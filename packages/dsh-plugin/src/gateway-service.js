/**
 * Framework-free host-side service used by the DSH adapter. It keeps only
 * filesystem/repository wiring here; every catalog/matching/usage decision is
 * delegated to @skill-gate/core.
 */

import path from 'node:path';

let coreModule;
try {
  coreModule = await import('@skill-gate/core');
} catch {
  coreModule = await import('../../core/src/index.js');
}

let repoStoreModule;
try {
  repoStoreModule = await import('@skill-gate/repo-store');
} catch {
  repoStoreModule = await import('../../repo-store/src/index.js');
}

const {
  aggregateUsage,
  attachSkill: coreAttachSkill,
  browse: coreBrowse,
  createScene: coreCreateScene,
  deleteScene: coreDeleteScene,
  deleteSkill: coreDeleteSkill,
  detachSkill: coreDetachSkill,
  importSceneTree: coreImportSceneTree,
  loadSkillFiles,
  recordUsage,
  updateScene: coreUpdateScene,
  upsertSkill: coreUpsertSkill,
  validateUpload,
} = coreModule;
const { RepoStore } = repoStoreModule;

export class SkillGatewayService {
  constructor(options = {}) {
    this.defaultCwd = path.resolve(options.cwd || process.cwd());
    this.dataDir = options.dataDir || null;
    this.now = options.now || Date.now;
    this.logger = options.logger || console;
    this._stores = new Map();
  }

  storeFor(cwd = this.defaultCwd) {
    const key = path.resolve(cwd);
    let store = this._stores.get(key);
    if (!store) {
      store = new RepoStore({ cwd: key, dir: this.dataDir || undefined });
      this._stores.set(key, store);
    }
    return store;
  }

  async ensureCatalog(cwd) {
    const store = this.storeFor(cwd);
    return store.ensureCatalog();
  }

  async state(cwd = this.defaultCwd) {
    const store = this.storeFor(cwd);
    const [catalog, usage, config, location] = await Promise.all([
      store.ensureCatalog(),
      store.loadUsage(),
      store.loadConfig(),
      store.locationInfo(),
    ]);
    return {
      ok: true,
      catalog,
      usage,
      config,
      location,
      stats: aggregateUsage(usage, 'all'),
    };
  }

  async stats(cwd = this.defaultCwd, options = {}) {
    const usage = await this.storeFor(cwd).loadUsage();
    const source = options.source || 'all';
    const sessionId = options.sessionId;
    const matchesSource = (record) => source === 'all' || String(record.source || 'gateway') === source;

    // The timeline is session-scoped; global statistics are workspace-scoped
    // and intentionally include every session that has used skills in `cwd`.
    const sessionUsage = usage.filter((record) => {
      if (!matchesSource(record)) return false;
      if (sessionId && String(record.sessionId || 'session') !== String(sessionId)) return false;
      return true;
    });
    const workspaceUsage = usage.filter(matchesSource);

    return {
      ok: true,
      usage: sessionUsage,
      stats: aggregateUsage(workspaceUsage, 'all'),
      sessionTotal: sessionUsage.length,
      workspaceTotal: workspaceUsage.length,
    };
  }

  async browse(cwd, sceneId) {
    const catalog = await this.ensureCatalog(cwd);
    return coreBrowse(catalog, sceneId);
  }

  async load(cwd, skillName, scenePath = '', sessionId = 'session') {
    const store = this.storeFor(cwd);
    const catalog = await store.ensureCatalog();
    if (!catalog.skills[skillName]) {
      return { ok: false, error: `技能不存在：${skillName}` };
    }

    const files = await store.loadSkillFiles(skillName);
    const loaded = loadSkillFiles({ [skillName]: files }, skillName);
    if (!loaded.ok) return loaded;

    const usage = await store.loadUsage();
    const nextUsage = recordUsage(usage, {
      skillName,
      source: 'gateway',
      scenePath,
      sessionId,
      timestamp: this.now(),
    });
    await store.appendUsage(nextUsage.slice(-1));

    const payload = { ok: true, skillName, files: loaded.files, usageRecorded: true };
    if (scenePath) payload.scenePath = scenePath;
    return payload;
  }

  async recordAgentSkillUse(cwd, skillName, sessionId = 'session') {
    const store = this.storeFor(cwd);
    return store.appendUsage({
      skillName,
      source: 'agent-skills',
      sessionId,
      timestamp: this.now(),
    });
  }

  async createScene(cwd, parentId, input = {}, options = {}) {
    const store = this.storeFor(cwd);
    const catalog = await store.ensureCatalog();
    const result = coreCreateScene(catalog, parentId, input, options);
    if (!result.ok) return result;
    await store.saveCatalog(result.catalog);
    return { ok: true, sceneId: result.sceneId, catalog: result.catalog };
  }

  async updateScene(cwd, sceneId, input = {}) {
    const store = this.storeFor(cwd);
    const catalog = await store.ensureCatalog();
    const result = coreUpdateScene(catalog, sceneId, input);
    if (!result.ok) return result;
    await store.saveCatalog(result.catalog);
    return { ok: true, catalog: result.catalog };
  }

  async deleteScene(cwd, sceneId) {
    const store = this.storeFor(cwd);
    const catalog = await store.ensureCatalog();
    const result = coreDeleteScene(catalog, sceneId);
    if (!result.ok) return result;
    await store.saveCatalog(result.catalog);
    return { ok: true, catalog: result.catalog, deletedIds: result.deletedIds };
  }

  async attachSkill(cwd, sceneId, skillName) {
    const store = this.storeFor(cwd);
    const catalog = await store.ensureCatalog();
    const result = coreAttachSkill(catalog, sceneId, skillName);
    if (!result.ok) return result;
    await store.saveCatalog(result.catalog);
    return { ok: true, catalog: result.catalog, added: result.added };
  }

  async detachSkill(cwd, sceneId, skillName) {
    const store = this.storeFor(cwd);
    const catalog = await store.ensureCatalog();
    const result = coreDetachSkill(catalog, sceneId, skillName);
    if (!result.ok) return result;
    await store.saveCatalog(result.catalog);
    return { ok: true, catalog: result.catalog, removed: result.removed };
  }

  // 管理面板的文件预览，不记录任何使用；gateway load 仍由 `load` 统一记账。
  async previewSkillFiles(cwd, skillName) {
    const store = this.storeFor(cwd);
    const catalog = await store.ensureCatalog();
    const skill = catalog.skills[skillName];
    if (!skill) return { ok: false, error: `技能不存在：${skillName}` };
    const files = await store.loadSkillFiles(skillName);
    return { ok: true, skillName, skill, files: files || {} };
  }

  async previewSceneTree(cwd, item, options = {}) {
    const source = Array.isArray(item) ? { files: item } : item || {};
    if (!Array.isArray(source.files) || !source.files.length) {
      return { ok: false, reasons: ['uploadSceneTree 需要非空的 item.files。'], name: source.name || null };
    }

    const catalog = await this.ensureCatalog(cwd);
    const result = coreImportSceneTree(catalog, source, {
      now: options.now === undefined ? this.now() : options.now,
      rootName: options.rootName,
      rootPath: options.rootPath,
      random: options.random,
    });
    if (!result.ok) return result;

    return {
      ok: true,
      name: result.name,
      sceneCounts: result.sceneCounts,
      skillsImported: result.skillsImported,
      skillsCreated: result.skillsCreated,
      skillsUpdated: result.skillsUpdated,
      fileCount: result.fileCount,
      ignoredFiles: result.ignoredFiles,
      skills: (result.skills || []).map((skill) => ({
        name: skill.name,
        description: skill.description,
        fileCount: Object.keys(skill.files || {}).length,
      })),
    };
  }

  async uploadSkill(cwd, item, options = {}) {
    const validation = validateUpload(item);
    if (!validation.ok) return validation;

    const skill = validation.skill;
    const store = this.storeFor(cwd);
    const catalog = await store.ensureCatalog();
    const existing = catalog.skills[skill.name];

    if (existing && options.confirm !== true) {
      return {
        ok: false,
        confirmRequired: true,
        existingSkill: existing,
        skillName: skill.name,
        reasons: [`技能 ${skill.name} 已存在，再次确认后将原地更新并保留使用历史。`],
        name: item.name || skill.name,
      };
    }

    const upsert = coreUpsertSkill(catalog, skill.name, skill.description, this.now());
    if (!upsert.ok) return upsert;
    await store.saveSkillFiles(skill.name, skill.files);
    await store.saveCatalog(upsert.catalog);
    return {
      ok: true,
      updated: upsert.updated,
      skillName: skill.name,
      catalog: upsert.catalog,
      fileCount: Object.keys(skill.files).length,
    };
  }

  async uploadSceneTree(cwd, item, options = {}) {
    const source = Array.isArray(item) ? { files: item } : item || {};
    if (!Array.isArray(source.files) || !source.files.length) {
      return { ok: false, reasons: ['uploadSceneTree 需要非空的 item.files。'], name: source.name || null };
    }

    const store = this.storeFor(cwd);
    const catalog = await store.ensureCatalog();
    const result = coreImportSceneTree(catalog, source, {
      now: options.now === undefined ? this.now() : options.now,
      rootName: options.rootName,
      rootPath: options.rootPath,
      random: options.random,
    });
    if (!result.ok) return result;

    for (const skill of result.skills) {
      await store.saveSkillFiles(skill.name, skill.files);
    }
    await store.saveCatalog(result.catalog);

    return {
      ok: true,
      catalog: result.catalog,
      name: result.name,
      scenesCreated: result.scenesCreated,
      scenesReused: result.scenesReused,
      sceneCounts: result.sceneCounts,
      skillsImported: result.skillsImported,
      skillsCreated: result.skillsCreated,
      skillsUpdated: result.skillsUpdated,
      skillNames: result.skillNames,
      fileCount: result.fileCount,
      ignoredFiles: result.ignoredFiles,
    };
  }

  async importSceneTree(cwd, item, options = {}) {
    return this.uploadSceneTree(cwd, item, options);
  }

  async deleteSkill(cwd, skillName) {
    const store = this.storeFor(cwd);
    const catalog = await store.ensureCatalog();
    const result = coreDeleteSkill(catalog, skillName);
    if (!result.ok) return result;
    await store.saveCatalog(result.catalog);
    await store.deleteSkillFiles(skillName);
    return { ok: true, catalog: result.catalog, skillName };
  }

  async getConfig(cwd = this.defaultCwd) {
    return this.storeFor(cwd).loadConfig();
  }

  async setEnabled(cwd, enabled) {
    const config = await this.storeFor(cwd).saveConfig({ enabled: enabled !== false });
    return { ok: true, config };
  }

  async relocate(cwd, newDataDir) {
    const result = await this.storeFor(cwd).relocate(newDataDir);
    return { ok: true, ...result };
  }
}
