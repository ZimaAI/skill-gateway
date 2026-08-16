/**
 * Pure prompt building and report extraction for organize sessions.
 *
 * No DSH imports here on purpose: the prompt shape and the report contract
 * are unit-tested at this seam; the session machinery lives in
 * organize-session.js and is verified in the GUI.
 */

export const ORGANIZE_MODES = Object.freeze({
  classify: {
    key: 'classify',
    taskName: '技能分类',
    title: '技能分类',
  },
  full: {
    key: 'full',
    taskName: '一键整理',
    title: '一键整理',
  },
  detect: {
    key: 'detect',
    taskName: '冲突检测',
    title: '冲突检测',
  },
});

const MODE_INSTRUCTIONS = {
  classify: [
    '本次任务是「自动分类」：只处理本次上传批次中的技能，不要改动场景树的其他部分。',
    '1. 为批次里的每个技能找到最合适的现有场景并挂载（attachSkill）。',
    '2. 没有合适场景时，创建新场景（createScene）——name 必须全树唯一，description 必须详细说明该场景的作用与边界。',
    '3. 一个技能确实适用于多个场景时，可以挂载到多个场景，并在报告 attachmentReasons 中逐个说明理由。',
    '4. 判断技能内容时用 skill_gateway 工具按需读取技能全文（不要臆测）。',
  ].join('\n'),
  full: [
    '本次任务是「一键整理」：对整棵场景树做一次完整整理。',
    '1. 澄清场景边界：为语义模糊的场景补写/改写 description（updateScene），必要时改名、移动（moveScene）。',
    '2. 删除多余或重复的场景（deleteScene）——删除会级联删除子场景，直接挂载的技能自动回到未分类。',
    '3. 把未分类技能归入合适场景；没有合适场景就新建场景（name 全树唯一，description 必须详细）。',
    '4. 判断技能内容时用 skill_gateway 工具按需读取技能全文（不要臆测）。',
    '5. 最后在报告中列出发现的冲突与重复技能。',
  ].join('\n'),
  detect: [
    '本次任务是「冲突检测」：只读检测，禁止任何修改。',
    '严禁调用 createScene / updateScene / deleteScene / moveScene / attachSkill / detachSkill —— 本次会话不允许改动场景树。',
    '请检测以下三类冲突，并在报告 JSON 中给出清单：',
    '② 不同名但 SKILL.md 内容高度相似的重复技能（用 skill_gateway 读取技能全文后判断）；',
    '③ 场景名称/描述语义重叠、边界模糊的场景；',
    '④ 一个技能挂载到多个语义相距很远的场景（挂载过散）。',
  ].join('\n'),
};

const SHARED_CONSTRAINTS = [
  '## 硬约束（必须遵守）',
  '- 技能文件与技能描述只读：不得修改、删除任何技能文件或技能 description；技能删除仅用户可操作，工具会拒绝。',
  '- 场景 name 全树唯一；新建场景必须提供详细 description。',
  '- 所有改动必须通过 skill_organize 工具完成，每次调用立即生效；不要直接改文件。',
  '- 场景摘要已嵌入本消息；技能全文不嵌入，需要时用 skill_gateway 工具浏览/加载。',
].join('\n');

const REPORT_FORMAT = [
  '## 报告格式（必须）',
  '你的最后一条消息必须以一个 JSON 代码块结尾（JSON 之后不要再写任何内容）：',
  '```json',
  '{',
  '  "conflicts": ["场景「X」与「Y」语义重叠：…", "…"],',
  '  "duplicates": ["skill-a 与 skill-b 的 SKILL.md 内容高度相似：…", "…"],',
  '  "attachmentReasons": { "skill-name": "挂载到多个场景的理由" }',
  '}',
  '```',
  '改动摘要由系统根据快照自动生成，你不必在 JSON 里重复改动清单。',
].join('\n');

function pad(value) {
  return String(value).padStart(2, '0');
}

export function formatOrganizeStamp(timestamp) {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return String(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Render the whole scene tree as text: one line per scene with indentation,
 * description and direct skill names. Skill full text is never embedded.
 */
export function sceneSummaryText(catalog) {
  const root = catalog && catalog.scenes && catalog.scenes[catalog.rootSceneId];
  if (!root) return '（场景树为空）';
  const lines = [];
  const visit = (scene, depth) => {
    const indent = '  '.repeat(depth);
    const skills = (scene.skills || []).join('、') || '无';
    lines.push(`${indent}- ${scene.name}：${scene.description || '（无描述）'}（直接技能：${skills}）`);
    for (const childId of scene.children || []) {
      const child = catalog.scenes[childId];
      if (child) visit(child, depth + 1);
    }
  };
  visit(root, 0);
  return lines.join('\n');
}

/**
 * Build the organize prompt for one mode. The first line is the task name
 * with a timestamp so the session title in the sidebar is stable and
 * recognizable ("技能分类 #2026-08-16 14:30").
 */
export function buildOrganizePrompt(mode, context = {}) {
  const def = ORGANIZE_MODES[mode] || ORGANIZE_MODES.classify;
  const stamp = formatOrganizeStamp(context.now || Date.now());
  const batch = context.batch || { addedSkills: [], overwrittenSkills: [] };
  const unclassified = Array.isArray(context.unclassified) ? context.unclassified : [];

  const batchLines = [];
  if (def.key === 'classify') {
    batchLines.push('## 本次上传批次');
    if (batch.addedSkills && batch.addedSkills.length) {
      batchLines.push(`新增技能：${batch.addedSkills.join('、')}`);
    }
    if (batch.overwrittenSkills && batch.overwrittenSkills.length) {
      batchLines.push(`同名覆盖：${batch.overwrittenSkills.join('、')}（旧版本已不可恢复，冲突检测不把同名差异列为冲突）`);
    }
    if (!batch.addedSkills.length && !batch.overwrittenSkills.length) {
      batchLines.push('（批次为空）');
    }
  }

  const unclassifiedLines = [];
  if (unclassified.length) {
    unclassifiedLines.push('## 未分类技能');
    for (const skill of unclassified) {
      unclassifiedLines.push(`- ${skill.name}：${skill.description || ''}`);
    }
  } else {
    unclassifiedLines.push('## 未分类技能');
    unclassifiedLines.push('（当前没有未分类技能）');
  }

  return [
    `${def.title} #${stamp}`,
    '',
    '你是 Skill Gateway 的整理助手。请在整理会话中完成下面的任务。',
    '',
    MODE_INSTRUCTIONS[def.key],
    '',
    '## 当前场景树摘要',
    context.sceneSummary || '（场景树为空）',
    '',
    ...batchLines,
    '',
    ...unclassifiedLines,
    '',
    SHARED_CONSTRAINTS,
    '',
    REPORT_FORMAT,
  ].filter((line, index, array) => !(line === '' && (index === 0 || array[index - 1] === ''))).join('\n');
}

/**
 * Extract the structured report block from the agent's final message: the
 * last fenced ```json block (a bare ``` fence is accepted too).
 */
export function extractOrganizeReport(text) {
  if (typeof text !== 'string') return null;
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
  let parsed = null;
  for (const match of fences) {
    try {
      const value = JSON.parse(match[1].trim());
      if (value && typeof value === 'object') parsed = value;
    } catch {
      // Keep scanning earlier/later fences.
    }
  }
  if (!parsed) return null;
  return {
    conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts.map(String) : [],
    duplicates: Array.isArray(parsed.duplicates) ? parsed.duplicates.map(String) : [],
    attachmentReasons:
      parsed.attachmentReasons && typeof parsed.attachmentReasons === 'object'
        ? parsed.attachmentReasons
        : {},
    raw: parsed,
  };
}
