import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrganizePrompt,
  extractOrganizeReport,
  formatOrganizeStamp,
  sceneSummaryText,
} from '../src/organize-prompts.js';
import { createCatalog, createScene, upsertSkill, attachSkill } from '../../core/src/index.js';

function seedCatalog() {
  let catalog = createCatalog();
  catalog = createScene(catalog, 'root', { name: '后端开发', description: '服务端实现', tags: ['backend'] }, { id: 'backend' }).catalog;
  catalog = createScene(catalog, 'backend', { name: '数据库设计', description: '关系模型与索引', tags: ['database'] }, { id: 'database' }).catalog;
  catalog = upsertSkill(catalog, 'db-schema-design', '设计关系表结构', 100).catalog;
  catalog = attachSkill(catalog, 'database', 'db-schema-design').catalog;
  return catalog;
}

test('formatOrganizeStamp renders a stable task timestamp', () => {
  assert.equal(formatOrganizeStamp(new Date(2026, 7, 16, 14, 5).getTime()), '2026-08-16 14:05');
});

test('buildOrganizePrompt starts with the task name and timestamp as the first line', () => {
  const prompt = buildOrganizePrompt('full', { now: new Date(2026, 7, 16, 14, 5).getTime(), sceneSummary: '…' });
  assert.equal(prompt.split('\n')[0], '一键整理 #2026-08-16 14:05');
});

test('classify prompt embeds the upload batch and unclassified list but no skill full text', () => {
  const prompt = buildOrganizePrompt('classify', {
    now: 100,
    sceneSummary: sceneSummaryText(seedCatalog()),
    unclassified: [{ name: 'brand-new', description: '全新技能' }],
    batch: { addedSkills: ['brand-new'], overwrittenSkills: ['db-schema-design'] },
  });
  assert.match(prompt, /本次上传批次/);
  assert.match(prompt, /新增技能：brand-new/);
  assert.match(prompt, /同名覆盖：db-schema-design/);
  assert.match(prompt, /未分类技能/);
  assert.match(prompt, /- brand-new：全新技能/);
  assert.match(prompt, /- 后端开发：服务端实现（直接技能：无）/);
  assert.match(prompt, /- 数据库设计：关系模型与索引（直接技能：db-schema-design）/);
  assert.match(prompt, /技能文件与技能描述只读/);
  assert.match(prompt, /attachmentReasons/);
});

test('detect prompt forbids every modifying action and lists the conflict kinds', () => {
  const prompt = buildOrganizePrompt('detect', { now: 100, sceneSummary: '…', unclassified: [] });
  assert.match(prompt, /只读检测/);
  assert.match(prompt, /严禁调用 createScene/);
  assert.match(prompt, /内容高度相似/);
  assert.match(prompt, /语义重叠/);
  assert.match(prompt, /挂载过散/);
});

test('full prompt covers whole-tree tidying', () => {
  const prompt = buildOrganizePrompt('full', { now: 100, sceneSummary: '…', unclassified: [] });
  assert.match(prompt, /对整棵场景树做一次完整整理/);
  assert.match(prompt, /删除多余或重复的场景/);
  assert.match(prompt, /把未分类技能归入合适场景/);
});

test('extractOrganizeReport parses the last fenced json block', () => {
  const text = [
    '我完成了整理。',
    '```json',
    '{ "conflicts": ["场景 A 与 B 重叠"], "duplicates": ["x 与 y 相似"], "attachmentReasons": { "s": "理由" } }',
    '```',
    '说明文字…',
    '```json',
    '{ "conflicts": ["最终结论"], "duplicates": [], "attachmentReasons": {} }',
    '```',
  ].join('\n');
  const report = extractOrganizeReport(text);
  assert.deepEqual(report.conflicts, ['最终结论']);
  assert.deepEqual(report.duplicates, []);
});

test('extractOrganizeReport tolerates malformed earlier blocks and returns null without any fence', () => {
  const text = '```json\n{ not json\n```\n```json\n{ "conflicts": ["ok"] }\n```';
  const report = extractOrganizeReport(text);
  assert.deepEqual(report.conflicts, ['ok']);
  assert.equal(extractOrganizeReport('没有代码块'), null);
  assert.equal(extractOrganizeReport(null), null);
});

test('extractOrganizeReport accepts a bare fence without the json tag', () => {
  const report = extractOrganizeReport('结果：\n```\n{"conflicts":[],"duplicates":["a"]}\n```');
  assert.deepEqual(report.duplicates, ['a']);
});
