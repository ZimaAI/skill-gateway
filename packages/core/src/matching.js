import { clone } from './util.js';

/** find / browse / load matching and tree traversal. */

export function normalize(value) {
  return String(value ?? '').toLowerCase().normalize('NFKC');
}

export function tokenize(text) {
  const raw = normalize(text).replace(/[^\p{Script=Han}\p{L}\p{N}\s-]/gu, ' ');
  const tokens = new Set();

  const wordRuns = raw.match(/[a-z0-9][a-z0-9-]*/g) || [];
  for (const token of wordRuns) tokens.add(token);

  const cjkRuns = raw.match(/\p{Script=Han}+/gu) || [];
  for (const run of cjkRuns) {
    tokens.add(run);
    if (run.length >= 2) {
      for (let i = 0; i < run.length - 1; i += 1) tokens.add(run.slice(i, i + 2));
    }
  }

  return [...tokens].filter((token) => token.length >= 2);
}

function tokenWeight(token) {
  return token.length >= 3 ? 2 : 1;
}

export function sceneMatchScore(scene, tokens) {
  if (!scene) return 0;
  const name = normalize(scene.name);
  const description = normalize(scene.description);
  const tags = (scene.tags || []).map(normalize);
  let score = 0;
  for (const token of tokens) {
    const weight = tokenWeight(token);
    if (name.includes(token)) score += weight * 4;
    if (description.includes(token)) score += weight;
    for (const tag of tags) {
      if (tag.includes(token)) score += weight * 2;
    }
  }
  return score;
}

export function skillMatchScore(skill, tokens) {
  if (!skill) return 0;
  const name = normalize(skill.name);
  const description = normalize(skill.description);
  let score = 0;
  for (const token of tokens) {
    const weight = tokenWeight(token);
    if (name.includes(token)) score += weight * 2;
    if (description.includes(token)) score += weight;
  }
  return score;
}

export function scenePath(catalog, sceneId) {
  const names = [];
  const seen = new Set();
  let cursor = catalog && catalog.scenes ? catalog.scenes[sceneId] : undefined;
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

export function collectSubtree(catalog, sceneId) {
  const groups = [];
  const skills = [];
  const sceneIds = [];
  const seenSkills = new Set();
  const seenScenes = new Set();
  const queue = [sceneId];

  while (queue.length) {
    const id = queue.shift();
    if (seenScenes.has(id)) continue;
    seenScenes.add(id);
    const scene = catalog && catalog.scenes ? catalog.scenes[id] : undefined;
    if (!scene) continue;
    sceneIds.push(id);

    const direct = [];
    for (const name of scene.skills || []) {
      const skill = catalog.skills && catalog.skills[name];
      if (!skill || seenSkills.has(name)) continue;
      seenSkills.add(name);
      direct.push({ name: skill.name, description: skill.description });
    }
    if (direct.length) {
      groups.push({ sceneId: id, path: scenePath(catalog, id), skills: direct });
    }
    skills.push(...direct);
    queue.push(...(scene.children || []));
  }

  return { sceneIds, groups, skills };
}

function sceneDepth(catalog, sceneId) {
  let depth = 0;
  let cursor = catalog && catalog.scenes ? catalog.scenes[sceneId] : undefined;
  const seen = new Set();
  while (cursor && cursor.parentId && catalog.scenes[cursor.parentId] && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    depth += 1;
    cursor = catalog.scenes[cursor.parentId];
  }
  return depth;
}

/**
 * Rank scenes by primary scene-text matches, then by secondary skill-text
 * matches. A scene hit returns its whole subtree's deduplicated metadata. A
 * secondary-only hit returns only the skills that actually matched.
 */
export function find(catalog, purpose) {
  const text = String(purpose || '');
  const tokens = tokenize(text);

  if (!tokens.length) {
    return {
      ok: true,
      purpose: text,
      tokens: [],
      matchedSceneId: null,
      matchedScenePath: null,
      matchType: null,
      groups: [],
      skills: [],
      message: 'purpose 为空，无法匹配。请输入目的描述。',
    };
  }

  const ranked = Object.values(catalog.scenes || {})
    .map((scene) => {
      const primary = sceneMatchScore(scene, tokens);
      const subtree = collectSubtree(catalog, scene.id);
      const secondary = subtree.skills.reduce(
        (best, skill) => Math.max(best, skillMatchScore(skill, tokens)),
        0,
      );
      return { scene, primary, secondary, depth: sceneDepth(catalog, scene.id) };
    })
    .filter((item) => item.primary > 0 || item.secondary > 0)
    .sort(
      (a, b) =>
        b.primary - a.primary ||
        b.secondary - a.secondary ||
        b.depth - a.depth ||
        a.scene.name.localeCompare(b.scene.name, 'zh-CN'),
    );

  if (!ranked.length) {
    return {
      ok: true,
      purpose: text,
      tokens,
      matchedSceneId: null,
      matchedScenePath: null,
      matchType: null,
      groups: [],
      skills: [],
      message: '没有匹配的场景或技能。换一个目的描述，或先扩充目录。',
    };
  }

  const best = ranked[0];
  const subtree = collectSubtree(catalog, best.scene.id);
  let groups = subtree.groups;
  let skills = subtree.skills;

  if (best.primary === 0) {
    const matchedNames = new Set(
      subtree.skills
        .filter((skill) => skillMatchScore(skill, tokens) > 0)
        .map((skill) => skill.name),
    );
    groups = subtree.groups
      .map((group) => ({
        ...group,
        skills: group.skills.filter((skill) => matchedNames.has(skill.name)),
      }))
      .filter((group) => group.skills.length);
    skills = groups.flatMap((group) => group.skills);
  }

  return {
    ok: true,
    purpose: text,
    tokens,
    matchedSceneId: best.scene.id,
    matchedScenePath: scenePath(catalog, best.scene.id),
    matchType: best.primary > 0 ? 'scene' : 'skill-secondary',
    scenePrimaryScore: best.primary,
    skillSecondaryScore: best.secondary,
    groups,
    skills,
    message: null,
  };
}

export function browse(catalog, sceneId) {
  if (!catalog || !catalog.scenes || !catalog.rootSceneId) {
    return { ok: false, error: '目录无效。' };
  }
  const rootId = catalog.rootSceneId;
  const id = sceneId && catalog.scenes[sceneId] ? sceneId : rootId;
  const scene = catalog.scenes[id];
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
    path: scenePath(catalog, scene.id),
    name: scene.name,
    description: scene.description,
    tags: scene.tags || [],
    children,
    skills,
  };
}

export function loadSkillFiles(skillFiles, skillName) {
  const nested = skillFiles && skillFiles[skillName];
  let files = nested && typeof nested === 'object' ? nested : null;

  // Convenience overload: loadSkillFiles({ 'SKILL.md': '...' }, 'tdd').
  if (!files && skillName && skillFiles && typeof skillFiles === 'object' && !(skillName in skillFiles)) {
    files = skillFiles;
  }

  if (!files) return { ok: false, error: `技能「${skillName}」的文件不存在。` };
  return { ok: true, skillName, files: clone(files) };
}

export const loadSkill = loadSkillFiles;
