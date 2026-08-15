/* ==========================================================================
   skill-gateway 页面原型 v2
   - 纯函数核心：场景树 CRUD / 上传校验与合并 / browse / load / 使用聚合
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
        skills: ['api-design', 'sql-review'],
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
        skills: ['react-component', 'tdd'],
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
/* 场景树上传：校验、分类与合并                                               */
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
  if (!files.length) reasons.push('场景树文件夹为空。');
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

function parentSegments(dirPath) {
  if (!dirPath) return [];
  const segments = dirPath.split('/').filter(Boolean);
  return segments.slice(0, -1);
}

function analyzeSceneTree(item) {
  const source = Array.isArray(item) ? { files: item } : item || {};
  const name = String(source.name || '').trim();
  const normalized = normalizeUploadFilePaths(source);
  if (normalized.reasons.length) return { ok: false, reasons: normalized.reasons, name };

  const dirs = buildDirIndex(normalized.files);
  const skillDirs = [];
  for (const dirPath of [...dirs.keys()].sort(compareDirPaths)) {
    if (skillDirs.some((skillDir) => isInsideDir(dirPath, skillDir))) continue;
    if (dirs.get(dirPath).files.has('SKILL.md')) skillDirs.push(dirPath);
  }

  const sceneDirs = [...dirs.keys()]
    .filter((dirPath) => {
      if (skillDirs.includes(dirPath)) return false;
      return !skillDirs.some((skillDir) => isInsideDir(dirPath, skillDir));
    })
    .sort(compareDirPaths);

  const nonRootScenes = sceneDirs.filter((dirPath) => dirPath !== '');
  if (!skillDirs.length && !nonRootScenes.length) {
    return { ok: false, reasons: ['场景树中没有可导入的场景或技能。'], name };
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
      parentPath: parentSegments(skillDir),
      name: skillName,
      description,
      files: renderedFiles,
    });
  }

  const ignoredFiles = normalized.files
    .map((file) => {
      const dirPath = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
      return { file, dirPath };
    })
    .filter((entry) => sceneDirs.includes(entry.dirPath))
    .map((entry) => entry.file.path)
    .sort();

  return {
    ok: reasons.length === 0,
    reasons,
    name,
    sceneDirs,
    nonRootScenes,
    skills,
    ignoredFiles,
    fileCount: normalized.files.length,
  };
}

function importSceneTree(catalog, item) {
  if (!catalog || !catalog.scenes || !catalog.skills || !catalog.rootSceneId || !catalog.scenes[catalog.rootSceneId]) {
    return { ok: false, reasons: ['目录无效。'] };
  }
  const analyzed = analyzeSceneTree(item);
  if (!analyzed.ok) return { ok: false, reasons: analyzed.reasons, name: analyzed.name };

  const next = clone(catalog);
  const scenesCreated = [];
  const scenesReused = new Set();
  let mergeError = null;

  const ensureScenePath = (segments) => {
    let parent = next.scenes[next.rootSceneId];
    for (const segment of segments) {
      const name = String(segment || '').trim();
      if (!name) {
        mergeError = `上传路径包含空场景名称：${segments.join(' / ')}`;
        return null;
      }
      const childId = (parent.children || []).find((id) => next.scenes[id] && next.scenes[id].name === name);
      if (childId) {
        if (!scenesCreated.includes(childId)) scenesReused.add(childId);
        parent = next.scenes[childId];
        continue;
      }
      const duplicate = Object.values(next.scenes).find((scene) => scene.name === name);
      if (duplicate) {
        mergeError = `场景名称已存在但不在上传路径中：${name}`;
        return null;
      }
      const scene = { id: makeId('scene'), name, description: '', tags: [], parentId: parent.id, children: [], skills: [] };
      next.scenes[scene.id] = scene;
      parent.children.push(scene.id);
      scenesCreated.push(scene.id);
      parent = scene;
    }
    return parent;
  };

  for (const dirPath of analyzed.nonRootScenes) {
    if (!ensureScenePath(dirPath.split('/').filter(Boolean))) {
      return { ok: false, reasons: [mergeError], name: analyzed.name };
    }
  }

  const originalSkillNames = new Set(Object.keys(catalog.skills || {}));
  const importedSkillNames = new Set();
  const updatedSkillNames = new Set();
  const mergedSkills = new Map();

  for (const skill of analyzed.skills) {
    const targetScene = ensureScenePath(skill.parentPath);
    if (!targetScene) return { ok: false, reasons: [mergeError], name: analyzed.name };

    importedSkillNames.add(skill.name);
    const existing = next.skills[skill.name];
    if (existing) updatedSkillNames.add(skill.name);
    next.skills[skill.name] = {
      name: skill.name,
      description: skill.description,
      createdAt: existing ? existing.createdAt : NOW,
      updatedAt: NOW,
    };
    if (!targetScene.skills.includes(skill.name)) targetScene.skills.push(skill.name);
    mergedSkills.set(skill.name, skill);
  }

  return {
    ok: true,
    catalog: next,
    name: analyzed.name,
    scenesCreated,
    scenesReused: [...scenesReused],
    sceneCounts: { created: scenesCreated.length, reused: scenesReused.size },
    skills: [...mergedSkills.values()],
    skillNames: [...importedSkillNames].sort(),
    skillsImported: analyzed.skills.length,
    skillsCreated: analyzed.skills.filter((skill) => !originalSkillNames.has(skill.name)).length,
    skillsUpdated: analyzed.skills.filter((skill) => originalSkillNames.has(skill.name)).length,
    fileCount: analyzed.fileCount,
    ignoredFiles: analyzed.ignoredFiles,
  };
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
  chatEvents: seedChatEvents(),
};

let modalState = { type: null, payload: null };

function resetState() {
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
  state.chatEvents = seedChatEvents();
  closeModal();
  renderAll();
}

function toast(message, kind = 'info', duration) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  const iconName = kind === 'success' ? 'check' : kind === 'danger' ? 'error' : kind === 'warning' ? 'warning' : 'info';
  el.innerHTML = `${icon(iconName)}<span>${esc(message)}</span>`;
  root.appendChild(el);
  const timeout = duration || (kind === 'danger' || kind === 'warning' ? 5000 : 3000);
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

  const body = $('#panel-body');
  if (!body) return;
  body.innerHTML = '';
  if (state.tab === 'catalog') renderCatalog(body);
  if (state.tab === 'stats') renderStats(body);
  if (state.tab === 'gateway') renderGateway(body);
  body.scrollTop = 0;

  renderChatFeed();
  updatePanelToggleLabel();
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
  const prefix = '　'.repeat(depth);
  return catalog.scenes[root.id].id === root.id
    ? `<option value="${esc(root.id)}" ${root.id === selectedId ? 'selected' : ''}>${prefix}${esc(root.name)}</option>` +
        (root.children || []).map((childId) => sceneOptionsInner(catalog, childId, selectedId, depth + 1)).join('')
    : '';
}

function sceneOptionsInner(catalog, sceneId, selectedId, depth) {
  const scene = catalog.scenes[sceneId];
  if (!scene) return '';
  const prefix = '　'.repeat(depth);
  return `<option value="${esc(scene.id)}" ${scene.id === selectedId ? 'selected' : ''}>${prefix}${esc(scene.name)}</option>` +
    (scene.children || []).map((childId) => sceneOptionsInner(catalog, childId, selectedId, depth + 1)).join('');
}

function renderCatalog(rootEl) {
  rootEl.innerHTML = `
    <div class="panel-section">
      <div class="section-head">
        <div>
          <h2 class="section-title">场景树管理</h2>
          <p class="section-sub">单根、不限深度；技能可挂载到多个场景。</p>
        </div>
        <div class="section-actions">
          <button class="btn btn-sm btn-ghost" type="button" data-action="upload-tree">
            ${icon('upload')}上传场景树
          </button>
          <button class="btn btn-sm btn-secondary" type="button" data-action="new-scene">
            ${icon('plus')}新建场景
          </button>
        </div>
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
        <div class="location-sub">catalog.json · usage.json · config.json · skills/</div>
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
          <p class="empty-desc">换个关键词，或先创建场景、上传场景树。</p>
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
        <button class="icon-btn" type="button" data-action="detach-scene-skill" data-scene="${esc(sceneId)}" data-skill="${esc(skillName)}" title="从当前场景解除挂载">${icon('close')}</button>
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
          <p class="empty-desc">${query ? '换个关键词试试。' : '上传场景树后，含 SKILL.md 的文件夹会自动识别为技能。'}</p>
          <div class="empty-actions">
            ${query ? `<button class="btn btn-secondary" type="button" data-action="clear-search">清除搜索</button>` : ''}
            <button class="btn btn-ghost" type="button" data-action="upload-tree">上传场景树</button>
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
                  ${paths.length ? badge(`${paths.length} 个挂载点`, 'primary') : badge('未挂载', 'warning')}
                </div>
                <div class="skill-desc">${esc(skill.description)}</div>
                ${paths.length ? `<div class="skill-scenes">${paths.map((path) => `<span class="path-chip" title="${esc(path)}">${esc(path)}</span>`).join('')}</div>` : ''}
              </div>
              <div class="skill-list-actions">
                <button class="icon-btn" type="button" data-action="attach-skill" data-skill="${esc(skill.name)}" title="挂载到场景">${icon('link')}</button>
                <button class="icon-btn" type="button" data-action="skill-detail" data-id="${esc(skill.name)}" title="查看详情与文件">${icon('eye')}</button>
                <button class="icon-btn danger" type="button" data-action="delete-skill" data-id="${esc(skill.name)}" title="删除技能">${icon('trash')}</button>
              </div>
            </div>`;
        }).join('')}
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
        ? `<div class="notice info">${icon('info')}开关 ON：<b>skill_gateway</b> 工具已注册，系统提示词已注入。</div>`
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
          '4. 有多个合适场景时可以分别进入并加载多个技能。'
        ].join('\n'))}</pre>
      </details>
    </div>`;
}

/* ------------------------------------------------------------------------ */
/* 渲染：会话画布（仅陪衬）                                                   */
/* ------------------------------------------------------------------------ */

function renderChatFeed() {
  const feed = $('#chat-feed');
  if (!feed) return;
  feed.innerHTML = `<div class="chat-inner">${state.chatEvents.map(renderChatEvent).join('')}</div>`;
  feed.scrollTop = feed.scrollHeight;
}

function renderChatEvent(event) {
  if (event.kind === 'day') return `<div class="chat-day">${esc(event.text)}</div>`;
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
  state.chatEvents.push({ ...event, timestamp: event.timestamp || NOW });
  renderChatFeed();
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
              <div class="field-hint">技能只会从这些场景解除挂载，技能文件与历史统计都会保留。</div>`
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
  toast(`已删除 ${result.deletedIds.length} 个场景，技能均已解链。`, 'success');
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
       <div class="field-hint">一个技能可以同时挂载到多个场景；取消勾选只会解除当前场景的挂载。</div>
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

  openModal('attach-skill', { skillName }, modalShell(
    '挂载技能到场景',
    `<form data-form="attach-skill">
       <input type="hidden" name="skillName" value="${esc(skillName)}">
       <div class="notice info" style="margin-bottom:16px">${icon('skill')}${esc(skillName)}：${esc(skill.description)}</div>
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
  toast(result.added ? `已挂载到「${state.catalog.scenes[sceneId].name}」。` : '该场景已挂载此技能。', result.added ? 'success' : 'info');
  renderAll();
}

/* ----------------------- 技能详情与文件预览 ------------------------------ */

function openSkillDetailModal(skillName) {
  const skill = state.catalog.skills[skillName];
  if (!skill) return;
  const files = state.skillFiles[skillName] || {};
  const paths = skillPaths(state.catalog, skillName);

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
         : `<div class="notice warning">${icon('warning')}尚未挂载到任何场景，Agent 无法经场景树发现该技能。</div>`}
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
    `<button class="btn btn-danger-soft" type="button" data-action="modal-delete-skill">删除技能</button>
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

/* ----------------------- 删除技能 -------------------------------------- */

function openDeleteSkillModal(skillName) {
  const skill = state.catalog.skills[skillName];
  if (!skill) return;
  const paths = skillPaths(state.catalog, skillName);

  openModal('delete-skill', { skillName }, modalShell(
    '删除技能',
    `<form data-form="delete-skill">
       <div class="notice danger">${icon('error')}删除后将永久移除技能文件夹「${esc(skillName)}」及其资源文件。</div>
       <div class="notice success" style="margin-top:8px">${icon('check')}历史使用统计会保留，来源与场景路径仍然可见。</div>
       <div class="field" style="margin:16px 0 0">
         <span class="field-label">将从以下场景解链（${paths.length}）</span>
         ${paths.length ? `<div class="skill-scenes">${paths.map((path) => `<span class="path-chip">${esc(path)}</span>`).join('')}</div>` : '<div class="field-hint">该技能当前未挂载到任何场景。</div>'}
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

/* ----------------------- 上传场景树 ------------------------------------- */

let pendingUpload = null;

function sampleSuccessUploadItem() {
  return {
    name: 'scene-tree-ops-sample',
    files: [
      {
        path: '运维与可靠性/incident-review/SKILL.md',
        content: skillMd('incident-review', '线上事故复盘流程：时间线还原、根因分析与行动项跟踪。', '# Incident Review\n\n1. 还原时间线。\n2. 定位根因。\n3. 输出行动项并跟踪。'),
      },
      {
        path: '运维与可靠性/incident-review/runbook.md',
        content: '# Runbook\n\n- 先止损，再定位。\n- 恢复后保留现场。\n- 复盘行动项必须可验证。',
      },
      {
        path: '运维与可靠性/可观测性/slo-checklist/SKILL.md',
        content: skillMd('slo-checklist', 'SLO 与监控告警清单：指标口径、告警分级与排班响应。', '# SLO Checklist\n\n1. 明确指标口径。\n2. 告警分级。\n3. 空页与排班确认。'),
      },
      {
        path: '后端开发/sql-review/SKILL.md',
        content: skillMd('sql-review', 'SQL 与索引评审（示例更新版），新增深分页游标检查。', '# SQL Review\n\n更新：深分页优先使用游标，并对 OFFSET 超阈值告警。'),
      },
      {
        path: '后端开发/sql-review/checklist.sql',
        content: '-- 检查：过滤条件、JOIN、排序、分页\nSELECT 1;\n',
      },
    ],
  };
}

function sampleFailureUploadItem() {
  return {
    name: 'scene-tree-invalid-sample',
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
    '上传场景树',
    `<form data-form="upload">
       <input type="file" id="upload-input" webkitdirectory multiple hidden>
       <div class="dropzone">
         <span class="dropzone-icon">${icon('upload')}</span>
         <div class="dropzone-title">选择一个场景树文件夹</div>
         <p class="dropzone-desc">所选文件夹作为场景树根目录与现有根场景合并。不含 SKILL.md 的文件夹识别为场景；含直接 SKILL.md 的文件夹整体识别为技能。ZIP 上传已移除。</p>
         <div class="dropzone-actions">
           <button class="btn btn-secondary" type="button" data-action="choose-folder">${icon('upload')}选择文件夹</button>
           <button class="btn btn-ghost" type="button" data-action="sample-upload-ok">${icon('check')}载入成功示例</button>
           <button class="btn btn-ghost" type="button" data-action="sample-upload-fail">${icon('error')}载入校验失败示例</button>
         </div>
       </div>
       <div id="upload-preview" class="upload-preview"></div>
     </form>`,
    `<button class="btn btn-ghost" type="button" data-close-modal>取消</button>
     <button class="btn btn-primary" type="submit" form="upload" id="upload-submit" disabled>导入场景树</button>`,
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
  const analyzed = analyzeSceneTree(item);
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
      <div class="notice danger">${icon('error')}<div><b>校验失败，本次上传不会导入任何内容。</b><ul class="reason-list" style="margin:8px 0 0">${analyzed.reasons.map((reason) => `<li>${esc(reason)}</li>`).join('')}</ul></div></div>`;
    if (submit) submit.disabled = true;
    return;
  }

  const newScenes = analyzed.nonRootScenes.filter((path) => {
    let parent = state.catalog.scenes[state.catalog.rootSceneId];
    const segments = path.split('/').filter(Boolean);
    for (const segment of segments) {
      const child = (parent.children || []).find((id) => state.catalog.scenes[id] && state.catalog.scenes[id].name === segment);
      if (!child) return true;
      parent = state.catalog.scenes[child];
    }
    return false;
  }).length;

  preview.innerHTML = `
    <div class="notice success">${icon('check')}已解析文件夹「${esc(item.name || 'selected-folder')}」，校验通过。</div>
    <div class="upload-summary" style="margin-top:12px">
      <div class="upload-summary-item"><div class="upload-summary-label">新建场景</div><div class="upload-summary-value">${newScenes}</div></div>
      <div class="upload-summary-item"><div class="upload-summary-label">技能</div><div class="upload-summary-value">${analyzed.skills.length}</div></div>
      <div class="upload-summary-item"><div class="upload-summary-label">文件</div><div class="upload-summary-value">${analyzed.fileCount}</div></div>
    </div>
    <div class="upload-list">
      ${analyzed.skills.map((skill) => `
        <div class="upload-skill-row">
          <div class="upload-skill-head">
            <span class="tree-icon">${icon('skill')}</span>
            <span class="upload-skill-name mono">${esc(skill.name)}</span>
            ${state.catalog.skills[skill.name] ? badge('同名更新', 'warning') : badge('新技能', 'success')}
            <span style="margin-left:auto;font-size:12px;color:var(--ink-3)">${Object.keys(skill.files).length} 文件</span>
          </div>
          <div class="upload-skill-desc">${esc(skill.folder || '根目录')} · ${esc(skill.description)}</div>
        </div>`).join('')}
    </div>
    ${analyzed.ignoredFiles.length ? `<div class="field-hint" style="margin-top:8px">场景目录中的普通文件不会作为技能资源导入：${esc(analyzed.ignoredFiles.slice(0, 4).join('、'))}${analyzed.ignoredFiles.length > 4 ? ' 等' : ''}</div>` : ''}`;
  if (submit) submit.disabled = false;
}

function handleUploadSubmit() {
  if (!pendingUpload || !pendingUpload.analyzed.ok) return;
  const result = importSceneTree(state.catalog, pendingUpload.item);
  if (!result.ok) {
    toast(result.reasons ? result.reasons[0] : '导入失败。', 'danger');
    return;
  }

  state.catalog = result.catalog;
  for (const skill of result.skills) {
    state.skillFiles[skill.name] = clone(skill.files);
  }
  const message = `导入完成：新建场景 ${result.sceneCounts.created} 个，复用 ${result.sceneCounts.reused} 个；技能新建 ${result.skillsCreated} 个，更新 ${result.skillsUpdated} 个。`;
  closeModal();
  toast(message, 'success', 5000);
  renderAll();
}

/* ----------------------- 数据迁移 -------------------------------------- */

function openRelocateModal() {
  openModal('relocate', null, modalShell(
    '迁移数据落点',
    `<form data-form="relocate">
       <div class="notice info" style="margin-bottom:16px">${icon('info')}数据默认落在工作目录根 <span class="mono">.skillgate/</span>，也可由 <span class="mono">.skillgate-anchor</span> 指向自定义位置。</div>
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
  } else if (action === 'upload-tree') {
    openUploadModal();
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
    toast(`已从当前场景解除挂载「${target.dataset.skill}」。`, 'success');
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
