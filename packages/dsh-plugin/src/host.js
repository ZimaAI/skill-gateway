/**
 * skill-gateway host half (DeepSeek Harness / Cordis plugin).
 *
 * Responsibilities kept intentionally thin:
 *   - resolve a repository-scoped RepoStore per agent cwd,
 *   - register the `skill_gateway` browse/load tool,
 *   - inject the positive system-prompt hint,
 *   - observe harness-default `skill` tool results and record agent-skills uses,
 *   - expose JSON routes consumed by the client settings panel.
 *
 * Every decision is delegated to @skill-gate/core through SkillGatewayService.
 */

import path from 'node:path';
import z from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { SkillGatewayService } from './gateway-service.js';
import { buildGatewayToolResponse } from './tool-response.js';

export const name = 'skill-gateway';
export const inject = ['tools', 'systemPrompt', 'webServer'];

export const Config = z.object({
  /** Optional fixed data directory. Empty means `<cwd>/.skillgate` or the anchor file. */
  dataDir: z.string().default(''),
  /** Optional fixed cwd. Empty means the harness process working directory. */
  cwd: z.string().default(''),
});

const GATEWAY_HINT = [
  '## Skill gateway（强制前置闸门，不可跳过）',
  '每次收到用户请求后，在输出任何最终回答、方案、代码或开始执行任务之前，必须先通过 skill_gateway 探索可用技能。',
  '无论任务看起来多么简单、是否已有相关知识、或用户是否要求直接开始，都必须先执行本流程。',
  '流程：',
  '1. 必须首先调用 skill_gateway(action: "browse")，获取根场景、直接子场景和直接挂载的技能元数据。',
  '2. 只依据返回结果，选择与当前目标最相关的场景，调用 skill_gateway(action: "browse", sceneId: "<返回的真实 sceneId>") 进入。',
  '3. 逐层重复第 2 步，直到进入包含合适 skill 的场景。禁止跳层、禁止猜测 sceneId。',
  '4. 调用 skill_gateway(action: "load", skillName: "<返回的真实 skill name>", scenePath: "<当前场景路径>") 加载该技能全文并应用。',
  '强制规则：',
  '1. 禁止在至少一次 skill_gateway(action: "browse") 之前输出最终答案或开始执行任务。',
  '2. 如果当前场景没有直接技能，但存在与目标相关的子场景，必须继续进入，不能提前跳过。',
  '3. 可以进入不同场景并加载多个相关技能。',
  '4. 只有在完成 browse 且确认根场景及子场景中确实没有任何相关场景或技能时，才可跳过加载，并需简短说明“未找到相关技能”。',
  '5. 所有 sceneId、skillName、scenePath 必须来自工具返回，禁止凭空构造。',
  '6. 如果工具调用失败，重试一次；仍失败则说明“skill_gateway 不可用”。'
].join('\n');

function firstString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function cwdForExec(exec) {
  const agent = exec && exec.agent;
  return (
    firstString(agent && agent.cwd) ||
    firstString(agent && agent.session && agent.session.header && agent.session.header.cwd) ||
    firstString(agent && agent.session && agent.session.cwd) ||
    firstString(agent && agent.workspace && (agent.workspace.cwd || agent.workspace.path)) ||
    process.cwd()
  );
}

function sessionIdForExec(exec) {
  const agent = exec && exec.agent;
  return (
    firstString(agent && agent.sessionId) ||
    firstString(agent && agent.session && agent.session.id) ||
    firstString(agent && agent.id) ||
    'session'
  );
}

function extractDefaultSkillName(args) {
  const value = args && typeof args === 'object' ? args : {};
  for (const key of ['skill', 'skillName', 'skill_name', 'name']) {
    const candidate = firstString(value[key]);
    if (candidate) return candidate;
  }
  return '';
}

export function apply(ctx, config = {}) {
  const defaultCwd = path.resolve(config.cwd || process.cwd());
  const service = new SkillGatewayService({
    cwd: defaultCwd,
    dataDir: config.dataDir || null,
    logger: ctx.logger || console,
  });

  let gatewayToolDisposer = null;
  let gatewayToolInstalled = false;
  let promptSectionDisposer = null;
  let promptSectionInstalled = false;
  let promptEnabled = true;
  let activeCwd = defaultCwd;

  function disposeTool() {
    if (typeof gatewayToolDisposer === 'function') {
      try {
        gatewayToolDisposer();
      } catch {
        // Already disposed by the fiber.
      }
    }
    gatewayToolDisposer = null;
    gatewayToolInstalled = false;
  }

  function disposePrompt() {
    if (typeof promptSectionDisposer === 'function') {
      try {
        promptSectionDisposer();
      } catch {
        // Already disposed by the fiber.
      }
    }
    promptSectionDisposer = null;
    promptSectionInstalled = false;
  }

  function registerTool() {
    if (gatewayToolInstalled) return;

    const tool = defineTool({
      name: 'skill_gateway',
      description:
        '沿 skill-gate 场景树逐层深入并按需加载技能：browse 进入一个场景并返回该场景的直接子场景和直接技能，load 一次性加载选定技能的文件夹全文。',
      parameters: {
        action: {
          type: 'string',
          required: true,
          description: 'browse（进入当前已知子场景，或省略 sceneId 返回根场景）或 load（加载技能全文）。',
        },
        sceneId: {
          type: 'string',
          description: 'browse 使用：要进入的场景 id；省略返回根场景及其直接子场景和直接技能。',
        },
        skillName: {
          type: 'string',
          description: 'load 使用：要加载的技能 name。',
        },
        scenePath: {
          type: 'string',
          description: 'load 使用：本次使用所经过的场景路径（可选）。',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: true,
          properties: {
            ok: { type: 'boolean', required: true },
            action: { type: 'string' },
            result: { type: 'object', additionalProperties: true },
            error: { type: 'string' },
            usageRecorded: { type: 'boolean' },
          },
        },
        render(_args, value) {
          return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
        },
      },
      async execute(args, exec) {
        const action = String(args.action || '');
        const cwd = path.resolve(cwdForExec(exec) || process.cwd());
        const sessionId = sessionIdForExec(exec);

        try {
          const configState = await service.getConfig(cwd);
          if (!configState.enabled) {
            return { ok: false, action, error: 'skill gateway 已关闭。', usageRecorded: false };
          }

          if (action === 'browse') {
            return buildGatewayToolResponse(action, await service.browse(cwd, args.sceneId));
          }

          if (action === 'load') {
            const skillName = String(args.skillName || '').trim();
            if (!skillName) {
              return { ok: false, action, error: 'load 需要 skillName。', usageRecorded: false };
            }
            const result = await service.load(cwd, skillName, String(args.scenePath || ''), sessionId);
            return buildGatewayToolResponse(action, result);
          }

          return { ok: false, action, error: `未知 action：${action}`, usageRecorded: false };
        } catch (error) {
          const message = error && error.message ? error.message : String(error);
          (ctx.logger || console).warn('[skill-gateway] tool call failed:', message);
          return { ok: false, action, error: message, usageRecorded: false };
        }
      },
    });

    gatewayToolDisposer = ctx.tools.register(tool);
    gatewayToolInstalled = true;
  }

  function installPrompt() {
    disposePrompt();
    if (!promptEnabled) return;
    promptSectionDisposer = ctx.systemPrompt.section({
      name: 'skill-gateway',
      order: 120,
      text: () => (promptEnabled ? GATEWAY_HINT : ''),
    });
    promptSectionInstalled = true;
  }

  async function syncEnabled(cwd = activeCwd) {
    activeCwd = path.resolve(cwd || defaultCwd);
    const { enabled } = await service.getConfig(activeCwd);
    promptEnabled = enabled;
    if (enabled && !gatewayToolInstalled) registerTool();
    if (!enabled) disposeTool();
    if (enabled && !promptSectionInstalled) installPrompt();
    if (!enabled) disposePrompt();
    return enabled;
  }

  // Default-on bootstrap. Persisted repository config is reconciled right after.
  registerTool();
  installPrompt();
  syncEnabled(defaultCwd).catch((error) => {
    (ctx.logger || console).warn('[skill-gateway] failed to load repository config:', error);
  });

  // Observer: harness-default skill tool. This is intentionally independent of
  // the toggle and runs even when the gateway tool has been removed.
  ctx.on('tools/result', (exec, result) => {
    if (!exec || exec.name !== 'skill') return;
    if (result && result.isError) return;
    const skillName = extractDefaultSkillName(exec.arguments);
    if (!skillName) return;

    const cwd = cwdForExec(exec);
    const sessionId = sessionIdForExec(exec);
    service.recordAgentSkillUse(cwd, skillName, sessionId).catch((error) => {
      (ctx.logger || console).warn('[skill-gateway] failed to record agent-skills usage:', error);
    });
  });

  // JSON routes for the client panel.
  const webServer = ctx.get ? ctx.get('webServer') : ctx.webServer;
  if (!webServer || typeof webServer.register !== 'function') return;

  function sendJson(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  }

  function queryCwd(req, fallback) {
    try {
      const url = new URL(req.url, 'http://skill-gateway.invalid');
      return path.resolve(url.searchParams.get('cwd') || fallback || activeCwd);
    } catch {
      return path.resolve(fallback || activeCwd);
    }
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > 20 * 1024 * 1024) {
          reject(new Error('请求体过大。'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          resolve(raw ? JSON.parse(raw) : {});
        } catch (error) {
          reject(error);
        }
      });
      req.on('error', reject);
    });
  }

  async function route(req, res) {
    try {
      const url = new URL(req.url, 'http://skill-gateway.invalid');
      const cwd = queryCwd(req);

      if (req.method === 'GET' && url.pathname === '/skill-gateway/state') {
        const state = await service.state(cwd);
        return sendJson(res, 200, state);
      }

      if (req.method === 'GET' && url.pathname === '/skill-gateway/stats') {
        const stats = await service.stats(cwd, {
          source: url.searchParams.get('source') || 'all',
          sessionId: url.searchParams.get('sessionId') || undefined,
        });
        return sendJson(res, 200, stats);
      }

      if (req.method === 'POST' && url.pathname === '/skill-gateway/toggle') {
        const body = await readBody(req);
        const result = await service.setEnabled(body.cwd || cwd, body.enabled);
        await syncEnabled(body.cwd || cwd);
        return sendJson(res, 200, result);
      }

      if (req.method === 'POST' && url.pathname === '/skill-gateway/call') {
        const body = await readBody(req);
        const scope = body.cwd || cwd;
        const action = String(body.action || '');
        if (action === 'browse') {
          const result = await service.browse(scope, body.sceneId);
          return sendJson(res, 200, { ok: result.ok, action, result, error: result.ok ? undefined : result.error });
        }
        if (action === 'load') {
          const result = await service.load(scope, body.skillName, body.scenePath || '', body.sessionId || 'session');
          return sendJson(res, 200, {
            ok: result.ok,
            action,
            result: result.ok ? { skillName: result.skillName, scenePath: result.scenePath, files: result.files } : undefined,
            error: result.ok ? undefined : result.error,
          });
        }
        return sendJson(res, 400, { ok: false, action, error: `未知 action：${action}` });
      }

      if (req.method === 'POST' && url.pathname === '/skill-gateway/scenes') {
        const body = await readBody(req);
        const scope = body.cwd || cwd;
        if (body.action === 'create') {
          return sendJson(res, 200, await service.createScene(scope, body.parentId, body.input || {}, body.options || {}));
        }
        if (body.action === 'update') {
          return sendJson(res, 200, await service.updateScene(scope, body.sceneId, body.input || {}));
        }
        if (body.action === 'delete') {
          return sendJson(res, 200, await service.deleteScene(scope, body.sceneId));
        }
        return sendJson(res, 400, { ok: false, error: '未知 action。' });
      }

      // 管理页文件预览专用：只读文件、不记录 usage；Agent 的全文取用仍走 /skill-gateway/call load。
      if (req.method === 'GET' && url.pathname === '/skill-gateway/skills/files') {
        const skillName = String(url.searchParams.get('skillName') || '').trim();
        if (!skillName) return sendJson(res, 400, { ok: false, error: '缺少 skillName。' });
        return sendJson(res, 200, await service.previewSkillFiles(cwd, skillName));
      }

      if (req.method === 'POST' && url.pathname === '/skill-gateway/scene-tree/preview') {
        const body = await readBody(req);
        const scope = body.cwd || cwd;
        let item = body.item || (body.files ? { name: body.name, files: body.files } : null);
        if (Array.isArray(item)) item = { name: body.name, files: item };
        if (!item || !Array.isArray(item.files)) {
          return sendJson(res, 400, { ok: false, error: 'preview 需要场景树文件夹 item.files。' });
        }
        return sendJson(res, 200, await service.previewSceneTree(scope, item, body.options || {}));
      }

      if (req.method === 'POST' && url.pathname === '/skill-gateway/scenes/skills') {
        const body = await readBody(req);
        const scope = body.cwd || cwd;
        if (body.action === 'attach') {
          return sendJson(res, 200, await service.attachSkill(scope, body.sceneId, body.skillName));
        }
        if (body.action === 'detach') {
          return sendJson(res, 200, await service.detachSkill(scope, body.sceneId, body.skillName));
        }
        return sendJson(res, 400, { ok: false, error: '未知 action。' });
      }

      if (req.method === 'POST' && (url.pathname === '/skill-gateway/upload' || url.pathname === '/skill-gateway/scene-tree/upload')) {
        const body = await readBody(req);
        const scope = body.cwd || cwd;
        if (body.zipBase64 !== undefined || (body.item && body.item.zipBase64 !== undefined)) {
          return sendJson(res, 400, { ok: false, error: 'ZIP 上传已移除，请上传场景树文件夹（item.files）。' });
        }
        let item = body.item || (body.files ? { name: body.name, files: body.files } : null);
        if (Array.isArray(item)) item = { name: body.name, files: item };
        if (!item || !Array.isArray(item.files)) {
          return sendJson(res, 400, { ok: false, error: 'upload 需要场景树文件夹 item.files。' });
        }
        const result = await service.uploadSceneTree(scope, item, body.options || {});
        return sendJson(res, 200, result);
      }

      if (req.method === 'POST' && url.pathname === '/skill-gateway/skills/delete') {
        const body = await readBody(req);
        return sendJson(res, 200, await service.deleteSkill(body.cwd || cwd, body.skillName));
      }

      if (req.method === 'POST' && url.pathname === '/skill-gateway/relocate') {
        const body = await readBody(req);
        return sendJson(res, 200, await service.relocate(body.cwd || cwd, body.dataDir));
      }

      sendJson(res, 404, { ok: false, error: `未找到路由：${req.method} ${url.pathname}` });
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      (ctx.logger || console).warn('[skill-gateway] route failed:', message);
      sendJson(res, 500, { ok: false, error: message });
    }
  }

  for (const spec of [
    { kind: 'exact', path: '/skill-gateway/state', handler: route },
    { kind: 'exact', path: '/skill-gateway/call', handler: route },
    { kind: 'exact', path: '/skill-gateway/stats', handler: route },
    { kind: 'exact', path: '/skill-gateway/toggle', handler: route },
    { kind: 'exact', path: '/skill-gateway/scenes', handler: route },
    { kind: 'exact', path: '/skill-gateway/scene-tree/preview', handler: route },
    { kind: 'exact', path: '/skill-gateway/skills/files', handler: route },
    { kind: 'exact', path: '/skill-gateway/scenes/skills', handler: route },
    { kind: 'exact', path: '/skill-gateway/upload', handler: route },
    { kind: 'exact', path: '/skill-gateway/scene-tree/upload', handler: route },
    { kind: 'exact', path: '/skill-gateway/skills/delete', handler: route },
    { kind: 'exact', path: '/skill-gateway/relocate', handler: route },
  ]) {
    webServer.register(spec);
  }

  return () => {
    disposeTool();
    disposePrompt();
  };
}

export const skillGatewayHint = GATEWAY_HINT;
