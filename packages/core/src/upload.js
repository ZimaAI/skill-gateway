import { SKILL_NAME_RE } from './util.js';

/** Upload validation and SKILL.md frontmatter parsing. */

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
 * Validate one uploaded skill folder/zip.
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
    return { ok: false, reasons: ['压缩包或文件夹为空。'], name: displayName };
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
