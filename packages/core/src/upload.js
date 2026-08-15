import { SKILL_NAME_RE, clone, makeId } from './util.js';

/** Upload validation, scene-tree import, and SKILL.md frontmatter parsing. */

/* ------------------------------------------------------------------------ */
/* Upload validation                                                        */
/* ------------------------------------------------------------------------ */

/**
 * Parse the frontmatter used by standard SKILL.md files. The parser is
 * intentionally small: it reads scalar `key: value` fields from the first YAML
 * block. `name` and `description` are the fields skill-gate consumes.
 */
export function parseFrontmatter(markdown) {
  const match = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(markdown || '');
  if (!match) {
    return { ok: false, reasons: ['SKILL.md 缺少 frontmatter（需以 --- 开头和结束）。'] };
  }

  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }
  return { ok: true, fields };
}

function normalizeUploadPaths(input) {
  const reasons = [];
  const files = [];

  for (const file of input.files || []) {
    let raw = String(file.path || '');
    raw = raw.replace(/\\/g, '/').replace(/^\.\/+/, '');
    raw = raw.replace(/^\/+/, '');
    if (!raw || raw.endsWith('/')) continue;

    const segments = raw.split('/').filter((part) => part && part !== '.');
    if (segments.includes('..')) {
      reasons.push(`路径包含非法片段：${raw}`);
      continue;
    }
    files.push({ ...file, path: segments.join('/') });
  }
  return { files, reasons };
}

/**
 * Validate one uploaded skill folder.
 *
 * @param {{name?: string, files: Array<{path: string, content: string}>}|Array} input
 * @returns validation result. On success `skill` is `{name, description, files}`.
 */
export function validateUpload(input) {
  const source = Array.isArray(input) ? { files: input } : input || {};
  const displayName = source.name || null;
  const { files, reasons } = normalizeUploadPaths(source);
  const paths = files.map((file) => file.path);

  if (!paths.length) {
    return { ok: false, reasons: ['文件夹为空。'], name: displayName };
  }

  const firstSegments = [...new Set(paths.map((path) => path.split('/')[0]))];
  let root = '';
  let relativePaths = paths;

  if (!paths.includes('SKILL.md') && firstSegments.length === 1) {
    const candidate = firstSegments[0];
    if (paths.includes(`${candidate}/SKILL.md`)) {
      root = candidate;
      relativePaths = paths.map((path) => path.slice(candidate.length + 1));
    }
  }

  const rootSkillPaths = relativePaths.filter((path) => path === 'SKILL.md');
  if (rootSkillPaths.length !== 1) {
    reasons.push(`根目录必须且只能有 1 个 SKILL.md，当前 ${rootSkillPaths.length} 个。`);
  }

  if (reasons.length) {
    return { ok: false, reasons, name: displayName };
  }

  const relativeFor = (file) => {
    const path = file.path;
    return root ? (path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path) : path;
  };
  const skillFile = files.find((file) => relativeFor(file) === 'SKILL.md');
  const parsed = parseFrontmatter(skillFile && skillFile.content);

  if (!parsed.ok) {
    reasons.push(...parsed.reasons);
  } else {
    const name = String(parsed.fields.name || '').trim();
    const description = String(parsed.fields.description || '').trim();
    if (!name) {
      reasons.push('frontmatter 缺少 name。');
    } else if (!SKILL_NAME_RE.test(name)) {
      reasons.push('name 不符合 [a-z0-9][a-z0-9-]*（小写字母、数字、连字符，且不能以连字符开头）。');
    }
    if (!description) {
      reasons.push('frontmatter 缺少非空 description。');
    }
  }

  if (reasons.length) {
    return { ok: false, reasons, name: displayName };
  }

  const renderedFiles = {};
  for (const file of files) {
    const rel = relativeFor(file);
    if (!rel) continue;
    if (typeof file.content !== 'string') {
      reasons.push(`${rel} 的内容必须是字符串。`);
      continue;
    }
    renderedFiles[rel] = file.content;
  }

  if (reasons.length) {
    return { ok: false, reasons, name: displayName };
  }

  const parsedOk = parseFrontmatter(skillFile.content);
  const skill = {
    name: String(parsedOk.fields.name).trim(),
    description: String(parsedOk.fields.description).trim(),
    files: renderedFiles,
  };

  return { ok: true, skill, name: displayName };
}

/* ------------------------------------------------------------------------ */
/* Scene-tree upload                                                        */
/* ------------------------------------------------------------------------ */

function normalizeSceneTreeSource(input) {
  const source = Array.isArray(input) ? { files: input } : input || {};
  const name = String(source.name || '').trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  return { source, name };
}

function normalizeSceneTreeFiles(source, options = {}) {
  const reasons = [];
  const files = [];

  if (!Array.isArray(source.files)) {
    reasons.push('files 必须是数组。');
    return { files, reasons, root: '' };
  }

  for (const file of source.files) {
    let raw = String((file && file.path) || '');
    raw = raw.replace(/\\/g, '/').replace(/^\.\/+/, '');
    raw = raw.replace(/^\/+/, '');
    if (!raw) continue;

    const isDir = raw.endsWith('/');
    raw = raw.replace(/\/+$/, '');
    if (!raw) continue;

    const segments = raw.split('/').filter((part) => part && part !== '.');
    if (!segments.length) continue;
    if (segments.includes('..')) {
      reasons.push(`路径包含非法片段：${raw}`);
      continue;
    }
    files.push({ path: segments.join('/'), content: file.content, dir: isDir });
  }

  if (!files.length) {
    reasons.push('场景树文件夹为空。');
  }

  const paths = files.map((file) => file.path);
  const requestedRoot = String((options.rootName || options.rootPath || source.name || '')).trim()
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  let root = '';
  if (requestedRoot) {
    const wrapped = paths.some((filePath) => filePath === requestedRoot || filePath.startsWith(`${requestedRoot}/`));
    if (wrapped) {
      root = requestedRoot;
      const outside = paths.filter((filePath) => filePath !== root && !filePath.startsWith(`${root}/`));
      for (const filePath of outside) {
        reasons.push(`路径不在所选根文件夹「${root}」内：${filePath}`);
      }
    }
  }

  const relativeFiles = files.map((file) => {
    if (!root) return file;
    if (file.path === root) return { ...file, path: '' };
    if (file.path.startsWith(`${root}/`)) return { ...file, path: file.path.slice(root.length + 1) };
    return file;
  }).filter((file) => file.path !== '' || file.dir);

  return { files: relativeFiles, reasons, root };
}

function ensureDir(dirs, dirPath) {
  let node = dirs.get(dirPath);
  if (node) return node;
  node = { path: dirPath, files: new Map() };
  dirs.set(dirPath, node);
  if (dirPath) {
    const parentPath = dirPath.includes('/') ? dirPath.slice(0, dirPath.lastIndexOf('/')) : '';
    ensureDir(dirs, parentPath);
  }
  return node;
}

function buildSceneTreeFileIndex(files) {
  const dirs = new Map();
  ensureDir(dirs, '');
  const fileEntries = [];

  for (const file of files) {
    if (file.dir) {
      if (file.path) ensureDir(dirs, file.path);
      continue;
    }
    if (!file.path) continue;
    const parentPath = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
    const fileName = file.path.slice(parentPath ? parentPath.length + 1 : 0);
    ensureDir(dirs, parentPath);
    dirs.get(parentPath).files.set(fileName, file.content);
    fileEntries.push({ dirPath: parentPath, name: fileName, content: file.content });
  }

  return { dirs, fileEntries };
}

function compareScenePaths(a, b) {
  const aDepth = a ? a.split('/').filter(Boolean).length : 0;
  const bDepth = b ? b.split('/').filter(Boolean).length : 0;
  return aDepth - bDepth || a.localeCompare(b, 'en');
}

function skillParentSegments(skillDir) {
  if (!skillDir) return [];
  const segments = skillDir.split('/').filter(Boolean);
  return segments.slice(0, -1);
}

function isInsideSkillDir(dirPath, skillDir) {
  if (skillDir === '') return true;
  return dirPath === skillDir || dirPath.startsWith(`${skillDir}/`);
}

function skillRelativePath(skillDir, dirPath, fileName) {
  if (dirPath === skillDir) return fileName;
  if (skillDir === '') return `${dirPath}/${fileName}`;
  return `${dirPath.slice(skillDir.length + 1)}/${fileName}`;
}

function parseSceneTreeSkills(dirs, fileEntries, skillDirs) {
  const reasons = [];
  const skills = [];
  const sortedSkillDirs = [...skillDirs].sort(compareScenePaths);

  for (const skillDir of sortedSkillDirs) {
    const label = skillDir ? `技能文件夹「${skillDir}」` : '根技能文件夹';
    const markdown = dirs.get(skillDir).files.get('SKILL.md');
    const parsed = parseFrontmatter(markdown);

    if (!parsed.ok) {
      reasons.push(`${label}：${parsed.reasons.join('；')}`);
      continue;
    }

    const name = String(parsed.fields.name || '').trim();
    const description = String(parsed.fields.description || '').trim();
    if (!name) {
      reasons.push(`${label}：frontmatter 缺少 name。`);
      continue;
    }
    if (!SKILL_NAME_RE.test(name)) {
      reasons.push(`${label}：name 不符合 [a-z0-9][a-z0-9-]*（小写字母、数字、连字符，且不能以连字符开头）。`);
      continue;
    }
    if (!description) {
      reasons.push(`${label}：frontmatter 缺少非空 description。`);
      continue;
    }

    const renderedFiles = {};
    let invalidContent = false;
    for (const entry of fileEntries) {
      if (!isInsideSkillDir(entry.dirPath, skillDir)) continue;
      const rel = skillRelativePath(skillDir, entry.dirPath, entry.name);
      if (typeof entry.content !== 'string') {
        reasons.push(`${label}/${rel} 的内容必须是字符串。`);
        invalidContent = true;
        continue;
      }
      renderedFiles[rel] = entry.content;
    }

    if (invalidContent) continue;
    skills.push({
      folder: skillDir,
      parentPath: skillParentSegments(skillDir),
      name,
      description,
      files: renderedFiles,
    });
  }

  return { reasons, skills };
}

/**
 * Import an uploaded scene-tree folder into an existing catalog.
 *
 * The selected folder is treated as the scene-tree root. Every folder below
 * it is scanned recursively:
 * - a folder without a direct SKILL.md is a scene (the selected root maps to
 *   the existing catalog root);
 * - a folder with a direct SKILL.md is one skill and its whole subtree is
 *   imported as that skill's files (nested SKILL.md files are assets, not
 *   additional skills).
 *
 * Overlapping paths reuse existing scenes by name; same-name skills are
 * overwritten in place, preserving createdAt and existing scene attachments.
 *
 * @param {object} catalog existing catalog (not mutated)
 * @param {{name?: string, files: Array<{path: string, content: string}>}|Array} input
 * @param {{now?: number|(() => number), random?: () => number}} [options]
 */
export function importSceneTree(catalog, input, options = {}) {
  if (!catalog || !catalog.scenes || !catalog.skills || !catalog.rootSceneId || !catalog.scenes[catalog.rootSceneId]) {
    return { ok: false, error: '目录无效。' };
  }

  const { source, name } = normalizeSceneTreeSource(input);
  const normalized = normalizeSceneTreeFiles(source, {
    rootName: options.rootName,
    rootPath: options.rootPath,
  });
  if (normalized.reasons.length) {
    return { ok: false, reasons: normalized.reasons, name };
  }

  const { dirs, fileEntries } = buildSceneTreeFileIndex(normalized.files);

  // A folder is a skill only when SKILL.md sits directly inside it. Descendants
  // of a skill folder are assets, so classification stops at the first skill.
  const skillDirs = new Set();
  for (const dirPath of [...dirs.keys()].sort(compareScenePaths)) {
    if ([...skillDirs].some((skillDir) => isInsideSkillDir(dirPath, skillDir))) continue;
    if (dirs.get(dirPath).files.has('SKILL.md')) skillDirs.add(dirPath);
  }

  const sceneDirs = [...dirs.keys()]
    .filter((dirPath) => {
      if (skillDirs.has(dirPath)) return false;
      return ![...skillDirs].some((skillDir) => isInsideSkillDir(dirPath, skillDir));
    })
    .sort(compareScenePaths);

  const nonRootScenes = sceneDirs.filter((dirPath) => dirPath !== '');
  if (!skillDirs.size && !nonRootScenes.length) {
    return { ok: false, reasons: ['场景树中没有可导入的场景或技能。'], name };
  }

  const ignoredFiles = fileEntries
    .filter((entry) => sceneDirs.includes(entry.dirPath))
    .map((entry) => (entry.dirPath ? `${entry.dirPath}/${entry.name}` : entry.name))
    .sort();

  const parsed = parseSceneTreeSkills(dirs, fileEntries, skillDirs);
  if (parsed.reasons.length) {
    return { ok: false, reasons: parsed.reasons, name };
  }

  const next = clone(catalog);
  const timestamp = options.now === undefined
    ? Date.now()
    : (typeof options.now === 'function' ? options.now() : options.now);
  const scenesCreated = [];
  const createdSceneIds = new Set();
  const scenesReused = new Set();
  let mergeError = null;

  const ensureScenePath = (segments) => {
    let parent = next.scenes[next.rootSceneId];
    for (let index = 0; index < segments.length; index += 1) {
      const segment = String(segments[index] || '').trim();
      if (!segment) {
        mergeError = `上传路径包含空场景名称：${segments.join(' / ')}`;
        return null;
      }
      const childId = (parent.children || []).find((id) => next.scenes[id] && next.scenes[id].name === segment);
      if (childId) {
        if (!createdSceneIds.has(childId)) scenesReused.add(childId);
        parent = next.scenes[childId];
        continue;
      }

      const duplicate = Object.values(next.scenes).find((scene) => scene.name === segment);
      if (duplicate) {
        const pathText = segments.slice(0, index + 1).join(' / ');
        mergeError = `场景名称已存在但不在上传路径中：${segment}（上传路径 ${pathText}，现有场景 ${duplicate.id}）。`;
        return null;
      }

      let id;
      do {
        id = makeId('scene', options.random);
      } while (next.scenes[id]);

      const scene = {
        id,
        name: segment,
        description: '',
        tags: [],
        parentId: parent.id,
        children: [],
        skills: [],
      };
      next.scenes[id] = scene;
      if (!parent.children) parent.children = [];
      parent.children.push(id);
      scenesCreated.push(id);
      createdSceneIds.add(id);
      parent = scene;
    }
    return parent;
  };

  // Materialize every non-root scene first so scenes that contain only
  // ignored/empty folders are still represented in the catalog.
  for (const dirPath of nonRootScenes) {
    const targetScene = ensureScenePath(dirPath.split('/').filter(Boolean));
    if (!targetScene) {
      return { ok: false, reasons: [mergeError], name };
    }
  }

  const originalSkillNames = new Set(Object.keys(catalog.skills || {}));
  const importedSkillNames = new Set();
  const updatedSkillNames = new Set();
  const mergedSkills = new Map();

  for (const skill of parsed.skills) {
    const targetScene = ensureScenePath(skill.parentPath);
    if (!targetScene) {
      return { ok: false, reasons: [mergeError], name };
    }

    importedSkillNames.add(skill.name);
    const existing = next.skills[skill.name];
    if (existing) updatedSkillNames.add(skill.name);
    next.skills[skill.name] = {
      name: skill.name,
      description: skill.description,
      createdAt: existing ? existing.createdAt : timestamp,
      updatedAt: timestamp,
    };
    if (!targetScene.skills) targetScene.skills = [];
    if (!targetScene.skills.includes(skill.name)) targetScene.skills.push(skill.name);
    mergedSkills.set(skill.name, skill);
  }

  const skills = [...mergedSkills.values()].map((skill) => ({
    name: skill.name,
    description: skill.description,
    files: skill.files,
  }));
  const fileCount = skills.reduce((total, skill) => total + Object.keys(skill.files).length, 0);

  return {
    ok: true,
    catalog: next,
    name,
    scenesCreated,
    scenesReused: [...scenesReused].sort(),
    sceneCounts: { created: scenesCreated.length, reused: scenesReused.size },
    skills,
    skillNames: [...importedSkillNames].sort(),
    skillsImported: skills.length,
    skillsCreated: [...importedSkillNames].filter((skillName) => !originalSkillNames.has(skillName)).length,
    skillsUpdated: [...updatedSkillNames].filter((skillName) => originalSkillNames.has(skillName)).length,
    fileCount,
    ignoredFiles,
  };
}

/** Alias for callers that prefer upload terminology. */
export const uploadSceneTree = importSceneTree;

/** Alias for callers that prefer merge terminology. */
export const mergeSceneTree = importSceneTree;
