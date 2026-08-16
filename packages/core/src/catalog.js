import { CATALOG_VERSION, SKILL_NAME_RE, clone, makeId, normalizeTags } from './util.js';
import { scenePath } from './matching.js';

export function createCatalog(options = {}) {
  const rootId = options.rootSceneId || 'root';
  const root = {
    id: rootId,
    name: options.rootName || '工作台',
    description: options.rootDescription || '所有场景的单一根节点，场景树从这里展开。',
    tags: normalizeTags(options.rootTags ?? ['workspace']),
    parentId: null,
    children: [],
    skills: [],
  };
  return {
    version: CATALOG_VERSION,
    rootSceneId: rootId,
    scenes: { [rootId]: root },
    skills: {},
  };
}

function normalizeSceneInput(input = {}) {
  return {
    name: typeof input.name === 'string' ? input.name.trim() : '',
    description: typeof input.description === 'string' ? input.description.trim() : '',
    tags: input.tags === undefined ? undefined : normalizeTags(input.tags),
  };
}

/** Minimum meaningful scene description length when description is required. */
export const MIN_SCENE_DESCRIPTION_LENGTH = 8;

function descriptionError(description, options = {}) {
  if (!options.requireDescription) return null;
  const min = Number.isFinite(options.minDescriptionLength)
    ? Math.max(1, Math.floor(options.minDescriptionLength))
    : MIN_SCENE_DESCRIPTION_LENGTH;
  if (!description) {
    return `场景 description 必填，需详细描述场景作用。`;
  }
  if (description.length < min) {
    return `场景 description 过短（至少 ${min} 个字符），需详细描述场景作用。`;
  }
  return null;
}

function sceneNameExists(catalog, name, excludeId) {
  return Object.values(catalog.scenes || {}).some(
    (scene) => scene.name === name && scene.id !== excludeId,
  );
}

/**
 * Create a scene below `parentId`. The returned catalog is a new value; the
 * input catalog is not modified.
 */
export function createScene(catalog, parentId, input = {}, options = {}) {
  if (!catalog || !catalog.scenes || !catalog.rootSceneId) {
    return { ok: false, error: '目录无效。' };
  }
  const next = clone(catalog);
  const parent = next.scenes[parentId];
  if (!parent) return { ok: false, error: '父场景不存在。' };

  const draft = normalizeSceneInput(input);
  if (!draft.name) return { ok: false, error: '场景名称不能为空。' };

  const descriptionProblem = descriptionError(draft.description, options);
  if (descriptionProblem) return { ok: false, error: descriptionProblem };

  if (sceneNameExists(next, draft.name)) {
    return { ok: false, error: `场景名称已存在：${draft.name}` };
  }

  let id = options.id || input.id;
  if (!id) {
    do {
      id = makeId('scene', options.random);
    } while (next.scenes[id]);
  } else if (next.scenes[id]) {
    return { ok: false, error: `场景 id 已存在：${id}` };
  }

  const scene = {
    id,
    name: draft.name,
    description: draft.description,
    tags: draft.tags || [],
    parentId,
    children: [],
    skills: [],
  };
  next.scenes[id] = scene;
  parent.children.push(id);
  return { ok: true, catalog: next, sceneId: id };
}

export function updateScene(catalog, sceneId, input = {}, options = {}) {
  if (!catalog || !catalog.scenes) return { ok: false, error: '目录无效。' };
  const next = clone(catalog);
  const scene = next.scenes[sceneId];
  if (!scene) return { ok: false, error: '场景不存在。' };

  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) return { ok: false, error: '场景名称不能为空。' };
    if (sceneNameExists(next, name, sceneId)) {
      return { ok: false, error: `场景名称已存在：${name}` };
    }
    scene.name = name;
  }
  if (input.description !== undefined) {
    const description = String(input.description).trim();
    const descriptionProblem = descriptionError(description, options);
    if (descriptionProblem) return { ok: false, error: descriptionProblem };
    scene.description = description;
  }
  if (input.tags !== undefined) scene.tags = normalizeTags(input.tags);

  return { ok: true, catalog: next };
}

export function collectDescendants(catalog, sceneId) {
  const ids = [];
  const queue = [sceneId];
  const seen = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const scene = catalog.scenes && catalog.scenes[id];
    if (!scene) continue;
    ids.push(id);
    queue.push(...(scene.children || []));
  }
  return ids;
}

/**
 * Delete a scene and its descendants. Skills are only unlinked by the removal
 * of the scene objects themselves; their metadata and files survive.
 */
export function deleteScene(catalog, sceneId) {
  if (!catalog || !catalog.scenes) return { ok: false, error: '目录无效。' };
  if (sceneId === catalog.rootSceneId) return { ok: false, error: '根场景不能删除。' };

  const next = clone(catalog);
  if (!next.scenes[sceneId]) return { ok: false, error: '场景不存在。' };

  const deletedIds = collectDescendants(next, sceneId);
  const parent = next.scenes[next.scenes[sceneId].parentId];
  if (parent) {
    parent.children = parent.children.filter((id) => id !== sceneId);
  }
  for (const id of deletedIds) delete next.scenes[id];
  return { ok: true, catalog: next, deletedIds };
}

/**
 * Re-parent a scene below `parentId`. Cycles (moving a scene under itself or
 * one of its descendants) and root moves are rejected.
 */
export function moveScene(catalog, sceneId, parentId) {
  if (!catalog || !catalog.scenes) return { ok: false, error: '目录无效。' };
  if (sceneId === catalog.rootSceneId) return { ok: false, error: '根场景不能移动。' };
  const next = clone(catalog);
  const scene = next.scenes[sceneId];
  if (!scene) return { ok: false, error: '场景不存在。' };
  const parent = next.scenes[parentId];
  if (!parent) return { ok: false, error: '父场景不存在。' };
  if (parentId === sceneId) return { ok: false, error: '不能移动到自身。' };
  if (collectDescendants(next, sceneId).includes(parentId)) {
    return { ok: false, error: '不能移动到自己的后代场景之下。' };
  }

  const oldParent = next.scenes[scene.parentId];
  if (oldParent) {
    oldParent.children = (oldParent.children || []).filter((id) => id !== sceneId);
  }
  scene.parentId = parentId;
  if (!parent.children) parent.children = [];
  if (!parent.children.includes(sceneId)) parent.children.push(sceneId);
  return { ok: true, catalog: next };
}

/**
 * Skills referenced by no scene — uploaded-but-unclassified skills and skills
 * unlinked by scene deletion or detach. Gateway discovery never returns them.
 */
export function unclassifiedSkills(catalog) {
  if (!catalog || !catalog.scenes || !catalog.skills) return [];
  const referenced = new Set();
  for (const scene of Object.values(catalog.scenes)) {
    for (const name of scene.skills || []) referenced.add(name);
  }
  return Object.values(catalog.skills)
    .filter((skill) => !referenced.has(skill.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/**
 * Structured change summary between two catalog values. Used by organize
 * reports and rollback responses.
 */
export function diffCatalogs(before, after) {
  const beforeScenes = (before && before.scenes) || {};
  const afterScenes = (after && after.scenes) || {};
  const beforeSkills = (before && before.skills) || {};
  const afterSkills = (after && after.skills) || {};

  const addedSkills = [];
  const removedSkills = [];
  const overwrittenSkills = [];
  for (const [name, skill] of Object.entries(afterSkills)) {
    if (!beforeSkills[name]) addedSkills.push(name);
    else if (
      beforeSkills[name].description !== skill.description ||
      beforeSkills[name].updatedAt !== skill.updatedAt
    ) {
      overwrittenSkills.push(name);
    }
  }
  for (const name of Object.keys(beforeSkills)) {
    if (!afterSkills[name]) removedSkills.push(name);
  }

  const scenesCreated = [];
  const scenesDeleted = [];
  const scenesRenamed = [];
  const scenesChanged = [];
  for (const [id, scene] of Object.entries(afterScenes)) {
    if (!beforeScenes[id]) {
      scenesCreated.push({ id, name: scene.name });
      continue;
    }
    const previous = beforeScenes[id];
    const fields = [];
    if (previous.name !== scene.name) {
      scenesRenamed.push({ id, from: previous.name, to: scene.name });
      fields.push('name');
    }
    if (previous.description !== scene.description) fields.push('description');
    if (JSON.stringify(previous.tags || []) !== JSON.stringify(scene.tags || [])) fields.push('tags');
    if (previous.parentId !== scene.parentId) fields.push('parent');
    if (fields.length) scenesChanged.push({ id, name: scene.name, fields });
  }
  for (const [id, scene] of Object.entries(beforeScenes)) {
    if (!afterScenes[id]) scenesDeleted.push({ id, name: scene.name });
  }

  const attachChanges = [];
  for (const [id, scene] of Object.entries(afterScenes)) {
    const previous = beforeScenes[id];
    if (!previous) continue;
    const beforeSet = new Set(previous.skills || []);
    for (const skillName of scene.skills || []) {
      if (!beforeSet.has(skillName)) {
        attachChanges.push({ sceneId: id, sceneName: scene.name, skillName, kind: 'attach' });
      }
    }
    for (const skillName of previous.skills || []) {
      if (!(scene.skills || []).includes(skillName)) {
        attachChanges.push({ sceneId: id, sceneName: scene.name, skillName, kind: 'detach' });
      }
    }
  }

  return {
    addedSkills: [...addedSkills].sort(),
    removedSkills: [...removedSkills].sort(),
    overwrittenSkills: [...overwrittenSkills].sort(),
    scenesCreated: scenesCreated.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    scenesDeleted: scenesDeleted.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    scenesRenamed: scenesRenamed.sort((a, b) => a.id.localeCompare(b.id)),
    scenesChanged: scenesChanged.sort((a, b) => a.id.localeCompare(b.id)),
    attachChanges: attachChanges.sort(
      (a, b) => a.sceneId.localeCompare(b.sceneId) || a.skillName.localeCompare(b.skillName),
    ),
  };
}

export function attachSkill(catalog, sceneId, skillName) {
  if (!catalog || !catalog.scenes) return { ok: false, error: '目录无效。' };
  const next = clone(catalog);
  const scene = next.scenes[sceneId];
  if (!scene) return { ok: false, error: '场景不存在。' };
  if (!next.skills[skillName]) return { ok: false, error: '技能不存在。' };

  if (!scene.skills.includes(skillName)) {
    scene.skills.push(skillName);
    return { ok: true, catalog: next, added: true };
  }
  return { ok: true, catalog: next, added: false };
}

export function detachSkill(catalog, sceneId, skillName) {
  if (!catalog || !catalog.scenes) return { ok: false, error: '目录无效。' };
  const next = clone(catalog);
  const scene = next.scenes[sceneId];
  if (!scene) return { ok: false, error: '场景不存在。' };

  const before = (scene.skills || []).length;
  scene.skills = (scene.skills || []).filter((name) => name !== skillName);
  return { ok: true, catalog: next, removed: scene.skills.length !== before };
}

export function upsertSkill(catalog, name, description, now = Date.now()) {
  if (!catalog || !catalog.scenes || !catalog.skills) return { ok: false, error: '目录无效。' };
  const trimmedName = String(name || '').trim();
  if (!SKILL_NAME_RE.test(trimmedName)) {
    return { ok: false, error: '技能 name 不符合 [a-z0-9][a-z0-9-]*。' };
  }
  const trimmedDescription = String(description || '').trim();
  if (!trimmedDescription) return { ok: false, error: '技能 description 不能为空。' };

  const next = clone(catalog);
  const existing = next.skills[trimmedName];
  const timestamp = typeof now === 'function' ? now() : now;
  next.skills[trimmedName] = {
    name: trimmedName,
    description: trimmedDescription,
    createdAt: existing ? existing.createdAt : timestamp,
    updatedAt: timestamp,
  };
  return { ok: true, catalog: next, updated: Boolean(existing) };
}

/**
 * Delete skill metadata and unlink the skill from every scene. Removing the
 * skill folder and retaining historical usage are adapter responsibilities.
 */
export function deleteSkill(catalog, skillName) {
  if (!catalog || !catalog.scenes || !catalog.skills) return { ok: false, error: '目录无效。' };
  const next = clone(catalog);
  if (!next.skills[skillName]) return { ok: false, error: '技能不存在。' };

  delete next.skills[skillName];
  for (const scene of Object.values(next.scenes)) {
    scene.skills = (scene.skills || []).filter((name) => name !== skillName);
  }
  return { ok: true, catalog: next };
}

/* ------------------------------------------------------------------------ */
/* Catalog convenience helpers                                              */
/* ------------------------------------------------------------------------ */

export function skillPaths(catalog, skillName) {
  return Object.values((catalog && catalog.scenes) || {})
    .filter((scene) => (scene.skills || []).includes(skillName))
    .map((scene) => scenePath(catalog, scene.id));
}

export function getScene(catalog, sceneId) {
  return catalog && catalog.scenes ? catalog.scenes[sceneId] || null : null;
}

export function getSkill(catalog, skillName) {
  return catalog && catalog.skills ? catalog.skills[skillName] || null : null;
}
