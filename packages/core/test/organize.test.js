import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOrganizeAction,
  attachSkill,
  createCatalog,
  createScene,
  diffCatalogs,
  moveScene,
  scenePath,
  unclassifiedSkills,
  updateScene,
  upsertSkill,
} from '../src/index.js';

function seedCatalog() {
  let result = createCatalog();
  result = createScene(result, 'root', { name: '后端开发', description: '服务端实现', tags: ['backend'] }, { id: 'backend' }).catalog;
  result = createScene(result, 'backend', { name: '数据库设计', description: '关系模型与索引', tags: ['database'] }, { id: 'database' }).catalog;
  result = createScene(result, 'root', { name: '前端开发', description: '页面与交互', tags: ['frontend'] }, { id: 'frontend' }).catalog;
  result = upsertSkill(result, 'db-schema-design', '设计关系表结构', 100).catalog;
  result = upsertSkill(result, 'sql-query-review', '评审慢查询', 200).catalog;
  result = attachSkill(result, 'database', 'db-schema-design').catalog;
  return result;
}

test('moveScene re-parents a scene and keeps the tree consistent', () => {
  const result = moveScene(seedCatalog(), 'database', 'frontend');
  assert.equal(result.ok, true);
  assert.equal(result.catalog.scenes.database.parentId, 'frontend');
  assert.deepEqual(result.catalog.scenes.frontend.children, ['database']);
  assert.deepEqual(result.catalog.scenes.backend.children, []);
  assert.equal(scenePath(result.catalog, 'database'), '工作台 / 前端开发 / 数据库设计');
});

test('moveScene rejects cycles, self-moves, root moves, and missing parents', () => {
  const catalog = seedCatalog();
  assert.equal(moveScene(catalog, 'backend', 'database').ok, false, '不能移动到自己的后代之下');
  assert.equal(moveScene(catalog, 'backend', 'backend').ok, false, '不能移动到自身');
  assert.equal(moveScene(catalog, 'root', 'backend').ok, false, '根场景不能移动');
  assert.equal(moveScene(catalog, 'backend', 'missing').ok, false, '父场景不存在');
  assert.equal(moveScene(catalog, 'missing', 'root').ok, false, '场景不存在');
});

test('createScene with requireDescription rejects empty or too-short descriptions', () => {
  const catalog = seedCatalog();
  const empty = createScene(catalog, 'root', { name: '新场景', description: '  ' }, { requireDescription: true });
  assert.equal(empty.ok, false);
  assert.match(empty.error, /description/);

  const short = createScene(catalog, 'root', { name: '新场景', description: '太短' }, { requireDescription: true });
  assert.equal(short.ok, false);
  assert.match(short.error, /详细/);

  const ok = createScene(catalog, 'root', { name: '新场景', description: '覆盖发布流程的详细场景说明', tags: ['release'] }, { requireDescription: true });
  assert.equal(ok.ok, true);
  assert.equal(ok.catalog.scenes[ok.sceneId].description, '覆盖发布流程的详细场景说明');
});

test('updateScene with requireDescription enforces the rule only when description changes', () => {
  const catalog = seedCatalog();
  const rewrite = updateScene(catalog, 'backend', { description: '太短' }, { requireDescription: true });
  assert.equal(rewrite.ok, false);

  const renameOnly = updateScene(catalog, 'backend', { name: '后端工程' }, { requireDescription: true });
  assert.equal(renameOnly.ok, true);
  assert.equal(renameOnly.catalog.scenes.backend.name, '后端工程');
});

test('applyOrganizeAction createScene requires a detailed description and unique name', () => {
  let catalog = seedCatalog();
  const missingDesc = applyOrganizeAction(catalog, 'createScene', { parentId: 'root', name: '数据工程', description: '数据管道' });
  assert.equal(missingDesc.ok, false);
  assert.match(missingDesc.error, /详细/);

  const duplicate = applyOrganizeAction(catalog, 'createScene', { parentId: 'root', name: '后端开发', description: '与已有场景重名，应当被拒绝的详细说明' });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /已存在/);

  const created = applyOrganizeAction(catalog, 'createScene', { parentId: 'root', name: '数据工程', description: '数据管道、仓库建模与批处理任务的场景' });
  assert.equal(created.ok, true);
  assert.equal(created.sceneId, created.result.sceneId);
  catalog = created.catalog;
  assert.equal(catalog.scenes[created.result.sceneId].name, '数据工程');
});

test('applyOrganizeAction updateScene rewrites descriptions and rejects non-scene fields', () => {
  const catalog = seedCatalog();
  const rewritten = applyOrganizeAction(catalog, 'updateScene', { sceneId: 'backend', description: '服务端实现与接口契约的更清晰边界说明' });
  assert.equal(rewritten.ok, true);
  assert.equal(rewritten.catalog.scenes.backend.description, '服务端实现与接口契约的更清晰边界说明');

  const skillField = applyOrganizeAction(catalog, 'updateScene', { sceneId: 'backend', skillName: 'db-schema-design', description: '试图改技能' });
  assert.equal(skillField.ok, false);
  assert.match(skillField.error, /技能/);
});

test('applyOrganizeAction deleteScene cascades and returns skills unlinked to unclassified', () => {
  const result = applyOrganizeAction(seedCatalog(), 'deleteScene', { sceneId: 'backend' });
  assert.equal(result.ok, true);
  assert.equal(result.catalog.scenes.backend, undefined);
  assert.equal(result.catalog.scenes.database, undefined);
  assert.deepEqual([...result.result.unlinkedSkills].sort(), ['db-schema-design']);
  const unclassified = unclassifiedSkills(result.catalog).map((skill) => skill.name);
  assert.ok(unclassified.includes('db-schema-design'));
  assert.ok(unclassified.includes('sql-query-review'));
});

test('applyOrganizeAction attach/detach move skills between scenes', () => {
  let catalog = seedCatalog();
  const attached = applyOrganizeAction(catalog, 'attachSkill', { sceneId: 'frontend', skillName: 'db-schema-design' });
  assert.equal(attached.ok, true);
  assert.deepEqual(attached.catalog.scenes.frontend.skills, ['db-schema-design']);

  const moved = applyOrganizeAction(attached.catalog, 'detachSkill', { sceneId: 'database', skillName: 'db-schema-design' });
  assert.equal(moved.ok, true);
  assert.deepEqual(moved.catalog.scenes.database.skills, []);
  // db-schema-design remains attached to 前端开发; only the never-attached skill is unclassified.
  assert.deepEqual(unclassifiedSkills(moved.catalog).map((skill) => skill.name), ['sql-query-review']);
});

test('applyOrganizeAction rejects skill deletion and unknown actions', () => {
  const catalog = seedCatalog();
  const deleted = applyOrganizeAction(catalog, 'deleteSkill', { skillName: 'db-schema-design' });
  assert.equal(deleted.ok, false);
  assert.match(deleted.error, /仅用户/);

  const unknown = applyOrganizeAction(catalog, 'explode', {});
  assert.equal(unknown.ok, false);
  assert.match(unknown.error, /未知/);
});

test('applyOrganizeAction moveScene is available and cycle-safe', () => {
  const catalog = seedCatalog();
  const moved = applyOrganizeAction(catalog, 'moveScene', { sceneId: 'database', parentId: 'frontend' });
  assert.equal(moved.ok, true);
  assert.equal(moved.catalog.scenes.database.parentId, 'frontend');

  const cycle = applyOrganizeAction(catalog, 'moveScene', { sceneId: 'backend', parentId: 'database' });
  assert.equal(cycle.ok, false);
  assert.match(cycle.error, /环|后代|自身/);
});

test('diffCatalogs reports scene and skill changes between two catalogs', () => {
  let before = seedCatalog();
  const after = applyOrganizeAction(before, 'updateScene', { sceneId: 'backend', name: '后端工程' }).catalog;
  let next = applyOrganizeAction(after, 'createScene', { parentId: 'root', name: '数据工程', description: '数据管道与仓库建模的场景' }).catalog;
  next = applyOrganizeAction(next, 'attachSkill', { sceneId: 'frontend', skillName: 'db-schema-design' }).catalog;

  const diff = diffCatalogs(before, next);
  assert.deepEqual(diff.scenesCreated, [{ id: next.scenes.root.children.find((id) => next.scenes[id].name === '数据工程'), name: '数据工程' }]);
  assert.deepEqual(diff.scenesRenamed, [{ id: 'backend', from: '后端开发', to: '后端工程' }]);
  assert.deepEqual(diff.scenesDeleted, []);
  assert.deepEqual(diff.attachChanges, [
    { sceneId: 'frontend', sceneName: '前端开发', skillName: 'db-schema-design', kind: 'attach' },
  ]);
  assert.deepEqual(diff.addedSkills, []);
  assert.deepEqual(diff.removedSkills, []);
});

test('diffCatalogs reports skill overwrites and deletions', () => {
  const before = seedCatalog();
  let next = { ...before, skills: { ...before.skills } };
  next.skills = {
    ...next.skills,
    'db-schema-design': { ...next.skills['db-schema-design'], description: '新描述', updatedAt: 999 },
  };
  delete next.skills['sql-query-review'];

  const diff = diffCatalogs(before, next);
  assert.deepEqual(diff.overwrittenSkills, ['db-schema-design']);
  assert.deepEqual(diff.removedSkills, ['sql-query-review']);
});
