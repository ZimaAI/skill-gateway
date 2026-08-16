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
  applyOrganizeAction: coreApplyOrganizeAction,
  applyUploadToCatalog: coreApplyUploadToCatalog,
  attachSkill: coreAttachSkill,
  browse: coreBrowse,
  collectUploadSkills: coreCollectUploadSkills,
  createScene: coreCreateScene,
  deleteScene: coreDeleteScene,
  deleteSkill: coreDeleteSkill,
  detachSkill: coreDetachSkill,
  loadSkillFiles,
  recordUsage,
  unclassifiedSkills,
  updateScene: coreUpdateScene,
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
    const [catalog, usage, config, location, uploadSnapshot, organizeSnapshot] = await Promise.all([
      store.ensureCatalog(),
      store.loadUsage(),
      store.loadConfig(),
      store.locationInfo(),
      store.loadSnapshot('upload'),
      store.loadSnapshot('organize'),
    ]);
    return {
      ok: true,
      catalog,
      usage,
      config,
      location,
      stats: aggregateUsage(usage, 'all'),
      snapshots: {
        upload: Boolean(uploadSnapshot),
        organize: Boolean(organizeSnapshot),
      },
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

  /**
   * Upload preview: validate the folder as a skill-only collection. Returns
   * the skill list with per-item validation, overwrite hints and ignored
   * files. Never persists anything and never touches the scene tree.
   */
  async previewUpload(cwd, item, options = {}) {
    const source = Array.isArray(item) ? { files: item } : item || {};
    if (!Array.isArray(source.files) || !source.files.length) {
      return { ok: false, reasons: ['上传需要非空的 item.files。'], name: source.name || null };
    }

    const result = coreCollectUploadSkills(source, {
      rootName: options.rootName,
      rootPath: options.rootPath,
    });
    if (!result.ok) return result;

    const catalog = await this.ensureCatalog(cwd);
    const existingNames = new Set(Object.keys(catalog.skills || {}));
    return {
      ok: true,
      name: result.name,
      skillCount: result.skillCount,
      fileCount: result.fileCount,
      ignoredFiles: result.ignoredFiles,
      skills: result.skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        fileCount: Object.keys(skill.files).length,
        overwrite: existingNames.has(skill.name),
      })),
    };
  }

  /**
   * Upload: collect every skill under the folder, land the files, upsert the
   * catalog (unclassified — no scene attachment), and snapshot the upload
   * slot. Same-name skills are overwritten in place with their originals
   * backed up for rollback. Opening an organize session afterwards is the
   * host's responsibility.
   */
  async upload(cwd, item, options = {}) {
    const source = Array.isArray(item) ? { files: item } : item || {};
    if (!Array.isArray(source.files) || !source.files.length) {
      return { ok: false, reasons: ['上传需要非空的 item.files。'], name: source.name || null };
    }

    const collected = coreCollectUploadSkills(source, {
      rootName: options.rootName,
      rootPath: options.rootPath,
    });
    if (!collected.ok) return collected;

    const store = this.storeFor(cwd);
    const catalog = await store.ensureCatalog();
    const applied = coreApplyUploadToCatalog(catalog, collected.skills, this.now());
    if (!applied.ok) return applied;

    // Snapshot BEFORE any file write: it carries the pre-upload catalog and
    // the batch manifest, and its slot keeps only the most recent snapshot.
    await store.saveSnapshot('upload', {
      catalog,
      batch: { addedSkills: applied.added, overwrittenSkills: applied.overwritten },
    });
    for (const skillName of applied.overwritten) {
      await store.backupSkillFiles('upload', skillName);
    }
    for (const skill of collected.skills) {
      await store.saveSkillFiles(skill.name, skill.files);
    }
    await store.saveCatalog(applied.catalog);

    return {
      ok: true,
      name: collected.name,
      catalog: applied.catalog,
      added: applied.added,
      overwritten: applied.overwritten,
      ignoredFiles: collected.ignoredFiles,
      fileCount: collected.fileCount,
      skillCount: collected.skillCount,
      skills: collected.skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        fileCount: Object.keys(skill.files).length,
      })),
    };
  }

  /**
   * Apply one skill_organize action against the current catalog and persist
   * immediately. Skill files and skill descriptions stay read-only here; the
   * pure rules live in core's applyOrganizeAction.
   */
  async organizeAction(cwd, action, args = {}) {
    const store = this.storeFor(cwd);
    const catalog = await store.ensureCatalog();
    const result = coreApplyOrganizeAction(catalog, action, args);
    if (!result.ok) return result;
    await store.saveCatalog(result.catalog);
    return { ok: true, action, result: result.result };
  }

  async saveOrganizeSnapshot(cwd) {
    const store = this.storeFor(cwd);
    const catalog = await store.ensureCatalog();
    await store.saveSnapshot('organize', { catalog, batch: {} });
    return { ok: true, slot: 'organize' };
  }

  async rollback(cwd, slot) {
    return this.storeFor(cwd).rollbackSnapshot(slot);
  }

  async getOrganizeReport(cwd) {
    const report = await this.storeFor(cwd).loadOrganizeReport();
    return { ok: true, report };
  }

  async saveOrganizeReport(cwd, report) {
    const saved = await this.storeFor(cwd).saveOrganizeReport(report);
    return { ok: true, report: saved };
  }

  async unclassified(cwd) {
    const catalog = await this.ensureCatalog(cwd);
    return { ok: true, skills: unclassifiedSkills(catalog) };
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
