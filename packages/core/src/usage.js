import { makeId } from './util.js';

/** Usage recording and aggregation. */

/* ------------------------------------------------------------------------ */
/* Usage recording and aggregation                                          */
/* ------------------------------------------------------------------------ */

function normalizeSource(source) {
  return source === 'agent-skills' ? 'agent-skills' : 'gateway';
}

export function recordUsage(usage = [], input = {}, now = Date.now()) {
  const timestampValue = input.timestamp ?? (typeof now === 'function' ? now() : now);
  const timestamp = Number.isFinite(Number(timestampValue)) ? Number(timestampValue) : Date.now();

  const record = {
    id: input.id || makeId('use'),
    skillName: String(input.skillName || '').trim(),
    source: normalizeSource(input.source),
    timestamp,
    sessionId: String(input.sessionId || 'session'),
  };
  const scenePath = String(input.scenePath || '').trim();
  if (scenePath) record.scenePath = scenePath;

  return [...(Array.isArray(usage) ? usage : []), record];
}

/**
 * Aggregate usage records. `options` may be a source filter string
 * (`'all' | 'gateway' | 'agent-skills'`) or `{ source, sessionId }`.
 */
export function aggregateUsage(usage = [], options = 'all') {
  const opts = typeof options === 'string' ? { source: options } : options || {};
  const sourceFilter = opts.source || 'all';
  const sessionId = opts.sessionId;

  const records = (Array.isArray(usage) ? usage : []).filter((record) => {
    if (!record || !record.skillName) return false;
    if (sourceFilter !== 'all' && normalizeSource(record.source) !== sourceFilter) return false;
    if (sessionId !== undefined && String(record.sessionId || 'session') !== String(sessionId)) return false;
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

    const scenePath = String(record.scenePath || '').trim();
    if (scenePath) {
      let scene = byScene.get(scenePath);
      if (!scene) {
        scene = { scenePath, count: 0, lastUsed: 0 };
        byScene.set(scenePath, scene);
      }
      scene.count += 1;
      scene.lastUsed = Math.max(scene.lastUsed, timestamp);
    }
  }

  const total = records.length;
  const withShare = (entry) => ({ ...entry, share: total > 0 ? entry.count / total : 0 });

  const skills = [...bySkill.values()]
    .map(withShare)
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.lastUsed - a.lastUsed ||
        a.skillName.localeCompare(b.skillName, 'en'),
    );

  const scenes = [...byScene.values()]
    .map(withShare)
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.lastUsed - a.lastUsed ||
        a.scenePath.localeCompare(b.scenePath, 'en'),
    );

  return { total, skills, scenes };
}
