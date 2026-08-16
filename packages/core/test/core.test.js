import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateUsage,
  applyUploadToCatalog,
  attachSkill,
  browse,
  collectUploadSkills,
  collectSubtree,
  createCatalog,
  createScene,
  deleteScene,
  deleteSkill,
  detachSkill,
  find,
  loadSkillFiles,
  parseFrontmatter,
  recordUsage,
  scenePath,
  skillPaths,
  unclassifiedSkills,
  upsertSkill,
  validateUpload,
} from '../src/index.js';

function seedCatalog() {
  let result = createCatalog();
  result = createScene(result, 'root', { name: '后端开发', description: '服务端实现', tags: ['backend', 'server'] }, { id: 'backend' }).catalog;
  result = createScene(result, 'backend', { name: '数据库设计', description: '关系模型、约束、索引与 schema 演进', tags: ['database', 'sql'] }, { id: 'database' }).catalog;
  result = createScene(result, 'backend', { name: '接口设计', description: 'HTTP 契约与错误模型', tags: ['api'] }, { id: 'api' }).catalog;
  result = createScene(result, 'root', { name: '前端开发', description: '页面与交互实现', tags: ['frontend', 'ui'] }, { id: 'frontend' }).catalog;
  result = createScene(result, 'frontend', { name: '界面设计', description: '视觉方向与布局', tags: ['visual', 'css'] }, { id: 'ui' }).catalog;
  result = upsertSkill(result, 'db-schema-design', '设计关系表结构、约束与索引', 100).catalog;
  result = upsertSkill(result, 'sql-query-review', '评审慢查询、缺失索引与危险写操作', 200).catalog;
  result = upsertSkill(result, 'api-design-review', '检查接口契约、错误模型与分页约定', 300).catalog;
  result = upsertSkill(result, 'frontend-design', '为页面建立视觉方向、色板与布局', 400).catalog;
  result = attachSkill(result, 'database', 'db-schema-design').catalog;
  result = attachSkill(result, 'database', 'sql-query-review').catalog;
  result = attachSkill(result, 'api', 'api-design-review').catalog;
  result = attachSkill(result, 'frontend', 'frontend-design').catalog;
  result = attachSkill(result, 'ui', 'frontend-design').catalog;
  return result;
}

test('createCatalog creates a single root scene', () => {
  const catalog = createCatalog();
  assert.equal(catalog.version, 1);
  assert.equal(catalog.rootSceneId, 'root');
  assert.equal(catalog.scenes.root.parentId, null);
  assert.deepEqual(catalog.scenes.root.children, []);
  assert.deepEqual(catalog.scenes.root.skills, []);
});

test('createScene supports arbitrary-depth nesting and scenes with both children and skills', () => {
  const catalog = seedCatalog();
  const backend = catalog.scenes.backend;
  assert.deepEqual(backend.children, ['database', 'api']);
  assert.ok(catalog.scenes.database.parentId === 'backend');
  assert.ok(catalog.scenes.api.parentId === 'backend');
  assert.equal(scenePath(catalog, 'database'), '工作台 / 后端开发 / 数据库设计');
});

test('a skill can be attached to multiple scenes', () => {
  const catalog = seedCatalog();
  assert.deepEqual(skillPaths(catalog, 'frontend-design'), [
    '工作台 / 前端开发',
    '工作台 / 前端开发 / 界面设计',
  ]);
  assert.deepEqual(catalog.scenes.frontend.skills, ['frontend-design']);
  assert.deepEqual(catalog.scenes.ui.skills, ['frontend-design']);
});

test('deleteScene cascade-deletes descendants and only unlinks skills', () => {
  const catalog = seedCatalog();
  const result = deleteScene(catalog, 'backend');
  assert.equal(result.ok, true);
  assert.deepEqual([...result.deletedIds].sort(), ['api', 'backend', 'database']);
  assert.equal(result.catalog.scenes.backend, undefined);
  assert.equal(result.catalog.scenes.database, undefined);
  assert.equal(result.catalog.scenes.api, undefined);
  assert.ok(result.catalog.skills['db-schema-design']);
  assert.ok(result.catalog.skills['api-design-review']);
  assert.deepEqual(result.catalog.scenes.root.children, ['frontend']);
});

test('root scene cannot be deleted', () => {
  const result = deleteScene(seedCatalog(), 'root');
  assert.equal(result.ok, false);
  assert.match(result.error, /根场景/);
});

test('upsertSkill preserves createdAt and updates description in place', () => {
  let catalog = seedCatalog();
  const before = catalog.skills['db-schema-design'];
  const result = upsertSkill(catalog, 'db-schema-design', '更新后的描述', 900);
  assert.equal(result.ok, true);
  assert.equal(result.updated, true);
  assert.equal(result.catalog.skills['db-schema-design'].createdAt, before.createdAt);
  assert.equal(result.catalog.skills['db-schema-design'].updatedAt, 900);
  assert.equal(result.catalog.skills['db-schema-design'].description, '更新后的描述');
});

test('deleteSkill unlinks it from every scene but keeps other skills', () => {
  const result = deleteSkill(seedCatalog(), 'frontend-design');
  assert.equal(result.ok, true);
  assert.equal(result.catalog.skills['frontend-design'], undefined);
  assert.ok(!result.catalog.scenes.frontend.skills.includes('frontend-design'));
  assert.ok(!result.catalog.scenes.ui.skills.includes('frontend-design'));
  assert.ok(result.catalog.skills['sql-query-review']);
});

test('find matches scene text first and returns the whole subtree deduplicated and grouped', () => {
  const catalog = seedCatalog();
  const result = find(catalog, '数据库建模和索引设计');
  assert.equal(result.ok, true);
  assert.equal(result.matchedScenePath, '工作台 / 后端开发 / 数据库设计');
  assert.equal(result.matchType, 'scene');
  assert.deepEqual(result.skills.map((s) => s.name), ['db-schema-design', 'sql-query-review']);
  assert.deepEqual(result.groups.map((g) => g.path), ['工作台 / 后端开发 / 数据库设计']);
});

test('find uses skill name/description as a secondary signal and filters to matched skills', () => {
  const catalog = seedCatalog();
  const result = find(catalog, 'api-design-review');
  assert.equal(result.ok, true);
  assert.equal(result.matchedSceneId, 'api');
  assert.equal(result.matchType, 'skill-secondary');
  assert.deepEqual(result.skills.map((s) => s.name), ['api-design-review']);
});

test('find returns no match with an explanatory message', () => {
  const result = find(seedCatalog(), '量子计算');
  assert.equal(result.ok, true);
  assert.equal(result.matchedSceneId, null);
  assert.ok(result.message);
  assert.deepEqual(result.skills, []);
});

test('browse returns one node with child summaries and direct skill metadata', () => {
  const result = browse(seedCatalog(), 'backend');
  assert.equal(result.ok, true);
  assert.equal(result.name, '后端开发');
  assert.deepEqual(result.children.map((c) => c.id), ['database', 'api']);
  assert.equal(result.skills.length, 0);
});

test('loadSkillFiles returns every file keyed by relative path', () => {
  const files = {
    'SKILL.md': '---\nname: tdd\ndescription: red green refactor\n---\n# TDD',
    'examples/flow.md': '# flow',
  };
  const result = loadSkillFiles({ tdd: files }, 'tdd');
  assert.equal(result.ok, true);
  assert.deepEqual(result.files, files);
});

test('loadSkillFiles also accepts a direct relative-path -> content map', () => {
  const result = loadSkillFiles({ 'SKILL.md': '# tdd' }, 'tdd');
  assert.equal(result.ok, true);
  assert.deepEqual(result.files, { 'SKILL.md': '# tdd' });
});

test('validateUpload accepts a folder whose only root SKILL.md has valid frontmatter', () => {
  const result = validateUpload({
    name: 'tdd',
    files: [
      { path: 'SKILL.md', content: '---\nname: tdd\ndescription: 先写失败测试，再写实现。\n---\n# TDD' },
      { path: 'examples/flow.md', content: '# flow' },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.skill.name, 'tdd');
  assert.deepEqual(Object.keys(result.skill.files), ['SKILL.md', 'examples/flow.md']);
});

test('validateUpload imports every root asset and ignores nested SKILL.md files', () => {
  const result = validateUpload({
    name: 'accessibility',
    files: [
      { path: 'accessibility/SKILL.md', content: '---\nname: accessibility\ndescription: audit accessibility\n---\n# Accessibility' },
      { path: 'accessibility/references/SKILL.md', content: '---\nname: nested-not-root\ndescription: nested reference\n---\n' },
      { path: 'accessibility/references/checklist.md', content: '# checklist' },
      { path: 'accessibility/tools/axe.md', content: '# axe' },
    ],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.skill.files).sort(), [
    'SKILL.md',
    'references/SKILL.md',
    'references/checklist.md',
    'tools/axe.md',
  ]);
});

test('validateUpload strips one wrapper folder from folder-upload paths', () => {
  const result = validateUpload({
    files: [
      { path: 'tdd-main/SKILL.md', content: '---\nname: tdd\ndescription: test first\n---\n' },
      { path: 'tdd-main/tests.md', content: '# tests' },
    ],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.skill.files), ['SKILL.md', 'tests.md']);
});

test('validateUpload returns per-item reasons for missing SKILL.md and bad frontmatter', () => {
  const missing = validateUpload({ files: [{ path: 'README.md', content: 'x' }] });
  assert.equal(missing.ok, false);
  assert.match(missing.reasons.join(' '), /SKILL\.md/);

  const bad = validateUpload({
    files: [{ path: 'SKILL.md', content: '---\nname: Bad Name\ndescription: x\n---\n' }],
  });
  assert.equal(bad.ok, false);
  assert.match(bad.reasons.join(' '), /name 不符合/);

  const emptyDesc = validateUpload({
    files: [{ path: 'SKILL.md', content: '---\nname: tdd\ndescription:\n---\n' }],
  });
  assert.equal(emptyDesc.ok, false);
  assert.match(emptyDesc.reasons.join(' '), /description/);
});

test('recordUsage and aggregateUsage compute counts, share, last-used, per-scene and source filter', () => {
  let usage = recordUsage([], { id: 'u1', skillName: 'tdd', source: 'gateway', scenePath: '工作台 / 工程质量', timestamp: 100, sessionId: 's1' });
  usage = recordUsage(usage, { id: 'u2', skillName: 'code-review', source: 'agent-skills', timestamp: 200, sessionId: 's1' });
  usage = recordUsage(usage, { id: 'u3', skillName: 'tdd', source: 'gateway', scenePath: '工作台 / 工程质量', timestamp: 300, sessionId: 's2' });

  const all = aggregateUsage(usage);
  assert.equal(all.total, 3);
  assert.equal(all.skills[0].skillName, 'tdd');
  assert.equal(all.skills[0].count, 2);
  assert.equal(all.skills[0].share, 2 / 3);
  assert.equal(all.skills[0].lastUsed, 300);
  assert.deepEqual(all.scenes, [{ scenePath: '工作台 / 工程质量', count: 2, lastUsed: 300, share: 2 / 3 }]);

  const gateway = aggregateUsage(usage, 'gateway');
  assert.equal(gateway.total, 2);
  assert.equal(gateway.skills.length, 1);
  assert.equal(gateway.skills[0].skillName, 'tdd');

  const session = aggregateUsage(usage, { sessionId: 's1' });
  assert.equal(session.total, 2);
  assert.deepEqual(session.skills.map((skill) => skill.skillName).sort(), ['code-review', 'tdd']);
});

test('collectUploadSkills collects every skill folder recursively and never creates scenes', () => {
  const result = collectUploadSkills({
    name: 'skills',
    files: [
      { path: '后端开发/数据库设计/SKILL.md', content: '---\nname: db-schema-design\ndescription: 数据库结构设计\n---\n# DB' },
      { path: '后端开发/数据库设计/templates/init.sql', content: 'select 1;' },
      { path: '后端开发/数据库设计/references/SKILL.md', content: '---\nname: nested-not-a-skill\ndescription: nested asset\n---\n' },
      { path: '后端开发/接口设计/README.md', content: '# notes' },
      { path: '前端/界面设计/SKILL.md', content: '---\nname: frontend-design\ndescription: 前端设计\n---\n# FE' },
    ],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.skills.map((skill) => skill.name).sort(), ['db-schema-design', 'frontend-design']);
  const db = result.skills.find((skill) => skill.name === 'db-schema-design');
  assert.deepEqual(Object.keys(db.files).sort(), ['SKILL.md', 'references/SKILL.md', 'templates/init.sql']);
  assert.equal(result.fileCount, 4);
  assert.equal(result.skillCount, 2);
  assert.deepEqual(result.ignoredFiles, ['后端开发/接口设计/README.md']);
});

test('collectUploadSkills treats a root SKILL.md as one skill', () => {
  const result = collectUploadSkills({
    name: 'root-skill-folder',
    files: [
      { path: 'SKILL.md', content: '---\nname: root-skill\ndescription: root skill\n---\n# root' },
      { path: 'assets/guide.md', content: '# guide' },
      { path: 'assets/SKILL.md', content: '---\nname: nested-asset\ndescription: not a separate skill\n---\n' },
    ],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.skills.map((skill) => skill.name), ['root-skill']);
  assert.deepEqual(Object.keys(result.skills[0].files).sort(), ['SKILL.md', 'assets/SKILL.md', 'assets/guide.md']);
  assert.deepEqual(result.ignoredFiles, []);
});

test('collectUploadSkills strips a wrapper folder when every path sits under it', () => {
  const result = collectUploadSkills({
    name: 'tdd-main',
    files: [
      { path: 'tdd-main/SKILL.md', content: '---\nname: tdd\ndescription: test first\n---\n' },
      { path: 'tdd-main/tests.md', content: '# tests' },
    ],
  }, { rootPath: 'tdd-main' });

  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.skills[0].files).sort(), ['SKILL.md', 'tests.md']);
});

test('collectUploadSkills rejects the whole batch with per-item reasons when any skill is invalid', () => {
  const result = collectUploadSkills({
    name: 'bad',
    files: [
      { path: 'a/SKILL.md', content: '---\nname: Bad Name\ndescription: x\n---\n' },
      { path: 'b/SKILL.md', content: '---\nname: ok-skill\ndescription: fine\n---\n' },
      { path: 'c/README.md', content: 'no skill here' },
    ],
  });

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' '), /name 不符合/);
  assert.equal(result.skills, undefined);
});

test('collectUploadSkills reports every missing-field reason per skill folder', () => {
  const result = collectUploadSkills({
    files: [
      { path: 'a/SKILL.md', content: '# no frontmatter at all' },
      { path: 'b/SKILL.md', content: '---\nname: b\ndescription:\n---\n' },
      { path: 'c/README.md', content: 'loose file' },
    ],
  });

  assert.equal(result.ok, false);
  const joined = result.reasons.join(' ');
  assert.match(joined, /技能文件夹「a」/);
  assert.match(joined, /frontmatter/);
  assert.match(joined, /技能文件夹「b」/);
  assert.match(joined, /description/);
});

test('applyUploadToCatalog upserts skills without attaching them to any scene', () => {
  const catalog = seedCatalog();
  const result = applyUploadToCatalog(catalog, [
    { name: 'db-schema-design', description: '新版描述', files: { 'SKILL.md': 'new' } },
    { name: 'brand-new-skill', description: '新技能', files: { 'SKILL.md': 'new' } },
  ], 999);

  assert.equal(result.ok, true);
  assert.deepEqual(result.added, ['brand-new-skill']);
  assert.deepEqual(result.overwritten, ['db-schema-design']);
  assert.equal(result.catalog.skills['db-schema-design'].description, '新版描述');
  assert.equal(result.catalog.skills['db-schema-design'].createdAt, 100);
  assert.equal(result.catalog.skills['db-schema-design'].updatedAt, 999);
  assert.deepEqual(result.catalog.scenes.database.skills, ['db-schema-design', 'sql-query-review']);
  assert.deepEqual(unclassifiedSkills(result.catalog).map((skill) => skill.name), ['brand-new-skill']);
});

test('unclassifiedSkills lists skills referenced by no scene, including skills unlinked by scene deletion', () => {
  const catalog = seedCatalog();
  assert.deepEqual(unclassifiedSkills(catalog), []);

  const result = deleteScene(catalog, 'database');
  const unclassified = unclassifiedSkills(result.catalog).map((skill) => skill.name);
  assert.ok(unclassified.includes('db-schema-design'));
  assert.ok(unclassified.includes('sql-query-review'));
  assert.ok(!unclassified.includes('frontend-design'));
});

test('browse and find never return unclassified skills', () => {
  const catalog = applyUploadToCatalog(seedCatalog(), [
    { name: 'unclassified-helper', description: '量子隧穿计算辅助工具', files: { 'SKILL.md': 'x' } },
  ], 500).catalog;

  assert.deepEqual(browse(catalog, 'frontend').skills.map((skill) => skill.name), ['frontend-design']);
  const found = find(catalog, '量子隧穿计算辅助工具');
  assert.equal(found.ok, true);
  assert.equal(found.matchedSceneId, null);
  assert.deepEqual(found.skills, []);
  assert.ok(found.message);
});

test('parseFrontmatter reads quoted scalar values', () => {
  const result = parseFrontmatter('---\nname: "code-review"\ndescription: \'Review diffs\'\n---\n');
  assert.equal(result.ok, true);
  assert.equal(result.fields.name, 'code-review');
  assert.equal(result.fields.description, 'Review diffs');
});
