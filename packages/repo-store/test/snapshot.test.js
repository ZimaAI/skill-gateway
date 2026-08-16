import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RepoStore } from '../src/index.js';
import { attachSkill, createCatalog, createScene, upsertSkill } from '../../core/src/index.js';

async function tempRepo() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skillgate-snap-'));
  return { dir, store: new RepoStore({ cwd: dir }) };
}

async function seedStore(store) {
  let catalog = await store.ensureCatalog();
  catalog = createScene(catalog, 'root', { name: '后端开发', description: '服务端', tags: 'backend' }, { id: 'backend' }).catalog;
  catalog = upsertSkill(catalog, 'db-schema-design', '旧描述', 100).catalog;
  catalog = upsertSkill(catalog, 'sql-query-review', '评审慢查询', 200).catalog;
  catalog = attachSkill(catalog, 'backend', 'db-schema-design').catalog;
  await store.saveCatalog(catalog);
  await store.saveSkillFiles('db-schema-design', { 'SKILL.md': '---\nname: db-schema-design\ndescription: 旧版\n---\n# v1' });
  await store.saveSkillFiles('sql-query-review', { 'SKILL.md': '---\nname: sql-query-review\ndescription: 评审\n---\n' });
  return catalog;
}

test('snapshots persist per slot and survive reopen; the newer snapshot replaces the older one', async (t) => {
  const { dir, store } = await tempRepo();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const catalog = await seedStore(store);

  const first = await store.saveSnapshot('organize', { catalog, batch: {} });
  assert.equal(first.slot, 'organize');
  const loaded = await store.loadSnapshot('organize');
  assert.equal(loaded.catalog.rootSceneId, 'root');
  assert.deepEqual(loaded.batch, { addedSkills: [], overwrittenSkills: [] });

  const reopened = new RepoStore({ cwd: dir });
  const afterReopen = await reopened.loadSnapshot('organize');
  assert.equal(afterReopen.catalog.scenes.backend.name, '后端开发');

  // The second snapshot for the same slot replaces the first.
  let changed = createScene(first.catalog, 'root', { name: '前端开发', description: '页面与交互', tags: 'frontend' }, { id: 'frontend' }).catalog;
  await store.saveSnapshot('organize', { catalog: changed, batch: {} });
  const latest = await store.loadSnapshot('organize');
  assert.ok(latest.catalog.scenes.frontend);
});

test('the two slots are independent: saving one does not replace the other', async (t) => {
  const { dir, store } = await tempRepo();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const catalog = await seedStore(store);

  await store.saveSnapshot('organize', { catalog, batch: {} });
  const upload = await store.saveSnapshot('upload', { catalog, batch: { addedSkills: ['brand-new'], overwrittenSkills: ['db-schema-design'] } });
  assert.equal(upload.slot, 'upload');

  const organize = await store.loadSnapshot('organize');
  const uploadLoaded = await store.loadSnapshot('upload');
  assert.ok(organize.catalog.scenes.backend);
  assert.deepEqual(uploadLoaded.batch.overwrittenSkills, ['db-schema-design']);
  assert.deepEqual(uploadLoaded.batch.addedSkills, ['brand-new']);
});

test('invalid slot names are rejected', async (t) => {
  const { dir, store } = await tempRepo();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await assert.rejects(() => store.saveSnapshot('nope', { catalog: {}, batch: {} }), /槽位/);
  await assert.rejects(() => store.rollbackSnapshot('nope'), /槽位/);
});

test('rollback with no snapshot fails cleanly', async (t) => {
  const { dir, store } = await tempRepo();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const result = await store.rollbackSnapshot('upload');
  assert.equal(result.ok, false);
  assert.match(result.error, /快照/);
});

test('upload-slot rollback restores the catalog, deletes added skill files, and restores overwritten originals', async (t) => {
  const { dir, store } = await tempRepo();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const preUpload = await seedStore(store);

  // Snapshot the pre-upload state, then simulate an upload: overwrite one
  // skill in place and add a new skill.
  await store.saveSnapshot('upload', {
    catalog: preUpload,
    batch: { addedSkills: ['brand-new'], overwrittenSkills: ['db-schema-design'] },
  });
  await store.backupSkillFiles('upload', 'db-schema-design');
  await store.saveSkillFiles('db-schema-design', { 'SKILL.md': '---\nname: db-schema-design\ndescription: 新版\n---\n# v2', 'extra.md': 'extra' });
  await store.saveSkillFiles('brand-new', { 'SKILL.md': '---\nname: brand-new\ndescription: 新技能\n---\n' });
  let postUpload = createScene(preUpload, 'root', { name: '前端开发', description: '页面与交互', tags: 'frontend' }, { id: 'frontend' }).catalog;
  postUpload = upsertSkill(postUpload, 'brand-new', '新技能', 300).catalog;
  postUpload = upsertSkill(postUpload, 'db-schema-design', '新版', 400).catalog;
  await store.saveCatalog(postUpload);

  const result = await store.rollbackSnapshot('upload');
  assert.equal(result.ok, true);
  assert.deepEqual(result.catalog, preUpload);
  assert.ok(result.affected.removedSkills.includes('brand-new'));
  assert.ok(result.affected.overwrittenSkills.includes('db-schema-design'));

  const restored = await store.loadSkillFiles('db-schema-design');
  assert.deepEqual(Object.keys(restored).sort(), ['SKILL.md']);
  assert.match(restored['SKILL.md'], /旧版/);

  const dataDir = await store.dataDir();
  const brandNewDir = path.join(dataDir, 'skills', 'brand-new');
  await assert.rejects(() => fs.access(brandNewDir));
});

test('organize-slot rollback restores the catalog only and never touches skill files', async (t) => {
  const { dir, store } = await tempRepo();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const before = await seedStore(store);

  await store.saveSnapshot('organize', { catalog: before, batch: {} });
  let organized = createScene(before, 'root', { name: '数据工程', description: '数据管道与仓库建模', tags: 'data' }, { id: 'data' }).catalog;
  organized = createScene(organized, 'data', { name: '子场景', description: '子场景说明', tags: [] }, { id: 'sub' }).catalog;
  organized = attachSkill(organized, 'data', 'sql-query-review').catalog;
  await store.saveCatalog(organized);

  const result = await store.rollbackSnapshot('organize');
  assert.equal(result.ok, true);
  assert.deepEqual(result.catalog, before);
  // The rollback removes the scenes the organize run had created.
  assert.ok(result.affected.scenesDeleted.some((scene) => scene.id === 'data'));

  const files = await store.loadSkillFiles('sql-query-review');
  assert.ok(files['SKILL.md']);
});

test('organize reports persist and load back', async (t) => {
  const { dir, store } = await tempRepo();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  assert.equal(await store.loadOrganizeReport(), null);

  const report = {
    mode: 'full',
    sessionId: 'session-1',
    startedAt: 100,
    endedAt: 200,
    summary: { scenesCreated: 2 },
    conflicts: ['场景 A 与场景 B 语义重叠'],
    duplicates: ['skill-x 与 skill-y 内容高度相似'],
    overwrites: ['db-schema-design'],
  };
  await store.saveOrganizeReport(report);
  const loaded = await new RepoStore({ cwd: dir }).loadOrganizeReport();
  assert.equal(loaded.mode, 'full');
  assert.deepEqual(loaded.duplicates, ['skill-x 与 skill-y 内容高度相似']);
});
