// skill-gateway client half.
//
// Registers a frame-level shell.overlay entry: a right-edge toggle opens a
// sliding Skill Gateway sidebar modelled after prototype/index.html. The panel
// owns three tabs (场景树管理 / 统计 / 网关) and talks to the host routes
// registered by src/host.js.

window.__ModuleLoader__.load({
  id: 'skill-gateway-dsh',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const React = require('react');
    const { useState, useEffect, useMemo, useCallback } = React;
    const name = 'skill-gateway-dsh';
    const inject = ['slots'];
    const identity = (state) => state;
    const h = React.createElement;

    const CSS = `
.sg-root, .sg-root *, .sg-fab, .sg-fab *, .sg-panel, .sg-panel * { box-sizing: border-box; }
:root, .sg-root {
  --sg-bg: #E7EDE9;
  --sg-bg-soft: #EDF2EE;
  --sg-surface: #F6F8F6;
  --sg-surface-2: #FCFDFC;
  --sg-ink: #17251F;
  --sg-ink-2: #3D4E47;
  --sg-muted: #5D6E66;
  --sg-faint: #63736B;
  --sg-line: #D3DDD7;
  --sg-line-strong: #B8C6BF;
  --sg-accent: #2F6B56;
  --sg-accent-hover: #245542;
  --sg-accent-soft: #DCEAE3;
  --sg-on-accent: #F2F9F5;
  --sg-danger: #AE4932;
  --sg-danger-soft: #F7E5DE;
  --sg-on-danger: #FFF6F3;
  --sg-warning: #8A631B;
  --sg-warning-soft: #F4EBD2;
  --sg-agent: #4C5B55;
  --sg-agent-soft: #E5EAE7;
  --sg-radius: 8px;
  --sg-shadow: 0 18px 40px rgba(0,0,0,.24);
  --sg-font: "Avenir Next","Segoe UI Variable","Segoe UI","Helvetica Neue","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif;
  --sg-mono: "Cascadia Code","SF Mono","JetBrains Mono","Fira Code",Menlo,Consolas,"Liberation Mono",monospace;
}
@media (prefers-color-scheme: dark) {
  :root, .sg-root {
    --sg-bg: #101815;
    --sg-bg-soft: #131F1A;
    --sg-surface: #16211D;
    --sg-surface-2: #1B2823;
    --sg-ink: #E9F0EC;
    --sg-ink-2: #C2CEC8;
    --sg-muted: #91A098;
    --sg-faint: #7E9087;
    --sg-line: #2A3933;
    --sg-line-strong: #3A4D45;
    --sg-accent: #55AD86;
    --sg-accent-hover: #6DBD98;
    --sg-accent-soft: #1B352A;
    --sg-on-accent: #0B1C14;
    --sg-danger: #E18364;
    --sg-danger-soft: #3A221B;
    --sg-on-danger: #26130D;
    --sg-warning: #D8AE58;
    --sg-warning-soft: #342A16;
    --sg-agent: #A9B6AF;
    --sg-agent-soft: #202C27;
  }
}
.sg-root {
  font-family: var(--sg-font);
  color: var(--sg-ink);
}
.sg-fab {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1200;
  display: flex;
  align-items: center;
  gap: 7px;
  writing-mode: vertical-rl;
  background: var(--sg-accent);
  color: var(--sg-on-accent);
  border: 0;
  border-radius: 9px 0 0 9px;
  padding: 12px 7px;
  font: 600 12px/1.3 var(--sg-font);
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0,0,0,.22);
  letter-spacing: .04em;
}
.sg-fab:hover { background: var(--sg-accent-hover); }
.sg-fab .sg-fab-glyph { writing-mode: horizontal-tb; font-family: var(--sg-mono); font-size: 13px; }
.sg-panel {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: min(720px, 100vw);
  background: var(--sg-surface);
  border-left: 1px solid var(--sg-line);
  box-shadow: var(--sg-shadow);
  display: flex;
  flex-direction: column;
  min-height: 0;
  z-index: 1300;
  animation: sg-panel-in .24s cubic-bezier(.16,1,.3,1);
}
@keyframes sg-panel-in { from { transform: translateX(40px); opacity: .6; } to { transform: translateX(0); opacity: 1; } }
.sg-head {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; border-bottom: 1px solid var(--sg-line);
  background: var(--sg-surface-2); flex: 0 0 auto;
}
.sg-kicker { font: 10px/1.4 var(--sg-mono); letter-spacing: .12em; color: var(--sg-muted); }
.sg-title { font-size: 14px; font-weight: 700; margin: 0; }
.sg-head-gap { flex: 1; }
.sg-switch {
  display: inline-flex; align-items: center; gap: 7px;
  background: transparent; border: 0; cursor: pointer;
  padding: 4px 6px; border-radius: var(--sg-radius); font: 12px/1 var(--sg-font); color: var(--sg-ink-2);
}
.sg-switch:hover { background: var(--sg-bg-soft); }
.sg-switch .sg-track { width: 34px; height: 19px; border-radius: 999px; background: var(--sg-line-strong); position: relative; transition: background .2s ease; }
.sg-switch .sg-knob { position: absolute; left: 2px; top: 2px; width: 15px; height: 15px; border-radius: 50%; background: var(--sg-surface-2); box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .2s ease; }
.sg-switch[aria-checked="true"] .sg-track { background: var(--sg-accent); }
.sg-switch[aria-checked="true"] .sg-knob { transform: translateX(15px); }
.sg-icon-btn {
  width: 28px; height: 28px; display: grid; place-items: center;
  background: transparent; border: 1px solid transparent; border-radius: var(--sg-radius);
  cursor: pointer; color: var(--sg-muted); font-size: 17px;
}
.sg-icon-btn:hover { background: var(--sg-bg-soft); color: var(--sg-ink); }
.sg-route { flex: 0 0 auto; padding: 12px 16px; border-bottom: 1px solid var(--sg-line); background: var(--sg-bg-soft); }
.sg-lane { display: grid; grid-template-columns: 96px 1fr; gap: 10px; align-items: center; font-size: 11px; }
.sg-lane + .sg-lane { margin-top: 8px; }
.sg-lane-label { font: 9px/1.3 var(--sg-mono); letter-spacing: .1em; color: var(--sg-muted); }
.sg-track { display: flex; align-items: center; min-width: 0; gap: 0; }
.sg-node { padding: 3px 7px; border: 1px solid var(--sg-line-strong); border-radius: 4px; background: var(--sg-surface-2); white-space: nowrap; color: var(--sg-ink-2); font-size: 11px; }
.sg-wire { flex: 1; height: 1px; min-width: 12px; background: var(--sg-line-strong); }
.sg-lane.sg-live .sg-wire { background: var(--sg-accent); }
.sg-gate {
  flex: 0 0 auto; width: 30px; height: 17px; border: 1px solid var(--sg-ink-2);
  border-radius: 3px; position: relative; background: var(--sg-surface-2);
}
.sg-gate i { position: absolute; left: 4px; top: 8px; width: 20px; height: 2px; background: var(--sg-ink-2); transform-origin: left center; transform: rotate(-22deg); transition: transform .3s cubic-bezier(.16,1,.3,1), background .2s ease; }
.sg-lane.sg-live .sg-gate { border-color: var(--sg-accent); }
.sg-lane.sg-live .sg-gate i { background: var(--sg-accent); transform: rotate(0deg); }
.sg-lane.sg-off { opacity: .46; }
.sg-lane.sg-off .sg-node { text-decoration: line-through; text-decoration-thickness: 1px; }
.sg-observer { display: flex; align-items: center; gap: 8px; margin-top: 9px; font: 9px/1.2 var(--sg-mono); letter-spacing: .1em; color: var(--sg-muted); }
.sg-led { width: 6px; height: 6px; border-radius: 50%; background: var(--sg-accent); }
.sg-observer .sg-live-label { margin-left: auto; color: var(--sg-accent); }
.sg-tabs { flex: 0 0 auto; display: flex; gap: 2px; padding: 0 14px; border-bottom: 1px solid var(--sg-line); background: var(--sg-surface); }
.sg-tab { background: transparent; border: 0; border-bottom: 2px solid transparent; padding: 10px 12px 9px; cursor: pointer; color: var(--sg-muted); font-size: 13px; }
.sg-tab:hover { color: var(--sg-ink); }
.sg-tab.sg-active { color: var(--sg-accent); border-bottom-color: var(--sg-accent); font-weight: 650; }
.sg-body { flex: 1; min-height: 0; overflow: auto; padding: 14px 16px 18px; }
.sg-foot { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-top: 1px solid var(--sg-line); background: var(--sg-surface-2); font-size: 11px; color: var(--sg-muted); }
.sg-foot .sg-last { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--sg-mono); font-size: 10px; }
.sg-foot b { color: var(--sg-ink-2); font-weight: 600; }
.sg-card { background: var(--sg-surface-2); border: 1px solid var(--sg-line); border-radius: var(--sg-radius); padding: 13px; margin-bottom: 12px; }
.sg-card:last-child { margin-bottom: 0; }
.sg-card-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
.sg-card-head h3 { margin: 0; font-size: 13px; font-weight: 700; }
.sg-card-sub { font: 10px/1.3 var(--sg-mono); color: var(--sg-muted); }
.sg-head-gap { flex: 1; }
.sg-field { margin-bottom: 11px; }
.sg-field:last-child { margin-bottom: 0; }
.sg-field label { display: block; font-size: 11px; color: var(--sg-muted); margin-bottom: 5px; }
.sg-input, .sg-textarea, .sg-select {
  width: 100%; background: var(--sg-surface); border: 1px solid var(--sg-line-strong);
  border-radius: 5px; padding: 7px 9px; font: 13px/1.45 var(--sg-font); color: var(--sg-ink);
}
.sg-textarea { min-height: 68px; resize: vertical; }
.sg-input::placeholder, .sg-textarea::placeholder { color: var(--sg-faint); }
.sg-help { font-size: 11px; color: var(--sg-muted); margin-top: 4px; }
.sg-btn { border-radius: var(--sg-radius); border: 1px solid var(--sg-line-strong); background: var(--sg-surface); padding: 7px 11px; font-size: 12px; cursor: pointer; color: var(--sg-ink-2); white-space: nowrap; }
.sg-btn:hover { border-color: var(--sg-accent); color: var(--sg-accent); }
.sg-btn-primary { background: var(--sg-accent); border-color: var(--sg-accent); color: var(--sg-on-accent); font-weight: 650; }
.sg-btn-primary:hover { background: var(--sg-accent-hover); border-color: var(--sg-accent-hover); color: var(--sg-on-accent); }
.sg-btn-danger { background: transparent; border-color: var(--sg-danger); color: var(--sg-danger); }
.sg-btn-danger:hover { background: var(--sg-danger); color: #fff; }
.sg-btn-sm { padding: 4px 8px; font-size: 11px; }
.sg-btn:disabled { opacity: .45; cursor: not-allowed; }
.sg-btn:disabled:hover { border-color: var(--sg-line-strong); color: var(--sg-ink-2); }
.sg-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.sg-grid2 { display: grid; grid-template-columns: minmax(210px,.92fr) minmax(250px,1.08fr); gap: 12px; align-items: start; }
.sg-tree { display: grid; gap: 2px; }
.sg-tree-row { display: flex; align-items: center; gap: 4px; min-width: 0; padding: 5px 6px; border-radius: 5px; cursor: pointer; border: 1px solid transparent; }
.sg-tree-row:hover { background: var(--sg-bg-soft); }
.sg-tree-row.sg-selected { background: var(--sg-accent-soft); border-color: var(--sg-accent); }
.sg-indent { flex: 0 0 auto; }
.sg-twisty { width: 18px; height: 18px; flex: 0 0 auto; display: grid; place-items: center; background: transparent; border: 0; color: var(--sg-muted); cursor: pointer; font-size: 9px; padding: 0; }
.sg-tree-name { flex: 1; min-width: 0; text-align: left; background: transparent; border: 0; padding: 2px 0; cursor: pointer; font-size: 12px; color: var(--sg-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sg-tree-row.sg-selected .sg-tree-name { font-weight: 700; color: var(--sg-accent); }
.sg-tree-meta { font: 9px/1.3 var(--sg-mono); color: var(--sg-muted); flex: 0 0 auto; white-space: nowrap; }
.sg-tree-actions { display: none; gap: 3px; flex: 0 0 auto; }
.sg-tree-row:hover .sg-tree-actions, .sg-tree-row:focus-within .sg-tree-actions { display: flex; }
.sg-empty { border: 1px dashed var(--sg-line-strong); border-radius: var(--sg-radius); padding: 14px; font-size: 12px; color: var(--sg-muted); text-align: center; }
.sg-section-label { font: 10px/1.4 var(--sg-mono); letter-spacing: .08em; color: var(--sg-muted); margin: 13px 0 7px; text-transform: uppercase; }
.sg-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.sg-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--sg-accent-soft); border: 1px solid var(--sg-accent); color: var(--sg-accent); border-radius: 999px; padding: 3px 8px; font: 11px/1.4 var(--sg-mono); }
.sg-chip button { background: transparent; border: 0; color: var(--sg-accent); cursor: pointer; font-size: 12px; line-height: 1; padding: 0; }
.sg-attach-row { display: flex; gap: 8px; }
.sg-attach-row .sg-select { flex: 1; min-width: 0; }
.sg-danger { border: 1px dashed var(--sg-danger); border-radius: var(--sg-radius); padding: 10px; margin-top: 14px; background: var(--sg-danger-soft); }
.sg-danger p { margin: 0 0 8px; font-size: 11px; color: var(--sg-danger); }
.sg-skill-list { display: grid; gap: 8px; }
.sg-skill-row { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; border: 1px solid var(--sg-line); border-radius: var(--sg-radius); padding: 9px 10px; background: var(--sg-surface); }
.sg-skill-main { min-width: 0; }
.sg-skill-title { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.sg-skill-title strong { font: 12px/1.4 var(--sg-mono); }
.sg-file-count { font: 9px/1.4 var(--sg-mono); color: var(--sg-muted); }
.sg-skill-row p { margin: 3px 0 0; font-size: 11px; color: var(--sg-muted); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.sg-skill-paths { font: 9px/1.5 var(--sg-mono); color: var(--sg-faint); margin-top: 5px; }
.sg-upload-report { border-left: 3px solid var(--sg-warning); background: var(--sg-warning-soft); border-radius: var(--sg-radius); padding: 10px 12px; font-size: 11px; margin-bottom: 12px; }
.sg-upload-report.sg-ok { border-left-color: var(--sg-accent); background: var(--sg-accent-soft); }
.sg-upload-report ul { margin: 6px 0 0; padding-left: 16px; }
.sg-upload-report li { margin: 2px 0; color: var(--sg-ink-2); }
.sg-upload-report li.sg-reason { color: var(--sg-danger); }
.sg-stats-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.sg-chips { display: inline-flex; gap: 4px; background: var(--sg-bg-soft); border: 1px solid var(--sg-line); border-radius: var(--sg-radius); padding: 3px; }
.sg-chips button { background: transparent; border: 0; border-radius: 4px; padding: 4px 9px; font-size: 11px; color: var(--sg-muted); cursor: pointer; }
.sg-chips button.sg-active { background: var(--sg-surface-2); color: var(--sg-accent); font-weight: 700; }
.sg-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
.sg-timeline-card { grid-column: 1 / -1; }
.sg-timeline { display: grid; gap: 7px; }
.sg-timeline-item { display: grid; grid-template-columns: 64px 1fr; gap: 8px; border: 1px solid var(--sg-line); border-radius: var(--sg-radius); padding: 7px 9px; background: var(--sg-surface); font-size: 11px; }
.sg-timeline-time { font: 10px/1.4 var(--sg-mono); color: var(--sg-muted); padding-top: 1px; }
.sg-timeline-main { min-width: 0; }
.sg-timeline-main strong { font: 11px/1.4 var(--sg-mono); }
.sg-timeline-path { font: 9px/1.4 var(--sg-mono); color: var(--sg-muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sg-source { display: inline-flex; font: 9px/1.4 var(--sg-mono); padding: 1px 6px; border-radius: 3px; margin-left: 7px; vertical-align: 1px; }
.sg-source-gateway { background: var(--sg-accent-soft); color: var(--sg-accent); border: 1px solid var(--sg-accent); }
.sg-source-agent { background: var(--sg-agent-soft); color: var(--sg-agent); border: 1px solid var(--sg-agent); }
.sg-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.sg-table th { text-align: left; font: 9px/1.4 var(--sg-mono); letter-spacing: .06em; color: var(--sg-muted); font-weight: 500; padding: 0 4px 7px; }
.sg-table td { padding: 7px 4px; vertical-align: middle; border-top: 1px solid var(--sg-line); }
.sg-table td:last-child { text-align: right; }
.sg-stat-name { font: 11px/1.4 var(--sg-mono); font-weight: 650; }
.sg-stat-num { font: 11px/1.4 var(--sg-mono); color: var(--sg-ink-2); }
.sg-stat-share { font: 10px/1.4 var(--sg-mono); color: var(--sg-muted); }
.sg-bar { height: 3px; background: var(--sg-accent); border-radius: 2px; margin-top: 3px; max-width: 120px; }
.sg-table-scroll { overflow: auto; }
.sg-note { font-size: 10px; color: var(--sg-muted); margin-top: 8px; }
.sg-result-empty { border: 1px dashed var(--sg-line-strong); border-radius: var(--sg-radius); padding: 18px; text-align: center; color: var(--sg-muted); font-size: 12px; }
.sg-path-pill { font: 11px/1.4 var(--sg-mono); background: var(--sg-accent-soft); color: var(--sg-accent); border: 1px solid var(--sg-accent); padding: 3px 7px; border-radius: 4px; }
.sg-match-note { font-size: 11px; color: var(--sg-muted); }
.sg-skill-result-list { display: grid; gap: 8px; }
.sg-skill-result { display: flex; align-items: center; gap: 10px; border: 1px solid var(--sg-line); border-radius: var(--sg-radius); padding: 9px 10px; background: var(--sg-surface); }
.sg-skill-result .sg-skill-main { flex: 1; min-width: 0; }
.sg-skill-result strong { font: 12px/1.4 var(--sg-mono); }
.sg-skill-result p { margin: 3px 0 0; font-size: 11px; color: var(--sg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sg-json { background: #101815; color: #D7E2DC; border-radius: var(--sg-radius); padding: 11px; font: 10.5px/1.55 var(--sg-mono); overflow: auto; max-height: 260px; margin: 10px 0 0; white-space: pre; }
.sg-raw summary { font-size: 11px; color: var(--sg-muted); cursor: pointer; margin-top: 10px; }
.sg-file-list { display: grid; gap: 5px; margin-top: 9px; }
.sg-file-row { display: flex; gap: 8px; align-items: baseline; font: 11px/1.4 var(--sg-mono); border: 1px solid var(--sg-line); border-radius: 4px; padding: 5px 8px; background: var(--sg-surface); }
.sg-file-row span:first-child { color: var(--sg-accent); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sg-file-row span:last-child { margin-left: auto; color: var(--sg-muted); font-size: 10px; }
.sg-preview { margin-top: 8px; background: var(--sg-surface); border: 1px solid var(--sg-line); border-radius: 4px; padding: 8px; font: 11px/1.5 var(--sg-mono); color: var(--sg-muted); white-space: pre-wrap; max-height: 140px; overflow: auto; }
.sg-error { border: 1px solid var(--sg-danger); background: var(--sg-danger-soft); color: var(--sg-danger); border-radius: var(--sg-radius); padding: 10px 12px; font-size: 12px; }
@media (prefers-reduced-motion: reduce) {
  .sg-panel { animation: none; }
  .sg-switch .sg-track, .sg-switch .sg-knob, .sg-gate i { transition: none; }
}
`;

    if (typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.dataset.plugin = name;
      style.dataset.pluginCss = `${name}/client.css`;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

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

    function fmtTime(timestamp) {
      if (!timestamp) return '—';
      const date = new Date(Number(timestamp));
      return Number.isNaN(date.getTime()) ? String(timestamp) : date.toLocaleString();
    }

    function fmtShare(share) {
      return `${Math.round((Number(share) || 0) * 1000) / 10}%`;
    }

    function scenePathOf(catalog, sceneId) {
      const names = [];
      let cursor = catalog.scenes[sceneId];
      const seen = new Set();
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        names.unshift(cursor.name);
        if (!cursor.parentId) break;
        cursor = catalog.scenes[cursor.parentId];
      }
      return names.join(' / ');
    }

    function scenePathsForSkill(catalog, skillName) {
      return Object.values(catalog.scenes || {})
        .filter((scene) => (scene.skills || []).includes(skillName))
        .map((scene) => scenePathOf(catalog, scene.id))
        .sort();
    }

    function SceneTree({ catalog, selectedId, onSelect, onAddChild, onDeleteScene }) {
      const [collapsed, setCollapsed] = useState(() => new Set());
      const renderScene = (scene, depth) => {
        const hasChildren = (scene.children || []).length > 0;
        const isCollapsed = collapsed.has(scene.id);
        return h('div', { key: scene.id },
          h('div', {
            className: 'sg-tree-row' + (scene.id === selectedId ? ' sg-selected' : ''),
            onClick: () => onSelect(scene.id),
          },
            h('div', { className: 'sg-indent', style: { width: depth * 14 } }),
            hasChildren
              ? h('button', {
                  className: 'sg-twisty',
                  onClick: (event) => {
                    event.stopPropagation();
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(scene.id)) next.delete(scene.id);
                      else next.add(scene.id);
                      return next;
                    });
                  },
                }, isCollapsed ? '▸' : '▾')
              : h('span', { className: 'sg-twisty' }),
            h('button', { className: 'sg-tree-name', title: scene.name }, scene.name),
            h('span', { className: 'sg-tree-meta' }, `${(scene.children || []).length}子 · ${(scene.skills || []).length}技`),
            h('span', { className: 'sg-tree-actions' },
              h('button', { className: 'sg-btn sg-btn-sm', onClick: (event) => { event.stopPropagation(); onAddChild(scene.id); } }, '+'),
              scene.id !== catalog.rootSceneId
                ? h('button', { className: 'sg-btn sg-btn-sm sg-btn-danger', onClick: (event) => { event.stopPropagation(); onDeleteScene(scene); } }, '删')
                : null)),
          hasChildren && !isCollapsed
            ? (scene.children || []).map((childId) => renderScene(catalog.scenes[childId], depth + 1))
            : null);
      };
      return h('div', { className: 'sg-tree' }, renderScene(catalog.scenes[catalog.rootSceneId], 0));
    }

    function UploadReport({ items }) {
      if (!items || !items.length) return null;
      const ok = items.every((item) => item.ok || item.skipped);
      return h('div', { className: 'sg-upload-report' + (ok ? ' sg-ok' : '') },
        h('div', null, ok ? '上传完成' : '部分项目未导入'),
        h('ul', null, items.map((item, index) =>
          h('li', { key: index, className: item.ok ? undefined : 'sg-reason' },
            `${item.name || '(未命名)'}: ${item.ok || item.skipped ? '已导入' : (item.reasons || [item.error]).join('；')}`))));
    }

    function CatalogTab({ state, cwd, refresh, notify }) {
      const catalog = state.catalog;
      const [selectedId, setSelectedId] = useState(catalog.rootSceneId);
      const [form, setForm] = useState({ name: '', description: '', tags: '' });
      const [attachSkill, setAttachSkill] = useState('');
      const [report, setReport] = useState([]);
      const selected = catalog.scenes[selectedId] || catalog.scenes[catalog.rootSceneId];

      useEffect(() => {
        if (selected) {
          setForm({ name: selected.name || '', description: selected.description || '', tags: (selected.tags || []).join(', ') });
        }
      }, [selectedId, state]);

      const saveScene = async () => {
        await api('POST', withCwd('/skill-gateway/scenes', cwd), { action: 'update', sceneId: selected.id, input: form, cwd });
        notify(`已保存场景「${form.name}」`);
        await refresh();
      };
      const addChild = async (parentId) => {
        const childName = window.prompt('新场景名称：');
        if (!childName) return;
        const result = await api('POST', withCwd('/skill-gateway/scenes', cwd), { action: 'create', parentId, input: { name: childName, description: '', tags: [] }, cwd });
        notify(result.ok ? `已创建场景「${childName}」` : (result.error || '创建失败'));
        await refresh();
      };
      const deleteScene = async (scene) => {
        if (!window.confirm(`删除场景「${scene.name}」及其所有子场景？其中的技能只会被解链，不会被删除。`)) return;
        const result = await api('POST', withCwd('/skill-gateway/scenes', cwd), { action: 'delete', sceneId: scene.id, cwd });
        notify(result.ok ? `已删除场景「${scene.name}」` : (result.error || '删除失败'));
        setSelectedId(catalog.rootSceneId);
        await refresh();
      };
      const doAttach = async () => {
        if (!attachSkill) return;
        const result = await api('POST', withCwd('/skill-gateway/scenes/skills', cwd), { action: 'attach', sceneId: selected.id, skillName: attachSkill, cwd });
        notify(result.ok ? `已把 ${attachSkill} 挂载到「${selected.name}」` : (result.error || '挂载失败'));
        await refresh();
      };
      const detach = async (skillName) => {
        const result = await api('POST', withCwd('/skill-gateway/scenes/skills', cwd), { action: 'detach', sceneId: selected.id, skillName, cwd });
        notify(`已从「${selected.name}」解链 ${skillName}`);
        await refresh();
      };
      const deleteSkill = async (skillName) => {
        if (!window.confirm(`删除技能「${skillName}」？它会从所有场景解链并删除文件，历史统计保留。`)) return;
        const result = await api('POST', withCwd('/skill-gateway/skills/delete', cwd), { skillName, cwd });
        notify(result.ok ? `已删除技能「${skillName}」` : (result.error || '删除失败'));
        await refresh();
      };

      const uploadItems = async (items) => {
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
            next.push(result.ok || result.skipped ? { ok: true, name: item.name || result.skillName, skipped: result.skipped } : result);
          } catch (error) {
            next.push({ ok: false, name: item.name, error: error.message });
          }
        }
        setReport(next);
        notify(next.every((item) => item.ok || item.skipped) ? '上传完成' : '上传完成，部分项目未导入');
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
        await uploadItems([...byRoot.entries()].map(([root, fileList]) => ({ name: root, files: fileList })));
        input.value = '';
      };
      const onZips = async (event) => {
        const input = event.target;
        const items = [];
        for (const file of [...(input.files || [])]) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          let binary = '';
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
          items.push({ name: file.name, zipBase64: btoa(binary) });
        }
        await uploadItems(items);
        input.value = '';
      };

      const skillNames = Object.keys(catalog.skills || {}).sort();
      return h('div', { className: 'sg-grid2' },
        h('div', null,
          h('section', { className: 'sg-card' },
            h('div', { className: 'sg-card-head' },
              h('h3', null, '场景树'),
              h('span', { className: 'sg-card-sub' }, `${Object.keys(catalog.scenes || {}).length} scenes`)),
            h(SceneTree, { catalog, selectedId, onSelect: setSelectedId, onAddChild: addChild, onDeleteScene: deleteScene })),
          h('section', { className: 'sg-card' },
            h('div', { className: 'sg-card-head' }, h('h3', null, '上传技能')),
            h('div', { className: 'sg-toolbar' },
              h('label', { className: 'sg-btn', htmlFor: 'sg-folder-input' }, '上传文件夹'),
              h('input', { id: 'sg-folder-input', type: 'file', webkitdirectory: '', style: { display: 'none' }, onChange: onFolder }),
              h('label', { className: 'sg-btn', htmlFor: 'sg-zip-input' }, '上传 ZIP（可多选）'),
              h('input', { id: 'sg-zip-input', type: 'file', accept: '.zip', multiple: true, style: { display: 'none' }, onChange: onZips })),
            h('div', { className: 'sg-help' }, '一个文件夹或一个 zip = 一个技能；同名上传需确认后原地更新。'),
            h(UploadReport, { items: report }))),
        h('div', null,
          h('section', { className: 'sg-card' },
            h('div', { className: 'sg-card-head' },
              h('h3', null, '场景信息'),
              h('span', { className: 'sg-card-sub' }, selected.path || selected.name)),
            h('div', { className: 'sg-field' },
              h('label', null, 'name'),
              h('input', { className: 'sg-input', value: form.name, onChange: (event) => setForm({ ...form, name: event.target.value }), placeholder: '场景名称' })),
            h('div', { className: 'sg-field' },
              h('label', null, 'description'),
              h('textarea', { className: 'sg-textarea', value: form.description, onChange: (event) => setForm({ ...form, description: event.target.value }), placeholder: '描述这个场景的工作目的' })),
            h('div', { className: 'sg-field' },
              h('label', null, 'tags'),
              h('input', { className: 'sg-input', value: form.tags, onChange: (event) => setForm({ ...form, tags: event.target.value }), placeholder: '逗号分隔，如 backend, server' })),
            h('div', { className: 'sg-toolbar', style: { justifyContent: 'flex-end' } },
              h('button', { className: 'sg-btn sg-btn-primary', onClick: saveScene }, '保存场景')),
            h('div', { className: 'sg-section-label' }, '直接挂载的技能'),
            (selected.skills || []).length
              ? h('div', { className: 'sg-chip-row' }, selected.skills.map((skillName) =>
                  h('span', { className: 'sg-chip', key: skillName },
                    skillName,
                    h('button', { onClick: () => detach(skillName), 'aria-label': `解链 ${skillName}` }, '×'))))
              : h('div', { className: 'sg-empty', style: { padding: 9 } }, '这个场景还没有直接挂载技能。'),
            h('div', { className: 'sg-section-label' }, '挂载技能到当前场景'),
            h('div', { className: 'sg-attach-row' },
              h('select', { className: 'sg-select', value: attachSkill, onChange: (event) => setAttachSkill(event.target.value) },
                h('option', { value: '' }, '— 选择要挂载的技能 —'),
                skillNames.map((skillName) => h('option', { key: skillName, value: skillName }, skillName))),
              h('button', { className: 'sg-btn sg-btn-primary', onClick: doAttach, disabled: !attachSkill }, '挂载')),
            selected.id !== catalog.rootSceneId
              ? h('div', { className: 'sg-danger' },
                  h('p', null, '删除场景会级联删除其所有子场景；场景中的技能只会被解链。'),
                  h('button', { className: 'sg-btn sg-btn-danger sg-btn-sm', onClick: () => deleteScene(selected) }, '删除当前场景'))
              : null),
          h('section', { className: 'sg-card' },
            h('div', { className: 'sg-card-head' },
              h('h3', null, '技能目录'),
              h('span', { className: 'sg-card-sub' }, `${skillNames.length} skills`)),
            skillNames.length
              ? h('div', { className: 'sg-skill-list' }, skillNames.map((skillName) => {
                  const skill = catalog.skills[skillName];
                  const paths = scenePathsForSkill(catalog, skillName);
                  return h('div', { className: 'sg-skill-row', key: skillName },
                    h('div', { className: 'sg-skill-main' },
                      h('div', { className: 'sg-skill-title' },
                        h('strong', null, skillName),
                        h('span', { className: 'sg-file-count' }, `${skill.updatedAt ? 'updated ' + fmtTime(skill.updatedAt) : ''}`)),
                      h('p', null, skill.description || ''),
                      h('div', { className: 'sg-skill-paths' }, paths.length ? paths.join('  ·  ') : '未挂载到任何场景')),
                    h('button', { className: 'sg-btn sg-btn-sm sg-btn-danger', onClick: () => deleteSkill(skillName) }, '删除'));
                }))
              : h('div', { className: 'sg-empty' }, '还没有技能。上传一个文件夹或 ZIP 开始。'))));
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
      const timeline = [...(stats.usage || [])].sort((a, b) => b.timestamp - a.timestamp);
      const maxSkillCount = aggregate.skills.length ? aggregate.skills[0].count : 1;
      const maxSceneCount = aggregate.scenes.length ? aggregate.scenes[0].count : 1;
      const tableRows = (entries, key, max) => entries.map((entry, index) =>
        h('tr', { key: entry[key] + index },
          h('td', null,
            h('div', { className: 'sg-stat-name' }, entry[key]),
            h('div', { className: 'sg-bar', style: { width: Math.max(8, Math.round((entry.count / max) * 92)) } })),
          h('td', { className: 'sg-stat-num' }, entry.count),
          h('td', { className: 'sg-stat-share' }, fmtShare(entry.share)),
          h('td', { className: 'sg-stat-share' }, fmtTime(entry.lastUsed))));
      return h('div', null,
        h('div', { className: 'sg-stats-toolbar' },
          h('span', { className: 'sg-card-sub' }, '来源'),
          h('div', { className: 'sg-chips' },
            [['all', '全部'], ['gateway', 'gateway'], ['agent-skills', 'agent-skills']].map(([value, label]) =>
              h('button', { key: value, className: source === value ? 'sg-active' : undefined, onClick: () => setSource(value) }, label))),
          h('span', { className: 'sg-card-sub', style: { marginLeft: 'auto' } }, `共 ${aggregate.total} 次使用`)),
        h('div', { className: 'sg-stats-grid' },
          h('section', { className: 'sg-card sg-timeline-card' },
            h('div', { className: 'sg-card-head' },
              h('h3', null, '会话内时间线'),
              h('span', { className: 'sg-card-sub' }, `${timeline.length} records`)),
            timeline.length
              ? h('div', { className: 'sg-timeline' },
                  timeline.map((record) =>
                    h('div', { className: 'sg-timeline-item', key: record.id },
                      h('span', { className: 'sg-timeline-time' }, fmtTime(record.timestamp)),
                      h('div', { className: 'sg-timeline-main' },
                        h('strong', null, record.skillName),
                        h('span', { className: 'sg-source ' + (record.source === 'gateway' ? 'sg-source-gateway' : 'sg-source-agent') }, record.source),
                        h('div', { className: 'sg-timeline-path' }, record.scenePath || '无场景路径（默认技能来源）'),
                      ),
                    ),
                  ),
                )
              : h('div', { className: 'sg-result-empty' }, '该来源筛选下暂无使用记录。')),
          h('section', { className: 'sg-card' },
            h('div', { className: 'sg-card-head' },
              h('h3', null, '全局统计 / 按技能'),
              h('span', { className: 'sg-card-sub' }, `${aggregate.total} 次使用`)),
            aggregate.skills.length
              ? h('div', { className: 'sg-table-scroll' },
                  h('table', { className: 'sg-table' },
                    h('thead', null, h('tr', null,
                      h('th', null, '技能'), h('th', null, '次数'), h('th', null, '占比'), h('th', null, '最近使用'))),
                    h('tbody', null, tableRows(aggregate.skills, 'skillName', maxSkillCount))))
              : h('div', { className: 'sg-result-empty' }, '暂无聚合数据。'),
            h('div', { className: 'sg-note' }, '统计只看来源筛选结果；技能删除后历史记录仍保留。')),
          h('section', { className: 'sg-card' },
            h('div', { className: 'sg-card-head' },
              h('h3', null, '全局统计 / 按场景'),
              h('span', { className: 'sg-card-sub' }, 'scenePath 聚合')),
            aggregate.scenes.length
              ? h('div', { className: 'sg-table-scroll' },
                  h('table', { className: 'sg-table' },
                    h('thead', null, h('tr', null,
                      h('th', null, '场景路径'), h('th', null, '次数'), h('th', null, '占比'), h('th', null, '最近使用'))),
                    h('tbody', null, tableRows(aggregate.scenes, 'scenePath', maxSceneCount))))
              : h('div', { className: 'sg-result-empty' }, '暂无带场景路径的使用记录。'),
            h('div', { className: 'sg-note' }, 'agent-skills 来源通常没有 scenePath，只出现在按技能统计中。'))));
    }

    function GatewayTab({ state, cwd, sessionId, onChanged, notify }) {
      const catalog = state.catalog;
      const [action, setAction] = useState('find');
      const [purpose, setPurpose] = useState('');
      const [browseSceneId, setBrowseSceneId] = useState(catalog.rootSceneId);
      const [loadSkill, setLoadSkill] = useState(Object.keys(catalog.skills || {})[0] || '');
      const [scenePath, setScenePath] = useState('');
      const [result, setResult] = useState(null);
      const [busy, setBusy] = useState(false);
      const sceneIds = Object.keys(catalog.scenes || {}).sort();
      const skillNames = Object.keys(catalog.skills || {}).sort();
      const loadPaths = scenePathsForSkill(catalog, loadSkill);

      useEffect(() => {
        if (!scenePath && loadPaths.length) setScenePath(loadPaths[0]);
      }, [loadSkill, loadPaths, scenePath]);

      const run = async () => {
        setBusy(true);
        try {
          const body = { action, cwd };
          if (action === 'find') body.purpose = purpose;
          if (action === 'browse') body.sceneId = browseSceneId;
          if (action === 'load') {
            body.skillName = loadSkill;
            body.scenePath = scenePath;
            body.sessionId = sessionId || 'session';
          }
          const data = await api('POST', withCwd('/skill-gateway/call', cwd), body);
          setResult(data);
          if (data.ok && action === 'load') {
            notify(`已通过网关加载 ${loadSkill}`);
            await onChanged();
          }
        } catch (error) {
          setResult({ ok: false, action, error: error.message });
        } finally {
          setBusy(false);
        }
      };

      const Raw = ({ value }) => h('details', { className: 'sg-raw' },
        h('summary', null, '查看原始 JSON'),
        h('div', { className: 'sg-json' }, JSON.stringify(value, null, 2)));
      const SkillResult = ({ skill }) => h('div', { className: 'sg-skill-result', key: skill.name },
        h('div', { className: 'sg-skill-main' },
          h('strong', null, skill.name),
          h('p', null, skill.description || '')));
      const ChildResult = ({ child }) => h('div', { className: 'sg-skill-result', key: child.id },
        h('div', { className: 'sg-skill-main' },
          h('strong', null, child.name),
          h('p', null, child.description || '')));

      let body = null;
      if (result && result.ok) {
        const value = result.result || {};
        if (action === 'find') {
          body = h('div', null,
            value.matchedSceneId
              ? h('div', null,
                  h('div', { className: 'sg-match-head' },
                    h('span', { className: 'sg-path-pill' }, value.matchedScenePath || ''),
                    h('span', { className: 'sg-match-note' }, value.matchType === 'skill-secondary' ? '次级匹配：技能 name/description' : '主匹配：场景 name/description/tags')),
                  h('div', { className: 'sg-skill-result-list' },
                    (value.skills || []).map((skill) => h(SkillResult, { skill }))),
                  h(Raw, { value }))
              : h('div', { className: 'sg-result-empty' }, value.message || '没有匹配的场景或技能。'));
        } else if (action === 'browse') {
          body = h('div', null,
            h('div', { className: 'sg-match-head' },
              h('span', { className: 'sg-path-pill' }, value.path || value.name),
              h('span', { className: 'sg-match-note' }, (value.tags || []).join(', '))),
            h('div', { className: 'sg-card' },
              h('div', { className: 'sg-card-head' }, h('h3', null, value.name)),
              h('p', { className: 'sg-help', style: { marginTop: 0 } }, value.description || '（无描述）'),
              h('div', { className: 'sg-section-label' }, '子场景'),
              (value.children || []).length
                ? h('div', { className: 'sg-skill-result-list' }, value.children.map((child) => h(ChildResult, { child })))
                : h('div', { className: 'sg-empty', style: { padding: 9 } }, '没有子场景。'),
              h('div', { className: 'sg-section-label' }, '直接挂载的技能'),
              (value.skills || []).length
                ? h('div', { className: 'sg-skill-result-list' }, value.skills.map((skill) => h(SkillResult, { skill })))
                : h('div', { className: 'sg-empty', style: { padding: 9 } }, '这个场景没有直接挂载技能。'),
            h(Raw, { value })));
        } else if (action === 'load') {
          const files = value.files || {};
          body = h('div', null,
            h('div', { className: 'sg-match-head' },
              h('span', { className: 'sg-path-pill' }, value.skillName || ''),
              value.scenePath ? h('span', { className: 'sg-match-note' }, value.scenePath) : null),
            h('div', { className: 'sg-file-list' },
              Object.keys(files).sort().map((rel) =>
                h('div', { className: 'sg-file-row', key: rel },
                  h('span', null, rel),
                  h('span', null, `${String(files[rel] || '').length} chars`)))),
            files['SKILL.md']
              ? h('div', { className: 'sg-preview' }, String(files['SKILL.md']).slice(0, 1200))
              : null,
            h(Raw, { value }));
        }
      } else if (result) {
        body = h('div', { className: 'sg-error' }, result.error || '调用失败');
      }

      return h('div', { className: 'sg-grid2' },
        h('section', { className: 'sg-card' },
          h('div', { className: 'sg-card-head' }, h('h3', null, '网关工具调用')),
          h('div', { className: 'sg-field' },
            h('label', null, 'action'),
            h('select', { className: 'sg-select', value: action, onChange: (event) => { setAction(event.target.value); setResult(null); } },
              h('option', { value: 'find' }, 'find(purpose)'),
              h('option', { value: 'browse' }, 'browse(sceneId?)'),
              h('option', { value: 'load' }, 'load(skillName, scenePath?)'))),
          action === 'find'
            ? h('div', { className: 'sg-field' },
                h('label', null, 'purpose'),
                h('textarea', { className: 'sg-textarea', value: purpose, onChange: (event) => setPurpose(event.target.value), placeholder: '例如：数据库建模和索引设计' }))
            : null,
          action === 'browse'
            ? h('div', { className: 'sg-field' },
                h('label', null, 'sceneId'),
                h('select', { className: 'sg-select', value: browseSceneId, onChange: (event) => setBrowseSceneId(event.target.value) },
                  sceneIds.map((id) => h('option', { key: id, value: id }, catalog.scenes[id].name))))
            : null,
          action === 'load'
            ? h('div', null,
                h('div', { className: 'sg-field' },
                  h('label', null, 'skillName'),
                  h('select', { className: 'sg-select', value: loadSkill, onChange: (event) => setLoadSkill(event.target.value) },
                    skillNames.map((skillName) => h('option', { key: skillName, value: skillName }, skillName)))),
                h('div', { className: 'sg-field' },
                  h('label', null, 'scenePath（可选）'),
                  h('select', { className: 'sg-select', value: scenePath, onChange: (event) => setScenePath(event.target.value) },
                    h('option', { value: '' }, '（不记录场景路径）'),
                    loadPaths.map((path) => h('option', { key: path, value: path }, path)))))
            : null,
          h('button', { className: 'sg-btn sg-btn-primary', onClick: run, disabled: busy || !state.config.enabled }, busy ? '调用中…' : '运行'),
          !state.config.enabled
            ? h('div', { className: 'sg-note' }, '网关已关闭：工具与提示词已卸载。这里仅作为 UI 演示被禁用。')
            : null),
        h('section', { className: 'sg-card' },
          h('div', { className: 'sg-card-head' },
            h('h3', null, '调用结果'),
            h('span', { className: 'sg-card-sub' }, action)),
          body || h('div', { className: 'sg-result-empty' }, '运行一次 find / browse / load，结果会显示在这里。')));
    }

    function SkillGatewayOverlay(props = {}) {
      const useWorkspaces = props.useWorkspaces || (() => null);
      const useSessions = props.useSessions || (() => null);
      const workspaceSnapshot = useWorkspaces(identity);
      const sessionsSnapshot = useSessions(identity);
      const cwd = useMemo(() => {
        const items = (workspaceSnapshot && workspaceSnapshot.items) || [];
        const recent = items.find((item) => item.id === (workspaceSnapshot && workspaceSnapshot.recentWorkspaceId)) || items[0];
        return recent ? (recent.path || recent.cwd || '') : '';
      }, [workspaceSnapshot]);
      const sessionId = (sessionsSnapshot && sessionsSnapshot.current) || '';

      const [open, setOpen] = useState(false);
      const [tab, setTab] = useState('catalog');
      const [state, setState] = useState(null);
      const [error, setError] = useState('');
      const [lastEvent, setLastEvent] = useState('等待操作');
      const [busy, setBusy] = useState(false);

      const notify = useCallback((message) => {
        setLastEvent(`${new Date().toLocaleTimeString()}  ${message}`);
      }, []);

      const refresh = useCallback(async () => {
        const next = await api('GET', withCwd('/skill-gateway/state', cwd));
        setState(next);
        setError('');
        return next;
      }, [cwd]);

      useEffect(() => {
        if (!open) return;
        refresh().catch((err) => setError(err.message));
      }, [open, refresh]);

      const toggleGateway = async () => {
        if (!state || busy) return;
        setBusy(true);
        try {
          const next = !state.config.enabled;
          await api('POST', withCwd('/skill-gateway/toggle', cwd), { enabled: next, cwd });
          notify(next ? '网关已开启' : '网关已关闭，默认技能旁路与统计观察器保持运行');
          await refresh();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      };

      if (!open) {
        return h('div', { className: 'sg-root' },
          h('button', { className: 'sg-fab', onClick: () => setOpen(true), 'aria-label': '打开 Skill Gateway' },
            h('span', { className: 'sg-fab-glyph' }, '▮'),
            'Skill Gateway'));
      }

      const routeState = state ? (state.config.enabled ? 'on' : 'off') : 'loading';
      return h('div', { className: 'sg-root' },
        h('aside', { className: 'sg-panel', 'aria-label': 'Skill Gateway' },
        h('header', { className: 'sg-head' },
          h('div', null,
            h('div', { className: 'sg-kicker' }, 'CLIENT ADAPTER'),
            h('h2', { className: 'sg-title' }, 'Skill Gateway')),
          h('div', { className: 'sg-head-gap' }),
          h('button', {
            className: 'sg-switch',
            role: 'switch',
            'aria-checked': state ? state.config.enabled : false,
            onClick: toggleGateway,
            disabled: busy || !state,
          },
            h('span', { className: 'sg-track' }, h('span', { className: 'sg-knob' })),
            h('span', null, state ? (state.config.enabled ? '已开启' : '已关闭') : '…')),
          h('button', { className: 'sg-icon-btn', onClick: () => setOpen(false), 'aria-label': '关闭面板' }, '×')),
        h('div', { className: 'sg-route' },
          h('div', { className: 'sg-lane' + (routeState === 'on' ? ' sg-live' : '') + (routeState === 'off' ? ' sg-off' : '') },
            h('div', { className: 'sg-lane-label' }, 'GATEWAY ROUTE'),
            h('div', { className: 'sg-track' },
              h('span', { className: 'sg-node' }, 'agent'),
              h('span', { className: 'sg-wire' }),
              h('span', { className: 'sg-gate' }, h('i')),
              h('span', { className: 'sg-wire' }),
              h('span', { className: 'sg-node' }, 'catalog'))),
          h('div', { className: 'sg-lane sg-live' },
            h('div', { className: 'sg-lane-label' }, 'DEFAULT SKILL'),
            h('div', { className: 'sg-track' },
              h('span', { className: 'sg-node' }, 'harness skill tool'),
              h('span', { className: 'sg-wire' }),
              h('span', { className: 'sg-node' }, 'bypass · 恒可用'))),
          h('div', { className: 'sg-observer' },
            h('span', { className: 'sg-led' }),
            'USAGE OBSERVER',
            h('span', { className: 'sg-live-label' }, '恒开'))),
        h('nav', { className: 'sg-tabs' },
          [['catalog', '场景树管理'], ['stats', '统计'], ['gateway', '网关']].map(([value, label]) =>
            h('button', { key: value, className: 'sg-tab' + (tab === value ? ' sg-active' : ''), onClick: () => setTab(value) }, label))),
        h('div', { className: 'sg-body' },
          error ? h('div', { className: 'sg-error' }, error) : null,
          !state ? h('div', { className: 'sg-result-empty' }, '加载中…') : null,
          state && tab === 'catalog' ? h(CatalogTab, { state, cwd, refresh, notify }) : null,
          state && tab === 'stats' ? h(StatsTab, { cwd, sessionId }) : null,
          state && tab === 'gateway' ? h(GatewayTab, { state, cwd, sessionId, onChanged: refresh, notify }) : null),
          h('footer', { className: 'sg-foot' },
            h('span', { className: 'sg-last' }, lastEvent),
            h('span', null, state && state.location ? state.location.dataDir : '—'))));
    }

    function apply(ctx) {
      if (!ctx || !ctx.slots) return;
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          { name: 'shell.overlay', id: 'skill-gateway-sidebar', order: 50, label: () => 'Skill Gateway' },
          (props) => h(SkillGatewayOverlay, props || {}),
        ));
    }

    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
