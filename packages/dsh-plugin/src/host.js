/**
 * skill-gateway host half (DeepSeek Harness / Cordis plugin).
 *
 * Responsibilities kept intentionally thin:
 *   - resolve a repository-scoped RepoStore per agent cwd,
 *   - register the `skill_gateway` find/browse/load tool,
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
import { unzip } from './zip.js';

export const name = 'skill-gateway';
export const inject = ['tools', 'systemPrompt', 'webServer'];

export const Config = z.object({
  /** Optional fixed data directory. Empty means `<cwd>/.skillgate` or the anchor file. */
  dataDir: z.string().default(''),
  /** Optional fixed cwd. Empty means the harness process working directory. */
  cwd: z.string().default(''),
});

const GATEWAY_HINT = [
  '## Skill gateway',
  '在开始子任务前，先调用 skill_gateway(find) 按目的查找相关技能；',
  '确定要使用某个技能后，再调用 skill_gateway(load) 一次性加载该技能全文。',
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
        '按目的渐进式取用 skill-gate 中的技能：先用 find 发现技能元数据，再用 browse 浏览场景树，确定后调用 load 一次性加载技能文件夹全文。',
      parameters: {
        action: {
          type: 'string',
          required: true,
          description: 'find（按目的匹配场景与技能）、browse（浏览一个场景节点）或 load（加载技能全文）。',
        },
        purpose: {
          type: 'string',
          description: 'find 使用：用一句目的描述来匹配场景树。',
        },
        sceneId: {
          type: 'string',
          description: 'browse 使用：场景 id，省略表示根场景。',
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
            result: { type: 'object' },
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

          if (action === 'find') {
            const result = await service.find(cwd, String(args.purpose || ''));
            return { ok: result.ok, action, result, usageRecorded: false };
          }

          if (action === 'browse') {
            const result = await service.browse(cwd, args.sceneId);
            return { ok: result.ok, action, result, usageRecorded: false };
          }

          if (action === 'load') {
            const skillName = String(args.skillName || '').trim();
            if (!skillName) {
              return { ok: false, action, error: 'load 需要 skillName。', usageRecorded: false };
            }
            const result = await service.load(cwd, skillName, String(args.scenePath || ''), sessionId);
            return {
              ok: result.ok,
              action,
              result: result.ok
                ? { skillName: result.skillName, scenePath: result.scenePath, files: result.files }
                : undefined,
              error: result.ok ? undefined : result.error,
              usageRecorded: result.ok ? true : false,
            };
          }

          return { ok: false, action, error: `未知 action：${action}` };
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

      if (req.method === 'POST' && url.pathname === '/skill-gateway/upload') {
        const body = await readBody(req);
        const scope = body.cwd || cwd;
        let item = body.item || null;
        if (body.zipBase64 || (item && item.zipBase64)) {
          const files = unzip(Buffer.from(body.zipBase64 || item.zipBase64, 'base64'));
          item = { name: body.name || (item && item.name) || 'archive.zip', files };
        }
        if (!item || !Array.isArray(item.files)) {
          return sendJson(res, 400, { ok: false, error: 'upload 需要 item.files 或 zipBase64。' });
        }
        return sendJson(res, 200, await service.uploadSkill(scope, item, { confirm: body.confirm === true }));
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
    { kind: 'exact', path: '/skill-gateway/stats', handler: route },
    { kind: 'exact', path: '/skill-gateway/toggle', handler: route },
    { kind: 'exact', path: '/skill-gateway/scenes', handler: route },
    { kind: 'exact', path: '/skill-gateway/scenes/skills', handler: route },
    { kind: 'exact', path: '/skill-gateway/upload', handler: route },
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
