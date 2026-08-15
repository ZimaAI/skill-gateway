export const CATALOG_VERSION = 1;
export const SKILL_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
export const USAGE_SOURCES = Object.freeze(['gateway', 'agent-skills']);

export function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/**
 * @param {string} prefix
 * @param {() => number} [random]
 */
export function makeId(prefix, random = Math.random) {
  return `${prefix}_${random().toString(36).slice(2, 10)}`;
}

export function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return [...new Set(tags.map((tag) => String(tag ?? '').trim()).filter(Boolean))];
  }
  if (typeof tags === 'string') {
    return [...new Set(tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))];
  }
  return [];
}
