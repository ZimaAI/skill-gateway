/**
 * Repository-scoped file persistence for skill-gate.
 *
 * Default layout:
 *   <cwd>/.skillgate-anchor       optional one-line pointer to the real data dir
 *   <data-dir>/catalog.json
 *   <data-dir>/usage.json
 *   <data-dir>/config.json
 *   <data-dir>/skills/<skill-name>/...
 *
 * All JSON writes are temp-file + rename. Usage appends additionally merge by
 * record id under a short-lived lock file, so concurrent writers cannot lose
 * each other's records.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createCatalog, diffCatalogs, makeId, SKILL_NAME_RE } from '../../core/src/index.js';

export const DEFAULT_DATA_DIRNAME = '.skillgate';
export const ANCHOR_FILENAME = '.skillgate-anchor';
export const LOCK_FILENAME = '.write.lock';
export const SNAPSHOT_SLOTS = Object.freeze(['upload', 'organize']);
export const SESSION_CONFIG_KEYS = Object.freeze(['mode', 'provider', 'model', 'reasoningEffort', 'permission']);
export const DEFAULT_SESSION_CONFIG = Object.freeze({
  mode: '',
  provider: '',
  model: '',
  reasoningEffort: '',
  permission: '',
});
const SNAPSHOT_LABELS = { upload: '上传', organize: '整理' };
const LOCK_STALE_MS = 15_000;

function now() {
  return Date.now();
}

async function pathExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function atomicWriteFile(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(temp, content, 'utf8');
  try {
    await fs.rename(temp, file);
  } catch (error) {
    if (error && (error.code === 'EEXIST' || error.code === 'EPERM')) {
      await fs.rm(file, { force: true });
      await fs.rename(temp, file);
    } else {
      throw error;
    }
  }
}

async function copyTree(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === LOCK_FILENAME || entry.name.endsWith('.tmp')) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else if (entry.isFile()) {
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.copyFile(from, to);
    }
  }
}

async function readJsonFile(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJsonFile(file, value) {
  await atomicWriteFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function assertSkillName(skillName) {
  if (!SKILL_NAME_RE.test(String(skillName || ''))) {
    throw new Error(`非法技能名称：${skillName}`);
  }
  return skillName;
}

function assertRelativePath(rel) {
  const normalized = String(rel || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (!normalized || normalized.startsWith('/')) {
    throw new Error(`非法技能文件路径：${rel}`);
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`非法技能文件路径：${rel}`);
  }
  return normalized;
}

function assertSnapshotSlot(slot) {
  if (!SNAPSHOT_SLOTS.includes(slot)) {
    throw new Error(`非法快照槽位：${slot}（可用：${SNAPSHOT_SLOTS.join('、')}）。`);
  }
  return slot;
}

/**
 * Normalize the repository's workspace-level session defaults. Empty string
 * means “follow the deployment/host default” for that field; only these five
 * fields are persisted and unknown keys are dropped.
 */
export function normalizeSessionConfig(value) {
  const source = value && typeof value === 'object' ? value : {};
  const next = {};
  for (const key of SESSION_CONFIG_KEYS) {
    next[key] = typeof source[key] === 'string' ? source[key].trim() : '';
  }
  return next;
}

function snapshotPath(dataDir, slot) {
  return path.join(dataDir, 'snapshots', `${slot}.json`);
}

function snapshotOverwritesDir(dataDir, slot) {
  return path.join(dataDir, 'snapshots', slot, 'overwrites');
}

export async function resolveDataDir(cwd = process.cwd(), explicitDir = null) {
  const base = path.resolve(cwd);
  if (explicitDir) return path.resolve(base, explicitDir);

  const anchor = path.join(base, ANCHOR_FILENAME);
  try {
    const content = (await fs.readFile(anchor, 'utf8')).trim();
    if (content) return path.resolve(base, content.split(/\r?\n/)[0].trim());
  } catch (error) {
    if (error && error.code !== 'ENOENT') throw error;
  }
  return path.join(base, DEFAULT_DATA_DIRNAME);
}

export class RepoStore {
  constructor(options = {}) {
    this.cwd = path.resolve(options.cwd || process.cwd());
    this.explicitDir = options.dir ? path.resolve(this.cwd, options.dir) : null;
    this._queue = Promise.resolve();
  }

  async dataDir() {
    return resolveDataDir(this.cwd, this.explicitDir);
  }

  async locationInfo() {
    const dataDir = await this.dataDir();
    return {
      cwd: this.cwd,
      dataDir,
      anchorFile: path.join(this.cwd, ANCHOR_FILENAME),
      defaultDataDir: path.join(this.cwd, DEFAULT_DATA_DIRNAME),
      hasAnchor: await pathExists(path.join(this.cwd, ANCHOR_FILENAME)),
    };
  }

  /**
   * Serialize writes made through this store instance. Repeated writes are
   * safe; usage appends are additionally merge-idempotent.
   */
  _enqueue(task) {
    const run = this._queue.then(task, task);
    this._queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async _withLock(dataDir, task) {
    await fs.mkdir(dataDir, { recursive: true });
    const lockFile = path.join(dataDir, LOCK_FILENAME);

    for (let attempt = 0; attempt < 120; attempt += 1) {
      let handle;
      try {
        handle = await fs.open(lockFile, 'wx');
        await handle.writeFile(JSON.stringify({ pid: process.pid, time: now() }));
        await handle.close();
        handle = null;
        try {
          return await task();
        } finally {
          await fs.rm(lockFile, { force: true });
        }
      } catch (error) {
        if (error && error.code === 'EEXIST') {
          try {
            const stat = await fs.stat(lockFile);
            if (now() - stat.mtimeMs > LOCK_STALE_MS) {
              await fs.rm(lockFile, { force: true });
              continue;
            }
          } catch {
            // The lock disappeared between open and stat; retry immediately.
            continue;
          }
          await new Promise((resolve) => setTimeout(resolve, 20 + Math.min(attempt, 40) * 5));
          continue;
        }
        throw error;
      }
    }
    throw new Error(`无法获取数据目录写锁：${lockFile}`);
  }

  async ensureCatalog() {
    return this._enqueue(async () => {
      const dataDir = await this.dataDir();
      const file = path.join(dataDir, 'catalog.json');
      let catalog = await readJsonFile(file, null);
      if (!catalog || !catalog.scenes || !catalog.rootSceneId) {
        catalog = createCatalog();
        await writeJsonFile(file, catalog);
      }
      return catalog;
    });
  }

  async loadCatalog() {
    return this._enqueue(async () => {
      const dataDir = await this.dataDir();
      return readJsonFile(path.join(dataDir, 'catalog.json'), null);
    });
  }

  async saveCatalog(catalog) {
    return this._enqueue(async () => {
      const dataDir = await this.dataDir();
      return this._withLock(dataDir, async () => {
        await writeJsonFile(path.join(dataDir, 'catalog.json'), catalog);
        return catalog;
      });
    });
  }

  async loadConfig() {
    return this._enqueue(async () => {
      const dataDir = await this.dataDir();
      const config = await readJsonFile(path.join(dataDir, 'config.json'), { enabled: true });
      return {
        enabled: config.enabled !== false,
        session: normalizeSessionConfig(config.session),
      };
    });
  }

  async saveConfig(config) {
    return this._enqueue(async () => {
      const dataDir = await this.dataDir();
      return this._withLock(dataDir, async () => {
        const file = path.join(dataDir, 'config.json');
        const current = await readJsonFile(file, { enabled: true });
        // Partial writes merge with the persisted record: an enabled-only
        // write (gateway toggle) must not wipe session defaults, and a
        // session-only write must not flip the gateway back on/off. Passing
        // a field explicitly still replaces it (`session: null` clears it).
        const object = config && typeof config === 'object' ? config : {};
        const hasEnabled = Object.prototype.hasOwnProperty.call(object, 'enabled');
        const hasSession = Object.prototype.hasOwnProperty.call(object, 'session');
        const next = {
          enabled: hasEnabled ? object.enabled !== false : current.enabled !== false,
          session: normalizeSessionConfig(hasSession ? object.session : current.session),
        };
        await writeJsonFile(file, next);
        return next;
      });
    });
  }

  async loadUsage() {
    return this._enqueue(async () => {
      const dataDir = await this.dataDir();
      return readJsonFile(path.join(dataDir, 'usage.json'), []);
    });
  }

  /**
   * Append usage records and persist. Records are de-duplicated by `id`, so
   * replaying the same append is harmless and concurrent appenders merge.
   */
  async appendUsage(records) {
    const incoming = Array.isArray(records) ? records : [records];
    return this._enqueue(async () => {
      const dataDir = await this.dataDir();
      return this._withLock(dataDir, async () => {
        const file = path.join(dataDir, 'usage.json');
        const current = await readJsonFile(file, []);
        const currentById = new Map();
        for (const record of current) {
          if (record && record.id) currentById.set(record.id, record);
        }

        const accepted = [];
        for (const input of incoming) {
          if (!input || !input.skillName) continue;
          const record = {
            id: input.id || makeId('use'),
            skillName: String(input.skillName),
            source: input.source === 'agent-skills' ? 'agent-skills' : 'gateway',
            timestamp: Number.isFinite(Number(input.timestamp)) ? Number(input.timestamp) : now(),
            sessionId: String(input.sessionId || 'session'),
          };
          const scenePath = String(input.scenePath || '').trim();
          if (scenePath) record.scenePath = scenePath;

          if (!currentById.has(record.id)) {
            currentById.set(record.id, record);
            accepted.push(record);
          }
        }

        if (!accepted.length) return { appended: 0, usage: current };

        const merged = [...currentById.values()].sort(
          (a, b) => Number(a.timestamp) - Number(b.timestamp) || String(a.id).localeCompare(String(b.id)),
        );
        await writeJsonFile(file, merged);
        return { appended: accepted.length, usage: merged };
      });
    });
  }

  async _skillDir(skillName) {
    const dataDir = await this.dataDir();
    return path.join(dataDir, 'skills', assertSkillName(skillName));
  }

  async saveSkillFiles(skillName, files) {
    return this._enqueue(async () => {
      const dataDir = await this.dataDir();
      return this._withLock(dataDir, async () => {
        const skillDir = path.join(dataDir, 'skills', assertSkillName(skillName));
        await fs.rm(skillDir, { recursive: true, force: true });
        await fs.mkdir(skillDir, { recursive: true });

        for (const [rawPath, content] of Object.entries(files || {})) {
          const rel = assertRelativePath(rawPath);
          const target = path.join(skillDir, ...rel.split('/'));
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, String(content), 'utf8');
        }
        return { skillName, files: Object.keys(files || {}).length };
      });
    });
  }

  async loadSkillFiles(skillName) {
    return this._enqueue(async () => {
      const skillDir = await this._skillDir(skillName);
      return this._readTree(skillDir);
    });
  }

  async _readTree(root) {
    let entries;
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === 'ENOENT') return null;
      throw error;
    }

    const files = {};
    async function walk(currentEntries, prefix) {
      for (const entry of currentEntries) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          const subEntries = await fs.readdir(path.join(root, rel), { withFileTypes: true });
          await walk(subEntries, rel);
        } else if (entry.isFile()) {
          files[rel] = await fs.readFile(path.join(root, rel), 'utf8');
        }
      }
    }
    await walk(entries, '');
    return files;
  }

  async deleteSkillFiles(skillName) {
    return this._enqueue(async () => {
      const skillDir = await this._skillDir(skillName);
      const existed = await pathExists(skillDir);
      await fs.rm(skillDir, { recursive: true, force: true });
      return { skillName, deleted: existed };
    });
  }

  async listSkillFolders() {
    return this._enqueue(async () => {
      const dataDir = await this.dataDir();
      const skillsDir = path.join(dataDir, 'skills');
      let entries;
      try {
        entries = await fs.readdir(skillsDir, { withFileTypes: true });
      } catch (error) {
        if (error && error.code === 'ENOENT') return [];
        throw error;
      }
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    });
  }

  /**
   * Persist one slot's snapshot: the whole catalog plus the batch manifest of
   * this run's file changes. Call BEFORE `backupSkillFiles` for the same slot —
   * saving clears the slot's previous file backups so each slot keeps only the
   * most recent snapshot.
   *
   * @param {'upload'|'organize'} slot
   * @param {{catalog: object, batch?: {addedSkills?: string[], overwrittenSkills?: string[]}}} snapshot
   */
  async saveSnapshot(slot, snapshot) {
    assertSnapshotSlot(slot);
    return this._enqueue(async () => {
      const dataDir = await this.dataDir();
      return this._withLock(dataDir, async () => {
        const target = snapshotPath(dataDir, slot);
        await fs.rm(snapshotOverwritesDir(dataDir, slot), { recursive: true, force: true });
        const payload = {
          slot,
          createdAt: now(),
          catalog: snapshot.catalog,
          batch: {
            addedSkills: [...(snapshot.batch && snapshot.batch.addedSkills) || []].sort(),
            overwrittenSkills: [...(snapshot.batch && snapshot.batch.overwrittenSkills) || []].sort(),
          },
        };
        await writeJsonFile(target, payload);
        return payload;
      });
    });
  }

  async loadSnapshot(slot) {
    assertSnapshotSlot(slot);
    return this._enqueue(async () => {
      const dataDir = await this.dataDir();
      return readJsonFile(snapshotPath(dataDir, slot), null);
    });
  }

  /**
   * Copy a skill's current files into the slot's backup area. Call before the
   * skill is overwritten so the original version can be restored by rollback.
   */
  async backupSkillFiles(slot, skillName) {
    assertSnapshotSlot(slot);
    assertSkillName(skillName);
    return this._enqueue(async () => {
      const dataDir = await this.dataDir();
      return this._withLock(dataDir, async () => {
        const source = path.join(dataDir, 'skills', skillName);
        const target = path.join(snapshotOverwritesDir(dataDir, slot), skillName);
        if (await pathExists(source)) {
          await copyTree(source, target);
          return { skillName, backedUp: true };
        }
        return { skillName, backedUp: false };
      });
    });
  }

  /**
   * Roll one slot back: restore the whole catalog from its snapshot. The
   * upload slot additionally deletes this batch's added skill files and
   * restores the overwritten skills' original files; the organize slot never
   * touches skill files. The snapshot is kept so a repeated rollback is
   * harmless.
   */
  async rollbackSnapshot(slot) {
    assertSnapshotSlot(slot);
    return this._enqueue(async () => {
      const dataDir = await this.dataDir();
      return this._withLock(dataDir, async () => {
        const snapshot = await readJsonFile(snapshotPath(dataDir, slot), null);
        if (!snapshot || !snapshot.catalog) {
          return { ok: false, error: `没有「${SNAPSHOT_LABELS[slot]}」快照可回滚（快照槽位为空）。` };
        }

        const catalogFile = path.join(dataDir, 'catalog.json');
        const current = await readJsonFile(catalogFile, null);
        const affected = diffCatalogs(current, snapshot.catalog);

        if (slot === 'upload') {
          for (const skillName of snapshot.batch.addedSkills || []) {
            await fs.rm(path.join(dataDir, 'skills', assertSkillName(skillName)), { recursive: true, force: true });
          }
          for (const skillName of snapshot.batch.overwrittenSkills || []) {
            const backup = path.join(snapshotOverwritesDir(dataDir, slot), skillName);
            const target = path.join(dataDir, 'skills', assertSkillName(skillName));
            if (await pathExists(backup)) {
              await fs.rm(target, { recursive: true, force: true });
              await copyTree(backup, target);
            }
          }
        }

        await writeJsonFile(catalogFile, snapshot.catalog);
        return { ok: true, slot, catalog: snapshot.catalog, affected };
      });
    });
  }

  async saveOrganizeReport(report) {
    return this._enqueue(async () => {
      const dataDir = await this.dataDir();
      await writeJsonFile(path.join(dataDir, 'organize-report.json'), report);
      return report;
    });
  }

  async loadOrganizeReport() {
    return this._enqueue(async () => {
      const dataDir = await this.dataDir();
      return readJsonFile(path.join(dataDir, 'organize-report.json'), null);
    });
  }

  async writeAnchor(dataDir) {
    const target = path.resolve(this.cwd, String(dataDir || ''));
    const anchor = path.join(this.cwd, ANCHOR_FILENAME);
    await atomicWriteFile(anchor, `${target}\n`);
    this.explicitDir = null;
    return target;
  }

  /**
   * Move the repository's gateway data to `newDataDir`. Existing data is copied
   * first, then the anchor is updated, then the old tree is removed.
   */
  async relocate(newDataDir) {
    return this._enqueue(async () => {
      const oldDir = await this.dataDir();
      const target = path.resolve(this.cwd, String(newDataDir || '').trim());
      if (!target || target === this.cwd) {
        throw new Error('数据目录必须位于工作目录之内的一个子目录中。');
      }
      if (target === oldDir) return { previousDir: oldDir, dataDir: target, moved: false };
      if (target.startsWith(`${oldDir}${path.sep}`)) {
        throw new Error('新数据目录不能位于旧数据目录内部。');
      }

      const oldExists = await pathExists(oldDir);
      if (oldExists) {
        await copyTree(oldDir, target);
      } else {
        await fs.mkdir(target, { recursive: true });
      }

      await this.writeAnchor(target);
      if (oldExists) await fs.rm(oldDir, { recursive: true, force: true });
      return { previousDir: oldDir, dataDir: target, moved: oldExists };
    });
  }
}
