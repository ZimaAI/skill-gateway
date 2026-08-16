/**
 * Host-side organize-session machinery: the `skill_organize` tool definition
 * (registered only into an organize session's agent scope) and the session
 * launcher with per-repo mutual exclusion.
 *
 * Session mechanics follow the verified DSH headless path:
 * `agents.create({ sessionId, meta: { cwd }, agentOptions, setup })` →
 * `followup(createUserMessage(...))` → `await agent.whenIdle()`. The session
 * is a normal top-level session (no `origin: 'subagent'`), stays in the
 * sidebar after completion, and is never disposed by the plugin.
 *
 * Per spec, this seam is GUI-verified rather than unit-tested; the prompt
 * shape and report extraction live in organize-prompts.js and are tested.
 */

import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { installModelSelection } from '@deepseek-ai/dsh-agent';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';
import {
  buildOrganizePrompt,
  extractOrganizeReport,
  sceneSummaryText,
} from './organize-prompts.js';

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

function getService(ctx, key) {
  const service = ctx.get ? ctx.get(key) : ctx[key];
  return service;
}

let coreModule;
try {
  coreModule = await import('@skill-gate/core');
} catch {
  coreModule = await import('../../core/src/index.js');
}
const { diffCatalogs } = coreModule;

function lastAssistantText(session) {
  const events = (session && session.events) || [];
  let last = '';
  for (const event of events) {
    if (!event || event.type !== 'assistant/message' || !event.data || !event.data.message) continue;
    const blocks = event.data.message.content || [];
    const text = blocks
      .filter((block) => block && block.type === 'text')
      .map((block) => block.text || '')
      .join('');
    if (text) last = text;
  }
  return last;
}

function buildOrganizeTool(service, options = {}) {
  const readOnly = Boolean(options.readOnly);
  return defineTool({
    name: 'skill_organize',
    description: readOnly
      ? '冲突检测会话的组织工具：本会话为只读，不允许任何修改动作（createScene/updateScene/deleteScene/moveScene/attachSkill/detachSkill 一律被拒绝）。请使用 skill_gateway 浏览场景树、读取技能全文，并把发现写入最终报告。'
      : '整理场景树专用的组织工具（仅整理会话可见）：createScene 新建场景（name 全树唯一、description 必填且详细）、' +
        'updateScene 改场景 name/description/tags、deleteScene 级联删除子场景（直接挂载技能回到未分类）、' +
        'moveScene 改父场景、attachSkill/detachSkill 挂载/解链技能。技能文件与技能描述只读；技能删除被拒绝。' +
        '每次调用立即校验并落盘。',
    parameters: {
      action: {
        type: 'string',
        required: true,
        description: '要执行的动作：createScene / updateScene / deleteScene / moveScene / attachSkill / detachSkill。',
      },
      sceneId: {
        type: 'string',
        description: 'updateScene/deleteScene/moveScene/attachSkill/detachSkill 使用的目标场景 id。',
      },
      parentId: {
        type: 'string',
        description: 'createScene/moveScene 使用的父场景 id。',
      },
      name: {
        type: 'string',
        description: 'createScene/updateScene 使用的场景名称（全树唯一）。',
      },
      description: {
        type: 'string',
        description: 'createScene/updateScene 使用的场景描述（必填，需详细说明场景作用与边界）。',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'createScene/updateScene 的标签列表（可选）。',
      },
      skillName: {
        type: 'string',
        description: 'attachSkill/detachSkill 使用的技能 name。',
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
        },
      },
      render(_args, value) {
        return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
      },
    },
    async execute(args, exec) {
      const action = String(args.action || '').trim();
      const cwd = path.resolve(cwdForExec(exec) || process.cwd());
      try {
        const config = await service.getConfig(cwd);
        if (!config.enabled) {
          return { ok: false, action, error: 'skill gateway 已关闭，整理功能不可用。' };
        }
        if (readOnly) {
          return { ok: false, action, error: '冲突检测为只读会话，不允许修改场景树（所有修改动作均被拒绝）。' };
        }
        const result = await service.organizeAction(cwd, action, args || {});
        if (!result.ok) {
          return { ok: false, action, error: result.error || '组织动作被拒绝。' };
        }
        return { ok: true, action, result: result.result };
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        return { ok: false, action, error: message };
      }
    },
  });
}

export class OrganizeController {
  /**
   * @param {{service: object, logger?: object, preset?: string}} options
   */
  constructor(options = {}) {
    this.service = options.service;
    this.logger = options.logger || console;
    this.preset = options.preset || '';
    this.tool = buildOrganizeTool(this.service);
    this.readOnlyTool = buildOrganizeTool(this.service, { readOnly: true });
    this.runs = new Map();
  }

  status(cwd) {
    const run = this.runs.get(path.resolve(cwd));
    if (!run || !run.running) {
      return { running: false, sessionId: null, mode: null, startedAt: null };
    }
    return { running: true, sessionId: run.sessionId, mode: run.mode, startedAt: run.startedAt };
  }

  isRunning(cwd) {
    return this.status(cwd).running;
  }

  /**
   * Start one organize session for a repository. Returns immediately with the
   * session id; the session itself runs in the background (snapshot → agent
   * creation → prompt → wait → report). Only one organize session per
   * repository may run at a time.
   */
  async start(ctx, cwd, mode, options = {}) {
    const key = path.resolve(cwd || process.cwd());
    if (this.isRunning(key)) {
      return {
        ok: false,
        error: '已有整理会话正在运行，请等待它完成或先打断它，再触发新的整理。',
      };
    }
    const config = await this.service.getConfig(key);
    if (!config.enabled) {
      return { ok: false, error: 'skill gateway 已关闭，整理功能不可用。' };
    }

    const agents = getService(ctx, 'agents');
    const sessions = getService(ctx, 'sessions');
    if (!agents || typeof agents.create !== 'function') {
      return { ok: false, error: '宿主未提供 agents 服务，无法开启整理会话。' };
    }

    // Resolve the workspace-level session configuration before publishing a
    // run, so a bad mode/model/permission value fails the trigger instead of
    // leaving an empty half-configured session in the sidebar.
    let creation;
    try {
      creation = await this.resolveSessionCreation(ctx, config.session);
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      this.logger.warn('[skill-gateway] failed to resolve organize session config:', message);
      return { ok: false, error: `解析会话配置失败：${message}` };
    }
    if (!creation.ok) return creation;

    // Re-check after the async config resolution: another trigger may have won
    // the mutex while this one was resolving. The check and `runs.set()` below
    // are synchronous, so only one caller can pass.
    if (this.isRunning(key)) {
      return {
        ok: false,
        error: '已有整理会话正在运行，请等待它完成或先打断它，再触发新的整理。',
      };
    }

    const sessionId = SessionId(`skill-organize-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`);
    const startedAt = Date.now();
    const run = { sessionId, mode, startedAt, running: true, endedAt: null };
    this.runs.set(key, run);

    // Fire-and-forget: the run settles the mutex and persists the report.
    this.runSession(ctx, key, run, agents, sessions, options, creation).catch((error) => {
      this.logger.warn('[skill-gateway] organize run failed:', error);
      run.running = false;
      run.endedAt = Date.now();
    });

    return { ok: true, sessionId, mode, startedAt };
  }

  /**
   * Resolve `config.session` into concrete `agents.create()` inputs.
   * Priority: workspace session config → plugin-level `preset` → deployment
   * default model / default agent preset / default permission preset.
   */
  async resolveSessionCreation(ctx, sessionConfig = {}) {
    const configured = sessionConfig && typeof sessionConfig === 'object' ? sessionConfig : {};
    const configuredMode = firstString(configured.mode);
    const configuredProvider = firstString(configured.provider);
    const configuredModel = firstString(configured.model);
    const configuredEffort = firstString(configured.reasoningEffort);
    const configuredPermission = firstString(configured.permission);

    if (Boolean(configuredProvider) !== Boolean(configuredModel)) {
      return { ok: false, error: '会话配置中的模型与提供方必须同时填写，或同时留空以跟随部署默认。' };
    }

    const defaultModel = getService(ctx, 'agentDefaultModel');
    let defaultSelection = null;
    try {
      defaultSelection = defaultModel && typeof defaultModel.currentSelection === 'function'
        ? defaultModel.currentSelection()
        : null;
    } catch {
      defaultSelection = null;
    }

    let selection = defaultSelection;
    if (configuredProvider) {
      selection = {
        provider: configuredProvider,
        model: configuredModel,
        ...(configuredEffort ? { reasoningEffort: configuredEffort } : {}),
      };
    } else if (selection && (!selection.provider || !selection.model)) {
      selection = null;
    }

    // Reasoning identifiers are adapter-owned. Validate an explicitly chosen
    // effort when the host can resolve the model, but never treat a failed
    // catalog lookup as a reason to block session creation: dsh-llm catalogs
    // are advisory and adapters may accept unlisted dynamic models.
    if (selection && selection.reasoningEffort) {
      const llm = getService(ctx, 'llm');
      if (llm && typeof llm.resolveModelInfo === 'function') {
        try {
          const info = await llm.resolveModelInfo(selection.provider, selection.model);
          const efforts = info && info.reasoning ? (info.reasoning.efforts || []) : [];
          const known = new Set(efforts.map((item) => firstString(item && item.id)).filter(Boolean));
          if (known.size && !known.has(selection.reasoningEffort)) {
            return { ok: false, error: `模型「${selection.model}」不支持推理等级「${selection.reasoningEffort}」（可用：${[...known].join('、')}）。` };
          }
        } catch (error) {
          this.logger.warn('[skill-gateway] model reasoning validation skipped:', error && error.message ? error.message : error);
        }
      }
    }

    const presetsService = getService(ctx, 'agentPresets');
    let presetId = configuredMode || firstString(this.preset) || undefined;
    if (presetId) {
      if (!presetsService || typeof presetsService.resolve !== 'function') {
        return { ok: false, error: `会话配置要求使用 Agent 模式「${presetId}」，但宿主未提供 agentPresets 服务。` };
      }
      try {
        const resolved = await presetsService.resolve(presetId);
        presetId = firstString(resolved && resolved.id) || presetId;
        if (resolved && resolved.broken) {
          return { ok: false, error: `Agent 模式「${presetId}」不可用：${resolved.broken}` };
        }
      } catch (error) {
        return { ok: false, error: `无法使用 Agent 模式「${presetId}」：${error && error.message ? error.message : String(error)}` };
      }
    } else if (presetsService && presetsService.defaultId) {
      presetId = presetsService.defaultId;
      if (typeof presetsService.resolve === 'function') {
        try {
          const resolved = await presetsService.resolve(presetId);
          presetId = firstString(resolved && resolved.id) || presetId;
          if (resolved && resolved.broken) {
            return { ok: false, error: `部署默认 Agent 模式「${presetId}」不可用：${resolved.broken}` };
          }
        } catch (error) {
          return { ok: false, error: `无法使用部署默认 Agent 模式「${presetId}」：${error && error.message ? error.message : String(error)}` };
        }
      }
    }

    const permissionPresets = getService(ctx, 'permissionPresets');
    if (configuredPermission) {
      if (!permissionPresets || typeof permissionPresets.set !== 'function') {
        return { ok: false, error: `会话配置要求使用权限「${configuredPermission}」，但宿主未提供权限预设服务。` };
      }
      const names = permissionPresets.names || [];
      if (!names.includes(configuredPermission)) {
        return { ok: false, error: `会话配置中的权限「${configuredPermission}」不存在（可用：${names.join('、') || '无'}）。` };
      }
    }

    return {
      ok: true,
      presetId: presetId || undefined,
      selection: selection || undefined,
      permission: configuredPermission || undefined,
      permissionPresets: configuredPermission ? permissionPresets : undefined,
      session: {
        mode: presetId || '',
        provider: selection ? selection.provider : '',
        model: selection ? selection.model : '',
        reasoningEffort: selection ? (selection.reasoningEffort || '') : '',
        permission: configuredPermission,
      },
    };
  }

  async runSession(ctx, key, run, agents, sessions, options, creation = {}) {
    const { sessionId, mode } = run;
    const { presetId, selection, permission, permissionPresets } = creation;

    // Snapshot before the session starts so the run is rollback-able.
    // Detect mode is read-only: no snapshot, no tree changes.
    if (mode !== 'detect') {
      await this.service.saveOrganizeSnapshot(key);
    }

    const catalog = await this.service.ensureCatalog(key);
    const preCatalog = JSON.parse(JSON.stringify(catalog));
    const unclassified = await this.service.unclassified(key);
    const prompt = buildOrganizePrompt(mode, {
      sceneSummary: sceneSummaryText(catalog),
      unclassified: unclassified.skills,
      batch: options.batch || { addedSkills: [], overwrittenSkills: [] },
      now: run.startedAt,
    });

    let agent;
    try {
      const handle = await agents.create({
        sessionId,
        meta: {
          cwd: key,
          ...(presetId ? { agentPreset: presetId } : {}),
        },
        ...(selection ? { agentOptions: { provider: selection.provider, model: selection.model } } : {}),
        setup: async (agentCtx) => {
          if (presetId) {
            const presets = getService(agentCtx, 'agentPresets') || getService(ctx, 'agentPresets');
            if (!presets || typeof presets.mount !== 'function') {
              throw new Error(`宿主未提供 agentPresets 服务，无法挂载 Agent 模式「${presetId}」。`);
            }
            await presets.mount(agentCtx, presetId);
          }
          if (selection) {
            installModelSelection(agentCtx, {
              current: selection,
              assembled: undefined,
            });
          }
          // Apply the workspace permission choice while the session is still
          // unpublished. `session/created` then sees the durable preset and
          // keeps it instead of pinning the deployment default on top.
          if (permissionPresets && permission) {
            const session = agentCtx && agentCtx.agent && agentCtx.agent.session;
            if (!session) {
              throw new Error('整理会话创建上下文中缺少 agent.session，无法应用权限配置。');
            }
            permissionPresets.set(session, permission);
          }
          agentCtx.tools.register(mode === 'detect' ? this.readOnlyTool : this.tool);
        },
      });
      agent = handle.agent;
    } catch (error) {
      run.running = false;
      run.endedAt = Date.now();
      const message = error && error.message ? error.message : String(error);
      this.logger.warn('[skill-gateway] organize session creation failed:', message);
      return { ok: false, error: `创建整理会话失败：${message}` };
    }

    try {
      await agent.whenIdle();
      // Persist the header now so the workspace registry can validate and
      // attach the session to the workspace owning `key` (the current
      // workspace, never the ungrouped one).
      if (sessions && typeof sessions.flush === 'function') {
        await sessions.flush(agent.session);
      }
      await this.attachToWorkspace(ctx, key, sessionId);
      agent.followup(createUserMessage({
        content: [{ type: 'text', text: prompt }],
        source: { kind: 'plugin', plugin: 'skill-gateway' },
      }));
      await agent.whenIdle();
      if (sessions && typeof sessions.flush === 'function') {
        await sessions.flush(agent.session);
      }
    } catch (error) {
      // Interrupted or failed sessions keep their partial changes and their
      // snapshot; no automatic rollback (spec).
      this.logger.warn('[skill-gateway] organize session interrupted:', error && error.message ? error.message : error);
    }

    run.running = false;
    run.endedAt = Date.now();

    const report = await this.buildReport(key, run, preCatalog, agent, { ...options, session: creation.session || null });
    try {
      await this.service.saveOrganizeReport(key, report);
    } catch (error) {
      this.logger.warn('[skill-gateway] failed to persist organize report:', error);
    }
    return { ok: true, sessionId, report };
  }

  /**
   * Attach a freshly created session to the workspace owning `cwd` so it
   * appears under the current workspace instead of "未分组". The registry
   * reuses the existing workspace for the same canonical path, so this is
   * create-or-attach and idempotent. Best effort: failure only logs.
   */
  async attachToWorkspace(ctx, cwd, sessionId) {
    const registry = getService(ctx, 'workspaceRegistry');
    if (!registry || typeof registry.create !== 'function') return;
    try {
      const workspace = await registry.create(cwd, path.basename(cwd) || 'workspace');
      if (workspace && typeof workspace.attachSession === 'function') {
        await workspace.attachSession(sessionId);
      }
    } catch (error) {
      this.logger.warn('[skill-gateway] organize session could not be attached to the current workspace (shown ungrouped):', error && error.message ? error.message : error);
    }
  }

  async buildReport(key, run, preCatalog, agent, options) {
    const finalCatalog = await this.service.ensureCatalog(key);
    const changes = diffCatalogs(preCatalog, finalCatalog);
    const text = lastAssistantText(agent.session);
    const parsed = extractOrganizeReport(text);
    const batch = options.batch || {};
    return {
      mode: run.mode,
      sessionId: run.sessionId,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      session: options.session || null,
      changes,
      conflicts: parsed ? parsed.conflicts : [],
      duplicates: parsed ? parsed.duplicates : [],
      attachmentReasons: parsed ? parsed.attachmentReasons : {},
      overwrites: Array.isArray(batch.overwrittenSkills) ? [...batch.overwrittenSkills] : [],
      rawText: text ? text.slice(0, 2000) : '',
    };
  }
}
