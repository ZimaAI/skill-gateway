/* ==========================================================================
   skill-gateway 页面原型 v2（上传改版 + Agent 整理）
   - 纯函数核心：场景树 CRUD / 仅收集技能的上传解析 / browse / load / 使用聚合
   - 整理流程模拟：上传后自动分类会话、一键整理、冲突检测（只读）、快照回滚
   - UI 状态仅存内存，刷新重置；不做真实文件持久化
   - 视觉遵循 docs/style/deepseek/design.md
   ========================================================================== */

'use strict';

/* ------------------------------------------------------------------------ */
/* 基础工具                                                                  */
/* ------------------------------------------------------------------------ */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const SKILL_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
const SESSION_ID = 'session_20250815_a1b2';
const OLD_SESSION_ID = 'session_20250808_c3d4';
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const NOW = Date.now();

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function icon(name, className = 'icon') {
  return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatClock(timestamp) {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${formatClock(timestamp)}`;
}

function formatRelative(timestamp) {
  const diff = NOW - Number(timestamp || 0);
  if (diff < MINUTE) return '刚刚';
  if (diff < 60 * MINUTE) return `${Math.floor(diff / MINUTE)} 分钟前`;
  if (diff < DAY) return `${Math.floor(diff / (60 * MINUTE))} 小时前`;
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  return formatDateTime(timestamp);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return [...new Set(tags.map((tag) => String(tag ?? '').trim()).filter(Boolean))];
  }
  if (typeof tags === 'string') {
    return [...new Set(tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))];
  }
  return [];
}

function badge(text, kind = 'neutral') {
  return `<span class="badge ${kind}">${esc(text)}</span>`;
}

/* ------------------------------------------------------------------------ */
/* 种子数据                                                                  */
/* ------------------------------------------------------------------------ */

function seedCatalog() {
  const base = NOW - 30 * DAY;
  return {
    version: 1,
    rootSceneId: 'root',
    scenes: {
      root: {
        id: 'root',
        name: '工作台',
        description: '所有场景的单一根节点，Agent 从这里开始逐层浏览场景树。',
        tags: ['workspace'],
        parentId: null,
        children: ['backend', 'frontend', 'quality'],
        skills: ['code-review'],
      },
      backend: {
        id: 'backend',
        name: '后端开发',
        description: '服务端接口、领域模型与业务逻辑相关技能。',
        tags: ['api', 'service'],
        parentId: 'root',
        children: ['database'],
        skills: ['api-design', 'sql-review', 'api-review'],
      },
      database: {
        id: 'database',
        name: '数据库设计',
        description: '表结构、索引、迁移与查询性能相关技能。',
        tags: ['sql', 'index'],
        parentId: 'backend',
        children: [],
        skills: ['sql-review', 'db-migration'],
      },
      frontend: {
        id: 'frontend',
        name: '前端开发',
        description: 'Web 界面、组件与交互实现相关技能。',
        tags: ['web', 'ui'],
        parentId: 'root',
        children: ['components'],
        skills: ['react-component'],
      },
      components: {
        id: 'components',
        name: '组件开发',
        description: '可复用组件与设计系统实现。',
        tags: ['react', 'design-system'],
        parentId: 'frontend',
        children: [],
        skills: ['react-component'],
      },
      quality: {
        id: 'quality',
        name: '测试与质量',
        description: '测试策略、质量门禁与代码评审流程。',
        tags: ['testing', 'review'],
        parentId: 'root',
        children: [],
        skills: ['tdd'],
      },
    },
    skills: {
      'code-review': {
        name: 'code-review',
        description: '提交前代码评审清单，覆盖正确性、可读性与安全。',
        createdAt: base,
        updatedAt: NOW - 2 * DAY,
      },
      'api-design': {
        name: 'api-design',
        description: 'REST API 设计评审，核对资源建模、错误语义与幂等性。',
        createdAt: base,
        updatedAt: NOW - 4 * DAY,
      },
      'api-review': {
        name: 'api-review',
        description: 'API 接口评审清单：资源建模、错误语义与幂等性核对。',
        createdAt: base,
        updatedAt: NOW - 2.5 * DAY,
      },
      'sql-review': {
        name: 'sql-review',
        description: 'SQL 与索引评审，定位缺失索引、低效 JOIN 与分页问题。',
        createdAt: base,
        updatedAt: NOW - 1 * DAY,
      },
      'db-migration': {
        name: 'db-migration',
        description: '数据库迁移与回滚流程，覆盖可重复迁移与数据校验。',
        createdAt: base,
        updatedAt: NOW - 3 * DAY,
      },
      'react-component': {
        name: 'react-component',
        description: 'React 组件开发规范，覆盖状态边界、可访问性与测试。',
        createdAt: base,
        updatedAt: NOW - 5 * DAY,
      },
      tdd: {
        name: 'tdd',
        description: '测试驱动开发工作流：先写失败测试，再实现最小通过。',
        createdAt: base,
        updatedAt: NOW - 6 * DAY,
      },
    },
  };
}

function skillMd(name, description, body) {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`;
}

function seedSkillFiles() {
  return {
    'code-review': {
      'SKILL.md': skillMd(
        'code-review',
        '提交前代码评审清单，覆盖正确性、可读性与安全。',
        '# Code Review\n\n按清单逐项核对提交内容。\n\n## 检查项\n\n- 正确性：边界条件、错误处理、并发语义。\n- 可读性：命名、函数长度、注释只解释“为什么”。\n- 安全：输入校验、权限边界、敏感信息。'
      ),
      'checklist.md': '# Review Checklist\n\n1. Diff 范围是否最小。\n2. 是否有缺失或冗余测试。\n3. 错误路径是否被处理。\n4. 是否引入新的外部依赖。',
    },
    'api-design': {
      'SKILL.md': skillMd(
        'api-design',
        'REST API 设计评审，核对资源建模、错误语义与幂等性。',
        '# API Design Review\n\n对接口设计做结构评审。\n\n## 资源建模\n\n- 名词复数表达集合资源。\n- 子资源路径不超过两层。\n\n## 错误语义\n\n- 使用稳定的业务错误码。\n- 4xx 与 5xx 不混用。'
      ),
      'review-template.md': '# API Review\n\n| 项目 | 结论 |\n| --- | --- |\n| 资源路径 | 待核 |\n| 幂等性 | 待核 |\n| 错误码 | 待核 |',
    },
    'api-review': {
      'SKILL.md': skillMd(
        'api-review',
        'API 接口评审清单：资源建模、错误语义与幂等性核对。',
        '# API Review Checklist\n\n按清单核对接口设计。\n\n## 核对项\n\n- 资源路径符合名词复数约定。\n- 错误码稳定且语义明确。\n- 幂等性设计完整。'
      ),
      'checklist.md': '# Checklist\n\n1. 资源建模是否符合 REST 约定。\n2. 错误语义是否稳定。\n3. 写接口是否具备幂等性。',
    },
    'sql-review': {
      'SKILL.md': skillMd(
        'sql-review',
        'SQL 与索引评审，定位缺失索引、低效 JOIN 与分页问题。',
        '# SQL Review\n\n先看执行计划，再改 SQL。\n\n## 步骤\n\n1. 收集目标 SQL 与表结构。\n2. 检查过滤条件是否命中索引。\n3. 检查 JOIN、排序与分页。\n4. 输出问题清单与重写建议。'
      ),
      'checks.md': '# SQL Checks\n\n- 避免对索引列使用函数。\n- 深分页优先使用游标。\n- 大表 DDL 使用在线变更策略。',
    },
    'db-migration': {
      'SKILL.md': skillMd(
        'db-migration',
        '数据库迁移与回滚流程，覆盖可重复迁移与数据校验。',
        '# DB Migration\n\n每次迁移都应可重复、可验证、可回滚。\n\n## 流程\n\n1. 先备份或确认恢复点。\n2. 使用事务包裹单次迁移。\n3. 迁移后立即执行数据校验。\n4. 准备并演练回滚脚本。'
      ),
      'migration-template.sql': '-- migration: <name>\n-- up\nBEGIN;\n\n-- down\nROLLBACK;\n',
    },
    'react-component': {
      'SKILL.md': skillMd(
        'react-component',
        'React 组件开发规范，覆盖状态边界、可访问性与测试。',
        '# React Component\n\n组件应只拥有展示所需的本地状态。\n\n## 规则\n\n- props 变更不复制为 state。\n- 异步数据有 loading / error / empty 三态。\n- 交互元素提供键盘路径与 aria 语义。'
      ),
      'component-template.tsx': 'export function Example() {\n  return <section aria-label="example">content</section>;\n}\n',
    },
    tdd: {
      'SKILL.md': skillMd(
        'tdd',
        '测试驱动开发工作流：先写失败测试，再实现最小通过。',
        '# TDD\n\nRed → Green → Refactor。\n\n## 循环\n\n1. 写一个最小失败测试。\n2. 用最少代码让测试通过。\n3. 重构并保持测试全绿。\n4. 提交前运行完整测试套件。'
      ),
      'cycle.md': '# TDD Cycle\n\n1. RED：先写测试。\n2. GREEN：实现。\n3. REFACTOR：清理。',
    },
  };
}

function seedUsage() {
  const current = SESSION_ID;
  const old = OLD_SESSION_ID;
  return [
    { id: 'use_101', skillName: 'sql-review', source: 'gateway', scenePath: '工作台 / 后端开发 / 数据库设计', timestamp: NOW - 6 * MINUTE, sessionId: current },
    { id: 'use_102', skillName: 'code-review', source: 'agent-skills', timestamp: NOW - 18 * MINUTE, sessionId: current },
    { id: 'use_103', skillName: 'db-migration', source: 'gateway', scenePath: '工作台 / 后端开发 / 数据库设计', timestamp: NOW - 34 * MINUTE, sessionId: current },
    { id: 'use_104', skillName: 'tdd', source: 'agent-skills', timestamp: NOW - 72 * MINUTE, sessionId: current },
    { id: 'use_105', skillName: 'api-design', source: 'gateway', scenePath: '工作台 / 后端开发', timestamp: NOW - 26 * 60 * MINUTE, sessionId: old },
    { id: 'use_106', skillName: 'sql-review', source: 'agent-skills', timestamp: NOW - 29 * 60 * MINUTE, sessionId: old },
    { id: 'use_107', skillName: 'react-component', source: 'gateway', scenePath: '工作台 / 前端开发 / 组件开发', timestamp: NOW - 2 * DAY, sessionId: old },
    { id: 'use_108', skillName: 'sql-review', source: 'gateway', scenePath: '工作台 / 后端开发', timestamp: NOW - 4 * DAY, sessionId: old },
  ];
}

function seedChatEvents() {
  return [
    { kind: 'day', text: '今天' },
    { kind: 'user', text: '帮我检查一下最近的 SQL，重点看索引和深分页。' },
    {
      kind: 'tool',
      title: 'skill_gateway · browse',
      text: JSON.stringify({ action: 'browse' }, null, 2) + '\n→ 根场景「工作台」，返回直接子场景：后端开发 / 前端开发 / 测试与质量。',
    },
    {
      kind: 'tool',
      title: 'skill_gateway · browse',
      text: JSON.stringify({ action: 'browse', sceneId: 'backend' }, null, 2) + '\n→ 进入「后端开发」，发现子场景「数据库设计」与直接技能 api-design、sql-review。',
    },
    { kind: 'user', text: '继续进入数据库设计，加载 sql-review。' },
    {
      kind: 'tool',
      title: 'skill_gateway · load',
      text: JSON.stringify({ action: 'load', skillName: 'sql-review', scenePath: '工作台 / 后端开发 / 数据库设计' }, null, 2) + '\n→ 返回 SKILL.md + checks.md，usageRecorded: true。',
    },
    { kind: 'assistant', text: '已加载「sql-review」。接下来我会按执行计划检查目标 SQL 的过滤条件、JOIN 与分页写法。' },
  ];
}

function placeholderHistoryEvents() {
  return [
    { kind: 'day', text: '历史会话' },
    { kind: 'assistant', text: '仅作界面陪衬：本原型只演示 Skill Gateway 侧边栏，历史会话内容不展开。' },
  ];
}

/* ------------------------------------------------------------------------ */
/* 核心纯函数（与 packages/core 行为对齐，UI 原型内联实现）                   */
/* ------------------------------------------------------------------------ */

function scenePath(catalog, sceneId) {
  const names = [];
  const seen = new Set();
  let cursor = catalog && catalog.scenes ? catalog.scenes[sceneId] : null;
  let guard = 0;
  while (cursor && !seen.has(cursor.id) && guard < 128) {
    seen.add(cursor.id);
    names.unshift(cursor.name);
    if (!cursor.parentId) break;
    cursor = catalog.scenes[cursor.parentId];
    guard += 1;
  }
  return names.join(' / ');
}

function collectDescendants(catalog, sceneId) {
  const ids = [];
  const queue = [sceneId];
  const seen = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const scene = catalog.scenes[id];
    if (!scene) continue;
    ids.push(id);
    queue.push(...(scene.children || []));
  }
  return ids;
}

function sceneNameExists(catalog, name, excludeId) {
  return Object.values(catalog.scenes || {}).some(
    (scene) => scene.name === name && scene.id !== excludeId,
  );
}

function sceneByName(catalog, name) {
  return Object.values(catalog.scenes || {}).find((scene) => scene.name === name) || null;
}

function createScene(catalog, parentId, input = {}) {
  if (!catalog || !catalog.scenes || !catalog.rootSceneId) return { ok: false, error: '目录无效。' };
  const next = clone(catalog);
  const parent = next.scenes[parentId];
  if (!parent) return { ok: false, error: '父场景不存在。' };

  const name = String(input.name || '').trim();
  const description = String(input.description || '').trim();
  const tags = normalizeTags(input.tags);

  if (!name) return { ok: false, error: '场景名称不能为空。' };
  if (sceneNameExists(next, name)) return { ok: false, error: `场景名称已存在：${name}` };

  const id = makeId('scene');
  const scene = { id, name, description, tags, parentId: parent.id, children: [], skills: [] };
  next.scenes[id] = scene;
  parent.children.push(id);
  return { ok: true, catalog: next, sceneId: id };
}

function updateScene(catalog, sceneId, input = {}) {
  if (!catalog || !catalog.scenes) return { ok: false, error: '目录无效。' };
  const next = clone(catalog);
  const scene = next.scenes[sceneId];
  if (!scene) return { ok: false, error: '场景不存在。' };

  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) return { ok: false, error: '场景名称不能为空。' };
    if (sceneNameExists(next, name, sceneId)) return { ok: false, error: `场景名称已存在：${name}` };
    scene.name = name;
  }
  if (input.description !== undefined) scene.description = String(input.description).trim();
  if (input.tags !== undefined) scene.tags = normalizeTags(input.tags);
  return { ok: true, catalog: next };
}

function deleteScene(catalog, sceneId) {
  if (!catalog || !catalog.scenes) return { ok: false, error: '目录无效。' };
  if (sceneId === catalog.rootSceneId) return { ok: false, error: '根场景不能删除。' };
  const next = clone(catalog);
  if (!next.scenes[sceneId]) return { ok: false, error: '场景不存在。' };

  const deletedIds = collectDescendants(next, sceneId);
  const parent = next.scenes[next.scenes[sceneId].parentId];
  if (parent) parent.children = parent.children.filter((id) => id !== sceneId);
  for (const id of deletedIds) delete next.scenes[id];
  return { ok: true, catalog: next, deletedIds };
}

function attachSkill(catalog, sceneId, skillName) {
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

function detachSkill(catalog, sceneId, skillName) {
  if (!catalog || !catalog.scenes) return { ok: false, error: '目录无效。' };
  const next = clone(catalog);
  const scene = next.scenes[sceneId];
  if (!scene) return { ok: false, error: '场景不存在。' };
  const before = (scene.skills || []).length;
  scene.skills = (scene.skills || []).filter((name) => name !== skillName);
  return { ok: true, catalog: next, removed: scene.skills.length !== before };
}

function deleteSkill(catalog, skillName) {
  if (!catalog || !catalog.scenes || !catalog.skills) return { ok: false, error: '目录无效。' };
  const next = clone(catalog);
  if (!next.skills[skillName]) return { ok: false, error: '技能不存在。' };
  delete next.skills[skillName];
  for (const scene of Object.values(next.scenes)) {
    scene.skills = (scene.skills || []).filter((name) => name !== skillName);
  }
  return { ok: true, catalog: next };
}

function skillPaths(catalog, skillName) {
  return Object.values(catalog.scenes || {})
    .filter((scene) => (scene.skills || []).includes(skillName))
    .map((scene) => scenePath(catalog, scene.id));
}

function unclassifiedSkills(catalog) {
  const mounted = new Set();
  for (const scene of Object.values(catalog.scenes || {})) {
    (scene.skills || []).forEach((name) => mounted.add(name));
  }
  return Object.values(catalog.skills || {})
    .filter((skill) => !mounted.has(skill.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

function browse(catalog, sceneId) {
  if (!catalog || !catalog.scenes || !catalog.rootSceneId) return { ok: false, error: '目录无效。' };
  const requestedId = sceneId === undefined || sceneId === null || String(sceneId).trim() === ''
    ? catalog.rootSceneId
    : String(sceneId).trim();
  const scene = catalog.scenes[requestedId];
  if (!scene) return { ok: false, error: '场景不存在。' };

  const children = (scene.children || [])
    .map((childId) => {
      const child = catalog.scenes[childId];
      if (!child) return null;
      return {
        id: child.id,
        name: child.name,
        description: child.description,
        tags: child.tags || [],
        childCount: (child.children || []).length,
        skillCount: (child.skills || []).length,
      };
    })
    .filter(Boolean);

  const skills = (scene.skills || [])
    .map((name) => {
      const skill = catalog.skills[name];
      return skill ? { name: skill.name, description: skill.description } : null;
    })
    .filter(Boolean);

  return {
    ok: true,
    sceneId: scene.id,
    parentId: scene.parentId || null,
    path: scenePath(catalog, scene.id),
    name: scene.name,
    description: scene.description,
    tags: scene.tags || [],
    children,
    skills,
  };
}

function recordUsage(usage, input) {
  const record = {
    id: input.id || makeId('use'),
    skillName: String(input.skillName || '').trim(),
    source: input.source === 'agent-skills' ? 'agent-skills' : 'gateway',
    timestamp: Number.isFinite(Number(input.timestamp)) ? Number(input.timestamp) : Date.now(),
    sessionId: String(input.sessionId || SESSION_ID),
  };
  const scenePath = String(input.scenePath || '').trim();
  if (scenePath) record.scenePath = scenePath;
  return [...(Array.isArray(usage) ? usage : []), record];
}

function aggregateUsage(usage, source = 'all') {
  const records = (Array.isArray(usage) ? usage : []).filter((record) => {
    if (!record || !record.skillName) return false;
    if (source !== 'all' && (record.source === 'agent-skills' ? 'agent-skills' : 'gateway') !== source) return false;
    return true;
  });

  const bySkill = new Map();
  const byScene = new Map();

  for (const record of records) {
    const timestamp = Number(record.timestamp) || 0;
    let skill = bySkill.get(record.skillName);
    if (!skill) {
      skill = { skillName: record.skillName, count: 0, lastUsed: 0 };
      bySkill.set(record.skillName, skill);
    }
    skill.count += 1;
    skill.lastUsed = Math.max(skill.lastUsed, timestamp);

    const path = String(record.scenePath || '').trim();
    if (path) {
      let scene = byScene.get(path);
      if (!scene) {
        scene = { scenePath: path, count: 0, lastUsed: 0 };
        byScene.set(path, scene);
      }
      scene.count += 1;
      scene.lastUsed = Math.max(scene.lastUsed, timestamp);
    }
  }

  const total = records.length;
  const withShare = (entry) => ({ ...entry, share: total > 0 ? entry.count / total : 0 });
  const skills = [...bySkill.values()].map(withShare).sort(
    (a, b) => b.count - a.count || b.lastUsed - a.lastUsed || a.skillName.localeCompare(b.skillName, 'en'),
  );
  const scenes = [...byScene.values()].map(withShare).sort(
    (a, b) => b.count - a.count || b.lastUsed - a.lastUsed || a.scenePath.localeCompare(b.scenePath, 'en'),
  );
  return { total, skills, scenes };
}

/* ------------------------------------------------------------------------ */
/* 上传解析：仅收集技能（文件夹层级不再产生场景）                              */
/* ------------------------------------------------------------------------ */

function parseFrontmatter(markdown) {
  const match = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(markdown || '');
  if (!match) return { ok: false, reasons: ['SKILL.md 缺少 frontmatter（需以 --- 开头和结束）。'] };
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }
  return { ok: true, fields };
}

function normalizeUploadFilePaths(item) {
  const reasons = [];
  const files = [];
  for (const file of item.files || []) {
    let raw = String(file.path || '');
    raw = raw.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '');
    raw = raw.replace(/\/+$/, '');
    if (!raw) continue;
    const segments = raw.split('/').filter((part) => part && part !== '.');
    if (!segments.length) continue;
    if (segments.includes('..')) {
      reasons.push(`路径包含非法片段：${raw}`);
      continue;
    }
    files.push({ path: segments.join('/'), content: file.content });
  }
  if (!files.length) reasons.push('所选文件夹为空。');
  return { files, reasons };
}

function buildDirIndex(files) {
  const dirs = new Map([['', { path: '', files: new Map() }]]);
  const ensureDir = (dirPath) => {
    let node = dirs.get(dirPath);
    if (node) return node;
    node = { path: dirPath, files: new Map() };
    dirs.set(dirPath, node);
    if (dirPath) {
      const parentPath = dirPath.includes('/') ? dirPath.slice(0, dirPath.lastIndexOf('/')) : '';
      ensureDir(parentPath);
    }
    return node;
  };
  for (const file of files) {
    const dirPath = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
    const fileName = file.path.slice(dirPath ? dirPath.length + 1 : 0);
    ensureDir(dirPath).files.set(fileName, file.content);
  }
  return dirs;
}

function dirDepth(dirPath) {
  return dirPath ? dirPath.split('/').filter(Boolean).length : 0;
}

function compareDirPaths(a, b) {
  return dirDepth(a) - dirDepth(b) || a.localeCompare(b, 'en');
}

function isInsideDir(dirPath, parentDir) {
  if (parentDir === '') return true;
  return dirPath === parentDir || dirPath.startsWith(`${parentDir}/`);
}

function analyzeUpload(item) {
  const source = Array.isArray(item) ? { files: item } : item || {};
  const name = String(source.name || '').trim();
  const normalized = normalizeUploadFilePaths(source);
  if (normalized.reasons.length) return { ok: false, reasons: normalized.reasons, name };

  const dirs = buildDirIndex(normalized.files);

  // 递归收集技能：含直接 SKILL.md 的文件夹整体为一个技能（子树资源全部保留）；
  // 已进入某个技能文件夹的子目录不再单独识别为技能。
  const skillDirs = [];
  for (const dirPath of [...dirs.keys()].sort(compareDirPaths)) {
    if (skillDirs.some((skillDir) => isInsideDir(dirPath, skillDir))) continue;
    if (dirs.get(dirPath).files.has('SKILL.md')) skillDirs.push(dirPath);
  }
  if (!skillDirs.length) {
    return { ok: false, reasons: ['所选文件夹中没有找到任何技能（未发现含直接 SKILL.md 的文件夹）。'], name };
  }

  const reasons = [];
  const skills = [];
  for (const skillDir of [...skillDirs].sort(compareDirPaths)) {
    const label = skillDir ? `技能文件夹「${skillDir}」` : '根技能文件夹';
    const markdown = dirs.get(skillDir).files.get('SKILL.md');
    const parsed = parseFrontmatter(markdown);
    if (!parsed.ok) {
      reasons.push(`${label}：${parsed.reasons.join('；')}`);
      continue;
    }
    const skillName = String(parsed.fields.name || '').trim();
    const description = String(parsed.fields.description || '').trim();
    if (!skillName) {
      reasons.push(`${label}：frontmatter 缺少 name。`);
      continue;
    }
    if (!SKILL_NAME_RE.test(skillName)) {
      reasons.push(`${label}：name 不符合 [a-z0-9][a-z0-9-]*（小写字母、数字、连字符，且不能以连字符开头）。`);
      continue;
    }
    if (!description) {
      reasons.push(`${label}：frontmatter 缺少非空 description。`);
      continue;
    }

    const renderedFiles = {};
    let contentError = false;
    for (const file of normalized.files) {
      const dirPath = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
      if (!isInsideDir(dirPath, skillDir)) continue;
      const rel = dirPath === skillDir
        ? file.path.slice(skillDir ? skillDir.length + 1 : 0)
        : `${dirPath.slice(skillDir.length + 1)}/${file.path.slice(dirPath.length + 1)}`;
      if (typeof file.content !== 'string') {
        reasons.push(`${label}/${rel} 的内容必须是字符串。`);
        contentError = true;
        continue;
      }
      renderedFiles[rel] = file.content;
    }
    if (contentError) continue;

    skills.push({
      folder: skillDir,
      name: skillName,
      description,
      files: renderedFiles,
    });
  }

  // 技能文件夹之外的散文件 → 忽略清单
  const ignoredFiles = normalized.files
    .map((file) => ({
      file,
      dirPath: file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '',
    }))
    .filter((entry) => !skillDirs.some((skillDir) => isInsideDir(entry.dirPath, skillDir)))
    .map((entry) => entry.file.path)
    .sort();

  return {
    ok: reasons.length === 0,
    reasons,
    name,
    skills,
    ignoredFiles,
    fileCount: normalized.files.length,
  };
}

function mergeUpload(catalog, item) {
  if (!catalog || !catalog.scenes || !catalog.skills || !catalog.rootSceneId || !catalog.scenes[catalog.rootSceneId]) {
    return { ok: false, reasons: ['目录无效。'] };
  }
  const analyzed = analyzeUpload(item);
  if (!analyzed.ok) return { ok: false, reasons: analyzed.reasons, name: analyzed.name };

  const next = clone(catalog);
  const added = [];
  const overwritten = [];
  for (const skill of analyzed.skills) {
    const existing = next.skills[skill.name];
    // 同名技能原地覆盖：createdAt 与使用历史保留
    next.skills[skill.name] = {
      name: skill.name,
      description: skill.description,
      createdAt: existing ? existing.createdAt : NOW,
      updatedAt: NOW,
    };
    if (existing) overwritten.push(skill.name);
    else added.push(skill.name);
  }

  return {
    ok: true,
    catalog: next,
    name: analyzed.name,
    skills: analyzed.skills,
    added,
    overwritten,
    ignoredFiles: analyzed.ignoredFiles,
    fileCount: analyzed.fileCount,
  };
}

/* ------------------------------------------------------------------------ */
/* 整理会话：提示词、计划模拟与执行                                           */
/* ------------------------------------------------------------------------ */

const MODE_LABEL = { classify: '自动分类', tidy: '一键整理', detect: '冲突检测' };
const MODE_BADGE = { classify: 'primary', tidy: 'warning', detect: 'neutral' };

function sceneSummary(catalog) {
  const lines = [];
  const walk = (sceneId, depth) => {
    const scene = catalog.scenes[sceneId];
    if (!scene) return;
    const skills = (scene.skills || []).length ? `（直接技能：${(scene.skills || []).join('、')}）` : '';
    lines.push(`${'  '.repeat(depth)}- ${scene.name}：${scene.description || '（无描述）'}${skills}`);
    (scene.children || []).forEach((childId) => walk(childId, depth + 1));
  };
  walk(catalog.rootSceneId, 0);
  return lines.join('\n');
}

function buildOrganizePrompt(mode, title, uploaded, overwritten) {
  const unclassified = unclassifiedSkills(state.catalog);
  const modeLine = mode === 'classify'
    ? '自动分类（仅处理本批上传技能）'
    : mode === 'detect'
      ? '冲突检测（只读，禁止任何修改）'
      : '一键整理（整树整理）';
  return [
    title,
    `模式：${modeLine}`,
    '可用工具：skill_organize（createScene / updateScene / deleteScene / moveScene / attachSkill / detachSkill）、skill_gateway（browse / load）。',
    '',
    '场景摘要（name + description + 直接挂载技能）：',
    sceneSummary(state.catalog),
    '',
    '未分类技能：',
    unclassified.length
      ? unclassified.map((skill) => `- ${skill.name}：${skill.description}`).join('\n')
      : '（无）',
    '',
    mode === 'classify'
      ? `本批上传技能：${(uploaded || []).join('、') || '（无新增）'}${overwritten && overwritten.length ? `；同名覆盖：${overwritten.join('、')}（保留 createdAt 与使用历史）` : ''}。任务：把本批技能归入最合适的场景；没有合适场景时新建场景（必须填写 name 与详细 description）；可多挂但需说明理由；禁止修改技能文件与描述、禁止删除技能；完成后输出整理报告（改动摘要 + 覆盖清单）。`
      : mode === 'detect'
        ? '任务：检测场景树中的冲突——内容高度相似的重复技能、语义重叠的模糊场景、挂载过散的技能，输出检测报告；明确禁止调用任何修改类工具。'
        : '任务：澄清场景边界、删除多余场景、归类未分类技能、补写场景描述；报告列出冲突与重复技能；禁止修改技能文件与描述、禁止删除技能；完成后输出整理报告。',
    '',
    '技能全文不嵌入提示词：需要时通过 skill_gateway browse/load 按需深读。',
  ].join('\n');
}

// 分类会话的归属建议：按技能内容关键词匹配现有场景，否则给出应新建的场景
function suggestSceneFor(skill) {
  const text = `${skill.name} ${skill.description}`.toLowerCase();
  if (/sql|数据库|索引|迁移|migration/.test(text)) return { sceneName: '数据库设计', description: null };
  if (/api|接口|rest|幂等/.test(text)) return { sceneName: '后端开发', description: null };
  if (/react|组件|前端|设计系统/.test(text)) return { sceneName: '组件开发', description: null };
  if (/测试|tdd|质量/.test(text)) return { sceneName: '测试与质量', description: null };
  if (/运维|监控|slo|可靠性|事故|告警|复盘/.test(text)) return { sceneName: '运维与可靠性', description: '线上系统运维、事故复盘、可观测性与 SLO 监控相关技能。' };
  return { sceneName: '技能收纳', description: '整理会话为本批暂无明确归属的技能创建的过渡场景，建议人工细分或改挂到更合适的场景。' };
}

function buildClassifyPlan(session) {
  const c = state.catalog;
  const steps = [];
  const uploaded = (session.uploaded || []).map((name) => c.skills[name]).filter(Boolean);

  steps.push({
    tool: { name: 'skill_gateway', action: 'browse', args: { action: 'browse' } },
    result: '根场景「工作台」，直接子场景：后端开发 / 前端开发 / 测试与质量。',
  });
  steps.push({
    assistant: `收到本批 ${uploaded.length} 个新技能${session.overwritten.length ? `，另有同名覆盖 ${session.overwritten.length} 个（原地覆盖、保留使用历史）` : ''}。逐一读取内容后决定归属。`,
  });

  for (const skill of uploaded) {
    steps.push({
      tool: { name: 'skill_gateway', action: 'load', args: { action: 'load', skillName: skill.name } },
      result: `返回 ${Object.keys(state.skillFiles[skill.name] || {}).length} 个文件（含 SKILL.md 全文）。`,
    });
    const suggestion = suggestSceneFor(skill);
    const existing = sceneByName(c, suggestion.sceneName);
    if (existing) {
      steps.push({
        tool: { name: 'skill_organize', action: 'attachSkill', args: { action: 'attachSkill', sceneId: existing.id, skillName: skill.name } },
        result: `已挂载 ${skill.name} → ${existing.name}。`,
        apply: (cat) => attachSkill(cat, existing.id, skill.name),
        reason: `「${skill.name}」的内容与「${existing.name}」的用途匹配。`,
        change: `归类技能：${skill.name} → ${existing.name}`,
      });
    } else {
      steps.push({
        createAndAttach: { name: suggestion.sceneName, description: suggestion.description, skillName: skill.name },
        tool: { name: 'skill_organize', action: 'createScene', args: { action: 'createScene', parentId: c.rootSceneId, name: suggestion.sceneName, description: suggestion.description } },
        result: `已创建场景「${suggestion.sceneName}」（含详细 description）并挂载 ${skill.name}。`,
      });
    }
  }

  steps.push({ assistant: '归类完成：本批技能均已进入场景，未分类分组已清空。' });
  return { steps, conflicts: [] };
}

function buildTidyPlan() {
  const c = state.catalog;
  const steps = [];
  const conflicts = [];

  const toolStep = (tool, result, extra = {}) => ({ tool, result, ...extra });

  steps.push({
    tool: { name: 'skill_gateway', action: 'browse', args: { action: 'browse' } },
    result: '根场景「工作台」，直接子场景：后端开发 / 前端开发 / 测试与质量。',
  });
  steps.push({ assistant: '开始整树整理：先补写场景描述澄清边界，再收拢分散挂载，最后删除冗余场景；疑似重复技能按需深读比对。' });

  const database = sceneByName(c, '数据库设计');
  if (database && !String(database.description || '').includes('执行计划')) {
    const description = '表结构、索引、迁移与查询性能相关技能；执行计划与索引评审收拢于此。';
    steps.push(toolStep(
      { name: 'skill_organize', action: 'updateScene', args: { action: 'updateScene', sceneId: database.id, description } },
      '已补写「数据库设计」的 description，澄清与 SQL 评审的边界。',
      {
        apply: (cat) => updateScene(cat, database.id, { description }),
        change: '补写场景描述：数据库设计',
      },
    ));
  }

  const backend = sceneByName(c, '后端开发');
  if (backend && (backend.skills || []).includes('sql-review')) {
    steps.push(toolStep(
      { name: 'skill_organize', action: 'detachSkill', args: { action: 'detachSkill', sceneId: backend.id, skillName: 'sql-review' } },
      '已解链 sql-review ← 后端开发（收拢为单挂载）。',
      {
        apply: (cat) => detachSkill(cat, backend.id, 'sql-review'),
        reason: 'sql-review 的语义归属「数据库设计」，后端开发不再重复挂载。',
        change: '收拢挂载：sql-review 仅保留于数据库设计',
      },
    ));
  }

  const frontend = sceneByName(c, '前端开发');
  if (frontend && (frontend.skills || []).includes('react-component')) {
    steps.push(toolStep(
      { name: 'skill_organize', action: 'detachSkill', args: { action: 'detachSkill', sceneId: frontend.id, skillName: 'react-component' } },
      '已解链 react-component ← 前端开发（收拢为单挂载）。',
      {
        apply: (cat) => detachSkill(cat, frontend.id, 'react-component'),
        reason: 'react-component 归属「组件开发」，前端开发不重复挂载。',
        change: '收拢挂载：react-component 仅保留于组件开发',
      },
    ));
  }

  const quality = sceneByName(c, '测试与质量');
  const components = sceneByName(c, '组件开发');
  if (quality && components && (quality.skills || []).includes('tdd')) {
    steps.push(toolStep(
      { name: 'skill_organize', action: 'detachSkill', args: { action: 'detachSkill', sceneId: quality.id, skillName: 'tdd' } },
      '已解链 tdd ← 测试与质量。',
      {
        apply: (cat) => detachSkill(cat, quality.id, 'tdd'),
        reason: 'move = detach + attach：把 tdd 移动到「组件开发」。',
        change: '移动挂载：tdd 测试与质量 → 组件开发',
      },
    ));
    steps.push(toolStep(
      { name: 'skill_organize', action: 'attachSkill', args: { action: 'attachSkill', sceneId: components.id, skillName: 'tdd' } },
      '已挂载 tdd → 组件开发。',
      { apply: (cat) => attachSkill(cat, components.id, 'tdd') },
    ));
  }

  if (quality) {
    steps.push(toolStep(
      { name: 'skill_organize', action: 'deleteScene', args: { action: 'deleteScene', sceneId: quality.id } },
      '已删除「测试与质量」（无直接技能，边界与「组件开发」重叠）。',
      {
        apply: (cat) => {
          const target = cat.scenes[quality.id];
          if (!target) return { ok: true, catalog: cat, changed: false, note: '「测试与质量」已不存在，跳过删除。' };
          if ((target.skills || []).length) {
            return { ok: true, catalog: cat, changed: false, note: '「测试与质量」仍有直接技能，跳过删除。' };
          }
          const removed = deleteScene(cat, quality.id);
          if (!removed.ok) return removed;
          return { ok: true, catalog: removed.catalog, changed: true, note: '已删除「测试与质量」（无直接技能，边界与「组件开发」重叠）。' };
        },
        change: '删除场景：测试与质量（技能已解链回未分类）',
      },
    ));
  }

  // 硬约束演示：技能文件/描述只读、技能删除仅用户可操作
  steps.push({
    rejected: true,
    tool: { name: 'skill_organize', action: 'updateSkill', args: { action: 'updateSkill', skillName: 'api-design', description: '改写为：…' } },
    reject: '硬约束：技能文件与技能描述对 Agent 只读，任何修改请求被拒绝。',
  });
  steps.push({
    rejected: true,
    tool: { name: 'skill_organize', action: 'deleteSkill', args: { action: 'deleteSkill', skillName: 'api-review' } },
    reject: '硬约束：技能删除（含文件清理）仅用户可操作，Agent 请求被拒绝。',
  });

  steps.push({ assistant: '整理完成。所有改动经 skill_organize 即时校验并持久化；报告包含冲突与重复清单，可一键回滚。' });

  conflicts.push(
    { kind: 'dup', tag: '重复技能', text: 'api-design 与 api-review：SKILL.md 内容高度相似（资源建模、错误语义、幂等性），建议人工合并后删除其一。' },
    { kind: 'overlap', tag: '语义重叠', text: '「测试与质量」与「组件开发」：tdd 双挂载、边界模糊——本次已删除「测试与质量」解决。' },
    { kind: 'scatter', tag: '挂载过散', text: 'sql-review（后端开发/数据库设计）、react-component（前端开发/组件开发）、tdd（组件开发/测试与质量）——本次已收拢为单挂载。' },
  );
  return { steps, conflicts };
}

function buildDetectPlan() {
  const c = state.catalog;
  const steps = [];

  steps.push({
    tool: { name: 'skill_gateway', action: 'browse', args: { action: 'browse' } },
    result: '根场景「工作台」，直接子场景：后端开发 / 前端开发 / 测试与质量。',
  });
  steps.push({ assistant: '只读检测：逐场景核对元数据，对疑似重复技能深读 SKILL.md 全文比对；不做任何修改。' });

  const backend = sceneByName(c, '后端开发');
  if (backend) {
    steps.push({
      tool: { name: 'skill_gateway', action: 'browse', args: { action: 'browse', sceneId: backend.id } },
      result: '「后端开发」直接技能：api-design、sql-review、api-review。',
    });
  }
  steps.push({
    tool: { name: 'skill_gateway', action: 'load', args: { action: 'load', skillName: 'api-design' } },
    result: '返回 api-design 的 SKILL.md 与 review-template.md。',
  });
  steps.push({
    tool: { name: 'skill_gateway', action: 'load', args: { action: 'load', skillName: 'api-review' } },
    result: '返回 api-review 的 SKILL.md 与 checklist.md。',
  });
  steps.push({ assistant: '比对完成：两份 SKILL.md 的检查项高度重合，判定为重复技能。输出检测报告，场景树未做任何改动。' });

  const conflicts = [
    { kind: 'dup', tag: '重复技能', text: 'api-design 与 api-review：SKILL.md 内容高度相似（资源建模、错误语义、幂等性），建议人工合并后删除其一。' },
    { kind: 'overlap', tag: '语义重叠', text: '「测试与质量」与「组件开发」：tdd 双挂载、场景边界模糊，建议澄清或合并场景。' },
    { kind: 'scatter', tag: '挂载过散', text: 'sql-review 挂载 2 处（后端开发、数据库设计）；react-component 挂载 2 处（前端开发、组件开发）；tdd 挂载 2 处（组件开发、测试与质量）。' },
  ];
  return { steps, conflicts };
}

function startOrganizeSession(mode, options = {}) {
  if (state.organizeRunning) {
    return { ok: false, error: '已有整理会话在运行：同一时间只允许一个整理会话。' };
  }
  const now = new Date();
  const title = `技能整理 #${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const session = {
    id: makeId('sess'),
    kind: 'organize',
    mode,
    title,
    status: 'running',
    createdAt: now.getTime(),
    events: [],
    changes: [],
    conflicts: [],
    rejected: [],
    uploaded: options.uploaded || [],
    overwritten: options.overwritten || [],
    plan: null,
    stepIndex: 0,
    timer: null,
    interrupted: false,
  };

  // 会话开始前按整理槽位打快照；冲突检测只读，不打快照
  if (mode !== 'detect') {
    state.snapshots.organize = {
      at: now.getTime(),
      catalog: clone(state.catalog),
      slotLabel: MODE_LABEL[mode],
    };
  }

  session.events.push({
    kind: 'system',
    title: `系统注入 · 整理提示词（${MODE_LABEL[mode]}）`,
    text: buildOrganizePrompt(mode, title, session.uploaded, session.overwritten),
    timestamp: now.getTime(),
  });

  const plan = mode === 'classify' ? buildClassifyPlan(session) : mode === 'tidy' ? buildTidyPlan() : buildDetectPlan();
  session.plan = plan.steps;
  session.conflicts = plan.conflicts || [];

  state.sessions.unshift(session);
  state.organizeRunning = true;
  state.activeSessionId = session.id;

  runNextOrganizeStep(session);
  return { ok: true, session };
}

function applyOrganizeStep(session, step) {
  const events = [];
  let resultText = step.result || '';

  if (step.rejected) {
    events.push({
      kind: 'reject',
      title: `skill_organize · ${step.tool.action}（被拒）`,
      text: `${JSON.stringify(step.tool.args, null, 2)}\n→ ${step.reject}`,
      timestamp: Date.now(),
    });
    return events;
  }

  if (step.tool) {
    if (step.apply) {
      const result = step.apply(state.catalog);
      if (result.ok) {
        state.catalog = result.catalog;
        if (result.changed !== false && step.change) session.changes.push(step.change);
        if (result.note) resultText = result.note;
      } else {
        resultText = `错误：${result.error}`;
      }
    } else if (step.createAndAttach) {
      const { name, description, skillName } = step.createAndAttach;
      let scene = sceneByName(state.catalog, name);
      if (!scene) {
        const created = createScene(state.catalog, state.catalog.rootSceneId, { name, description });
        if (!created.ok) {
          resultText = `错误：${created.error}`;
        } else {
          state.catalog = created.catalog;
          scene = state.catalog.scenes[created.sceneId];
          session.changes.push(`新建场景：${name}（含详细 description）`);
        }
      }
      if (scene) {
        const attached = attachSkill(state.catalog, scene.id, skillName);
        if (!attached.ok) {
          resultText = `错误：${attached.error}`;
        } else {
          state.catalog = attached.catalog;
          session.changes.push(`归类技能：${skillName} → ${scene.name}`);
        }
      }
    }
    events.push({
      kind: 'tool',
      title: `${step.tool.name} · ${step.tool.action}`,
      text: `${JSON.stringify(step.tool.args, null, 2)}\n→ ${resultText}${step.reason ? `（理由：${step.reason}）` : ''}`,
      timestamp: Date.now(),
    });
  }

  if (step.assistant) {
    events.push({ kind: 'assistant', text: step.assistant, timestamp: Date.now() });
  }
  return events;
}

function runNextOrganizeStep(session) {
  if (session.status !== 'running') return;
  const step = session.plan[session.stepIndex];
  if (!step) {
    finishOrganizeSession(session);
    return;
  }
  session.events.push(...applyOrganizeStep(session, step));
  session.stepIndex += 1;
  renderAll();
  session.timer = window.setTimeout(() => runNextOrganizeStep(session), 950);
}

function finishOrganizeSession(session) {
  session.status = 'done';
  session.finishedAt = Date.now();
  state.organizeRunning = false;
  session.events.push({
    kind: 'assistant',
    text: `整理完成。改动摘要 ${session.changes.length} 条${session.conflicts.length ? `，冲突与重复 ${session.conflicts.length} 项` : ''}，报告已持久化（侧边栏「场景树管理 → 整理报告」可查看与回滚）。`,
    timestamp: Date.now(),
  });
  state.report = {
    mode: session.mode,
    status: 'done',
    sessionId: session.id,
    title: session.title,
    startedAt: session.createdAt,
    finishedAt: session.finishedAt,
    changes: session.changes,
    conflicts: session.conflicts,
    overwritten: session.overwritten || [],
  };
  renderAll();
  toast(`${MODE_LABEL[session.mode]}完成：${session.changes.length} 条改动${session.conflicts.length ? `，${session.conflicts.length} 项冲突/重复` : ''}。可在报告卡片中查看并回滚。`, 'success', 5000);
}

function interruptOrganize() {
  const session = state.sessions.find((item) => item.status === 'running');
  if (!session) return;
  window.clearTimeout(session.timer);
  session.status = 'interrupted';
  session.finishedAt = Date.now();
  state.organizeRunning = false;
  session.events.push({
    kind: 'assistant',
    text: '会话已打断：已完成修改保留、快照仍在，不会自动回滚；可随时再次触发整理。',
    timestamp: Date.now(),
  });
  state.report = {
    mode: session.mode,
    status: 'interrupted',
    sessionId: session.id,
    title: session.title,
    startedAt: session.createdAt,
    finishedAt: session.finishedAt,
    changes: session.changes,
    conflicts: session.conflicts,
    overwritten: session.overwritten || [],
  };
  renderAll();
  toast('已打断整理会话：部分修改与快照保留，不会自动回滚。', 'warning', 5000);
}

function runningSession() {
  return state.sessions.find((item) => item.status === 'running') || null;
}

function activeSession() {
  const organize = state.sessions.find((item) => item.id === state.activeSessionId);
  if (organize) return organize;
  const history = state.historySessions.find((item) => item.id === state.activeSessionId) || state.historySessions[0];
  return {
    ...history,
    kind: 'chat',
    status: 'idle',
    events: state.chatEvents[history.id] || [],
  };
}

function sessionStatusBadge(session) {
  if (session.status === 'running') return `<span class="badge warning rail-status"><span class="dot warning"></span>整理中</span>`;
  if (session.status === 'interrupted') return `<span class="badge neutral rail-status">已打断</span>`;
  if (session.status === 'done') return `<span class="badge success rail-status"><span class="dot success"></span>已完成</span>`;
  return '';
}

/* ------------------------------------------------------------------------ */
/* 快照与回滚                                                                */
/* ------------------------------------------------------------------------ */

function openRollbackModal(slot) {
  const snapshot = state.snapshots[slot];
  if (!snapshot) {
    toast(slot === 'upload' ? '上传槽位没有快照。' : '整理槽位没有快照。', 'info');
    return;
  }
  if (state.organizeRunning) {
    toast('整理会话进行中，请等待会话结束后再回滚。', 'warning');
    return;
  }

  if (slot === 'upload') {
    const added = snapshot.batch.added || [];
    const overwritten = Object.keys(snapshot.batch.overwritten || {});
    openModal('rollback', { slot }, modalShell(
      '回滚上传',
      `<form data-form="rollback">
         <div class="notice danger">${icon('warning')}将还原到<b>上传前</b>的整棵树，本次回滚影响范围：</div>
         <ul class="reason-list" style="color:var(--ink-2);margin:8px 0 0">
           <li>删除本批新增技能文件（${added.length} 个）：${esc(added.join('、') || '无')}</li>
           <li>恢复被覆盖技能的原始文件（${overwritten.length} 个）：${esc(overwritten.join('、') || '无')}</li>
           <li>还原上传前的场景树与全部挂载关系</li>
         </ul>
         <div class="field-hint" style="margin-top:8px">使用历史统计不受影响；回滚后上传槽位快照被清空。</div>
       </form>`,
      `<button class="btn btn-ghost" type="button" data-close-modal>取消</button>
       <button class="btn btn-danger-soft" type="submit" form="rollback">回滚上传</button>`,
      'confirm',
    ));
  } else {
    const sceneCount = Object.keys(snapshot.catalog.scenes || {}).length;
    openModal('rollback', { slot }, modalShell(
      '回滚整理',
      `<form data-form="rollback">
         <div class="notice danger">${icon('warning')}将还原到<b>整理前</b>的整棵树：恢复 ${sceneCount} 个场景与全部挂载关系。</div>
         <div class="notice success" style="margin-top:8px">${icon('check')}整理回滚只还原 catalog，技能文件不会被触碰。</div>
         <div class="field-hint" style="margin-top:8px">回滚后整理槽位快照被清空，报告标记为已回滚。</div>
       </form>`,
      `<button class="btn btn-ghost" type="button" data-close-modal>取消</button>
       <button class="btn btn-danger-soft" type="submit" form="rollback">回滚整理</button>`,
      'confirm',
    ));
  }
}

function handleRollbackSubmit() {
  const slot = modalState.payload.slot;
  const snapshot = state.snapshots[slot];
  if (!snapshot) {
    toast('快照不存在或已被清空。', 'danger');
    return;
  }
  state.catalog = clone(snapshot.catalog);
  if (slot === 'upload') {
    for (const name of snapshot.batch.added || []) delete state.skillFiles[name];
    for (const [name, files] of Object.entries(snapshot.batch.overwritten || {})) {
      state.skillFiles[name] = clone(files);
    }
  }
  state.snapshots[slot] = null;
  if (slot === 'organize' && state.report) state.report.rolledBack = true;
  closeModal();
  toast(
    slot === 'upload'
      ? '已回滚到上传前：新增技能文件已删除，被覆盖文件已恢复，场景树已还原。'
      : '已回滚到整理前：场景树已整树还原，技能文件未变动。',
    'success',
    5000,
  );
  renderAll();
}

/* ------------------------------------------------------------------------ */
/* 全局 UI 状态                                                              */
/* ------------------------------------------------------------------------ */

const state = {
  catalog: seedCatalog(),
  skillFiles: seedSkillFiles(),
  usage: seedUsage(),
  config: { enabled: true },
  dataDir: '.skillgate/',
  tab: 'catalog',
  catalogView: 'tree',
  catalogSearch: '',
  selectedSceneId: 'root',
  collapsed: new Set(),
  statsSource: 'all',
  gatewayStack: ['root'],
  historySessions: [
    { id: 'hist_main', title: 'SQL 索引评审与迁移' },
    { id: 'hist_1', title: 'React 组件库重构' },
    { id: 'hist_2', title: '网关技能目录整理' },
    { id: 'hist_3', title: 'API 设计评审' },
  ],
  chatEvents: {
    hist_main: seedChatEvents(),
    hist_1: placeholderHistoryEvents(),
    hist_2: placeholderHistoryEvents(),
    hist_3: placeholderHistoryEvents(),
  },
  sessions: [],            // 整理会话（运行中/已完成/已打断，保留在侧边栏）
  activeSessionId: 'hist_main',
  organizeRunning: false,
  snapshots: { upload: null, organize: null },
  report: null,
};

let modalState = { type: null, payload: null };
let pendingUpload = null;

function resetState() {
  for (const session of state.sessions) {
    if (session.timer) window.clearTimeout(session.timer);
  }
  state.catalog = seedCatalog();
  state.skillFiles = seedSkillFiles();
  state.usage = seedUsage();
  state.config = { enabled: true };
  state.dataDir = '.skillgate/';
  state.tab = 'catalog';
  state.catalogView = 'tree';
  state.catalogSearch = '';
  state.selectedSceneId = 'root';
  state.collapsed = new Set();
  state.statsSource = 'all';
  state.gatewayStack = ['root'];
  state.sessions = [];
  state.activeSessionId = 'hist_main';
  state.chatEvents = {
    hist_main: seedChatEvents(),
    hist_1: placeholderHistoryEvents(),
    hist_2: placeholderHistoryEvents(),
    hist_3: placeholderHistoryEvents(),
  };
  state.organizeRunning = false;
  state.snapshots = { upload: null, organize: null };
  state.report = null;
  pendingUpload = null;
  closeModal();
  renderAll();
}

function toast(message, kind = 'info', options) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  const iconName = kind === 'success' ? 'check' : kind === 'danger' ? 'error' : kind === 'warning' ? 'warning' : 'info';
  el.innerHTML = `${icon(iconName)}<span>${esc(message)}</span>`;
  if (options && typeof options === 'object' && options.actionLabel) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = options.actionLabel;
    button.addEventListener('click', () => {
      if (options.onAction) options.onAction();
      el.remove();
    });
    el.appendChild(button);
  }
  root.appendChild(el);
  const timeout = typeof options === 'number' ? options : (options && options.duration) || (kind === 'danger' || kind === 'warning' ? 5000 : 3000);
  window.setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.2s ease';
    window.setTimeout(() => el.remove(), 220);
  }, timeout);
}

/* ------------------------------------------------------------------------ */
/* 渲染：面板骨架与场景树管理                                                 */
/* ------------------------------------------------------------------------ */

function renderAll() {
  const toggle = $('#gateway-toggle');
  if (toggle) toggle.checked = state.config.enabled;

  $$('#tab-bar [data-tab]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tab === state.tab);
  });

  renderPanelBody();
  renderRail();
  renderWorkspace();
  updatePanelToggleLabel();
}

function renderPanelBody() {
  const body = $('#panel-body');
  if (!body) return;
  body.innerHTML = '';
  if (state.tab === 'catalog') renderCatalog(body);
  if (state.tab === 'stats') renderStats(body);
  if (state.tab === 'gateway') renderGateway(body);
  body.scrollTop = 0;
}

function containsText(value, query) {
  return String(value || '').toLowerCase().includes(String(query || '').toLowerCase());
}

function sceneSelfMatches(scene, query) {
  return containsText(scene.name, query) ||
    containsText(scene.description, query) ||
    (scene.tags || []).some((tag) => containsText(tag, query));
}

function skillMetaMatches(skill, query) {
  return skill && (containsText(skill.name, query) || containsText(skill.description, query));
}

function sceneTreeMatches(catalog, sceneId, query) {
  const scene = catalog.scenes[sceneId];
  if (!scene) return false;
  if (!query) return true;
  if (sceneSelfMatches(scene, query)) return true;
  if (scene.children.some((childId) => sceneTreeMatches(catalog, childId, query))) return true;
  return (scene.skills || []).some((name) => skillMetaMatches(catalog.skills[name], query));
}

function sceneOptions(catalog, selectedId, depth = 0) {
  const root = catalog.scenes[catalog.rootSceneId];
  if (!root) return '';
  return `<option value="${esc(root.id)}" ${root.id === selectedId ? 'selected' : ''}>${esc(root.name)}</option>` +
    (root.children || []).map((childId) => sceneOptionsInner(catalog, childId, selectedId, depth + 1)).join('');
}

function sceneOptionsInner(catalog, sceneId, selectedId, depth) {
  const scene = catalog.scenes[sceneId];
  if (!scene) return '';
  const prefix = '　'.repeat(depth);
  return `<option value="${esc(scene.id)}" ${scene.id === selectedId ? 'selected' : ''}>${prefix}${esc(scene.name)}</option>` +
    (scene.children || []).map((childId) => sceneOptionsInner(catalog, childId, selectedId, depth + 1)).join('');
}

function renderCatalog(rootEl) {
  const busy = runningSession();
  rootEl.innerHTML = `
    <div class="panel-section">
      <div class="section-head">
        <div>
          <h2 class="section-title">场景树管理</h2>
          <p class="section-sub">上传只收集技能；未分类技能归类后才对网关可见。</p>
        </div>
        <div class="section-actions">
          <button class="btn btn-sm btn-ghost" type="button" data-action="upload">
            ${icon('upload')}上传
          </button>
          <button class="btn btn-sm btn-secondary" type="button" data-action="new-scene">
            ${icon('plus')}新建场景
          </button>
        </div>
      </div>

      <div class="organize-toolbar">
        <button class="btn btn-sm btn-ghost" type="button" data-action="organize-tidy" ${busy ? 'disabled title="整理会话进行中，完成后可再次触发"' : ''}>
          ${icon('wand')}一键整理
        </button>
        <button class="btn btn-sm btn-ghost" type="button" data-action="organize-detect" ${busy ? 'disabled title="整理会话进行中，完成后可再次触发"' : ''}>
          ${icon('radar')}冲突检测
        </button>
        ${busy ? `<span class="organize-status">${icon('clock')}整理会话进行中：${esc(busy.title)}（可到会话画布打断）</span>` : ''}
      </div>

      <div class="segmented sm view-switch" id="catalog-view-switch">
        <button type="button" data-view="tree" class="${state.catalogView === 'tree' ? 'is-active' : ''}">场景树</button>
        <button type="button" data-view="skills" class="${state.catalogView === 'skills' ? 'is-active' : ''}">全部技能</button>
      </div>

      <label class="search">
        ${icon('search')}
        <input id="catalog-search" type="search" value="${esc(state.catalogSearch)}" placeholder="搜索场景名称、描述、标签或技能">
      </label>

      <div id="catalog-view-root">${state.catalogView === 'tree' ? renderTreeCard() : renderSkillListCard()}</div>
      ${state.catalogView === 'tree' ? renderUnclassifiedCard() : ''}
      ${renderReportCard()}
      ${renderRollbackCard()}
      ${renderLocationCard()}
    </div>`;
}

function renderLocationCard() {
  return `
    <div class="card location-card">
      <span class="location-icon">${icon('database')}</span>
      <div class="location-main">
        <div class="location-title">数据落点</div>
        <div class="location-path">./${esc(state.dataDir)}</div>
        <div class="location-sub">catalog.json · usage.json · config.json · skills/ · snapshots/（上传/整理两个槽位）</div>
      </div>
      <button class="btn btn-sm btn-ghost" type="button" data-action="relocate">迁移</button>
    </div>`;
}

function renderTreeCard() {
  const catalog = state.catalog;
  const query = state.catalogSearch.trim();
  const root = catalog.scenes[catalog.rootSceneId];

  if (query && !sceneTreeMatches(catalog, catalog.rootSceneId, query)) {
    return `
      <div class="card">
        <div class="empty">
          <div class="empty-icon">${icon('search')}</div>
          <h3 class="empty-title">没有匹配的场景或技能</h3>
          <p class="empty-desc">换个关键词，或先上传技能、新建场景。</p>
          <div class="empty-actions">
            <button class="btn btn-secondary" type="button" data-action="clear-search">清除搜索</button>
          </div>
        </div>
      </div>`;
  }

  return `<div class="card tree-card" id="tree-card">${renderTreeLevel(root.id, 0, query)}</div>`;
}

function renderTreeLevel(sceneId, depth, query) {
  const catalog = state.catalog;
  const scene = catalog.scenes[sceneId];
  if (!scene) return '';
  if (query && !sceneTreeMatches(catalog, sceneId, query)) return '';

  const expanded = query ? true : !state.collapsed.has(sceneId);
  const hasChildren = (scene.children || []).length > 0;
  const skillNames = (scene.skills || []);
  const selfMatched = !query || sceneSelfMatches(scene, query);

  const skillsHtml = expanded
    ? (selfMatched || !query ? skillNames : skillNames.filter((name) => skillMetaMatches(catalog.skills[name], query)))
        .map((name) => renderSkillRow(name, sceneId, depth + 1))
        .join('')
    : '';

  const childrenHtml = expanded
    ? scene.children.map((childId) => renderTreeLevel(childId, depth + 1, query)).join('')
    : '';

  return `
    <div class="tree-node">
      <div class="tree-row ${state.selectedSceneId === sceneId ? 'is-selected' : ''}" style="padding-left:${8 + depth * 16}px" data-action="select-scene" data-id="${esc(scene.id)}" tabindex="0">
        ${hasChildren
          ? `<button class="tree-caret ${expanded ? 'is-expanded' : ''}" type="button" data-action="toggle-expand" data-id="${esc(scene.id)}" aria-label="${expanded ? '折叠' : '展开'}">${icon('chevron-right')}</button>`
          : '<span class="tree-spacer"></span>'}
        <span class="tree-icon">${icon('folder')}</span>
        <div class="tree-main">
          <div class="tree-title-line">
            <span class="tree-title">${esc(scene.name)}</span>
            ${hasChildren ? badge(`${scene.children.length} 子场景`, 'neutral') : ''}
            ${skillNames.length ? badge(`${skillNames.length} 技能`, 'primary') : ''}
          </div>
          ${scene.description ? `<div class="tree-desc">${esc(scene.description)}</div>` : ''}
          ${(scene.tags || []).length ? `<div class="tree-tags">${scene.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="tree-actions">
          <button class="icon-btn" type="button" data-action="new-child-scene" data-id="${esc(scene.id)}" title="新建子场景">${icon('plus')}</button>
          <button class="icon-btn" type="button" data-action="attach-scene-skills" data-id="${esc(scene.id)}" title="管理场景挂载的技能">${icon('link')}</button>
          ${scene.id !== catalog.rootSceneId ? `<button class="icon-btn" type="button" data-action="edit-scene" data-id="${esc(scene.id)}" title="编辑场景">${icon('edit')}</button>` : ''}
          ${scene.id !== catalog.rootSceneId ? `<button class="icon-btn danger" type="button" data-action="delete-scene" data-id="${esc(scene.id)}" title="删除场景">${icon('trash')}</button>` : ''}
        </div>
      </div>
      ${skillsHtml}
      ${childrenHtml}
    </div>`;
}

function renderSkillRow(skillName, sceneId, depth) {
  const catalog = state.catalog;
  const skill = catalog.skills[skillName];
  if (!skill) return '';
  const paths = skillPaths(catalog, skillName);
  const currentPath = scenePath(catalog, sceneId);

  return `
    <div class="skill-row" style="padding-left:${8 + depth * 16}px" data-action="skill-detail" data-id="${esc(skillName)}" tabindex="0">
      <span class="tree-spacer"></span>
      <span class="tree-icon">${icon('skill')}</span>
      <div class="tree-main">
        <div class="tree-title-line">
          <span class="tree-title mono">${esc(skill.name)}</span>
          ${paths.length > 1 ? badge(`挂载 ${paths.length} 处`, 'neutral') : ''}
        </div>
        <div class="tree-desc">${esc(skill.description)}</div>
        <div class="skill-scenes">
          <span class="path-chip" title="${esc(currentPath)}">${esc(currentPath)}</span>
        </div>
      </div>
      <div class="tree-actions">
        <button class="icon-btn" type="button" data-action="detach-scene-skill" data-scene="${esc(sceneId)}" data-skill="${esc(skillName)}" title="从当前场景解除挂载（技能回到未分类）">${icon('close')}</button>
      </div>
    </div>`;
}

function renderSkillListCard() {
  const query = state.catalogSearch.trim();
  const skills = Object.values(state.catalog.skills)
    .filter((skill) => !query || skillMetaMatches(skill, query))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name, 'en'));

  if (!skills.length) {
    return `
      <div class="card">
        <div class="empty">
          <div class="empty-icon">${icon('skill')}</div>
          <h3 class="empty-title">${query ? '没有匹配的技能' : '目录中还没有技能'}</h3>
          <p class="empty-desc">${query ? '换个关键词试试。' : '上传技能后，含 SKILL.md 的文件夹整体识别为一个技能；未分类技能会出现在「未分类」分组。'}</p>
          <div class="empty-actions">
            ${query ? `<button class="btn btn-secondary" type="button" data-action="clear-search">清除搜索</button>` : ''}
            <button class="btn btn-ghost" type="button" data-action="upload">上传</button>
          </div>
        </div>
      </div>`;
  }

  return `
    <div class="card">
      <div class="table-head">
        <span class="table-title">全部技能</span>
        <span class="table-count">${skills.length} 个技能 · 挂载点可在详情中管理</span>
      </div>
      <div class="skill-list">
        ${skills.map((skill) => {
          const paths = skillPaths(state.catalog, skill.name);
          return `
            <div class="skill-list-item" tabindex="0" data-action="skill-detail" data-id="${esc(skill.name)}">
              <span class="tree-icon">${icon('skill')}</span>
              <div class="skill-list-main">
                <div class="skill-name-line">
                  <span class="skill-name mono">${esc(skill.name)}</span>
                  ${paths.length ? badge(`${paths.length} 个挂载点`, 'primary') : badge('未分类', 'warning')}
                </div>
                <div class="skill-desc">${esc(skill.description)}</div>
                ${paths.length ? `<div class="skill-scenes">${paths.map((path) => `<span class="path-chip" title="${esc(path)}">${esc(path)}</span>`).join('')}</div>` : ''}
              </div>
              <div class="skill-list-actions">
                <button class="icon-btn" type="button" data-action="attach-skill" data-skill="${esc(skill.name)}" title="挂载到场景">${icon('link')}</button>
                <button class="icon-btn" type="button" data-action="skill-detail" data-id="${esc(skill.name)}" title="查看详情与文件">${icon('eye')}</button>
                <button class="icon-btn danger" type="button" data-action="delete-skill" data-id="${esc(skill.name)}" title="删除技能（仅用户可操作）">${icon('trash')}</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

/* ----------------------------- 未分类分组 ------------------------------- */

function renderUnclassifiedCard() {
  const skills = unclassifiedSkills(state.catalog);
  return `
    <div class="card">
      <div class="table-head">
        <span class="table-title">未分类技能</span>
        <span class="table-count">${skills.length} 个 · 网关 browse/find 不可见</span>
      </div>
      ${skills.length
        ? `
          <div class="skill-list">
            ${skills.map((skill) => `
              <div class="skill-list-item">
                <span class="tree-icon">${icon('skill')}</span>
                <div class="skill-list-main">
                  <div class="skill-name-line">
                    <span class="skill-name mono">${esc(skill.name)}</span>
                    ${badge('未分类', 'warning')}
                  </div>
                  <div class="skill-desc">${esc(skill.description)}</div>
                </div>
                <div class="skill-list-actions">
                  <button class="icon-btn" type="button" data-action="attach-skill" data-skill="${esc(skill.name)}" title="挂载到场景">${icon('link')}</button>
                  <button class="icon-btn" type="button" data-action="skill-detail" data-id="${esc(skill.name)}" title="预览文件">${icon('eye')}</button>
                </div>
              </div>`).join('')}
          </div>
          <div class="field-hint" style="padding:8px 12px 4px">上传后、解链后的技能都会出现在这里；整理会话会自动归类，也可手动挂载到任意场景。</div>`
        : `
          <div class="notice success" style="margin:0 12px 12px">${icon('check')}没有未分类技能：所有技能都已挂载到场景。</div>`}
    </div>`;
}

/* ----------------------------- 整理报告卡片 ----------------------------- */

function renderReportCard() {
  const report = state.report;
  if (!report) {
    return `
      <div class="card">
        <div class="table-head">
          <span class="table-title">整理报告</span>
          <span class="table-count">最近一份</span>
        </div>
        <div class="empty" style="padding:20px 16px 12px">
          <div class="empty-title" style="font-size:14px">还没有整理报告</div>
          <p class="empty-desc">上传技能会自动开启分类整理；也可以点页面头部的「一键整理」或「冲突检测」。只保留最近一份。</p>
        </div>
      </div>`;
  }

  const canRollback = report.mode !== 'detect' && state.snapshots.organize && !report.rolledBack && !state.organizeRunning;
  return `
    <div class="card report-card">
      <div class="table-head">
        <span class="table-title">整理报告</span>
        <span class="table-count">${esc(formatDateTime(report.startedAt))}</span>
      </div>
      <div class="report-meta">
        ${badge(MODE_LABEL[report.mode], MODE_BADGE[report.mode] || 'neutral')}
        ${report.status === 'interrupted' ? badge('已打断 · 部分修改保留', 'warning') : badge('已完成', 'success')}
        ${report.rolledBack ? badge('已回滚', 'danger') : ''}
        <span class="report-title">${esc(report.title)}</span>
      </div>
      <div class="report-block">
        <div class="report-block-title">改动摘要（${report.changes.length}）</div>
        ${report.changes.length
          ? `<ul class="report-list">${report.changes.map((change) => `<li>${esc(change)}</li>`).join('')}</ul>`
          : '<p class="report-empty">本次没有改动场景树。</p>'}
      </div>
      ${report.conflicts.length ? `
        <div class="report-block">
          <div class="report-block-title">冲突与重复（${report.conflicts.length}）</div>
          <ul class="report-list">
            ${report.conflicts.map((conflict) => `
              <li><span class="badge ${conflict.kind === 'dup' ? 'warning' : conflict.kind === 'overlap' ? 'warning' : 'neutral'}">${esc(conflict.tag)}</span>${esc(conflict.text)}</li>`).join('')}
          </ul>
        </div>` : ''}
      ${report.overwritten.length ? `
        <div class="report-block">
          <div class="report-block-title">覆盖清单</div>
          <ul class="report-list">
            ${report.overwritten.map((name) => `<li><span class="mono">${esc(name)}</span>：同名上传已原地覆盖，createdAt 与使用历史保留，旧版本未保留。</li>`).join('')}
          </ul>
        </div>` : ''}
      ${report.mode === 'detect'
        ? `<div class="notice info" style="margin-top:12px">${icon('info')}冲突检测为只读会话：未打快照、未改动场景树，无回滚入口。</div>`
        : ''}
      ${canRollback
        ? `<div class="report-footer">
             <button class="btn btn-sm btn-danger-soft" type="button" data-action="rollback-organize">${icon('undo')}回滚整理（还原整树）</button>
             <span class="field-hint">回滚仅还原 catalog，不触碰技能文件。</span>
           </div>`
        : ''}
    </div>`;
}

/* ----------------------------- 快照与回滚卡片 --------------------------- */

function renderRollbackCard() {
  const uploadSnapshot = state.snapshots.upload;
  const organizeSnapshot = state.snapshots.organize;
  const busy = state.organizeRunning;
  const busyTitle = busy ? ' title="整理会话进行中"' : '';
  return `
    <div class="card">
      <div class="table-head">
        <span class="table-title">快照与回滚</span>
        <span class="table-count">每个槽位只保留最近一份</span>
      </div>
      <div class="slot-row">
        <span class="slot-icon">${icon('box')}</span>
        <div class="slot-main">
          <div class="slot-title">上传槽位 ${uploadSnapshot ? badge(`快照 ${formatClock(uploadSnapshot.at)}`, 'primary') : badge('无快照', 'neutral')}</div>
          <div class="slot-desc">回滚 = 还原整树 + 删除本批新增技能文件 + 恢复被覆盖原文件。</div>
        </div>
        <button class="btn btn-sm btn-ghost" type="button" data-action="rollback-upload" ${uploadSnapshot && !busy ? '' : 'disabled'}${busyTitle}>回滚</button>
      </div>
      <div class="slot-row" style="border-top:1px solid var(--line-soft)">
        <span class="slot-icon">${icon('box')}</span>
        <div class="slot-main">
          <div class="slot-title">整理槽位 ${organizeSnapshot ? badge(`快照 ${formatClock(organizeSnapshot.at)} · ${organizeSnapshot.slotLabel}`, 'primary') : badge('无快照', 'neutral')}</div>
          <div class="slot-desc">回滚 = 仅还原 catalog，技能文件不触碰；冲突检测（只读）不产生快照。</div>
        </div>
        <button class="btn btn-sm btn-ghost" type="button" data-action="rollback-organize" ${organizeSnapshot && !busy ? '' : 'disabled'}${busyTitle}>回滚</button>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------------ */
/* 渲染：统计 tab                                                            */
/* ------------------------------------------------------------------------ */

function renderStats(rootEl) {
  const source = state.statsSource;
  const workspaceRecords = state.usage.filter((record) =>
    source === 'all' || (record.source === 'agent-skills' ? 'agent-skills' : 'gateway') === source,
  );
  const sessionRecords = workspaceRecords.filter((record) => (record.sessionId || SESSION_ID) === SESSION_ID);
  const stats = aggregateUsage(workspaceRecords, 'all');
  const timeline = [...sessionRecords].sort((a, b) => b.timestamp - a.timestamp);

  rootEl.innerHTML = `
    <div class="panel-section">
      <div class="section-head">
        <div>
          <h2 class="section-title">统计</h2>
          <p class="section-sub">会话内时间线 + 仓库级全局聚合；来源可过滤。</p>
        </div>
      </div>

      <div class="segmented sm" data-role="stats-source">
        <button type="button" data-source="all" class="${source === 'all' ? 'is-active' : ''}">全部</button>
        <button type="button" data-source="gateway" class="${source === 'gateway' ? 'is-active' : ''}">gateway</button>
        <button type="button" data-source="agent-skills" class="${source === 'agent-skills' ? 'is-active' : ''}">agent-skills</button>
      </div>

      <div class="stat-cards">
        <div class="card stat-card">
          <div class="stat-label">本会话使用</div>
          <div class="stat-value">${sessionRecords.length}</div>
          <div class="stat-foot">${source === 'all' ? 'gateway 与 agent-skills 合计' : `来源过滤：${source}`}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">仓库累计使用</div>
          <div class="stat-value">${workspaceRecords.length}</div>
          <div class="stat-foot">所有会话 · 所有时间</div>
        </div>
      </div>

      ${workspaceRecords.length
        ? `
          <div class="card table-card">
            <div class="table-head">
              <span class="table-title">全局统计 · 按技能</span>
              <span class="table-count">${stats.skills.length} 个技能 / ${stats.total} 次触发</span>
            </div>
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>技能</th><th class="num">次数</th><th>占比</th><th class="num">最近使用</th></tr></thead>
                <tbody>
                  ${stats.skills.map((row) => `
                    <tr>
                      <td><span class="primary-cell mono">${esc(row.skillName)}</span></td>
                      <td class="num">${row.count}</td>
                      <td><div class="progress cell-progress"><span class="progress-track"><span class="progress-fill" style="width:${Math.max(row.share * 100, row.count ? 3 : 0)}%"></span></span><span class="progress-text">${(row.share * 100).toFixed(1)}%</span></div></td>
                      <td class="num">${esc(formatRelative(row.lastUsed))}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card table-card">
            <div class="table-head">
              <span class="table-title">全局统计 · 按场景</span>
              <span class="table-count">${stats.scenes.length} 个场景路径</span>
            </div>
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>场景路径</th><th class="num">次数</th><th>占比</th><th class="num">最近使用</th></tr></thead>
                <tbody>
                  ${stats.scenes.map((row) => `
                    <tr>
                      <td><span class="primary-cell">${esc(row.scenePath)}</span></td>
                      <td class="num">${row.count}</td>
                      <td><div class="progress cell-progress"><span class="progress-track"><span class="progress-fill" style="width:${Math.max(row.share * 100, 3)}%"></span></span><span class="progress-text">${(row.share * 100).toFixed(1)}%</span></div></td>
                      <td class="num">${esc(formatRelative(row.lastUsed))}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card table-card">
            <div class="table-head">
              <span class="table-title">会话内使用时间线</span>
              <span class="table-count">${timeline.length} 条 · 当前会话</span>
            </div>
            <ol class="timeline">
              ${timeline.map((record) => `
                <li class="timeline-item ${record.source === 'agent-skills' ? 'agent' : ''}">
                  <div class="timeline-line">
                    <span class="timeline-time">${esc(formatClock(record.timestamp))}</span>
                    <span class="timeline-skill mono">${esc(record.skillName)}</span>
                    ${record.source === 'gateway' ? badge('gateway', 'primary') : badge('agent-skills', 'neutral')}
                  </div>
                  ${record.scenePath ? `<div class="timeline-path">${icon('folder')} ${esc(record.scenePath)}</div>` : '<div class="timeline-path">harness 默认技能加载，无场景路径</div>'}
                </li>`).join('')}
            </ol>
          </div>`
        : `
          <div class="card">
            <div class="empty">
              <div class="empty-icon">${icon('stats')}</div>
              <h3 class="empty-title">${source === 'all' ? '还没有使用记录' : '该来源下没有记录'}</h3>
              <p class="empty-desc">gateway load 与 harness 默认 skill 调用都会被观察器记录；开关关闭时统计仍然生效。</p>
              <div class="empty-actions">
                <button class="btn btn-secondary" type="button" data-action="go-gateway">去网关取用演示</button>
              </div>
            </div>
          </div>`}
    </div>`;
}

/* ------------------------------------------------------------------------ */
/* 渲染：网关取用 tab（browse → load 渐进式加载演示）                         */
/* ------------------------------------------------------------------------ */

function currentGatewaySceneId() {
  return state.gatewayStack[state.gatewayStack.length - 1] || state.catalog.rootSceneId;
}

function renderGateway(rootEl) {
  const enabled = state.config.enabled;
  const currentId = currentGatewaySceneId();
  const result = browse(state.catalog, currentId);
  if (!result.ok) {
    rootEl.innerHTML = `<div class="card"><div class="notice danger">${icon('error')}${esc(result.error)}</div></div>`;
    return;
  }

  const breadcrumbParts = result.path.split(' / ');
  rootEl.innerHTML = `
    <div class="panel-section">
      <div class="section-head">
        <div>
          <h2 class="section-title">网关取用</h2>
          <p class="section-sub">模拟 Agent 调用 skill_gateway：逐层 browse，再 load 全文。</p>
        </div>
      </div>

      ${enabled
        ? `<div class="notice info">${icon('info')}开关 ON：<b>skill_gateway</b> 工具已注册，系统提示词已注入；未分类技能不参与 browse/find。</div>`
        : `<div class="notice danger">${icon('error')}开关 OFF：工具与提示词已卸下。<pre class="prompt-pre" style="margin-top:8px">${esc(JSON.stringify({ ok: false, action: 'browse', error: 'skill gateway 已关闭。', usageRecorded: false }, null, 2))}</pre></div>`}

      <div class="card">
        <div class="table-head" style="padding:0 0 10px">
          <div class="breadcrumb">
            ${breadcrumbParts.map((part, index) => `${index ? icon('chevron-right') : ''}<span class="${index === breadcrumbParts.length - 1 ? 'current' : ''}">${esc(part)}</span>`).join('')}
          </div>
          <div style="display:flex;gap:8px;flex:0 0 auto">
            ${state.gatewayStack.length > 1
              ? `<button class="btn btn-sm btn-ghost" type="button" data-action="gateway-back" ${enabled ? '' : 'disabled'}>${icon('arrow-left')}后退</button>`
              : ''}
            ${result.parentId
              ? `<button class="btn btn-sm btn-ghost" type="button" data-action="gateway-up" ${enabled ? '' : 'disabled'}>${icon('arrow-up')}父场景</button>`
              : ''}
            ${state.gatewayStack.length > 1
              ? `<button class="btn btn-sm btn-secondary" type="button" data-action="gateway-root" ${enabled ? '' : 'disabled'}>根场景</button>`
              : ''}
          </div>
        </div>
        <p class="gateway-scene-desc">${esc(result.description)}</p>
        ${(result.tags || []).length ? `<div class="tree-tags" style="margin-top:8px">${result.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}</div>` : ''}
      </div>

      <div class="card">
        <div class="table-head" style="padding:0 0 10px">
          <span class="table-title">直接子场景</span>
          <span class="table-count">${result.children.length} 个</span>
        </div>
        ${result.children.length
          ? `<div class="gateway-list">
              ${result.children.map((child) => `
                <div class="gateway-item">
                  <span class="tree-icon">${icon('folder')}</span>
                  <div class="gateway-item-main">
                    <div class="gateway-item-title">${esc(child.name)}</div>
                    <div class="gateway-item-desc">${esc(child.description)}</div>
                    <div class="gateway-item-meta">
                      ${badge(`${child.childCount} 子场景`, 'neutral')}
                      ${badge(`${child.skillCount} 直接技能`, 'primary')}
                    </div>
                  </div>
                  <button class="btn btn-sm btn-secondary" type="button" data-action="gateway-enter" data-id="${esc(child.id)}" ${enabled ? '' : 'disabled'}>进入</button>
                </div>`).join('')}
            </div>`
          : `<div class="notice info">${icon('info')}当前场景没有直接子场景。</div>`}
      </div>

      <div class="card">
        <div class="table-head" style="padding:0 0 10px">
          <span class="table-title">直接挂载的技能</span>
          <span class="table-count">${result.skills.length} 个 · load 会记录 gateway 使用</span>
        </div>
        ${result.skills.length
          ? `<div class="gateway-list">
              ${result.skills.map((skill) => `
                <div class="gateway-item">
                  <span class="tree-icon">${icon('skill')}</span>
                  <div class="gateway-item-main">
                    <div class="gateway-item-title mono">${esc(skill.name)}</div>
                    <div class="gateway-item-desc">${esc(skill.description)}</div>
                  </div>
                  <button class="btn btn-sm btn-primary" type="button" data-action="gateway-load" data-id="${esc(skill.name)}" ${enabled ? '' : 'disabled'}>加载全文</button>
                </div>`).join('')}
            </div>`
          : `<div class="notice info">${icon('info')}当前场景没有直接挂载的技能，继续进入子场景浏览。</div>`}
      </div>

      <details class="card">
        <summary>${icon('chevron-right')}系统提示词（开关 ON 时注入）</summary>
        <pre class="prompt-pre">${esc([
          '在任何设计、执行开始前，先通过 skill_gateway 逐层深入，探索合适的 skill 加载至上下文中。',
          '1. browse() 返回根场景的直接子场景和直接技能。',
          '2. browse(sceneId) 逐层进入，不要跳过场景或猜测 scene id。',
          '3. load(skillName, scenePath?) 一次性加载选定技能的文件夹全文。',
          '4. 有多个合适场景时可以分别进入并加载多个技能。',
          '5. browse/find 只返回已挂载技能：未分类技能不可见。'
        ].join('\n'))}</pre>
      </details>
    </div>`;
}

/* ------------------------------------------------------------------------ */
/* 渲染：DSH 会话列表（左侧导航）与会话画布                                   */
/* ------------------------------------------------------------------------ */

function renderRail() {
  const rail = $('#rail-sessions');
  if (!rail) return;
  const renderItem = (session, isOrganize) => `
    <button class="rail-item ${state.activeSessionId === session.id ? 'is-active' : ''}" type="button" data-session="${esc(session.id)}">
      ${icon(isOrganize ? 'wand' : 'chat')}
      <span class="rail-item-text">${esc(session.title)}</span>
      ${isOrganize ? sessionStatusBadge(session) : ''}
    </button>`;

  rail.innerHTML = `
    <div class="rail-group">历史会话</div>
    ${state.historySessions.map((session) => renderItem(session, false)).join('')}
    ${state.sessions.length ? `<div class="rail-group">整理会话</div>${state.sessions.map((session) => renderItem(session, true)).join('')}` : ''}`;
}

function renderWorkspace() {
  const session = activeSession();

  const titleEl = $('#chat-header-title');
  const subEl = $('#chat-header-sub');
  const actionsEl = $('#chat-header-actions');
  if (titleEl) titleEl.textContent = session.title;
  if (subEl) {
    if (session.kind === 'organize') {
      subEl.innerHTML = `整理会话 · ${MODE_LABEL[session.mode]} · skill_organize 已挂载 ${sessionStatusBadge(session)}`;
    } else {
      subEl.textContent = 'session_20250815_a1b2 · gateway 已开启';
    }
  }
  if (actionsEl) {
    actionsEl.innerHTML = session.kind === 'organize' && session.status === 'running'
      ? `<button class="btn btn-sm btn-danger-soft" type="button" id="interrupt-organize">${icon('stop')}打断整理</button>`
      : '';
  }

  const feed = $('#chat-feed');
  if (feed) {
    feed.innerHTML = `<div class="chat-inner">${session.events.map(renderChatEvent).join('')}</div>`;
    feed.scrollTop = feed.scrollHeight;
  }

  const composer = $('#chat-composer-text');
  if (composer) {
    composer.textContent = session.kind === 'organize'
      ? session.status === 'running'
        ? '整理会话进行中…可随时打断；技能文件与描述对 Agent 只读。'
        : session.status === 'interrupted'
          ? '会话已打断：部分修改与快照保留，不会自动回滚；可继续对话要求修正。'
          : '整理已完成。可继续对话要求修正，或在「场景树管理 → 整理报告」中一键回滚。'
      : '在真实 DSH 中，Agent 先通过 skill_gateway 逐层浏览，再 load 选定技能。';
  }
}

function renderChatEvent(event) {
  if (event.kind === 'day') return `<div class="chat-day">${esc(event.text)}</div>`;
  if (event.kind === 'system') {
    return `
      <div class="tool-card system-card">
        <div class="tool-card-head">${icon('wand')}<span>${esc(event.title)}</span><span class="mono" style="color:var(--ink-4)">${esc(formatClock(event.timestamp || NOW))}</span></div>
        <pre>${esc(event.text)}</pre>
      </div>`;
  }
  if (event.kind === 'reject') {
    return `
      <div class="tool-card reject-card">
        <div class="tool-card-head">${icon('warning')}<span>${esc(event.title)}</span><span class="mono" style="color:var(--ink-4)">${esc(formatClock(event.timestamp || NOW))}</span></div>
        <pre>${esc(event.text)}</pre>
      </div>`;
  }
  if (event.kind === 'tool') {
    return `
      <div class="tool-card">
        <div class="tool-card-head">${icon('gateway')}<span>${esc(event.title)}</span><span class="mono" style="color:var(--ink-4)">${esc(formatClock(event.timestamp || NOW))}</span></div>
        <pre>${esc(event.text)}</pre>
      </div>`;
  }
  if (event.kind === 'assistant') {
    return `<div class="chat-msg"><span class="avatar">AI</span><div class="chat-bubble">${esc(event.text)}</div><span class="chat-time">${esc(formatClock(event.timestamp || NOW))}</span></div>`;
  }
  return `<div class="chat-msg user"><span class="avatar">Z</span><div class="chat-bubble">${esc(event.text)}</div><span class="chat-time">${esc(formatClock(event.timestamp || NOW))}</span></div>`;
}

function appendChatEvent(event) {
  const session = activeSession();
  if (session.kind === 'chat') {
    if (!state.chatEvents[session.id]) state.chatEvents[session.id] = [];
    state.chatEvents[session.id].push({ ...event, timestamp: event.timestamp || NOW });
    renderWorkspace();
  }
}

/* ------------------------------------------------------------------------ */
/* 面板开合                                                                  */
/* ------------------------------------------------------------------------ */

function isPanelOpen() {
  return document.body.classList.contains('panel-open');
}

function setPanelOpen(open) {
  document.body.classList.toggle('panel-open', open);
  document.body.classList.toggle('panel-closed', !open);
  updatePanelToggleLabel();
}

function updatePanelToggleLabel() {
  const button = $('#panel-toggle');
  if (!button) return;
  button.innerHTML = isPanelOpen()
    ? `${icon('close')}关闭侧边栏`
    : `${icon('panel')}打开 Skill Gateway`;
}

/* ------------------------------------------------------------------------ */
/* 弹窗系统                                                                  */
/* ------------------------------------------------------------------------ */

function modalShell(title, bodyHtml, footerHtml = '', size = '') {
  return `
    <div class="modal-backdrop">
      <section class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header class="modal-header">
          <h2 class="modal-title" id="modal-title">${esc(title)}</h2>
          <button class="icon-btn" type="button" data-close-modal aria-label="关闭弹窗">${icon('close')}</button>
        </header>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<footer class="modal-footer">${footerHtml}</footer>` : ''}
      </section>
    </div>`;
}

function openModal(type, payload, html, options = {}) {
  modalState = { type, payload };
  $('#modal-root').innerHTML = html;
  if (options.afterOpen) options.afterOpen();
}

function closeModal() {
  modalState = { type: null, payload: null };
  $('#modal-root').innerHTML = '';
}

/* ----------------------------- 场景表单 -------------------------------- */

function openSceneModal(mode, payload = {}) {
  const sceneId = payload.sceneId || null;
  const defaultParentId = payload.parentId || state.selectedSceneId || state.catalog.rootSceneId;
  const scene = sceneId ? state.catalog.scenes[sceneId] : null;
  const isEdit = Boolean(sceneId && scene);

  const parentField = isEdit
    ? `<div class="field">
         <span class="field-label">父场景</span>
         <div class="notice info">${icon('folder')}${esc(scenePath(state.catalog, scene.parentId))}</div>
       </div>`
    : `<div class="field">
         <label class="field-label" for="scene-parent">父场景</label>
         <select id="scene-parent" name="parentId">${sceneOptions(state.catalog, defaultParentId)}</select>
       </div>`;

  openModal(isEdit ? 'scene-edit' : 'scene-create', { sceneId, isEdit }, modalShell(
    isEdit ? '编辑场景' : '新建场景',
    `<form data-form="scene-form">
       <input type="hidden" name="sceneId" value="${esc(sceneId || '')}">
       ${parentField}
       <div class="field">
         <label class="field-label" for="scene-name"><span class="required">*</span>场景名称</label>
         <input id="scene-name" name="name" type="text" maxlength="40" value="${esc(scene ? scene.name : '')}" placeholder="如：后端开发">
         <div class="field-hint">全局唯一，不能为空。根场景不可删除。</div>
       </div>
       <div class="field">
         <label class="field-label" for="scene-description">场景描述</label>
         <textarea id="scene-description" name="description" rows="3" maxlength="160" placeholder="这个场景用于完成什么目的？">${esc(scene ? scene.description : '')}</textarea>
         <div class="field-hint">建议填写详细描述：整理会话中的 Agent 会按描述判断技能归属。</div>
       </div>
       <div class="field">
         <label class="field-label" for="scene-tags">标签</label>
         <input id="scene-tags" name="tags" type="text" value="${esc(scene ? (scene.tags || []).join(', ') : '')}" placeholder="用逗号分隔，如 api, service">
         <div class="field-hint">标签会参与 skill_gateway 匹配，可留空。</div>
       </div>
       <div class="form-error hidden" id="scene-form-error"></div>
     </form>`,
    `<button class="btn btn-ghost" type="button" data-close-modal>取消</button>
     <button class="btn btn-primary" type="submit" form="scene-form">${isEdit ? '保存修改' : '创建场景'}</button>`,
  ));
}

function handleSceneFormSubmit(form) {
  const errorBox = $('#scene-form-error');
  const nameInput = form.elements.name;
  const name = nameInput.value.trim();
  const description = form.elements.description.value.trim();
  const tags = form.elements.tags.value.trim();

  let result;
  if (modalState.type === 'scene-edit') {
    result = updateScene(state.catalog, modalState.payload.sceneId, { name, description, tags });
  } else {
    result = createScene(state.catalog, form.elements.parentId.value, { name, description, tags });
  }

  if (!result.ok) {
    errorBox.textContent = result.error;
    errorBox.classList.remove('hidden');
    nameInput.classList.add('is-invalid');
    nameInput.focus();
    return;
  }

  state.catalog = result.catalog;
  if (result.sceneId) state.selectedSceneId = result.sceneId;
  if (modalState.type === 'scene-create' && result.sceneId) state.collapsed.delete(form.elements.parentId.value);
  closeModal();
  toast(modalState.type === 'scene-edit' ? '场景已更新。' : '场景已创建。', 'success');
  renderAll();
}

/* ----------------------------- 删除场景 -------------------------------- */

function openDeleteSceneModal(sceneId) {
  const scene = state.catalog.scenes[sceneId];
  if (!scene) return;
  const deletedIds = collectDescendants(state.catalog, sceneId);
  const affectedSkills = new Set();
  for (const id of deletedIds) {
    (state.catalog.scenes[id].skills || []).forEach((name) => affectedSkills.add(name));
  }

  openModal('delete-scene', { sceneId }, modalShell(
    '删除场景',
    `<form data-form="delete-scene">
       <div class="notice warning">${icon('warning')}即将删除 <b>${deletedIds.length}</b> 个场景（含 ${Math.max(deletedIds.length - 1, 0)} 个子场景）。子场景会级联删除。</div>
       <div class="field" style="margin:16px 0 0">
         <span class="field-label">受影响技能</span>
         ${affectedSkills.size
           ? `<div class="skill-scenes">${[...affectedSkills].map((name) => badge(name, 'neutral')).join('')}</div>
              <div class="field-hint">技能只会从这些场景解除挂载并回到「未分类」分组，技能文件与历史统计都会保留。</div>`
           : '<div class="field-hint">这些场景没有直接或间接挂载技能。</div>'}
       </div>
     </form>`,
    `<button class="btn btn-ghost" type="button" data-close-modal>取消</button>
     <button class="btn btn-danger-soft" type="submit" form="delete-scene">删除场景</button>`,
    'confirm',
  ));
}

function handleDeleteSceneSubmit() {
  const sceneId = modalState.payload.sceneId;
  const result = deleteScene(state.catalog, sceneId);
  if (!result.ok) {
    toast(result.error, 'danger');
    return;
  }
  state.catalog = result.catalog;
  if (state.selectedSceneId === sceneId || result.deletedIds.includes(state.selectedSceneId)) {
    state.selectedSceneId = state.catalog.rootSceneId;
  }
  state.gatewayStack = [state.catalog.rootSceneId];
  closeModal();
  toast(`已删除 ${result.deletedIds.length} 个场景，技能均已解链回未分类。`, 'success');
  renderAll();
}

/* ----------------------- 场景挂载技能选择器 ----------------------------- */

function openSkillPickerModal(sceneId) {
  const scene = state.catalog.scenes[sceneId];
  if (!scene) return;
  const skills = Object.values(state.catalog.skills).sort((a, b) => a.name.localeCompare(b.name, 'en'));

  openModal('skill-picker', { sceneId }, modalShell(
    '管理场景挂载的技能',
    `<form data-form="skill-picker">
       <input type="hidden" name="sceneId" value="${esc(sceneId)}">
       <label class="search">
         ${icon('search')}
         <input id="skill-picker-search" type="search" placeholder="搜索技能名称或描述">
       </label>
       <div class="field" style="margin:16px 0 0">
         <span class="field-label">${esc(scene.name)} 的直接技能</span>
         <div class="check-list" id="skill-picker-list">
           ${skills.map((skill) => `
             <label class="check-row" data-text="${esc(`${skill.name} ${skill.description}`.toLowerCase())}">
               <input type="checkbox" name="skills" value="${esc(skill.name)}" ${scene.skills.includes(skill.name) ? 'checked' : ''}>
               <span class="check-row-main">
                 <span class="check-row-title mono">${esc(skill.name)}</span>
                 <span class="check-row-desc">${esc(skill.description)}</span>
               </span>
               <span class="badge ${scene.skills.includes(skill.name) ? 'primary' : 'neutral'}">${scene.skills.includes(skill.name) ? '已挂载' : '未挂载'}</span>
             </label>`).join('')}
         </div>
       </div>
       <div class="field-hint">一个技能可以同时挂载到多个场景；取消勾选只会解除当前场景的挂载（技能回到未分类）。</div>
     </form>`,
    `<button class="btn btn-ghost" type="button" data-close-modal>取消</button>
     <button class="btn btn-primary" type="submit" form="skill-picker">保存挂载</button>`,
  ));
}

function filterSkillPicker(query) {
  $$('#skill-picker-list .check-row').forEach((row) => {
    row.classList.toggle('hidden', !row.dataset.text.includes(query.toLowerCase()));
  });
}

function handleSkillPickerSubmit(form) {
  const sceneId = form.elements.sceneId.value;
  const before = new Set(state.catalog.scenes[sceneId].skills || []);
  const after = new Set($$('input[name="skills"]:checked', form).map((input) => input.value));
  let attached = 0;
  let detached = 0;

  for (const name of after) {
    if (before.has(name)) continue;
    const result = attachSkill(state.catalog, sceneId, name);
    if (result.ok) {
      state.catalog = result.catalog;
      if (result.added) attached += 1;
    }
  }
  for (const name of before) {
    if (after.has(name)) continue;
    const result = detachSkill(state.catalog, sceneId, name);
    if (result.ok) {
      state.catalog = result.catalog;
      if (result.removed) detached += 1;
    }
  }

  closeModal();
  if (attached || detached) toast(`挂载 ${attached} 个，解链 ${detached} 个。`, 'success');
  else toast('挂载关系没有变化。', 'info');
  renderAll();
}

/* ----------------------- 技能挂载到场景 --------------------------------- */

function openAttachSkillModal(skillName) {
  const skill = state.catalog.skills[skillName];
  if (!skill) return;
  const firstPath = skillPaths(state.catalog, skillName)[0];
  const scene = Object.values(state.catalog.scenes).find((item) => scenePath(state.catalog, item.id) === firstPath);
  const selectedId = scene ? scene.id : state.selectedSceneId;
  const isUnclassified = !firstPath;

  openModal('attach-skill', { skillName }, modalShell(
    '挂载技能到场景',
    `<form data-form="attach-skill">
       <input type="hidden" name="skillName" value="${esc(skillName)}">
       <div class="notice info" style="margin-bottom:16px">${icon('skill')}${esc(skillName)}：${esc(skill.description)}</div>
       ${isUnclassified ? `<div class="notice warning" style="margin-bottom:12px">${icon('warning')}该技能当前未分类：网关 browse/find 不会返回它，挂载后立即可见。</div>` : ''}
       <div class="field">
         <label class="field-label" for="attach-scene-select">目标场景</label>
         <select id="attach-scene-select" name="sceneId">${sceneOptions(state.catalog, selectedId)}</select>
       </div>
       <div class="field-hint">同一技能可挂载到多个场景；重复挂载同一场景不会产生重复记录。</div>
     </form>`,
    `<button class="btn btn-ghost" type="button" data-close-modal>取消</button>
     <button class="btn btn-primary" type="submit" form="attach-skill">确认挂载</button>`,
  ));
}

function handleAttachSkillSubmit(form) {
  const skillName = form.elements.skillName.value;
  const sceneId = form.elements.sceneId.value;
  const result = attachSkill(state.catalog, sceneId, skillName);
  if (!result.ok) {
    toast(result.error, 'danger');
    return;
  }
  state.catalog = result.catalog;
  closeModal();
  toast(result.added ? `已挂载到「${state.catalog.scenes[sceneId].name}」，技能已移出未分类。` : '该场景已挂载此技能。', result.added ? 'success' : 'info');
  renderAll();
}

/* ----------------------- 技能详情与文件预览 ------------------------------ */

function openSkillDetailModal(skillName) {
  const skill = state.catalog.skills[skillName];
  if (!skill) return;
  const files = state.skillFiles[skillName] || {};
  const paths = skillPaths(state.catalog, skillName);
  const isUnclassified = !paths.length;

  openModal('skill-detail', { skillName }, modalShell(
    `技能详情 · ${skillName}`,
    `<div class="notice info" style="margin-bottom:16px">${icon('info')}${esc(skill.description)}</div>
     <div class="stat-cards" style="grid-template-columns:1fr 1fr;margin-bottom:16px">
       <div class="stat-card" style="padding:12px;border:1px solid var(--line-soft);border-radius:var(--r-sm)">
         <div class="stat-label">创建时间</div><div class="stat-value" style="font-size:14px">${esc(formatDateTime(skill.createdAt))}</div>
       </div>
       <div class="stat-card" style="padding:12px;border:1px solid var(--line-soft);border-radius:var(--r-sm)">
         <div class="stat-label">最近更新</div><div class="stat-value" style="font-size:14px">${esc(formatRelative(skill.updatedAt))}</div>
       </div>
     </div>
     <div class="field">
       <span class="field-label">挂载场景（${paths.length}）</span>
       ${paths.length
         ? `<div class="skill-scenes">${paths.map((path) => `<span class="path-chip" title="${esc(path)}">${esc(path)}</span>`).join('')}</div>`
         : `<div class="notice warning">${icon('warning')}未分类：尚未挂载到任何场景，网关 browse/find 不会返回该技能；可手动挂载或由整理会话归类。</div>`}
     </div>
     <div class="field">
       <span class="field-label">技能文件夹（${Object.keys(files).length} 个文件）</span>
       <div class="check-list">
         ${Object.keys(files).sort().map((file) => `
           <button class="file-tree-item check-row" type="button" data-action="preview-file" data-skill="${esc(skillName)}" data-file="${esc(file)}" style="border:1px solid var(--line);background:var(--bg);width:100%;text-align:left">
             ${icon('file')}<span class="check-row-main"><span class="check-row-title mono">${esc(file)}</span></span>
           </button>`).join('')}
       </div>
       <div class="field-hint">管理面板中的文件预览不会记录使用；只有 skill_gateway load 才记录 gateway 使用。</div>
     </div>`,
    `<button class="btn btn-danger-soft" type="button" data-action="modal-delete-skill">删除技能（仅用户可操作）</button>
     <button class="btn btn-ghost" type="button" data-close-modal>关闭</button>`,
    'large',
  ));
}

function openFilePreviewModal(skillName, options = {}) {
  const files = options.files || state.skillFiles[skillName] || {};
  const active = options.active || Object.keys(files).find((path) => path === 'SKILL.md') || Object.keys(files)[0] || '';
  const notice = options.notice || '';

  openModal('file-preview', { skillName, files, active, notice }, modalShell(
    `文件预览 · ${skillName}`,
    `<form data-form="none">
       ${notice ? `<div class="notice success" style="margin-bottom:12px">${icon('check')}${esc(notice)}</div>` : ''}
       <div class="file-preview">
         <aside class="file-tree">
           ${Object.keys(files).sort().map((file) => `
             <button type="button" data-action="preview-file" data-file="${esc(file)}" class="${file === active ? 'is-active' : ''}">${icon('file')}<span class="mono">${esc(file)}</span></button>`).join('')}
         </aside>
         <section class="file-content">
           <div class="file-content-head mono">${esc(active)}</div>
           <pre>${esc(files[active] || '')}</pre>
         </section>
       </div>
     </form>`,
    `<button class="btn btn-ghost" type="button" data-close-modal>关闭</button>`,
    'large',
  ));
}

function refreshFilePreview(file) {
  if (modalState.type !== 'file-preview' || !modalState.payload) return;
  const files = modalState.payload.files || {};
  if (!(file in files)) return;
  modalState.payload.active = file;
  const content = $('#modal-root .file-content');
  if (!content) return;
  $('#modal-root .file-content-head').textContent = file;
  content.querySelector('pre').textContent = files[file];
  $$('#modal-root .file-tree button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.file === file);
  });
}

/* ----------------------- 删除技能（仅用户可操作） ----------------------- */

function openDeleteSkillModal(skillName) {
  const skill = state.catalog.skills[skillName];
  if (!skill) return;
  const paths = skillPaths(state.catalog, skillName);

  openModal('delete-skill', { skillName }, modalShell(
    '删除技能',
    `<form data-form="delete-skill">
       <div class="notice danger">${icon('error')}删除后将永久移除技能文件夹「${esc(skillName)}」及其资源文件。此操作仅用户可执行，整理会话中的 Agent 无此权限。</div>
       <div class="notice success" style="margin-top:8px">${icon('check')}历史使用统计会保留，来源与场景路径仍然可见。</div>
       <div class="field" style="margin:16px 0 0">
         <span class="field-label">将从以下场景解链（${paths.length}）</span>
         ${paths.length ? `<div class="skill-scenes">${paths.map((path) => `<span class="path-chip">${esc(path)}</span>`).join('')}</div>` : '<div class="field-hint">该技能当前未分类，未挂载到任何场景。</div>'}
       </div>
     </form>`,
    `<button class="btn btn-ghost" type="button" data-close-modal>取消</button>
     <button class="btn btn-danger-soft" type="submit" form="delete-skill">删除技能</button>`,
    'confirm',
  ));
}

function handleDeleteSkillSubmit() {
  const skillName = modalState.payload.skillName;
  const result = deleteSkill(state.catalog, skillName);
  if (!result.ok) {
    toast(result.error, 'danger');
    return;
  }
  state.catalog = result.catalog;
  delete state.skillFiles[skillName];
  closeModal();
  toast(`技能「${skillName}」已删除，历史统计保留。`, 'success');
  renderAll();
}

/* ----------------------- 上传技能（仅收集技能） -------------------------- */

function sampleSuccessUploadItem() {
  return {
    name: 'skills-bundle-20250816',
    files: [
      {
        path: 'incident-review/SKILL.md',
        content: skillMd('incident-review', '线上事故复盘流程：时间线还原、根因分析与行动项跟踪。', '# Incident Review\n\n1. 还原时间线。\n2. 定位根因。\n3. 输出行动项并跟踪。'),
      },
      {
        path: 'incident-review/runbook.md',
        content: '# Runbook\n\n- 先止损，再定位。\n- 恢复后保留现场。\n- 复盘行动项必须可验证。',
      },
      {
        path: 'archives/observability/slo-checklist/SKILL.md',
        content: skillMd('slo-checklist', 'SLO 与监控告警清单：指标口径、告警分级与排班响应。', '# SLO Checklist\n\n1. 明确指标口径。\n2. 告警分级。\n3. 空页与排班确认。'),
      },
      {
        path: 'archives/observability/slo-checklist/alert-rules.md',
        content: '# Alert Rules\n\n- 错误预算消耗 > 30% 触发 P1。\n- 每季度复核一次指标口径。',
      },
      {
        path: 'sql-pack/sql-review/SKILL.md',
        content: skillMd('sql-review', 'SQL 与索引评审（示例更新版），新增深分页游标检查。', '# SQL Review\n\n更新：深分页优先使用游标，并对 OFFSET 超阈值告警。'),
      },
      {
        path: 'sql-pack/sql-review/checks.sql',
        content: '-- 检查：过滤条件、JOIN、排序、分页\nSELECT 1;\n',
      },
      {
        path: 'notes/README.txt',
        content: '本文件不在任何技能文件夹内，将被忽略。',
      },
      {
        path: 'notes/scan-results.csv',
        content: 'a,b,c\n1,2,3\n',
      },
    ],
  };
}

function sampleFailureUploadItem() {
  return {
    name: 'skills-invalid-sample',
    files: [
      {
        path: 'frontend-api/SKILL.md',
        content: '---\nname: frontend-api\n---\n\n缺少 description。',
      },
      {
        path: '新场景/Bad_Name/SKILL.md',
        content: '---\nname: Bad_Name\ndescription: name 含大写和下划线，不符合约束。\n---\n',
      },
      {
        path: '新场景/no-frontmatter/SKILL.md',
        content: '# 没有 frontmatter\n',
      },
    ],
  };
}

function openUploadModal() {
  pendingUpload = null;
  openModal('upload', null, modalShell(
    '上传技能',
    `<form data-form="upload">
       <input type="file" id="upload-input" webkitdirectory multiple hidden>
       <div class="dropzone">
         <span class="dropzone-icon">${icon('upload')}</span>
         <div class="dropzone-title">选择一个技能文件夹</div>
         <p class="dropzone-desc">递归扫描文件夹下的所有技能：含直接 SKILL.md 的文件夹整体识别为一个技能（整棵子树的资源全部保留）。文件夹层级不会创建任何场景；技能文件夹之外的散文件会被忽略并列入清单。ZIP 上传已移除。</p>
         <div class="dropzone-actions">
           <button class="btn btn-secondary" type="button" data-action="choose-folder">${icon('upload')}选择文件夹</button>
           <button class="btn btn-ghost" type="button" data-action="sample-upload-ok">${icon('check')}载入成功示例</button>
           <button class="btn btn-ghost" type="button" data-action="sample-upload-fail">${icon('error')}载入校验失败示例</button>
         </div>
       </div>
       <div id="upload-preview" class="upload-preview"></div>
     </form>`,
    `<button class="btn btn-ghost" type="button" data-close-modal>取消</button>
     <button class="btn btn-primary" type="submit" form="upload" id="upload-submit" disabled>上传并开始整理</button>`,
    'large',
  ));
}

async function filesToUploadItem(fileList) {
  const files = [];
  let rootName = '';
  for (const file of fileList) {
    const raw = file.webkitRelativePath || file.name || '';
    if (raw.endsWith('/')) continue;
    const segments = raw.split('/').filter(Boolean);
    if (!segments.length) continue;
    if (!rootName && file.webkitRelativePath) rootName = segments[0];
    const path = file.webkitRelativePath ? segments.slice(1).join('/') : segments.join('/');
    if (!path) continue;
    let content = '';
    try {
      content = await file.text();
    } catch {
      content = '';
    }
    files.push({ path, content });
  }
  return { name: rootName || 'selected-folder', files };
}

function setPendingUpload(item) {
  const analyzed = analyzeUpload(item);
  pendingUpload = { item, analyzed };
  renderUploadPreview();
}

function renderUploadPreview() {
  const preview = $('#upload-preview');
  const submit = $('#upload-submit');
  if (!preview) return;

  if (!pendingUpload) {
    preview.innerHTML = '';
    if (submit) submit.disabled = true;
    return;
  }

  const { item, analyzed } = pendingUpload;
  if (!analyzed.ok) {
    preview.innerHTML = `
      <div class="notice danger">${icon('error')}<div><b>校验失败，本次上传整体拒绝，不会落盘任何内容。</b><ul class="reason-list" style="margin:8px 0 0">${analyzed.reasons.map((reason) => `<li>${esc(reason)}</li>`).join('')}</ul></div></div>`;
    if (submit) submit.disabled = true;
    return;
  }

  const overwrittenNames = analyzed.skills.filter((skill) => state.catalog.skills[skill.name]).map((skill) => skill.name);

  preview.innerHTML = `
    <div class="notice success">${icon('check')}已收集 ${analyzed.skills.length} 个技能（共 ${analyzed.fileCount} 个文件），校验通过。上传后技能处于未分类状态，不会创建或复用任何场景。</div>
    <div class="upload-summary" style="margin-top:12px">
      <div class="upload-summary-item"><div class="upload-summary-label">技能</div><div class="upload-summary-value">${analyzed.skills.length}</div></div>
      <div class="upload-summary-item"><div class="upload-summary-label">覆盖</div><div class="upload-summary-value">${overwrittenNames.length}</div></div>
      <div class="upload-summary-item"><div class="upload-summary-label">忽略文件</div><div class="upload-summary-value">${analyzed.ignoredFiles.length}</div></div>
      <div class="upload-summary-item"><div class="upload-summary-label">文件</div><div class="upload-summary-value">${analyzed.fileCount}</div></div>
    </div>
    <div class="upload-list">
      ${analyzed.skills.map((skill) => `
        <div class="upload-skill-row">
          <div class="upload-skill-head">
            <span class="tree-icon">${icon('skill')}</span>
            <span class="upload-skill-name mono">${esc(skill.name)}</span>
            ${state.catalog.skills[skill.name] ? badge('同名覆盖 · 保留历史', 'warning') : badge('新技能 · 未分类', 'success')}
            <span style="margin-left:auto;font-size:12px;color:var(--ink-3)">${Object.keys(skill.files).length} 文件</span>
          </div>
          <div class="upload-skill-desc">${esc(skill.folder || '根目录')} · ${esc(skill.description)}</div>
        </div>`).join('')}
    </div>
    ${analyzed.ignoredFiles.length
      ? `<div class="notice info" style="margin-top:8px">${icon('info')}<div>技能文件夹之外的散文件已忽略（${analyzed.ignoredFiles.length} 个）：${esc(analyzed.ignoredFiles.slice(0, 4).join('、'))}${analyzed.ignoredFiles.length > 4 ? ` 等 ${analyzed.ignoredFiles.length} 个` : ''}</div></div>`
      : ''}
    <div class="field-hint" style="margin-top:8px">任一技能校验失败时整体拒绝；同名技能原地覆盖并保留 createdAt 与使用历史。上传成功后自动开启整理会话，把本批技能归入合适场景。</div>`;
  if (submit) submit.disabled = false;
}

function handleUploadSubmit() {
  if (!pendingUpload || !pendingUpload.analyzed.ok) return;

  const preCatalog = state.catalog;
  const preFiles = clone(state.skillFiles);
  const result = mergeUpload(preCatalog, pendingUpload.item);
  if (!result.ok) {
    toast(result.reasons ? result.reasons[0] : '上传失败。', 'danger');
    return;
  }

  state.catalog = result.catalog;
  for (const skill of result.skills) {
    state.skillFiles[skill.name] = clone(skill.files);
  }

  // 上传槽位快照：整树 + 本批新增技能名 + 被覆盖技能的原文件备份
  const overwrittenBackup = {};
  for (const name of result.overwritten) overwrittenBackup[name] = clone(preFiles[name]);
  state.snapshots.upload = {
    at: Date.now(),
    catalog: clone(preCatalog),
    batch: { added: result.added, overwritten: overwrittenBackup },
  };

  closeModal();

  if (state.organizeRunning) {
    toast(`上传完成：新建 ${result.added.length} 个、覆盖 ${result.overwritten.length} 个。整理会话正在运行，本次不自动开启整理。`, 'warning', 5000);
    renderAll();
    return;
  }

  const started = startOrganizeSession('classify', { uploaded: result.added, overwritten: result.overwritten });
  renderAll();
  toast(
    `上传完成：新建 ${result.added.length} 个、覆盖 ${result.overwritten.length} 个，整理会话已自动开启。`,
    'success',
    {
      duration: 5000,
      actionLabel: '查看会话',
      onAction: () => {
        if (started.ok) {
          state.activeSessionId = started.session.id;
          renderAll();
          toast('已切换到整理会话，可在会话画布中观察或打断。', 'info');
        }
      },
    },
  );
}

/* ----------------------- 数据迁移 -------------------------------------- */

function openRelocateModal() {
  openModal('relocate', null, modalShell(
    '迁移数据落点',
    `<form data-form="relocate">
       <div class="notice info" style="margin-bottom:16px">${icon('info')}数据默认落在工作目录根 <span class="mono">.skillgate/</span>，也可由 <span class="mono">.skillgate-anchor</span> 指向自定义位置。快照与备份位于 <span class="mono">snapshots/</span>。</div>
       <div class="field">
         <label class="field-label" for="relocate-path">数据目录</label>
         <input id="relocate-path" name="dataDir" type="text" value="${esc(state.dataDir)}" placeholder="如 .skillgate/ 或 .config/skillgate/">
       </div>
       <div class="field-hint">原型只模拟状态切换：真实实现会先复制数据、再更新锚点、最后删除旧目录，统计不丢失。</div>
     </form>`,
    `<button class="btn btn-ghost" type="button" data-close-modal>取消</button>
     <button class="btn btn-primary" type="submit" form="relocate">迁移</button>`,
    'confirm',
  ));
}

function handleRelocateSubmit(form) {
  const dataDir = form.elements.dataDir.value.trim() || '.skillgate/';
  state.dataDir = dataDir;
  closeModal();
  toast(`数据落点已迁移到 ./${dataDir}，统计不丢失。`, 'success');
  renderAll();
}

/* ------------------------------------------------------------------------ */
/* 面板事件处理                                                              */
/* ------------------------------------------------------------------------ */

function updateCatalogViewRoot() {
  const rootEl = $('#catalog-view-root');
  if (!rootEl) return;
  rootEl.innerHTML = state.catalogView === 'tree' ? renderTreeCard() : renderSkillListCard();
  $$('#catalog-view-switch [data-view]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === state.catalogView);
  });
}

function handleCatalogAction(action, target) {
  const id = target.dataset.id || target.dataset.skill || '';
  const sceneId = target.dataset.scene || '';

  if (action === 'new-scene') {
    openSceneModal('create', { parentId: state.selectedSceneId });
  } else if (action === 'upload') {
    openUploadModal();
  } else if (action === 'organize-tidy') {
    if (state.organizeRunning) {
      toast('整理会话进行中：同一时间只允许一个整理会话。', 'warning');
      return;
    }
    const started = startOrganizeSession('tidy');
    if (!started.ok) {
      toast(started.error, 'warning');
      return;
    }
    renderAll();
    toast('已开启一键整理：整理槽位快照已就绪，完成后可一键回滚。', 'info', 4000);
  } else if (action === 'organize-detect') {
    if (state.organizeRunning) {
      toast('整理会话进行中：同一时间只允许一个整理会话。', 'warning');
      return;
    }
    const started = startOrganizeSession('detect');
    if (!started.ok) {
      toast(started.error, 'warning');
      return;
    }
    renderAll();
    toast('已开启冲突检测：只读会话，不打快照、不改动场景树。', 'info', 4000);
  } else if (action === 'rollback-upload') {
    openRollbackModal('upload');
  } else if (action === 'rollback-organize') {
    openRollbackModal('organize');
  } else if (action === 'relocate') {
    openRelocateModal();
  } else if (action === 'clear-search') {
    state.catalogSearch = '';
    const input = $('#catalog-search');
    if (input) input.value = '';
    updateCatalogViewRoot();
  } else if (action === 'select-scene') {
    state.selectedSceneId = id;
    updateCatalogViewRoot();
  } else if (action === 'toggle-expand') {
    if (state.collapsed.has(id)) state.collapsed.delete(id);
    else state.collapsed.add(id);
    updateCatalogViewRoot();
  } else if (action === 'new-child-scene') {
    openSceneModal('create', { parentId: id });
  } else if (action === 'attach-scene-skills') {
    openSkillPickerModal(id);
  } else if (action === 'edit-scene') {
    openSceneModal('edit', { sceneId: id });
  } else if (action === 'delete-scene') {
    openDeleteSceneModal(id);
  } else if (action === 'skill-detail') {
    openSkillDetailModal(id);
  } else if (action === 'detach-scene-skill') {
    const result = detachSkill(state.catalog, sceneId, target.dataset.skill);
    if (!result.ok) {
      toast(result.error, 'danger');
      return;
    }
    state.catalog = result.catalog;
    toast(`已从当前场景解除挂载「${target.dataset.skill}」，技能回到未分类。`, 'success');
    renderAll();
  } else if (action === 'attach-skill') {
    openAttachSkillModal(id);
  } else if (action === 'delete-skill') {
    openDeleteSkillModal(id);
  }
}

function handleStatsAction(action, target) {
  if (action === 'go-gateway') {
    state.tab = 'gateway';
    renderAll();
  } else if (target.dataset.source) {
    state.statsSource = target.dataset.source;
    renderAll();
  }
}

function handleGatewayAction(action, target) {
  if (action === 'gateway-back') {
    if (state.gatewayStack.length > 1) {
      state.gatewayStack.pop();
      renderAll();
    }
  } else if (action === 'gateway-up') {
    const current = browse(state.catalog, currentGatewaySceneId());
    if (current.ok && current.parentId) {
      state.gatewayStack.push(current.parentId);
      renderAll();
    }
  } else if (action === 'gateway-root') {
    state.gatewayStack = [state.catalog.rootSceneId];
    renderAll();
  } else if (action === 'gateway-enter') {
    state.gatewayStack.push(target.dataset.id);
    renderAll();
  } else if (action === 'gateway-load') {
    handleGatewayLoad(target.dataset.id);
  }
}

function handleGatewayLoad(skillName) {
  if (!state.config.enabled) {
    toast('skill gateway 已关闭。', 'danger');
    return;
  }
  const skill = state.catalog.skills[skillName];
  const files = state.skillFiles[skillName] || {};
  if (!skill) {
    toast(`技能不存在：${skillName}`, 'danger');
    return;
  }

  const current = browse(state.catalog, currentGatewaySceneId());
  const path = current.ok ? current.path : '';
  state.usage = recordUsage(state.usage, {
    skillName,
    source: 'gateway',
    scenePath: path,
    sessionId: SESSION_ID,
    timestamp: NOW,
  });

  appendChatEvent({
    kind: 'tool',
    title: 'skill_gateway · load',
    text: JSON.stringify({ action: 'load', skillName, scenePath: path }, null, 2) + `\n→ 返回 ${Object.keys(files).length} 个文件，usageRecorded: true。`,
  });
  appendChatEvent({ kind: 'assistant', text: `已通过 gateway 加载「${skillName}」，接下来按技能内容执行。` });

  toast(`已加载「${skillName}」并记录 gateway 使用。`, 'success');
  openFilePreviewModal(skillName, {
    files,
    active: Object.keys(files).includes('SKILL.md') ? 'SKILL.md' : Object.keys(files)[0],
    notice: `本次 load 已记录使用：source=gateway，scenePath=${path}。`,
  });
  renderAll();
}

/* ------------------------------------------------------------------------ */
/* 全局事件绑定                                                              */
/* ------------------------------------------------------------------------ */

function bindEvents() {
  $('#gateway-toggle').addEventListener('change', (event) => {
    state.config.enabled = event.target.checked;
    toast(event.target.checked ? '网关已开启：skill_gateway 工具与提示词恢复。' : '网关已关闭：工具与提示词卸下，统计观察器仍生效。', event.target.checked ? 'success' : 'warning');
    renderAll();
  });

  $('#tab-bar').addEventListener('click', (event) => {
    const button = event.target.closest('[data-tab]');
    if (!button) return;
    state.tab = button.dataset.tab;
    renderAll();
  });

  $('#rail-sessions').addEventListener('click', (event) => {
    const button = event.target.closest('[data-session]');
    if (!button) return;
    state.activeSessionId = button.dataset.session;
    renderAll();
  });

  $('#new-chat-btn').addEventListener('click', () => {
    toast('原型演示：新建对话由真实 DSH 宿主管理，此处不展开。', 'info');
  });

  $('#chat-header-actions').addEventListener('click', (event) => {
    if (event.target.closest('#interrupt-organize')) {
      interruptOrganize();
    }
  });

  $('#panel-body').addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      state.catalogView = viewButton.dataset.view;
      updateCatalogViewRoot();
      return;
    }

    const sourceButton = event.target.closest('[data-source]');
    if (sourceButton) {
      state.statsSource = sourceButton.dataset.source;
      renderAll();
      return;
    }

    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (state.tab === 'catalog') handleCatalogAction(action, actionEl);
    if (state.tab === 'stats') handleStatsAction(action, actionEl);
    if (state.tab === 'gateway') handleGatewayAction(action, actionEl);
  });

  $('#panel-body').addEventListener('input', (event) => {
    if (event.target.id === 'catalog-search') {
      state.catalogSearch = event.target.value;
      updateCatalogViewRoot();
    }
  });

  $('#panel-body').addEventListener('keydown', (event) => {
    if (event.target.classList && event.target.classList.contains('tree-row') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      state.selectedSceneId = event.target.dataset.id;
      updateCatalogViewRoot();
    }
  });

  $('#modal-root').addEventListener('click', (event) => {
    if (event.target.classList.contains('modal-backdrop')) {
      closeModal();
      return;
    }

    const closeButton = event.target.closest('[data-close-modal]');
    if (closeButton) {
      closeModal();
      return;
    }

    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === 'choose-folder') {
      const input = $('#upload-input');
      if (input) input.click();
    } else if (action === 'sample-upload-ok') {
      setPendingUpload(sampleSuccessUploadItem());
    } else if (action === 'sample-upload-fail') {
      setPendingUpload(sampleFailureUploadItem());
    } else if (action === 'preview-file') {
      if (modalState.type === 'skill-detail') {
        const skillName = actionEl.dataset.skill || modalState.payload.skillName;
        openFilePreviewModal(skillName, { files: state.skillFiles[skillName] || {}, active: actionEl.dataset.file });
      } else {
        refreshFilePreview(actionEl.dataset.file);
      }
    } else if (action === 'modal-delete-skill') {
      const skillName = modalState.payload.skillName;
      closeModal();
      openDeleteSkillModal(skillName);
    }
  });

  $('#modal-root').addEventListener('input', (event) => {
    if (event.target.id === 'skill-picker-search') {
      filterSkillPicker(event.target.value);
    }
  });

  $('#modal-root').addEventListener('change', (event) => {
    if (event.target.id === 'upload-input' && event.target.files && event.target.files.length) {
      const preview = $('#upload-preview');
      if (preview) preview.innerHTML = `<div class="notice info">${icon('info')}正在读取文件夹，请稍候…</div>`;
      filesToUploadItem(event.target.files).then((item) => {
        setPendingUpload(item);
      }).catch(() => {
        toast('读取文件夹失败，请重试。', 'danger');
      });
    }
  });

  $('#modal-root').addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();

    if (form.dataset.form === 'scene-form') handleSceneFormSubmit(form);
    if (form.dataset.form === 'delete-scene') handleDeleteSceneSubmit();
    if (form.dataset.form === 'skill-picker') handleSkillPickerSubmit(form);
    if (form.dataset.form === 'attach-skill') handleAttachSkillSubmit(form);
    if (form.dataset.form === 'delete-skill') handleDeleteSkillSubmit();
    if (form.dataset.form === 'upload') handleUploadSubmit();
    if (form.dataset.form === 'relocate') handleRelocateSubmit(form);
    if (form.dataset.form === 'rollback') handleRollbackSubmit();
  });

  $('#reset-demo').addEventListener('click', resetState);

  $('#mock-agent-skill').addEventListener('click', () => {
    state.usage = recordUsage(state.usage, {
      skillName: 'code-review',
      source: 'agent-skills',
      sessionId: SESSION_ID,
      timestamp: NOW,
    });
    appendChatEvent({
      kind: 'tool',
      title: 'skill · 默认工具调用',
      text: JSON.stringify({ name: 'skill', arguments: { name: 'code-review' } }, null, 2) + '\n→ 观察器记录 source=agent-skills（无场景路径）。',
    });
    toast('已记录一条 source=agent-skills 的默认技能调用。', 'success');
    renderAll();
  });

  const applyResponsivePanel = () => {
    if (window.innerWidth > 980) {
      setPanelOpen(true);
    } else if (!document.body.classList.contains('panel-open') && !document.body.classList.contains('panel-closed')) {
      setPanelOpen(false);
    }
  };

  $('#panel-toggle').addEventListener('click', () => setPanelOpen(!isPanelOpen()));
  $('#panel-close').addEventListener('click', () => setPanelOpen(false));
  window.addEventListener('resize', applyResponsivePanel);
  applyResponsivePanel();
}

/* ------------------------------------------------------------------------ */
/* 启动                                                                      */
/* ------------------------------------------------------------------------ */

renderAll();
bindEvents();
