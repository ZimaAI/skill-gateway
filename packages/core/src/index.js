/**
 * @skill-gate/core
 *
 * Framework-free, plain-JSON domain core for the skill gateway.
 *
 * Every public function treats its inputs as immutable data. Mutating helpers
 * return the next catalog/usage value instead of changing the input in place.
 */

export {
  CATALOG_VERSION,
  SKILL_NAME_RE,
  USAGE_SOURCES,
  clone,
  makeId,
  normalizeTags,
} from './util.js';
export {
  MIN_SCENE_DESCRIPTION_LENGTH,
  attachSkill,
  collectDescendants,
  createCatalog,
  createScene,
  deleteScene,
  deleteSkill,
  detachSkill,
  diffCatalogs,
  getScene,
  getSkill,
  moveScene,
  skillPaths,
  unclassifiedSkills,
  updateScene,
  upsertSkill,
} from './catalog.js';
export {
  browse,
  collectSubtree,
  find,
  loadSkillFiles,
  loadSkill,
  normalize,
  sceneMatchScore,
  scenePath,
  skillMatchScore,
  tokenize,
} from './matching.js';
export {
  applyUploadToCatalog,
  collectUploadSkills,
  parseFrontmatter,
  validateUpload,
} from './upload.js';
export { applyOrganizeAction, ORGANIZE_ACTIONS } from './organize.js';
export { aggregateUsage, recordUsage } from './usage.js';
