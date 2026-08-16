/**
 * Organize-tool action dispatcher (pure).
 *
 * Every organize-session mutation of the scene tree flows through
 * `applyOrganizeAction`. Hard constraints live here:
 *   - skill files and skill descriptions are read-only (no action reaches them),
 *   - skill deletion is a user-only action and is rejected,
 *   - scene names stay unique across the whole tree,
 *   - new scenes must carry a detailed description,
 *   - every call validates against the current catalog and returns the next
 *     catalog value so the caller can persist immediately.
 */

import {
  MIN_SCENE_DESCRIPTION_LENGTH,
  attachSkill,
  createScene,
  deleteScene,
  detachSkill,
  moveScene,
  updateScene,
} from './catalog.js';

export const ORGANIZE_ACTIONS = [
  'createScene',
  'updateScene',
  'deleteScene',
  'moveScene',
  'attachSkill',
  'detachSkill',
];

const UPDATE_ALLOWED_FIELDS = new Set(['sceneId', 'name', 'description', 'tags']);

export function applyOrganizeAction(catalog, action, args = {}) {
  if (!catalog || !catalog.scenes) return { ok: false, error: '目录无效。' };

  if (action === 'deleteSkill') {
    return { ok: false, error: '技能删除仅用户可操作；整理会话中技能文件与技能描述只读。' };
  }
  if (!ORGANIZE_ACTIONS.includes(action)) {
    return { ok: false, error: `未知的组织动作：${action}` };
  }

  switch (action) {
    case 'createScene': {
      const parentId = String(args.parentId || '');
      const name = String(args.name || '').trim();
      const description = String(args.description || '').trim();
      if (!name) return { ok: false, error: '场景名称不能为空。' };
      if (description.length < MIN_SCENE_DESCRIPTION_LENGTH) {
        return {
          ok: false,
          error: `新建场景必须提供至少 ${MIN_SCENE_DESCRIPTION_LENGTH} 个字符的详细 description，说明该场景的作用与边界。`,
        };
      }
      const result = createScene(catalog, parentId, { name, description, tags: args.tags }, { requireDescription: true });
      if (!result.ok) return result;
      return {
        ok: true,
        catalog: result.catalog,
        sceneId: result.sceneId,
        result: { sceneId: result.sceneId, message: `已创建场景「${name}」。` },
      };
    }

    case 'updateScene': {
      const sceneId = String(args.sceneId || '');
      if (!catalog.scenes[sceneId]) return { ok: false, error: '场景不存在。' };
      const rejected = Object.keys(args).filter((key) => !UPDATE_ALLOWED_FIELDS.has(key));
      if (rejected.length) {
        return { ok: false, error: `不允许修改技能相关字段（技能文件与技能描述只读）：${rejected.join('、')}` };
      }
      const input = {};
      if (args.name !== undefined) input.name = String(args.name);
      if (args.description !== undefined) input.description = String(args.description);
      if (args.tags !== undefined) input.tags = args.tags;
      const result = updateScene(catalog, sceneId, input, { requireDescription: true });
      if (!result.ok) return result;
      const message = [];
      if (input.name !== undefined) {
        message.push(`场景改名：${catalog.scenes[sceneId].name} → ${String(input.name).trim()}`);
      }
      if (input.description !== undefined) message.push('已更新场景描述');
      if (input.tags !== undefined) message.push('已更新标签');
      return { ok: true, catalog: result.catalog, result: { sceneId, message: message.join('；') || '无变更。' } };
    }

    case 'deleteScene': {
      const sceneId = String(args.sceneId || '');
      const result = deleteScene(catalog, sceneId);
      if (!result.ok) return result;
      const unlinked = new Set();
      for (const id of result.deletedIds) {
        for (const skillName of (catalog.scenes[id] && catalog.scenes[id].skills) || []) {
          unlinked.add(skillName);
        }
      }
      return {
        ok: true,
        catalog: result.catalog,
        result: {
          sceneId,
          deletedIds: result.deletedIds,
          unlinkedSkills: [...unlinked],
          message: `已删除场景及其 ${result.deletedIds.length - 1} 个子场景，${unlinked.size} 个技能回到未分类。`,
        },
      };
    }

    case 'moveScene': {
      const sceneId = String(args.sceneId || '');
      const parentId = String(args.parentId || '');
      const result = moveScene(catalog, sceneId, parentId);
      if (!result.ok) return result;
      const scene = result.catalog.scenes[sceneId];
      return { ok: true, catalog: result.catalog, result: { sceneId, parentId, message: `「${scene.name}」已移动到新父场景。` } };
    }

    case 'attachSkill': {
      const sceneId = String(args.sceneId || '');
      const skillName = String(args.skillName || '').trim();
      const result = attachSkill(catalog, sceneId, skillName);
      if (!result.ok) return result;
      const sceneName = result.catalog.scenes[sceneId].name;
      return {
        ok: true,
        catalog: result.catalog,
        result: { sceneId, skillName, message: result.added ? `已把 ${skillName} 挂载到「${sceneName}」。` : `${skillName} 已在「${sceneName}」。` },
      };
    }

    case 'detachSkill': {
      const sceneId = String(args.sceneId || '');
      const skillName = String(args.skillName || '').trim();
      const result = detachSkill(catalog, sceneId, skillName);
      if (!result.ok) return result;
      const sceneName = result.catalog.scenes[sceneId].name;
      return {
        ok: true,
        catalog: result.catalog,
        result: { sceneId, skillName, message: result.removed ? `已把 ${skillName} 从「${sceneName}」解链，回到未分类。` : `${skillName} 不在「${sceneName}」。` },
      };
    }

    default:
      return { ok: false, error: `未知的组织动作：${action}` };
  }
}
