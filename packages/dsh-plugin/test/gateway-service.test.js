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
  assert.deepEqual(state.config.session, {
    mode: '',
    provider: '',
    model: '',
    reasoningEffort: '',
    permission: '',
  });
  assert.equal(state.usage.length, 0);
});

test('service saves workspace session defaults and toggle preserves them', async (t) => {
  const { service } = await tempService(t);
  const saved = await service.saveSessionConfig(undefined, {
    mode: 'code',
    provider: 'deepseek',
    model: 'deepseek-chat',
    reasoningEffort: 'high',
    permission: 'workspace-write',
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.session.mode, 'code');
  assert.equal(saved.session.model, 'deepseek-chat');

  const toggled = await service.setEnabled(undefined, false);
  assert.equal(toggled.ok, true);
  assert.equal(toggled.config.enabled, false);
  assert.equal(toggled.config.session.mode, 'code');
  assert.equal(toggled.config.session.reasoningEffort, 'high');

  const reopened = await service.getSessionConfig(undefined);
  assert.equal(reopened.permission, 'workspace-write');
});

test('service upload persists skills unclassified and reports added/overwritten/ignored', async (t) => {
  const { service } = await tempService(t);
  const item = {
    name: 'skills-folder',
    files: [
      { path: '后端开发/数据库设计/SKILL.md', content: '---\nname: db-schema-design\ndescription: 数据库设计\n---\n# v1' },
      { path: '后端开发/数据库设计/templates/init.sql', content: 'select 1;' },
      { path: '前端/README.md', content: 'ignored' },
    ],
  };

  const first = await service.upload(undefined, item);
  assert.equal(first.ok, true);
  assert.deepEqual(first.added, ['db-schema-design']);
  assert.deepEqual(first.overwritten, []);
  assert.deepEqual(first.ignoredFiles, ['前端/README.md']);
  assert.equal(first.fileCount, 2);

  const loaded = await service.storeFor(undefined).loadSkillFiles('db-schema-design');
  assert.deepEqual(Object.keys(loaded).sort(), ['SKILL.md', 'templates/init.sql']);

  const state = await service.state();
  assert.deepEqual(state.catalog.scenes.root.skills, []);
  assert.deepEqual(Object.keys(state.catalog.skills), ['db-schema-design']);

  const second = await service.upload(undefined, {
    name: 'skills-folder',
    files: [
      { path: 'db-schema-design/SKILL.md', content: '---\nname: db-schema-design\ndescription: 第二版\n---\n# v2' },
      { path: 'db-schema-design/extra.md', content: 'extra' },
      { path: 'brand-new/SKILL.md', content: '---\nname: brand-new\ndescription: 全新技能\n---\n' },
    ],
  });
  assert.equal(second.ok, true);
  assert.deepEqual(second.added, ['brand-new']);
  assert.deepEqual(second.overwritten, ['db-schema-design']);

  const overwritten = await service.storeFor(undefined).loadSkillFiles('db-schema-design');
  assert.deepEqual(Object.keys(overwritten).sort(), ['SKILL.md', 'extra.md']);
  assert.match(overwritten['SKILL.md'], /第二版/);

  // Uploaded skills land unclassified: no scene attachment, visible to the
  // unclassified query, invisible to browse.
  const unclassified = await service.unclassified(undefined);
  assert.deepEqual(unclassified.skills.map((skill) => skill.name), ['brand-new', 'db-schema-design']);
  const browse = await service.browse(undefined, 'root');
  assert.deepEqual(browse.skills, []);
});

test('service upload rejects the whole batch when any skill is invalid and keeps the catalog untouched', async (t) => {
  const { service } = await tempService(t);
  const result = await service.upload(undefined, {
    name: 'bad',
    files: [
      { path: 'good/SKILL.md', content: '---\nname: good\ndescription: fine\n---\n' },
      { path: 'bad/SKILL.md', content: '---\nname: Bad Name\ndescription: x\n---\n' },
    ],
  });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' '), /name 不符合/);
  const state = await service.state();
  assert.deepEqual(Object.keys(state.catalog.skills), []);
});

test('service upload snapshots the upload slot with the pre-upload catalog and batch', async (t) => {
  const { service } = await tempService(t);
  const item = {
    name: 'folder',
    files: [
      { path: 'a/SKILL.md', content: '---\nname: skill-a\ndescription: 技能甲\n---\n' },
      { path: 'b/SKILL.md', content: '---\nname: skill-b\ndescription: 技能乙\n---\n' },
    ],
  };
  const first = await service.upload(undefined, item);
  assert.equal(first.ok, true);

  const snapshot = await service.storeFor(undefined).loadSnapshot('upload');
  assert.equal(snapshot.slot, 'upload');
  assert.deepEqual(snapshot.batch.addedSkills, ['skill-a', 'skill-b']);
  assert.deepEqual(Object.keys(snapshot.catalog.skills), []);
});

test('service rollback restores the pre-upload catalog and deletes uploaded skill files', async (t) => {
  const { service } = await tempService(t);
  const item = {
    name: 'folder',
    files: [
      { path: 'a/SKILL.md', content: '---\nname: skill-a\ndescription: 技能甲\n---\n' },
    ],
  };
  await service.upload(undefined, item);
  await service.attachSkill(undefined, 'root', 'skill-a');

  const rollback = await service.rollback(undefined, 'upload');
  assert.equal(rollback.ok, true);
  assert.deepEqual(Object.keys(rollback.catalog.skills), []);
  assert.deepEqual(rollback.affected.removedSkills, ['skill-a']);
  assert.deepEqual(rollback.catalog.scenes.root.skills, []);

  const files = await service.storeFor(undefined).loadSkillFiles('skill-a');
  assert.equal(files, null);
});

test('service rollback restores overwritten skill originals and removes batch-added files', async (t) => {
  const { service } = await tempService(t);
  const v1 = {
    name: 'folder',
    files: [
      { path: 'a/SKILL.md', content: '---\nname: skill-a\ndescription: 技能甲 v1\n---\n# v1' },
      { path: 'a/tools/helper.sh', content: 'echo v1' },
    ],
  };
  await service.upload(undefined, v1);
  await service.attachSkill(undefined, 'root', 'skill-a');

  // Second upload overwrites skill-a and adds skill-b.
  const second = await service.upload(undefined, {
    name: 'folder',
    files: [
      { path: 'a/SKILL.md', content: '---\nname: skill-a\ndescription: 技能甲 v2\n---\n# v2' },
      { path: 'a/extra.md', content: 'extra' },
      { path: 'b/SKILL.md', content: '---\nname: skill-b\ndescription: 技能乙\n---\n' },
    ],
  });
  assert.deepEqual(second.overwritten, ['skill-a']);
  assert.deepEqual(second.added, ['skill-b']);

  const rollback = await service.rollback(undefined, 'upload');
  assert.equal(rollback.ok, true);
  assert.ok(rollback.affected.overwrittenSkills.includes('skill-a'));
  assert.ok(rollback.affected.removedSkills.includes('skill-b'));

  const restored = await service.storeFor(undefined).loadSkillFiles('skill-a');
  assert.deepEqual(Object.keys(restored).sort(), ['SKILL.md', 'tools/helper.sh']);
  assert.match(restored['SKILL.md'], /v1/);

  const state = await service.state();
  assert.deepEqual(Object.keys(state.catalog.skills), ['skill-a']);
  assert.deepEqual(state.catalog.scenes.root.skills, ['skill-a']);
});

test('service organizeAction applies and persists one tool action at a time', async (t) => {
  const { service } = await tempService(t);
  const created = await service.organizeAction(undefined, 'createScene', {
    parentId: 'root',
    name: '数据工程',
    description: '数据管道、仓库建模与批处理任务的场景',
  });
  assert.equal(created.ok, true);
  const sceneId = created.result.sceneId;

  const renamed = await service.organizeAction(undefined, 'updateScene', {
    sceneId,
    name: '数据工程与仓库',
  });
  assert.equal(renamed.ok, true);

  const blocked = await service.organizeAction(undefined, 'deleteSkill', { skillName: 'anything' });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /仅用户/);

  const state = await service.state();
  assert.equal(state.catalog.scenes[sceneId].name, '数据工程与仓库');
});

test('service organize snapshot and organize-slot rollback restore the catalog only', async (t) => {
  const { service } = await tempService(t);
  await service.upload(undefined, {
    name: 'folder',
    files: [{ path: 'a/SKILL.md', content: '---\nname: skill-a\ndescription: 技能甲\n---\n' }],
  });
  await service.attachSkill(undefined, 'root', 'skill-a');

  await service.saveOrganizeSnapshot(undefined);
  await service.organizeAction(undefined, 'createScene', {
    parentId: 'root',
    name: '临时场景',
    description: '整理会话中创建随后被回滚的场景说明',
  });

  const rollback = await service.rollback(undefined, 'organize');
  assert.equal(rollback.ok, true);
  assert.ok(rollback.affected.scenesDeleted.some((scene) => scene.name === '临时场景'));
  // Organize rollback never touches skill files.
  const files = await service.storeFor(undefined).loadSkillFiles('skill-a');
  assert.ok(files['SKILL.md']);
});

test('service organize reports persist and load back', async (t) => {
  const { service } = await tempService(t);
  assert.equal((await service.getOrganizeReport(undefined)).report, null);
  await service.saveOrganizeReport(undefined, {
    mode: 'detect',
    sessionId: 'session-1',
    summary: {},
    conflicts: ['场景边界模糊'],
    duplicates: [],
  });
  const { report } = await service.getOrganizeReport(undefined);
  assert.equal(report.mode, 'detect');
  assert.deepEqual(report.conflicts, ['场景边界模糊']);
});

test('service previewSkillFiles reads files without recording usage', async (t) => {
  const { service } = await tempService(t);
  await service.upload(undefined, {
    name: 'tdd',
    files: [{ path: 'SKILL.md', content: '---\nname: tdd\ndescription: test first\n---\n# TDD' }],
  });

  const before = await service.stats();
  const preview = await service.previewSkillFiles(undefined, 'tdd');
  const after = await service.stats();

  assert.equal(preview.ok, true);
  assert.equal(preview.skill.name, 'tdd');
  assert.deepEqual(Object.keys(preview.files), ['SKILL.md']);
  assert.equal(after.stats.total, before.stats.total);
});

test('service previewUpload validates and summarizes without persisting', async (t) => {
  const { service } = await tempService(t);
  const item = {
    name: 'skills-folder',
    files: [
      { path: '后端开发/数据库设计/SKILL.md', content: '---\nname: db-schema-design\ndescription: 第一版\n---\n# v1' },
      { path: '后端开发/数据库设计/templates/init.sql', content: 'select 1;' },
      { path: '前端/README.md', content: 'ignored' },
    ],
  };

  const preview = await service.previewUpload(undefined, item);
  assert.equal(preview.ok, true);
  assert.equal(preview.skillCount, 1);
  assert.equal(preview.skills[0].fileCount, 2);
  assert.equal(preview.skills[0].overwrite, false);
  assert.deepEqual(preview.ignoredFiles, ['前端/README.md']);

  const state = await service.state();
  assert.deepEqual(Object.keys(state.catalog.skills), []);
});

test('service stats keeps the timeline session-scoped and globals workspace-scoped', async (t) => {
  const { service } = await tempService(t);
  await service.upload(undefined, {
    name: 'tdd',
    files: [{ path: 'SKILL.md', content: '---\nname: tdd\ndescription: test first\n---\n' }],
  });
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
  await service.upload(undefined, {
    name: 'tdd',
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
