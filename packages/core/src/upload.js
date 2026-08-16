import { SKILL_NAME_RE, clone } from './util.js';

/**
 * Upload validation and skill-only collection. The upload path intentionally
 * knows nothing about scenes: a selected folder is recursively scanned for
 * skill folders (a folder holding a direct SKILL.md), and folder structure is
 * otherwise ignored. Scene classification is an organize-session concern.
 */

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
/* Skill-only collection (upload preview and landing)                       */
/* ------------------------------------------------------------------------ */

function ensureDir(dirs, dirPath) {
  let node = dirs.get(dirPath);
  if (node) return node;
  node = new Map();
  dirs.set(dirPath, node);
  if (dirPath) {
    const parentPath = dirPath.includes('/') ? dirPath.slice(0, dirPath.lastIndexOf('/')) : '';
    ensureDir(dirs, parentPath);
  }
  return node;
}

function parentPath(filePath) {
  return filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';
}

function isInsideSkillDir(dirPath, skillDir) {
  if (skillDir === '') return true;
  return dirPath === skillDir || dirPath.startsWith(`${skillDir}/`);
}

function skillRelativePath(skillDir, filePath) {
  if (skillDir === '') return filePath;
  if (filePath === skillDir) return '';
  return filePath.slice(skillDir.length + 1);
}

function compareDepth(a, b) {
  const aDepth = a ? a.split('/').filter(Boolean).length : 0;
  const bDepth = b ? b.split('/').filter(Boolean).length : 0;
  return aDepth - bDepth || a.localeCompare(b, 'en');
}

/**
 * Collect every skill under an uploaded folder without any scene semantics.
 *
 * A folder is one skill exactly when SKILL.md sits directly inside it; the
 * folder's whole subtree is that skill's asset files (a nested SKILL.md is an
 * asset, not another skill). Folder structure produces no scenes and no
 * attachments. Any other file is reported as ignored. Any invalid skill
 * rejects the whole batch with per-item reasons.
 *
 * @param {{name?: string, files: Array<{path: string, content: string}>}|Array} input
 * @param {{rootPath?: string, rootName?: string}} [options] optional wrapper folder to strip
 */
export function collectUploadSkills(input, options = {}) {
  const source = Array.isArray(input) ? { files: input } : input || {};
  const name = String(source.name || '').trim() || null;
  const { files, reasons } = normalizeUploadPaths(source);
  if (reasons.length) {
    return { ok: false, reasons, name };
  }
  if (!files.length) {
    return { ok: false, reasons: ['文件夹为空。'], name };
  }

  // Strip an optional wrapper folder when every path sits under it.
  const requestedRoot = String((options.rootName || options.rootPath || '')).trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  let normalized = files;
  if (requestedRoot) {
    const wrapped = normalized.some(
      (file) => file.path === requestedRoot || file.path.startsWith(`${requestedRoot}/`),
    );
    if (wrapped) {
      normalized = normalized.map((file) => ({
        ...file,
        path: file.path === requestedRoot ? '' : file.path.slice(requestedRoot.length + 1),
      })).filter((file) => file.path);
    }
  }

  // Directory index: dirPath -> Map(filename -> content).
  const dirs = new Map();
  ensureDir(dirs, '');
  for (const file of normalized) {
    if (!file.path) continue;
    const parent = parentPath(file.path);
    const fileName = file.path.slice(parent ? parent.length + 1 : 0);
    ensureDir(dirs, parent);
    dirs.get(parent).set(fileName, file.content);
  }

  // Skill dirs: a dir with a direct SKILL.md that is not inside another skill
  // dir (classification stops at the first skill level).
  const skillDirs = [];
  for (const dirPath of [...dirs.keys()].sort(compareDepth)) {
    if (skillDirs.some((skillDir) => isInsideSkillDir(dirPath, skillDir))) continue;
    if (dirs.get(dirPath).has('SKILL.md')) skillDirs.push(dirPath);
  }

  const ignoredFiles = normalized
    .filter((file) => file.path && !skillDirs.some((skillDir) => isInsideSkillDir(parentPath(file.path), skillDir)))
    .map((file) => file.path)
    .sort();

  const skillReasons = [];
  const skills = [];
  for (const skillDir of skillDirs) {
    const label = skillDir ? `技能文件夹「${skillDir}」` : '根技能文件夹';
    const markdown = dirs.get(skillDir).get('SKILL.md');
    const parsed = parseFrontmatter(markdown);
    if (!parsed.ok) {
      skillReasons.push(`${label}：${parsed.reasons.join('；')}`);
      continue;
    }

    const skillName = String(parsed.fields.name || '').trim();
    const description = String(parsed.fields.description || '').trim();
    if (!skillName) {
      skillReasons.push(`${label}：frontmatter 缺少 name。`);
      continue;
    }
    if (!SKILL_NAME_RE.test(skillName)) {
      skillReasons.push(`${label}：name 不符合 [a-z0-9][a-z0-9-]*（小写字母、数字、连字符，且不能以连字符开头）。`);
      continue;
    }
    if (!description) {
      skillReasons.push(`${label}：frontmatter 缺少非空 description。`);
      continue;
    }

    const renderedFiles = {};
    let invalidContent = false;
    for (const file of normalized) {
      if (!file.path || !isInsideSkillDir(parentPath(file.path), skillDir)) continue;
      const rel = skillRelativePath(skillDir, file.path);
      if (typeof file.content !== 'string') {
        skillReasons.push(`${label}/${rel} 的内容必须是字符串。`);
        invalidContent = true;
        continue;
      }
      renderedFiles[rel] = file.content;
    }
    if (invalidContent) continue;
    skills.push({ name: skillName, description, files: renderedFiles });
  }

  if (skillReasons.length) {
    return { ok: false, reasons: skillReasons, name };
  }
  if (!skills.length) {
    return { ok: false, reasons: ['文件夹中没有找到任何技能（技能 = 含直接 SKILL.md 的文件夹）。'], name };
  }

  const fileCount = skills.reduce((total, skill) => total + Object.keys(skill.files).length, 0);
  return {
    ok: true,
    name,
    skills,
    ignoredFiles,
    fileCount,
    skillCount: skills.length,
  };
}

/**
 * Land collected skills into a catalog without touching the scene tree.
 *
 * Same-name skills are overwritten in place, preserving `createdAt` and any
 * existing scene attachments. Uploaded skills are unclassified: they are not
 * attached to any scene and gateway discovery ignores them.
 *
 * @param {object} catalog existing catalog (not mutated)
 * @param {Array<{name: string, description: string, files: object}>} skills
 * @param {number|(() => number)} [now]
 */
export function applyUploadToCatalog(catalog, skills, now = Date.now()) {
  if (!catalog || !catalog.scenes || !catalog.skills) return { ok: false, error: '目录无效。' };
  if (!Array.isArray(skills)) return { ok: false, error: 'skills 必须是数组。' };

  const next = clone(catalog);
  const timestamp = typeof now === 'function' ? now() : now;
  const added = [];
  const overwritten = [];

  for (const skill of skills) {
    const name = String(skill && skill.name || '').trim();
    if (!SKILL_NAME_RE.test(name)) {
      return { ok: false, error: `技能 name 不符合 [a-z0-9][a-z0-9-]*：${name}` };
    }
    const description = String(skill && skill.description || '').trim();
    if (!description) {
      return { ok: false, error: `技能 ${name} 的 description 不能为空。` };
    }

    const existing = next.skills[name];
    if (existing) overwritten.push(name);
    else added.push(name);
    next.skills[name] = {
      name,
      description,
      createdAt: existing ? existing.createdAt : timestamp,
      updatedAt: timestamp,
    };
  }

  return {
    ok: true,
    catalog: next,
    added: [...added].sort(),
    overwritten: [...overwritten].sort(),
  };
}
