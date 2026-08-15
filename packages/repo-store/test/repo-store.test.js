import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RepoStore, resolveDataDir } from '../src/index.js';
import { createCatalog, createScene, upsertSkill } from '../../core/src/index.js';

async function tempRepo() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skillgate-store-'));
  return { dir, store: new RepoStore({ cwd: dir }) };
}

test('defaults to <cwd>/.skillgate and initializes a valid catalog', async (t) => {
  const { dir, store } = await tempRepo();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  assert.equal(await resolveDataDir(dir), path.join(dir, '.skillgate'));
  const catalog = await store.ensureCatalog();
  assert.equal(catalog.rootSceneId, 'root');
  assert.ok(catalog.scenes.root);

  const loaded = await store.loadCatalog();
  assert.equal(loaded.rootSceneId, 'root');
});

test('catalog and config write/read back after a fresh store instance', async (t) => {
  const { dir, store } = await tempRepo();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  let catalog = await store.ensureCatalog();
  catalog = createScene(catalog, 'root', { name: '后端开发', description: '服务端', tags: 'backend, server' }, { id: 'backend' }).catalog;
  await store.saveCatalog(catalog);
  await store.saveConfig({ enabled: false });

  const reopened = new RepoStore({ cwd: dir });
  assert.equal((await reopened.loadConfig()).enabled, false);
  const loaded = await reopened.loadCatalog();
  assert.equal(loaded.scenes.backend.name, '后端开发');
  assert.deepEqual(loaded.scenes.backend.tags, ['backend', 'server']);
});

test('usage appends survive reopen, merge by id, and sort by timestamp', async (t) => {
  const { dir, store } = await tempRepo();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  await store.appendUsage([
    { id: 'u2', skillName: 'code-review', source: 'agent-skills', timestamp: 200, sessionId: 's1' },
    { id: 'u1', skillName: 'tdd', source: 'gateway', scenePath: '工作台 / 工程质量', timestamp: 100, sessionId: 's1' },
  ]);
  const duplicate = await store.appendUsage({
    id: 'u1',
    skillName: 'tdd',
    source: 'gateway',
    timestamp: 100,
    sessionId: 's1',
  });
  assert.equal(duplicate.appended, 0);

  const reopened = new RepoStore({ cwd: dir });
  const usage = await reopened.loadUsage();
  assert.equal(usage.length, 2);
  assert.deepEqual(usage.map((r) => r.id), ['u1', 'u2']);
  assert.equal(usage[0].scenePath, '工作台 / 工程质量');
});

test('concurrent appends from two store instances merge without loss', async (t) => {
  const { dir, store } = await tempRepo();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  const other = new RepoStore({ cwd: dir });
  await Promise.all([
    store.appendUsage({ id: 'a', skillName: 'tdd', source: 'gateway', timestamp: 1 }),
    other.appendUsage({ id: 'b', skillName: 'code-review', source: 'agent-skills', timestamp: 2 }),
    other.appendUsage({ id: 'c', skillName: 'tdd', source: 'gateway', timestamp: 3 }),
  ]);

  const usage = await store.loadUsage();
  assert.equal(usage.length, 3);
  assert.deepEqual(new Set(usage.map((r) => r.id)), new Set(['a', 'b', 'c']));
});

test('skill files are written verbatim and deleted as a folder', async (t) => {
  const { dir, store } = await tempRepo();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  await store.saveSkillFiles('tdd', {
    'SKILL.md': '---\nname: tdd\ndescription: test first\n---\n# TDD',
    'examples/flow.md': '# flow',
  });
  const files = await store.loadSkillFiles('tdd');
  assert.deepEqual(Object.keys(files).sort(), ['SKILL.md', 'examples/flow.md']);
  assert.match(files['SKILL.md'], /name: tdd/);

  await store.deleteSkillFiles('tdd');
  assert.equal(await store.loadSkillFiles('tdd'), null);
});

test('an anchor file points to a custom location and relocate preserves usage and skills', async (t) => {
  const { dir, store } = await tempRepo();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  let catalog = createCatalog();
  catalog = upsertSkill(catalog, 'tdd', 'test first', 100).catalog;
  await store.saveCatalog(catalog);
  await store.appendUsage({ id: 'u1', skillName: 'tdd', source: 'gateway', timestamp: 100 });
  await store.saveSkillFiles('tdd', { 'SKILL.md': '---\nname: tdd\ndescription: test first\n---\n' });

  const moved = await store.relocate('data/custom-skillgate');
  assert.equal(moved.dataDir, path.join(dir, 'data/custom-skillgate'));
  assert.equal(await resolveDataDir(dir), moved.dataDir);
  assert.equal((await store.loadUsage())[0].skillName, 'tdd');
  assert.ok(await store.loadSkillFiles('tdd'));
  const reloadedCatalog = await store.loadCatalog();
  assert.equal(reloadedCatalog.skills.tdd.name, 'tdd');
});
