// skill-gateway client half.
//
// Registers a settings panel with two tabs:
//   场景树管理 — scene CRUD, multi-parent attachment, folder/zip upload, delete
//   统计 — session timeline, per-skill/per-scene global stats, source filter
//
// The panel talks to the host routes registered by src/host.js.

window.__ModuleLoader__.load({
  id: 'skill-gateway',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const React = require('react');
    const { useState, useEffect, useMemo, useCallback } = React;
    const name = 'skill-gateway';

    async function api(method, pathname, body) {
      const opts = { method, headers: {} };
      if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(pathname, opts);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data && (data.error || data.message)) || 'HTTP ' + res.status);
      return data;
    }

    const withCwd = (pathname, cwd) => {
      const sep = pathname.includes('?') ? '&' : '?';
      return cwd ? `${pathname}${sep}cwd=${encodeURIComponent(cwd)}` : pathname;
    };

    function currentCwd(workspaces) {
      if (!workspaces) return '';
      const current = workspaces.current;
      if (current && typeof current === 'object' && current.path) return current.path;
      if (current && typeof current === 'function') {
        try {
          const value = current();
          if (value && value.path) return value.path;
        } catch {
          // Not a snapshot function; fall through.
        }
      }
      const candidates = [workspaces.currentWorkspace, workspaces.defaultWorkspace, workspaces.activeWorkspace];
      for (const candidate of candidates) {
        if (candidate && (candidate.path || candidate.cwd)) return candidate.path || candidate.cwd;
      }
      return '';
    }

    function cwdFromSnapshot(snapshot) {
      if (!snapshot) return '';
      const items = snapshot.items || [];
      const recent = items.find((item) => item.id === snapshot.recentWorkspaceId) || items[0];
      if (recent) return recent.path || recent.cwd || recent.title || '';
      return '';
    }

    const token = (v, fb) => `var(${v}, ${fb})`;
    const T = {
      bg: token('--dsw-alias-bg-layer-1', 'rgba(128,128,128,0.07)'),
      surface: token('--dsw-alias-bg-layer-2', '#ffffff'),
      border: token('--dsw-alias-border-l2', 'rgba(128,128,128,0.35)'),
      muted: token('--dsw-alias-label-tertiary', 'rgba(128,128,128,0.7)'),
      label: token('--dsw-alias-label-primary', '#1f2937'),
      primary: token('--dsw-alias-button-primary-fill', '#2F6B56'),
      onPrimary: token('--dsw-alias-button-contrast-fill', '#ffffff'),
      danger: token('--dsw-static-red-500', '#b91c1c'),
      ok: token('--dsw-static-green-500', '#15803d'),
      radius: 8,
    };
    const inputStyle = {
      flex: 1,
      padding: '6px 10px',
      borderRadius: T.radius,
      border: '1px solid ' + T.border,
      background: T.surface,
      color: T.label,
      outline: 'none',
    };
    const buttonStyle = {
      padding: '6px 12px',
      borderRadius: T.radius,
      border: '1px solid ' + T.border,
      background: T.surface,
      color: T.label,
      cursor: 'pointer',
    };
    const primaryButtonStyle = {
      ...buttonStyle,
      border: 'none',
      background: T.primary,
      color: T.onPrimary,
      fontWeight: 600,
    };
    const boxStyle = {
      border: '1px solid ' + T.border,
      borderRadius: T.radius,
      background: T.bg,
      padding: 10,
    };

    function fmtTime(timestamp) {
      if (!timestamp) return '—';
      const date = new Date(Number(timestamp));
      return Number.isNaN(date.getTime()) ? String(timestamp) : date.toLocaleString();
    }

    function fmtShare(share) {
      return `${Math.round((Number(share) || 0) * 1000) / 10}%`;
    }

    function UploadReport({ items }) {
      if (!items || !items.length) return null;
      return React.createElement('div', { style: { display: 'grid', gap: 4 } },
        items.map((item, index) => React.createElement('div', {
          key: index,
          style: { color: item.ok ? T.ok : T.danger, fontSize: 12, fontFamily: 'monospace' },
        }, `${item.name || '(未命名)'}: ${item.ok ? '已导入' : (item.reasons || [item.error]).join('；')}`)),
      );
    }

    function SceneTree({ catalog, selectedId, onSelect, onAddChild, onDeleteScene }) {
      const root = catalog && catalog.scenes[catalog.rootSceneId];
      if (!root) return null;
      const renderScene = (scene, depth) => {
        const childStyle = { paddingLeft: depth * 14, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' };
        return React.createElement('div', { key: scene.id },
          React.createElement('div', {
            style: { ...childStyle, background: scene.id === selectedId ? T.bg : 'transparent' },
            onClick: () => onSelect(scene.id),
          },
            React.createElement('span', { style: { flex: 1 } }, scene.name),
            React.createElement('span', { style: { fontSize: 11, color: T.muted } }, `${(scene.children || []).length} 子场景 · ${(scene.skills || []).length} 技能`),
            React.createElement('button', { style: { ...buttonStyle, padding: '2px 8px' }, onClick: (e) => { e.stopPropagation(); onAddChild(scene.id); } }, '+'),
            scene.id !== catalog.rootSceneId ? React.createElement('button', { style: { ...buttonStyle, padding: '2px 8px' }, onClick: (e) => { e.stopPropagation(); onDeleteScene(scene); } }, '删') : null),
          (scene.children || []).map((childId) => renderScene(catalog.scenes[childId], depth + 1)),
        );
      };
      return React.createElement('div', { style: boxStyle }, renderScene(root, 0));
    }

    function CatalogTab({ state, cwd, refresh }) {
      const catalog = state.catalog;
      const [selectedId, setSelectedId] = useState(catalog ? catalog.rootSceneId : 'root');
      const [form, setForm] = useState({ name: '', description: '', tags: '' });
      const [attachSkill, setAttachSkill] = useState('');
      const [report, setReport] = useState([]);
      const selected = catalog && catalog.scenes[selectedId];

      useEffect(() => {
        if (selected) setForm({ name: selected.name || '', description: selected.description || '', tags: (selected.tags || []).join(', ') });
      }, [selectedId, state]);

      const saveScene = async () => {
        await api('POST', withCwd('/skill-gateway/scenes', cwd), {
          action: 'update', sceneId: selectedId, input: form, cwd,
        });
        await refresh();
      };
      const addChild = async (parentId) => {
        const childName = window.prompt('新场景名称：');
        if (!childName) return;
        await api('POST', withCwd('/skill-gateway/scenes', cwd), {
          action: 'create', parentId, input: { name: childName, description: '', tags: [] }, cwd,
        });
        await refresh();
      };
      const deleteScene = async (scene) => {
        if (!window.confirm(`删除场景「${scene.name}」及其所有子场景？其中的技能只会被解链，不会被删除。`)) return;
        await api('POST', withCwd('/skill-gateway/scenes', cwd), {
          action: 'delete', sceneId: scene.id, cwd,
        });
        setSelectedId(catalog.rootSceneId);
        await refresh();
      };
      const doAttach = async () => {
        if (!attachSkill) return;
        await api('POST', withCwd('/skill-gateway/scenes/skills', cwd), {
          action: 'attach', sceneId: selectedId, skillName: attachSkill, cwd,
        });
        await refresh();
      };
      const detach = async (skillName) => {
        await api('POST', withCwd('/skill-gateway/scenes/skills', cwd), {
          action: 'detach', sceneId: selectedId, skillName, cwd,
        });
        await refresh();
      };
      const deleteSkill = async (skillName) => {
        if (!window.confirm(`删除技能「${skillName}」？它会从所有场景解链并删除文件，历史统计保留。`)) return;
        await api('POST', withCwd('/skill-gateway/skills/delete', cwd), { skillName, cwd });
        await refresh();
      };
      const uploadFiles = async (items) => {
        const next = [];
        for (const item of items) {
          try {
            let result = await api('POST', withCwd('/skill-gateway/upload', cwd), { item, cwd });
            if (result.ok === false && result.confirmRequired) {
              const skill = result.existingSkill;
              if (window.confirm(`技能「${skill.name}」已存在。确认原地更新并保留使用历史？`)) {
                result = await api('POST', withCwd('/skill-gateway/upload', cwd), { item, cwd, confirm: true });
              } else {
                result = { ok: true, skipped: true };
              }
            }
            next.push(result.ok || result.skipped ? { ok: true, name: item.name || result.skillName } : result);
          } catch (error) {
            next.push({ ok: false, name: item.name, error: error.message });
          }
        }
        setReport(next);
        await refresh();
      };
      const onFolder = async (event) => {
        const input = event.target;
        const files = [...(input.files || [])];
        if (!files.length) return;
        const byRoot = new Map();
        for (const file of files) {
          const rel = file.webkitRelativePath || file.name;
          const root = rel.split('/').slice(0, -1).join('/');
          if (!byRoot.has(root)) byRoot.set(root, []);
          byRoot.get(root).push({ path: rel, content: await file.text() });
        }
        await uploadFiles([...byRoot.entries()].map(([root, fileList]) => ({ name: root, files: fileList })));
        input.value = '';
      };
      const onZips = async (event) => {
        const input = event.target;
        const items = [];
        for (const file of [...(input.files || [])]) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          let binary = '';
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          items.push({ name: file.name, zipBase64: btoa(binary) });
        }
        await uploadFiles(items);
        input.value = '';
      };

      const skillNames = Object.keys(catalog.skills || {}).sort();
      return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 2fr', gap: 12 } },
        React.createElement('div', { style: { display: 'grid', gap: 8, alignContent: 'start' } },
          React.createElement('div', { style: { fontSize: 14, fontWeight: 650 } }, '场景树'),
          React.createElement(SceneTree, { catalog, selectedId, onSelect: setSelectedId, onAddChild: addChild, onDeleteScene: deleteScene }),
          React.createElement('div', { style: boxStyle },
            React.createElement('div', { style: { marginBottom: 6, fontWeight: 600 } }, '上传技能'),
            React.createElement('label', { style: buttonStyle, htmlFor: 'skillgate-folder' }, '上传文件夹'),
            React.createElement('input', { id: 'skillgate-folder', type: 'file', webkitdirectory: '', style: { display: 'none' }, onChange: onFolder }),
            React.createElement('label', { style: buttonStyle, htmlFor: 'skillgate-zips' }, '上传 ZIP（可多选）'),
            React.createElement('input', { id: 'skillgate-zips', type: 'file', accept: '.zip', multiple: true, style: { display: 'none' }, onChange: onZips }),
            React.createElement('div', { style: { fontSize: 11, color: T.muted } }, '一个文件夹或一个 zip = 一个技能；同名上传需确认后原地更新。'),
            React.createElement(UploadReport, { items: report })),
        ),
        React.createElement('div', { style: { display: 'grid', gap: 8, alignContent: 'start' } },
          selected ? React.createElement('div', { style: boxStyle },
            React.createElement('div', { style: { fontWeight: 650, marginBottom: 6 } }, '场景信息'),
            React.createElement('div', { style: { fontSize: 12, color: T.muted, marginBottom: 6 } }, selected.path || selected.name),
            React.createElement('input', { value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }), placeholder: 'name', style: inputStyle }),
            React.createElement('textarea', { value: form.description, onChange: (e) => setForm({ ...form, description: e.target.value }), placeholder: 'description', rows: 3, style: { ...inputStyle, marginTop: 6, resize: 'vertical' } }),
            React.createElement('input', { value: form.tags, onChange: (e) => setForm({ ...form, tags: e.target.value }), placeholder: 'tags，逗号分隔', style: { ...inputStyle, marginTop: 6 } }),
            React.createElement('div', { style: { display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' } },
              React.createElement('button', { style: primaryButtonStyle, onClick: saveScene }, '保存场景')),
            React.createElement('div', { style: { display: 'flex', gap: 6, marginTop: 8 } },
              React.createElement('select', { value: attachSkill, onChange: (e) => setAttachSkill(e.target.value), style: inputStyle },
                React.createElement('option', { value: '' }, '— 选择要挂载的技能 —'),
                skillNames.map((skillName) => React.createElement('option', { key: skillName, value: skillName }, skillName))),
              React.createElement('button', { style: primaryButtonStyle, onClick: doAttach, disabled: !attachSkill }, '挂载')),
            React.createElement('div', { style: { marginTop: 8 } },
              (selected.skills || []).map((skillName) =>
                React.createElement('div', { key: skillName, style: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid ' + T.border } },
                  React.createElement('span', { style: { flex: 1 } }, skillName),
                  React.createElement('button', { style: buttonStyle, onClick: () => detach(skillName) }, '解链'),
                ),
              ),
            ),
          ) : null,
          React.createElement('div', { style: boxStyle },
            React.createElement('div', { style: { fontWeight: 650, marginBottom: 6 } }, '技能目录'),
            skillNames.length
              ? skillNames.map((skillName) =>
                  React.createElement('div', { key: skillName, style: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid ' + T.border } },
                    React.createElement('span', { style: { flex: 1 } }, skillName),
                    React.createElement('span', { style: { fontSize: 11, color: T.muted } }, catalog.skills[skillName].description),
                    React.createElement('button', { style: { ...buttonStyle, color: T.danger }, onClick: () => deleteSkill(skillName) }, '删除'),
                  ),
                )
              : React.createElement('div', { style: { color: T.muted, fontSize: 12 } }, '还没有技能。上传一个文件夹或 ZIP 开始。')),
        ),
      );
    }

    function StatsTab({ cwd, sessionId }) {
      const [source, setSource] = useState('all');
      const [stats, setStats] = useState({ usage: [], stats: { total: 0, skills: [], scenes: [] } });
      const refresh = useCallback(async () => {
        const query = `${withCwd('/skill-gateway/stats', cwd)}${cwd ? '&' : '?'}source=${encodeURIComponent(source)}${sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : ''}`;
        setStats(await api('GET', query));
      }, [cwd, source, sessionId]);
      useEffect(() => { refresh().catch(() => {}); }, [refresh]);

      const aggregate = stats.stats || { total: 0, skills: [], scenes: [] };
      const rows = (entries, key) => entries.map((entry, index) => React.createElement('tr', { key: entry[key] + index },
        React.createElement('td', { style: cellStyle }, entry[key]),
        React.createElement('td', { style: cellStyle }, entry.count),
        React.createElement('td', { style: cellStyle }, fmtShare(entry.share)),
        React.createElement('td', { style: cellStyle }, fmtTime(entry.lastUsed))));

      return React.createElement('div', { style: { display: 'grid', gap: 12 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('span', null, '来源过滤'),
          React.createElement('select', { value: source, onChange: (e) => setSource(e.target.value), style: { ...inputStyle, maxWidth: 180 } },
            React.createElement('option', { value: 'all' }, '全部'),
            React.createElement('option', { value: 'gateway' }, 'gateway'),
            React.createElement('option', { value: 'agent-skills' }, 'agent-skills')),
          React.createElement('span', { style: { color: T.muted } }, `共 ${aggregate.total} 次使用`)),
        React.createElement('div', { style: boxStyle },
          React.createElement('div', { style: { fontWeight: 650, marginBottom: 6 } }, '会话内使用时间线'),
          React.createElement('table', { style: tableStyle },
            React.createElement('thead', null, React.createElement('tr', null,
              React.createElement('th', { style: cellStyle }, '时间'), React.createElement('th', { style: cellStyle }, '技能'), React.createElement('th', { style: cellStyle }, '来源'), React.createElement('th', { style: cellStyle }, '场景路径'))),
            React.createElement('tbody', null, [...(stats.usage || [])].sort((a, b) => b.timestamp - a.timestamp).map((record) => React.createElement('tr', { key: record.id },
              React.createElement('td', { style: cellStyle }, fmtTime(record.timestamp)),
              React.createElement('td', { style: cellStyle }, record.skillName),
              React.createElement('td', { style: cellStyle }, record.source),
              React.createElement('td', { style: cellStyle }, record.scenePath || '—')))))),
        React.createElement('div', { style: boxStyle },
          React.createElement('div', { style: { fontWeight: 650, marginBottom: 6 } }, '全局统计 · 按技能'),
          React.createElement('table', { style: tableStyle },
            React.createElement('thead', null, React.createElement('tr', null,
              React.createElement('th', { style: cellStyle }, '技能'), React.createElement('th', { style: cellStyle }, '次数'), React.createElement('th', { style: cellStyle }, '占比'), React.createElement('th', { style: cellStyle }, '最近使用'))),
            React.createElement('tbody', null, rows(aggregate.skills, 'skillName')))),
        React.createElement('div', { style: boxStyle },
          React.createElement('div', { style: { fontWeight: 650, marginBottom: 6 } }, '全局统计 · 按场景'),
          React.createElement('table', { style: tableStyle },
            React.createElement('thead', null, React.createElement('tr', null,
              React.createElement('th', { style: cellStyle }, '场景路径'), React.createElement('th', { style: cellStyle }, '次数'), React.createElement('th', { style: cellStyle }, '占比'), React.createElement('th', { style: cellStyle }, '最近使用'))),
            React.createElement('tbody', null, rows(aggregate.scenes, 'scenePath')))));
    }

    const cellStyle = { padding: '5px 8px', borderBottom: '1px solid ' + T.border, fontSize: 12, textAlign: 'left' };
    const tableStyle = { borderCollapse: 'collapse', width: '100%' };

    function SkillGatewayPage(props = {}) {
      const workspaceSnapshot = typeof props.useWorkspaces === 'function' ? props.useWorkspaces() : null;
      const sessionsSnapshot = typeof props.useSessions === 'function' ? props.useSessions() : null;
      const sessionId = (sessionsSnapshot && sessionsSnapshot.current) || '';
      const cwd = useMemo(() => cwdFromSnapshot(workspaceSnapshot) || currentCwd((globalThis.__skillGatewayCtx || {}).workspaces), [workspaceSnapshot]);

      const [state, setState] = useState(null);
      const [tab, setTab] = useState('catalog');
      const [error, setError] = useState('');

      const refresh = useCallback(async () => {
        const next = await api('GET', withCwd('/skill-gateway/state', cwd));
        setState(next);
      }, [cwd]);
      useEffect(() => { refresh().catch((err) => setError(err.message)); }, [refresh]);

      const toggle = async () => {
        const enabled = !state.config.enabled;
        await api('POST', withCwd('/skill-gateway/toggle', cwd), { enabled, cwd });
        await refresh();
      };

      if (error) return React.createElement('div', { style: { padding: 16, color: T.danger } }, error);
      if (!state) return React.createElement('div', { style: { padding: 16, color: T.muted } }, '加载中…');

      return React.createElement('div', { style: { padding: 16, display: 'grid', gap: 12, maxWidth: 980 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: 15, fontWeight: 650 } }, 'Skill Gateway'),
            React.createElement('div', { style: { fontSize: 12, color: T.muted, fontFamily: 'monospace' } }, state.location && state.location.dataDir)),
          React.createElement('div', { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement('span', { style: { color: state.config.enabled ? T.ok : T.muted } }, state.config.enabled ? '网关已开启' : '网关已关闭'),
            React.createElement('button', { style: state.config.enabled ? buttonStyle : primaryButtonStyle, onClick: toggle }, state.config.enabled ? '关闭' : '开启'))),
        React.createElement('div', { style: { display: 'flex', gap: 8, borderBottom: '1px solid ' + T.border } },
          React.createElement('button', { style: { ...buttonStyle, borderBottom: tab === 'catalog' ? '2px solid ' + T.primary : '1px solid ' + T.border }, onClick: () => setTab('catalog') }, '场景树管理'),
          React.createElement('button', { style: { ...buttonStyle, borderBottom: tab === 'stats' ? '2px solid ' + T.primary : '1px solid ' + T.border }, onClick: () => setTab('stats') }, '统计')),
        tab === 'catalog'
          ? React.createElement(CatalogTab, { state, cwd, refresh })
          : React.createElement(StatsTab, { cwd, sessionId }));
    }

    function apply(ctx) {
      const slots = ctx && (ctx.slots || (ctx.get && ctx.get('slots')));
      if (!slots || typeof slots.inject !== 'function') return;
      globalThis.__skillGatewayCtx = {
        workspaces: (ctx.get && ctx.get('workspaces')) || ctx.workspaces || null,
      };
      slots.inject('settings.section', () =>
        slots.register(
          { name: 'settings.section', id: 'skill-gateway', order: 50, label: () => 'Skill Gateway' },
          (props) => React.createElement(SkillGatewayPage, props || {}),
        ),
      );
    }

    exports.name = name;
    exports.apply = apply;
    return module.exports;
  },
});
