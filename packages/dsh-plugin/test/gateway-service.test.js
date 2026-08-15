import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SkillGatewayService } from '../src/gateway-service.js';

async function tempService(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skillgate-service-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const service = new SkillGatewayService({ cwd: dir, now: () => 1234 });
  return { dir, service };
}

test('service state initializes a catalog and toggle defaults to on', async (t) => {
  const { service } = await tempService(t);
  const state = await service.state();
  assert.equal(state.ok, true);
  assert.equal(state.catalog.rootSceneId, 'root');
  assert.equal(state.config.enabled, true);
  assert.equal(state.usage.length, 0);
});

test('service upload validates, persists files, and rejects duplicate without confirmation', async (t) => {
  const { service } = await tempService(t);
  const item = {
    name: 'tdd',
    files: [{ path: 'SKILL.md', content: '---\nname: tdd\ndescription: test first\n---\n# TDD' }],
  };

  const first = await service.uploadSkill(undefined, item);
  assert.equal(first.ok, true);
  assert.equal(first.updated, false);

  const blocked = await service.uploadSkill(undefined, item);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.confirmRequired, true);

  const confirmed = await service.uploadSkill(undefined, item, { confirm: true });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.updated, true);
});

test('service uploadSceneTree persists scenes/skills and overwrites same-name skills', async (t) => {
  const { service } = await tempService(t);
  const item = {
    name: 'scene-tree',
    files: [
      { path: 'scene-tree/后端开发/数据库设计/SKILL.md', content: '---\nname: db-schema-design\ndescription: 第一版\n---\n# v1' },
      { path: 'scene-tree/后端开发/数据库设计/templates/init.sql', content: 'select 1;' },
      { path: 'scene-tree/前端开发/README.md', content: 'ignored' },
    ],
  };

  const first = await service.uploadSceneTree(undefined, item);
  assert.equal(first.ok, true);
  assert.equal(first.sceneCounts.created, 2);
  assert.equal(first.sceneCounts.reused, 0);
  assert.equal(first.skillsImported, 1);
  assert.equal(first.skillsCreated, 1);

  const loaded = await service.storeFor(undefined).loadSkillFiles('db-schema-design');
  assert.deepEqual(Object.keys(loaded).sort(), ['SKILL.md', 'templates/init.sql']);

  const second = await service.uploadSceneTree(undefined, {
    name: 'scene-tree',
    files: [
      { path: 'scene-tree/后端开发/数据库设计/SKILL.md', content: '---\nname: db-schema-design\ndescription: 第二版\n---\n# v2' },
      { path: 'scene-tree/后端开发/数据库设计/extra.md', content: 'extra' },
    ],
  });
  assert.equal(second.ok, true);
  assert.equal(second.sceneCounts.created, 0);
  assert.equal(second.sceneCounts.reused, 1);
  assert.equal(second.skillsUpdated, 1);
  assert.equal(second.skillsCreated, 0);

  const overwritten = await service.storeFor(undefined).loadSkillFiles('db-schema-design');
  assert.deepEqual(Object.keys(overwritten).sort(), ['SKILL.md', 'extra.md']);
  assert.match(overwritten['SKILL.md'], /第二版/);
});

test('service stats keeps the timeline session-scoped and globals workspace-scoped', async (t) => {
  const { service } = await tempService(t);
  const files = [{ path: 'SKILL.md', content: '---\nname: tdd\ndescription: test first\n---\n' }];
  await service.uploadSkill(undefined, { files });
  await service.recordAgentSkillUse(undefined, 'tdd', 's1');
  await service.recordAgentSkillUse(undefined, 'code-review', 's3');
  await service.load(undefined, 'tdd', '', 's2');

  const all = await service.stats();
  assert.equal(all.usage.length, 3);
  assert.equal(all.stats.total, 3);
  assert.equal(all.workspaceTotal, 3);

  const s1 = await service.stats(undefined, { sessionId: 's1' });
  assert.equal(s1.usage.length, 1);
  assert.equal(s1.sessionTotal, 1);
  // Globals are NOT session-filtered: tdd appears in s1 + s2, code-review in s3.
  assert.equal(s1.stats.total, 3);
  assert.deepEqual(s1.stats.skills.map((entry) => entry.skillName), ['tdd', 'code-review']);

  const gateway = await service.stats(undefined, { source: 'gateway' });
  assert.equal(gateway.usage.length, 1);
  assert.equal(gateway.stats.total, 1);
  assert.equal(gateway.usage[0].source, 'gateway');
});

test('service load records gateway usage and deleteSkill keeps history', async (t) => {
  const { service } = await tempService(t);
  await service.uploadSkill(undefined, {
    files: [{ path: 'SKILL.md', content: '---\nname: tdd\ndescription: test first\n---\n' }],
  });
  await service.attachSkill(undefined, 'root', 'tdd');

  const loaded = await service.load(undefined, 'tdd', '工作台', 's1');
  assert.equal(loaded.ok, true);
  assert.deepEqual(Object.keys(loaded.files), ['SKILL.md']);

  await service.deleteSkill(undefined, 'tdd');
  const state = await service.state();
  assert.equal(state.catalog.skills.tdd, undefined);
  assert.equal(state.usage.length, 1);
  assert.equal(state.stats.total, 1);
});
