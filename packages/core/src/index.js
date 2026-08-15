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
  attachSkill,
  collectDescendants,
  createCatalog,
  createScene,
  deleteScene,
  deleteSkill,
  detachSkill,
  getScene,
  getSkill,
  skillPaths,
  updateScene,
  upsertSkill,
} from './catalog.js';
export {
  browse,
  collectSubtree,
  find,
  loadSkill,
  loadSkillFiles,
  normalize,
  sceneMatchScore,
  scenePath,
  skillMatchScore,
  tokenize,
} from './matching.js';
export { importSceneTree, mergeSceneTree, parseFrontmatter, uploadSceneTree, validateUpload } from './upload.js';
export { aggregateUsage, recordUsage } from './usage.js';
