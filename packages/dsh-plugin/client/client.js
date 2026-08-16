// skill-gateway client half.
//
// Skill Gateway 侧边栏页面，按 prototype/version2 的 Skill Gateway 面板还原：
// - 设计 token 与组件遵循 docs/style/deepseek/design.md
// - 场景树 / 全部技能双视图、上传校验预览、技能文件预览、会话配置、统计、网关 browse 演示
// - 支持拖拽调整侧边栏宽度
// - 页面端不提供“加载全文”；完整技能内容由 Agent 通过 skill_gateway load 工具取用。

window.__ModuleLoader__.load({
  id: 'skill-gateway-dsh',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const React = require('react');
    const { useState, useEffect, useMemo, useRef, useCallback } = React;
    const name = 'skill-gateway-dsh';
    const inject = ['slots'];
    const identity = (state) => state;
    const h = React.createElement;

    const CSS = `/* Skill Gateway DSH 页面样式 · docs/style/deepseek/design.md */
.sg-root, .sg-root *, .sg-modal-root, .sg-modal-root *, .sg-toast-root, .sg-toast-root * { box-sizing: border-box; }
.sg-root, .sg-modal-root, .sg-toast-root {
  color-scheme: light;
  --sg-primary: #165DFF;
  --sg-primary-soft: #E8F3FF;
  --sg-primary-soft-hover: #D4E4FF;
  --sg-primary-gradient: linear-gradient(135deg, #7B9CFF 0%, #9DB8FF 100%);
  --sg-success: #00B42A;
  --sg-success-soft: #E8FFEA;
  --sg-warning: #FF7D00;
  --sg-warning-soft: #FFF3E8;
  --sg-danger: #F53F3F;
  --sg-danger-soft: #FFECE8;
  --sg-bg: #FFFFFF;
  --sg-bg-secondary: #F7F8FA;
  --sg-bg-hover: #F2F3F5;
  --sg-ink-1: #1D2129;
  --sg-ink-2: #4E5969;
  --sg-ink-3: #86909C;
  --sg-ink-4: #C9CDD4;
  --sg-line: #E5E6EB;
  --sg-line-soft: #F2F3F5;
  --sg-r-sm: 8px;
  --sg-r-md: 12px;
  --sg-r-lg: 16px;
  --sg-r-full: 999px;
  --sg-shadow-float: 0 4px 12px rgba(0, 0, 0, 0.06);
  --sg-shadow-normal: 0 1px 3px rgba(0, 0, 0, 0.04);
  --sg-shadow-focus: 0 0 0 3px rgba(22, 93, 255, 0.08);
  --sg-font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
  --sg-font-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  --sg-unit: 4px;
  --sg-panel-w: 440px;
}
.sg-root, .sg-modal-root, .sg-toast-root {
  font-family: var(--sg-font-ui);
  color: var(--sg-ink-1);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
.sg-root button, .sg-root input, .sg-root textarea, .sg-root select,
.sg-modal-root button, .sg-modal-root input, .sg-modal-root textarea, .sg-modal-root select {
  font: inherit;
  color: inherit;
}
.sg-root button, .sg-modal-root button { letter-spacing: 0.01em; }
.sg-root button:focus-visible, .sg-root input:focus-visible, .sg-root textarea:focus-visible, .sg-root select:focus-visible,
.sg-modal-root button:focus-visible, .sg-modal-root input:focus-visible, .sg-modal-root textarea:focus-visible, .sg-modal-root select:focus-visible {
  outline: 2px solid var(--sg-primary);
  outline-offset: 1px;
}
svg.sg-icon {
  width: 16px; height: 16px; flex: 0 0 auto; fill: none; stroke: currentColor;
  stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round;
}

/* 自定义：面板悬浮/宽度拖拽 */
.sg-launcher {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1200;
  display: flex;
  align-items: center;
  gap: 7px;
  writing-mode: vertical-rl;
  background: var(--sg-primary-gradient);
  color: #fff;
  border: 0;
  border-radius: 12px 0 0 12px;
  padding: 10px 7px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  cursor: pointer;
  box-shadow: var(--sg-shadow-float);
}
.sg-launcher:hover { filter: brightness(1.05); }
.sg-launcher .sg-logo { writing-mode: horizontal-tb; width: 22px; height: 22px; }
.sg-panel {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  z-index: 1300;
  background: var(--sg-bg);
  border-left: 1px solid var(--sg-line);
  box-shadow: var(--sg-shadow-float);
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  animation: sg-panel-in 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes sg-panel-in {
  from { transform: translateX(40px); opacity: 0.6; }
  to { transform: translateX(0); opacity: 1; }
}
.sg-panel.sg-panel-closed { display: none; }
.sg-resizer {
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 7px;
  cursor: col-resize;
  z-index: 20;
  touch-action: none;
}
.sg-resizer::before {
  content: "";
  position: absolute;
  left: 3px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--sg-line);
  transition: background 0.2s ease, width 0.2s ease;
}
.sg-resizer:hover::before, .sg-root.sg-is-resizing .sg-resizer::before {
  left: 2px;
  width: 3px;
  background: var(--sg-primary);
}
.sg-root.sg-is-resizing { user-select: none; cursor: col-resize; }
.sg-root.sg-is-resizing .sg-panel { transition: none; }
.sg-logo { display: block; flex: 0 0 auto; }
.sg-panel-mark {
  display: grid;
  place-items: center;
  border-radius: var(--sg-r-sm);
  flex: 0 0 auto;
  color: #fff;
}
.sg-panel-mark .sg-logo { width: 28px; height: 28px; }
.sg-mono {
  font-family: var(--sg-font-mono);
}

.sg-hidden {
  display: none !important;
}

/* ------------------------------------------------------------------------ */
/* Skill Gateway 侧边栏                                                      */
/* ------------------------------------------------------------------------ */

.sg-panel {
  width: var(--sg-panel-w);
  flex: 0 0 var(--sg-panel-w);
  background: var(--sg-bg);
  border-left: 1px solid var(--sg-line);
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.sg-panel-header {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border-bottom: 1px solid var(--sg-line-soft);
  flex: 0 0 auto;
}

.sg-panel-mark {
  width: 28px;
  height: 28px;
  border-radius: var(--sg-r-sm);
  background: var(--sg-primary-gradient);
  color: #fff;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.sg-panel-mark svg {
  width: 16px;
  height: 16px;
}

.sg-panel-title-wrap {
  min-width: 0;
  flex: 1;
}

.sg-panel-title {
  font-size: 16px;
  font-weight: 500;
  line-height: 1.5;
  color: var(--sg-ink-1);
  white-space: nowrap;
}

.sg-panel-subtitle {
  font-size: 12px;
  line-height: 1.5;
  color: var(--sg-ink-3);
  white-space: nowrap;
}

.sg-icon-btn {
  width: 28px;
  height: 28px;
  display: inline-grid;
  place-items: center;
  border: 0;
  border-radius: var(--sg-r-sm);
  background: transparent;
  color: var(--sg-ink-3);
  cursor: pointer;
  padding: 0;
}

.sg-icon-btn:hover {
  background: var(--sg-bg-hover);
  color: var(--sg-ink-1);
}

.sg-icon-btn.sg-danger:hover {
  background: var(--sg-danger-soft);
  color: var(--sg-danger);
}

.sg-panel-tabs {
  padding: 12px 16px 8px;
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--sg-line-soft);
  flex: 0 0 auto;
}

.sg-panel-tabs .sg-segmented {
  width: 100%;
}

.sg-panel-tabs .sg-segmented button {
  flex: 1;
  justify-content: center;
  padding-left: 8px;
  padding-right: 8px;
  font-size: 12px;
  white-space: nowrap;
}

.sg-panel-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  background: var(--sg-bg-secondary);
  padding: 16px;
}

/* ------------------------------------------------------------------------ */
/* 通用组件                                                                  */
/* ------------------------------------------------------------------------ */

.sg-btn {
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: var(--sg-r-md);
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  white-space: nowrap;
}

.sg-btn-primary {
  background: var(--sg-primary-gradient);
  color: #fff;
  box-shadow: var(--sg-shadow-normal);
}

.sg-btn-primary:hover:not(:disabled) {
  filter: brightness(1.05);
  box-shadow: var(--sg-shadow-float);
}

.sg-btn-secondary {
  background: var(--sg-primary-soft);
  color: var(--sg-primary);
}

.sg-btn-secondary:hover:not(:disabled) {
  background: var(--sg-primary-soft-hover);
}

.sg-btn-ghost {
  background: var(--sg-bg);
  color: var(--sg-ink-1);
  box-shadow: var(--sg-shadow-normal);
  border: 1px solid var(--sg-line-soft);
}

.sg-btn-ghost:hover:not(:disabled) {
  background: var(--sg-bg-secondary);
}

.sg-btn-danger-soft {
  background: var(--sg-danger-soft);
  color: var(--sg-danger);
}

.sg-btn-danger-soft:hover:not(:disabled) {
  filter: brightness(0.97);
}

.sg-btn-sm {
  height: 30px;
  padding: 6px 12px;
  border-radius: var(--sg-r-sm);
  font-size: 12px;
  font-weight: 500;
}

.sg-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.sg-segmented {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--sg-bg);
  border: 1px solid var(--sg-line);
  border-radius: var(--sg-r-full);
}

.sg-segmented button {
  border: 0;
  background: transparent;
  color: var(--sg-ink-2);
  border-radius: var(--sg-r-full);
  height: 28px;
  padding: 0 12px;
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s ease, color 0.2s ease;
}

.sg-segmented button:hover:not(.sg-is-active) {
  color: var(--sg-ink-1);
}

.sg-segmented button.sg-is-active {
  background: var(--sg-primary-soft);
  color: var(--sg-primary);
  font-weight: 500;
}

.sg-segmented.sg-sm button {
  height: 26px;
  padding: 0 10px;
  font-size: 12px;
}

.sg-card {
  background: var(--sg-bg);
  border: 1px solid var(--sg-line-soft);
  border-radius: var(--sg-r-md);
  box-shadow: var(--sg-shadow-normal);
  padding: 16px;
  transition: box-shadow 0.2s ease;
}

.sg-card:hover {
  box-shadow: var(--sg-shadow-float);
}

.sg-section-head {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  margin-bottom: 12px;
}

.sg-section-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--sg-ink-1);
}

.sg-section-sub {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--sg-ink-3);
}

.sg-section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.sg-panel-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Badge */
.sg-badge {
  height: 20px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border-radius: var(--sg-r-full);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  white-space: nowrap;
}

.sg-badge.sg-primary { background: var(--sg-primary-soft); color: var(--sg-primary); }
.sg-badge.sg-success { background: var(--sg-success-soft); color: var(--sg-success); }
.sg-badge.sg-warning { background: var(--sg-warning-soft); color: var(--sg-warning); }
.sg-badge.sg-danger  { background: var(--sg-danger-soft);  color: var(--sg-danger); }
.sg-badge.sg-neutral { background: var(--sg-bg-hover); color: var(--sg-ink-2); }

.sg-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.sg-dot.sg-success { background: var(--sg-success); }
.sg-dot.sg-danger  { background: var(--sg-danger); }
.sg-dot.sg-warning { background: var(--sg-warning); }
.sg-dot.sg-neutral { background: var(--sg-ink-4); }

/* Switch 开关 */
.sg-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  flex: 0 0 auto;
}

.sg-switch input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.sg-switch-track {
  width: 36px;
  height: 20px;
  border-radius: var(--sg-r-full);
  background: var(--sg-ink-4);
  position: relative;
  transition: background 0.2s ease;
}

.sg-switch-track::after {
  content: "";
  position: absolute;
  left: 2px;
  top: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
  transition: transform 0.2s ease;
}

.sg-switch input:checked + .sg-switch-track {
  background: var(--sg-primary);
}

.sg-switch input:checked + .sg-switch-track::after {
  transform: translateX(16px);
}

.sg-switch-label {
  font-size: 12px;
  color: var(--sg-ink-2);
}

/* Search */
.sg-search {
  position: relative;
}

.sg-search svg {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--sg-ink-3);
  pointer-events: none;
}

.sg-search input {
  width: 100%;
  height: 42px;
  border: 1px solid var(--sg-line);
  border-radius: var(--sg-r-lg);
  background: var(--sg-bg);
  padding: 12px 16px 12px 40px;
  font-size: 14px;
  color: var(--sg-ink-1);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.sg-search input::placeholder {
  color: var(--sg-ink-4);
}

.sg-search input:focus {
  outline: none;
  border-color: var(--sg-primary);
  box-shadow: var(--sg-shadow-focus);
}

/* Empty state：图标 → 标题 → 描述 → 操作按钮 */
.sg-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 28px 16px;
}

.sg-empty-icon {
  width: 96px;
  height: 96px;
  border-radius: var(--sg-r-full);
  background: var(--sg-primary-soft);
  color: var(--sg-primary);
  display: grid;
  place-items: center;
  margin-bottom: 16px;
}

.sg-empty-icon svg {
  width: 40px;
  height: 40px;
}

.sg-empty-title {
  font-size: 18px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--sg-ink-1);
  margin: 0;
}

.sg-empty-desc {
  margin: 4px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--sg-ink-3);
  max-width: 280px;
}

.sg-empty-actions {
  margin-top: 24px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

/* Progress */
.sg-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sg-progress-track {
  flex: 1;
  height: 6px;
  border-radius: var(--sg-r-full);
  background: var(--sg-bg-hover);
  overflow: hidden;
}

.sg-progress-fill {
  height: 100%;
  border-radius: var(--sg-r-full);
  background: var(--sg-primary);
  min-width: 2px;
}

.sg-progress-text {
  font-size: 12px;
  color: var(--sg-ink-3);
  min-width: 44px;
  text-align: right;
}

/* Notice / callout */
.sg-notice {
  display: flex;
  gap: 8px;
  border-radius: var(--sg-r-sm);
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.5;
}

.sg-notice.sg-info {
  background: var(--sg-primary-soft);
  color: var(--sg-ink-2);
}

.sg-notice.sg-success {
  background: var(--sg-success-soft);
  color: var(--sg-ink-2);
}

.sg-notice.sg-warning {
  background: var(--sg-warning-soft);
  color: var(--sg-ink-2);
}

.sg-notice.sg-danger {
  background: var(--sg-danger-soft);
  color: var(--sg-ink-2);
}

.sg-notice svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.sg-notice .sg-prompt-pre {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0 0 0 8px;
}

/* ------------------------------------------------------------------------ */
/* 场景树管理                                                                */
/* ------------------------------------------------------------------------ */

.sg-view-switch {
  margin-top: 12px;
}

.sg-tree-card {
  padding: 8px;
}

.sg-tree-node {
  min-width: 0;
}

.sg-tree-row,
.sg-skill-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  border-radius: var(--sg-r-sm);
  padding: 8px;
  position: relative;
  cursor: default;
}

.sg-tree-row:hover,
.sg-skill-row:hover {
  background: var(--sg-bg-secondary);
}

.sg-tree-row.sg-is-selected {
  background: var(--sg-primary-soft);
}

.sg-tree-caret {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--sg-ink-3);
  cursor: pointer;
  padding: 0;
  flex: 0 0 auto;
}

.sg-tree-caret svg {
  width: 14px;
  height: 14px;
  transition: transform 0.2s ease;
}

.sg-tree-caret.sg-is-expanded svg {
  transform: rotate(90deg);
}

.sg-tree-spacer {
  width: 20px;
  flex: 0 0 auto;
}

.sg-tree-icon {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: var(--sg-primary);
  background: var(--sg-primary-soft);
  flex: 0 0 auto;
}

.sg-skill-row .sg-tree-icon {
  color: var(--sg-ink-2);
  background: var(--sg-bg-hover);
}

.sg-tree-icon svg {
  width: 14px;
  height: 14px;
}

.sg-tree-main {
  min-width: 0;
  flex: 1;
}

.sg-tree-title-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.sg-tree-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--sg-ink-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sg-tree-row.sg-is-selected .sg-tree-title {
  color: var(--sg-primary);
}

.sg-tree-desc {
  font-size: 12px;
  color: var(--sg-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sg-tree-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.sg-tag {
  font-size: 11px;
  color: var(--sg-ink-3);
  background: var(--sg-bg-hover);
  border-radius: var(--sg-r-full);
  padding: 1px 6px;
}

.sg-tree-actions {
  display: flex;
  gap: 2px;
  flex: 0 0 auto;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.sg-tree-row:hover .sg-tree-actions,
.sg-tree-row:focus-within .sg-tree-actions,
.sg-skill-row:hover .sg-tree-actions,
.sg-skill-row:focus-within .sg-tree-actions {
  opacity: 1;
}

.sg-tree-actions .sg-icon-btn {
  width: 26px;
  height: 26px;
}

.sg-tree-actions .sg-icon-btn svg {
  width: 14px;
  height: 14px;
}

.sg-skill-scenes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.sg-path-chip {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 1.4;
  color: var(--sg-ink-3);
  background: var(--sg-bg-hover);
  border-radius: var(--sg-r-full);
  padding: 1px 6px;
}

/* 全部技能列表 */
.sg-skill-list {
  display: flex;
  flex-direction: column;
}

.sg-skill-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--sg-r-sm);
}

.sg-skill-list-item:hover {
  background: var(--sg-bg-secondary);
}

.sg-skill-list-main {
  min-width: 0;
  flex: 1;
}

.sg-skill-name-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sg-skill-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--sg-ink-1);
}

.sg-skill-desc {
  font-size: 12px;
  color: var(--sg-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sg-skill-list-actions {
  display: flex;
  gap: 2px;
  flex: 0 0 auto;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.sg-skill-list-item:hover .sg-skill-list-actions,
.sg-skill-list-item:focus-within .sg-skill-list-actions {
  opacity: 1;
}

/* 数据落点卡 */
.sg-location-card {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sg-location-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--sg-r-sm);
  background: var(--sg-primary-soft);
  color: var(--sg-primary);
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.sg-location-main {
  min-width: 0;
  flex: 1;
}

.sg-location-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--sg-ink-1);
}

.sg-location-path {
  font-family: var(--sg-font-mono);
  font-size: 12px;
  color: var(--sg-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sg-location-sub {
  font-size: 11px;
  color: var(--sg-ink-4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ------------------------------------------------------------------------ */
/* 统计 tab                                                                  */
/* ------------------------------------------------------------------------ */

.sg-stat-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.sg-stat-card {
  padding: 12px 16px;
}

.sg-stat-label {
  font-size: 12px;
  color: var(--sg-ink-3);
}

.sg-stat-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--sg-ink-1);
}

.sg-stat-foot {
  margin-top: 2px;
  font-size: 11px;
  color: var(--sg-ink-4);
}

.sg-table-card {
  padding: 0;
  overflow: hidden;
}

.sg-table-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--sg-line-soft);
}

.sg-table-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--sg-ink-1);
}

.sg-table-count {
  font-size: 12px;
  color: var(--sg-ink-3);
}

.sg-table-wrap {
  overflow-x: auto;
}

table.sg-data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 360px;
}

.sg-data-table th {
  height: 40px;
  padding: 0 12px;
  background: var(--sg-bg-secondary);
  color: var(--sg-ink-1);
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
}

.sg-data-table td {
  height: 48px;
  padding: 0 12px;
  border-bottom: 1px solid var(--sg-line-soft);
  color: var(--sg-ink-2);
  font-size: 14px;
  vertical-align: middle;
}

.sg-data-table tr:last-child td {
  border-bottom: 0;
}

.sg-data-table tbody tr:hover td {
  background: var(--sg-bg-secondary);
}

.sg-data-table .sg-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.sg-data-table .sg-primary-cell {
  color: var(--sg-ink-1);
  font-weight: 500;
}

.sg-data-table .sg-sub-cell {
  display: block;
  font-size: 11px;
  color: var(--sg-ink-4);
  font-weight: 400;
}

.sg-cell-progress {
  min-width: 96px;
}

.sg-timeline {
  list-style: none;
  margin: 0;
  padding: 8px 16px;
}

.sg-timeline-item {
  position: relative;
  padding: 10px 0 10px 20px;
  border-bottom: 1px solid var(--sg-line-soft);
}

.sg-timeline-item:last-child {
  border-bottom: 0;
}

.sg-timeline-item::before {
  content: "";
  position: absolute;
  left: 5px;
  top: 18px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--sg-primary);
}

.sg-timeline-item.sg-agent::before {
  background: var(--sg-ink-4);
}

.sg-timeline-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sg-timeline-time {
  font-family: var(--sg-font-mono);
  font-size: 11px;
  color: var(--sg-ink-3);
}

.sg-timeline-skill {
  font-size: 14px;
  font-weight: 500;
  color: var(--sg-ink-1);
}

.sg-timeline-path {
  width: 100%;
  font-size: 12px;
  color: var(--sg-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ------------------------------------------------------------------------ */
/* 网关取用 tab                                                              */
/* ------------------------------------------------------------------------ */

.sg-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.sg-breadcrumb span {
  color: var(--sg-ink-3);
  font-size: 12px;
}

.sg-breadcrumb .sg-current {
  color: var(--sg-ink-1);
  font-weight: 500;
}

.sg-breadcrumb svg {
  width: 12px;
  height: 12px;
  color: var(--sg-ink-4);
}

.sg-gateway-scene-desc {
  font-size: 14px;
  color: var(--sg-ink-2);
  line-height: 1.5;
}

.sg-gateway-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sg-gateway-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--sg-line-soft);
  border-radius: var(--sg-r-sm);
  padding: 10px 12px;
  background: var(--sg-bg-secondary);
}

.sg-gateway-item-main {
  min-width: 0;
  flex: 1;
}

.sg-gateway-item-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--sg-ink-1);
}

.sg-gateway-item-desc {
  font-size: 12px;
  color: var(--sg-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sg-gateway-item-meta {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.sg-prompt-pre {
  margin: 0;
  background: var(--sg-bg-secondary);
  border-radius: var(--sg-r-sm);
  padding: 12px;
  font-family: var(--sg-font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--sg-ink-2);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 260px;
  overflow: auto;
}

details.sg-card > summary {
  cursor: pointer;
  list-style: none;
  font-size: 14px;
  font-weight: 500;
  color: var(--sg-ink-1);
  display: flex;
  align-items: center;
  gap: 8px;
}

details.sg-card > summary::-webkit-details-marker {
  display: none;
}

details.sg-card > summary svg {
  color: var(--sg-ink-3);
  transition: transform 0.2s ease;
}

details.sg-card[open] > summary svg {
  transform: rotate(90deg);
}

details.sg-card[open] > summary {
  margin-bottom: 12px;
}

/* ------------------------------------------------------------------------ */
/* 表单与校验                                                                */
/* ------------------------------------------------------------------------ */

.sg-field {
  margin-bottom: 16px;
}

.sg-field:last-child {
  margin-bottom: 0;
}

.sg-field-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--sg-ink-2);
  margin-bottom: 8px;
}

.sg-required {
  color: var(--sg-danger);
  margin-right: 4px;
}

.sg-field input[type="text"],
.sg-field input[type="search"],
.sg-field input[type="password"],
.sg-field textarea,
.sg-field select {
  width: 100%;
  border: 1px solid var(--sg-line);
  border-radius: var(--sg-r-lg);
  background: var(--sg-bg);
  padding: 12px 16px;
  font-size: 14px;
  color: var(--sg-ink-1);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.sg-field textarea {
  resize: vertical;
  min-height: 76px;
  line-height: 1.5;
}

.sg-field input:focus,
.sg-field textarea:focus,
.sg-field select:focus {
  outline: none;
  border-color: var(--sg-primary);
  box-shadow: var(--sg-shadow-focus);
}

.sg-field input:disabled,
.sg-field textarea:disabled,
.sg-field select:disabled {
  background: var(--sg-bg-secondary);
  border-color: var(--sg-line-soft);
  color: var(--sg-ink-3);
  cursor: not-allowed;
}

.sg-field input.sg-is-invalid,
.sg-field textarea.sg-is-invalid {
  border-color: var(--sg-danger);
}

.sg-field-hint {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--sg-ink-3);
}

.sg-field-error {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--sg-danger);
}

.sg-form-error {
  margin-top: 8px;
  border-radius: var(--sg-r-sm);
  background: var(--sg-danger-soft);
  color: var(--sg-danger);
  font-size: 12px;
  padding: 8px 10px;
}

.sg-radio-list,
.sg-check-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
}

.sg-check-row {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--sg-line);
  border-radius: var(--sg-r-sm);
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.sg-check-row:hover {
  background: var(--sg-bg-secondary);
}

.sg-check-row input {
  accent-color: var(--sg-primary);
  width: 16px;
  height: 16px;
  margin: 0;
}

.sg-check-row-main {
  min-width: 0;
  flex: 1;
}

.sg-check-row-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--sg-ink-1);
}

.sg-check-row-desc {
  font-size: 12px;
  color: var(--sg-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ------------------------------------------------------------------------ */
/* 上传                                                                      */
/* ------------------------------------------------------------------------ */

.sg-dropzone {
  border: 1px dashed var(--sg-line);
  border-radius: var(--sg-r-md);
  background: var(--sg-bg-secondary);
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.sg-dropzone:hover {
  border-color: var(--sg-primary);
  background: var(--sg-primary-soft);
}

.sg-dropzone-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--sg-r-full);
  background: var(--sg-primary-soft);
  color: var(--sg-primary);
  display: grid;
  place-items: center;
  margin-bottom: 12px;
}

.sg-dropzone-icon svg {
  width: 24px;
  height: 24px;
}

.sg-dropzone-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--sg-ink-1);
}

.sg-dropzone-desc {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--sg-ink-3);
  max-width: 420px;
}

.sg-dropzone-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 16px;
}

.sg-upload-preview {
  margin-top: 16px;
}

.sg-upload-summary {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.sg-upload-summary-item {
  background: var(--sg-bg-secondary);
  border-radius: var(--sg-r-sm);
  padding: 10px 12px;
}

.sg-upload-summary-label {
  font-size: 11px;
  color: var(--sg-ink-3);
}

.sg-upload-summary-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--sg-ink-1);
}

.sg-upload-list {
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sg-upload-skill-row {
  border: 1px solid var(--sg-line-soft);
  border-radius: var(--sg-r-sm);
  padding: 10px 12px;
}

.sg-upload-skill-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sg-upload-skill-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--sg-ink-1);
}

.sg-upload-skill-desc {
  font-size: 12px;
  color: var(--sg-ink-3);
  margin-top: 2px;
}

.sg-reason-list {
  margin: 0;
  padding-left: 18px;
  color: var(--sg-danger);
  font-size: 12px;
  line-height: 1.6;
}

/* ------------------------------------------------------------------------ */
/* 弹窗 Modal                                                                */
/* ------------------------------------------------------------------------ */

.sg-modal-root:empty {
  display: none;
}

.sg-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: fade-in 0.16s ease;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.sg-modal {
  width: 520px;
  max-width: 100%;
  max-height: calc(100dvh - 48px);
  display: flex;
  flex-direction: column;
  background: var(--sg-bg);
  border-radius: var(--sg-r-md);
  box-shadow: var(--sg-shadow-float);
  animation: modal-in 0.18s ease;
}

.sg-modal.sg-large {
  width: 720px;
}

.sg-modal.sg-confirm {
  width: 400px;
}

@keyframes modal-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.sg-modal-header {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 24px;
  border-bottom: 1px solid var(--sg-line-soft);
  flex: 0 0 auto;
}

.sg-modal-title {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--sg-ink-1);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sg-modal-body {
  padding: 24px;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
}

.sg-modal-footer {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 0 24px;
  border-top: 1px solid var(--sg-line-soft);
  flex: 0 0 auto;
}

.sg-modal-footer .sg-btn {
  min-width: 72px;
}

/* 文件预览弹窗 */
.sg-file-preview {
  display: flex;
  gap: 16px;
  min-height: 320px;
}

.sg-file-tree {
  width: 200px;
  flex: 0 0 auto;
  border: 1px solid var(--sg-line-soft);
  border-radius: var(--sg-r-sm);
  background: var(--sg-bg-secondary);
  padding: 8px;
  overflow-y: auto;
  max-height: 380px;
}

.sg-file-tree button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  border-radius: 6px;
  color: var(--sg-ink-2);
  font-size: 12px;
  padding: 7px 8px;
  text-align: left;
  cursor: pointer;
}

.sg-file-tree button:hover {
  background: var(--sg-bg-hover);
  color: var(--sg-ink-1);
}

.sg-file-tree button.sg-is-active {
  background: var(--sg-primary-soft);
  color: var(--sg-primary);
  font-weight: 500;
}

.sg-file-tree button svg {
  width: 14px;
  height: 14px;
}

.sg-file-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--sg-line-soft);
  border-radius: var(--sg-r-sm);
  overflow: hidden;
}

.sg-file-content-head {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  background: var(--sg-bg-secondary);
  border-bottom: 1px solid var(--sg-line-soft);
  font-family: var(--sg-font-mono);
  font-size: 12px;
  color: var(--sg-ink-2);
  overflow: hidden;
  white-space: nowrap;
}

.sg-file-content pre {
  flex: 1;
  margin: 0;
  padding: 12px;
  overflow: auto;
  font-family: var(--sg-font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--sg-ink-2);
  white-space: pre-wrap;
  word-break: break-word;
}

/* ------------------------------------------------------------------------ */
/* Toast                                                                     */
/* ------------------------------------------------------------------------ */

.sg-toast-root {
  position: fixed;
  top: 64px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 80;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  pointer-events: none;
}

.sg-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 220px;
  max-width: 440px;
  padding: 12px 20px;
  border-radius: var(--sg-r-sm);
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--sg-line-soft);
  box-shadow: var(--sg-shadow-float);
  color: var(--sg-ink-1);
  font-size: 14px;
  animation: toast-in 0.2s ease;
}

.sg-toast.sg-success svg { color: var(--sg-success); }
.sg-toast.sg-danger svg  { color: var(--sg-danger); }
.sg-toast.sg-warning svg { color: var(--sg-warning); }
.sg-toast.sg-info svg    { color: var(--sg-primary); }

@keyframes toast-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ------------------------------------------------------------------------ */
/* Skill Gateway 覆盖：弹窗与 Toast 必须浮在侧边栏之上 */
.sg-modal-backdrop { z-index: 1400; }
.sg-toast-root { z-index: 1500; }

/* ------------------------------------------------------------------------ */
/* 整理与回滚：入口按钮、报告卡片、未分类分组                                  */
.sg-organize-actions { display: flex; gap: 8px; align-items: center; }
.sg-organize-actions .sg-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.sg-report-card { margin-top: 16px; }
.sg-report-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.sg-report-title { font-size: 13px; font-weight: 600; color: var(--sg-ink-1); }
.sg-report-time { font-size: 12px; color: var(--sg-ink-3); margin-left: auto; }
.sg-report-section { margin: 10px 0 0; }
.sg-report-section-title { font-size: 12px; font-weight: 600; color: var(--sg-ink-2); margin-bottom: 6px; }
.sg-report-list { list-style: none; margin: 0; padding: 0; }
.sg-report-list li { font-size: 12.5px; line-height: 1.6; color: var(--sg-ink-1); padding: 4px 8px; border-radius: 6px; background: var(--sg-bg-hover); margin-bottom: 4px; }
.sg-report-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.sg-report-chips .sg-path-chip { font-size: 12px; }
.sg-report-foot { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.sg-unclassified-card { margin-top: 12px; }
.sg-unclassified-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; cursor: pointer; }
.sg-unclassified-row:hover { background: var(--sg-bg-hover); }
.sg-unclassified-main { min-width: 0; flex: 1; }
.sg-upload-result { padding: 4px 0 0; }
.sg-upload-result-title { font-size: 14px; font-weight: 600; margin: 10px 0 4px; color: var(--sg-ink-1); }
.sg-upload-result-actions { display: flex; gap: 8px; margin-top: 10px; }
`;

    if (typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.dataset.plugin = name;
      style.dataset.pluginCss = `${name}/client.css`;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    /* ------------------------------------------------------------------ */
    /* 基础工具                                                            */
    /* ------------------------------------------------------------------ */

    async function api(method, pathname, body) {
      const opts = { method, headers: {} };
      if (body !== undefined) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(pathname, opts);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data && (data.error || data.message)) || 'HTTP ' + res.status);
      return data;
    }

    function withCwd(pathname, cwd) {
      if (!cwd) return pathname;
      const sep = pathname.includes('?') ? '&' : '?';
      return `${pathname}${sep}cwd=${encodeURIComponent(cwd)}`;
    }

    function withParams(pathname, params) {
      const search = new URLSearchParams();
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') search.set(key, value);
      });
      const text = search.toString();
      const sep = pathname.includes('?') ? '&' : '?';
      return text ? `${pathname}${sep}${text}` : pathname;
    }

    function cx(...parts) {
      return parts.filter(Boolean).join(' ');
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function pad(value) {
      return String(value).padStart(2, '0');
    }

    function fmtClock(timestamp) {
      const date = new Date(Number(timestamp));
      if (Number.isNaN(date.getTime())) return '—';
      return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    function fmtDateTime(timestamp) {
      if (!timestamp) return '—';
      const date = new Date(Number(timestamp));
      if (Number.isNaN(date.getTime())) return String(timestamp);
      return `${date.getMonth() + 1}/${date.getDate()} ${fmtClock(timestamp)}`;
    }

    function fmtRelative(timestamp) {
      if (!timestamp) return '—';
      const diff = Date.now() - Number(timestamp || 0);
      const MINUTE = 60 * 1000;
      const HOUR = 60 * MINUTE;
      const DAY = 24 * HOUR;
      if (diff < MINUTE) return '刚刚';
      if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;
      if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
      if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} 天前`;
      return fmtDateTime(timestamp);
    }

    function fmtShare(share) {
      const value = Number(share) || 0;
      return `${Math.round(value * 1000) / 10}%`;
    }

    function normalizeTags(tags) {
      if (Array.isArray(tags)) {
        return [...new Set(tags.map((tag) => String(tag == null ? '' : tag).trim()).filter(Boolean))];
      }
      if (typeof tags === 'string') {
        return [...new Set(tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))];
      }
      return [];
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

    function collectDescendants(catalog, sceneId) {
      const ids = [];
      const queue = [sceneId];
      const seen = new Set();
      while (queue.length) {
        const id = queue.shift();
        if (seen.has(id)) continue;
        seen.add(id);
        const scene = catalog.scenes && catalog.scenes[id];
        if (!scene) continue;
        ids.push(id);
        queue.push(...(scene.children || []));
      }
      return ids;
    }

    function flattenSceneOptions(catalog) {
      const options = [];
      const walk = (sceneId, depth) => {
        const scene = catalog.scenes[sceneId];
        if (!scene) return;
        options.push({ id: scene.id, name: scene.name, depth });
        (scene.children || []).forEach((childId) => walk(childId, depth + 1));
      };
      if (catalog.scenes[catalog.rootSceneId]) walk(catalog.rootSceneId, 0);
      return options;
    }

    function containsText(value, query) {
      return String(value || '').toLowerCase().includes(String(query || '').toLowerCase());
    }

    function sceneSelfMatches(scene, query) {
      return containsText(scene.name, query) ||
        containsText(scene.description, query) ||
        (scene.tags || []).some((tag) => containsText(tag, query));
    }

    function skillMetaMatches(skill, query) {
      return Boolean(skill) && (containsText(skill.name, query) || containsText(skill.description, query));
    }

    function sceneTreeMatches(catalog, sceneId, query) {
      const scene = catalog.scenes[sceneId];
      if (!scene) return false;
      if (!query) return true;
      if (sceneSelfMatches(scene, query)) return true;
      if ((scene.children || []).some((childId) => sceneTreeMatches(catalog, childId, query))) return true;
      return (scene.skills || []).some((skillName) => skillMetaMatches(catalog.skills[skillName], query));
    }

    function browseFromCatalog(catalog, sceneId) {
      const rootId = catalog.rootSceneId;
      const requestedId = sceneId === undefined || sceneId === null || String(sceneId).trim() === ''
        ? rootId
        : String(sceneId).trim();
      const scene = catalog.scenes[requestedId];
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
        .map((skillName) => {
          const skill = catalog.skills[skillName];
          return skill ? { name: skill.name, description: skill.description } : null;
        })
        .filter(Boolean);
      return {
        ok: true,
        sceneId: scene.id,
        parentId: scene.parentId || null,
        path: scenePathOf(catalog, scene.id),
        name: scene.name,
        description: scene.description,
        tags: scene.tags || [],
        children,
        skills,
      };
    }

    /* ------------------------------------------------------------------ */
    /* 图标与 Logo                                                         */
    /* ------------------------------------------------------------------ */

    const ICON_PATHS = {
      'chevron-right': [['path', { d: 'm6 3 5 5-5 5' }]],
      'chevron-down': [['path', { d: 'm3 6 5 5 5-5' }]],
      plus: [['path', { d: 'M8 3v10M3 8h10' }]],
      edit: [['path', { d: 'M10.8 2.8 13.2 5.2 5.5 13H3v-2.5L10.8 2.8ZM9.4 4.2l2.4 2.4' }]],
      trash: [['path', { d: 'M2.5 4h11M5.5 4V2.5h5V4M3.5 4l.8 10h7.4l.8-10M6.5 7v4M9.5 7v4' }]],
      folder: [['path', { d: 'M2 3.5h4.5l1.5 1.5H14v8H2v-9.5Z' }]],
      file: [['path', { d: 'M4 2h5l3 3v9H4V2Z' }], ['path', { d: 'M9 2v3h3M6 8h4M6 11h4' }]],
      skill: [['path', { d: 'M8 2.5c.7 2.6 1.4 3.3 4 4-2.6.7-3.3 1.4-4 4-.7-2.6-1.4-3.3-4-4 2.6-.7 3.3-1.4 4-4Z' }]],
      close: [['path', { d: 'm3.5 3.5 9 9M12.5 3.5l-9 9' }]],
      check: [['path', { d: 'm3 8.5 3.2 3L13 4.5' }]],
      info: [['circle', { cx: 8, cy: 8, r: 6 }], ['path', { d: 'M8 7v4M8 4.8v.4' }]],
      warning: [['path', { d: 'M8 2.5 14.5 14h-13L8 2.5Z' }], ['path', { d: 'M8 7v3M8 11.4v.4' }]],
      error: [['circle', { cx: 8, cy: 8, r: 6 }], ['path', { d: 'M5.5 5.5l5 5M10.5 5.5l-5 5' }]],
      upload: [['path', { d: 'M8 11V3M4.5 5.5 8 2l3.5 3.5M2.5 11.5V14h11v-2.5' }]],
      search: [['circle', { cx: 7, cy: 7, r: 4.5 }], ['path', { d: 'm10.5 10.5 3 3' }]],
      stats: [['path', { d: 'M2.5 13.5h11M4 10V6.5M8 10V3.5M12 10V5' }]],
      gateway: [['circle', { cx: 4, cy: 8, r: 2.2 }], ['circle', { cx: 12, cy: 8, r: 2.2 }], ['path', { d: 'M6.2 8h3.6' }]],
      database: [['ellipse', { cx: 8, cy: 3.5, rx: 5, ry: 2 }], ['path', { d: 'M3 3.5v9c0 1.1 2.2 2 5 2s5-.9 5-2v-9' }], ['path', { d: 'M3 8c0 1.1 2.2 2 5 2s5-.9 5-2' }]],
      link: [['path', { d: 'm6.5 9.5 3-3M5 7.5 3.5 9a3.5 3.5 0 0 0 5 5l1.5-1.5M11 8.5l1.5-1.5a3.5 3.5 0 0 0-5-5L6 3.5' }]],
      layers: [['path', { d: 'm8 2.5 6 3.5-6 3.5-6-3.5 6-3.5Z' }], ['path', { d: 'm2.5 9.5 5.5 3 5.5-3' }]],
      'arrow-left': [['path', { d: 'M13 8H3M6.5 4.5 3 8l3.5 3.5' }]],
      'arrow-up': [['path', { d: 'M8 13V3M4.5 6.5 8 3l3.5 3.5' }]],
      eye: [['path', { d: 'M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4Z' }], ['circle', { cx: 8, cy: 8, r: 1.8 }]],
      refresh: [['path', { d: 'M13.5 5V1.5M13.5 5H10M12.8 9.5A5 5 0 1 1 11 4.6' }]],
      panel: [['path', { d: 'M10.5 2H14v12h-3.5V2ZM2 2h6v12H2V2Z' }]],
      clock: [['circle', { cx: 8, cy: 8, r: 6 }], ['path', { d: 'M8 5v3.5l2.5 1.5' }]],
    };

    function Icon(props) {
      const { name: iconName, className } = props;
      const shapes = ICON_PATHS[iconName] || ICON_PATHS.info;
      return h(
        'svg',
        { className: cx('sg-icon', className), viewBox: '0 0 16 16', 'aria-hidden': true },
        shapes.map(([tag, attrs], index) => h(tag, Object.assign({ key: index }, attrs))),
      );
    }

    /**
     * Skill Gateway 产品 Logo：
     * 左侧三个节点组成“场景树”，中部双柱 + 开启斜线构成“网关”，
     * 右侧四角星代表“skill”。整体落在主色渐变圆角方块中。
     */
    function GatewayLogo(props = {}) {
      const size = props.size || 32;
      return h(
        'svg',
        {
          className: 'sg-logo',
          viewBox: '0 0 32 32',
          width: size,
          height: size,
          role: 'img',
          'aria-label': 'Skill Gateway logo：场景树、网关与 skill',
        },
        h('defs', null,
          h('linearGradient', { id: 'sg-logo-gradient', x1: '4', y1: '2', x2: '28', y2: '30', gradientUnits: 'userSpaceOnUse' },
            h('stop', { offset: '0%', stopColor: '#7B9CFF' }),
            h('stop', { offset: '100%', stopColor: '#9DB8FF' }))),
        h('rect', { x: 0, y: 0, width: 32, height: 32, rx: 8, fill: 'url(#sg-logo-gradient)' }),
        h('g', { fill: 'none', stroke: '#FFFFFF', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
          // 场景树：根节点向上分叉为三个场景节点
          h('path', { d: 'M8.5 22.5v-5M8.5 17.5 5 14.2M8.5 17.5 12 14.2' }),
          h('circle', { cx: 8.5, cy: 22.5, r: 2, fill: '#FFFFFF', stroke: 'none' }),
          h('circle', { cx: 5, cy: 14.2, r: 1.8, fill: '#FFFFFF', stroke: 'none' }),
          h('circle', { cx: 12, cy: 14.2, r: 1.8, fill: '#FFFFFF', stroke: 'none' }),
          // 网关：双柱 + 开启斜线
          h('path', { d: 'M17 20.5V10.5M23 20.5V10.5M17.8 10.5l4.4 8' }),
          // skill：四角星
          h('path', { d: 'M27.5 16c-.6 2.2-1.3 2.9-3.5 3.5 2.2.6 2.9 1.3 3.5 3.5.6-2.2 1.3-2.9 3.5-3.5-2.2-.6-2.9-1.3-3.5-3.5Z' }),
        ),
      );
    }

    function PanelMark() {
      return h('span', { className: 'sg-panel-mark', title: 'Skill Gateway' }, h(GatewayLogo, { size: 28 }));
    }

    /* ------------------------------------------------------------------ */
    /* 场景树管理 tab                                                       */
    /* ------------------------------------------------------------------ */

    function SceneTreeNode({ catalog, scene, depth, query, collapsed, selectedId, onSelect, onToggle, onAddChild, onEdit, onDelete, onManageSkills, onSkillDetail, onDetachSkill }) {
      const hasChildren = (scene.children || []).length > 0;
      const isCollapsed = collapsed.has(scene.id);
      const expanded = query ? true : !isCollapsed;
      const selfMatched = !query || sceneSelfMatches(scene, query);
      const visibleSkills = expanded
        ? (selfMatched || !query
            ? (scene.skills || [])
            : (scene.skills || []).filter((skillName) => skillMetaMatches(catalog.skills[skillName], query)))
        : [];
      const sceneMatches = !query || sceneTreeMatches(catalog, scene.id, query);

      if (query && !sceneMatches) return null;

      const renderSkillRow = (skillName) => {
        const skill = catalog.skills[skillName];
        if (!skill) return null;
        const paths = scenePathsForSkill(catalog, skillName);
        const currentPath = scenePathOf(catalog, scene.id);
        return h('div', {
          className: 'sg-skill-row',
          key: `skill-${scene.id}-${skillName}`,
          style: { paddingLeft: 8 + (depth + 1) * 16 },
          tabIndex: 0,
          role: 'button',
          onClick: () => onSkillDetail(skillName),
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSkillDetail(skillName);
            }
          },
        },
          h('span', { className: 'sg-tree-spacer' }),
          h('span', { className: 'sg-tree-icon' }, h(Icon, { name: 'skill' })),
          h('div', { className: 'sg-tree-main' },
            h('div', { className: 'sg-tree-title-line' },
              h('span', { className: 'sg-tree-title sg-mono' }, skill.name),
              paths.length > 1 ? h('span', { className: 'sg-badge sg-neutral' }, `挂载 ${paths.length} 处`) : null),
            h('div', { className: 'sg-tree-desc' }, skill.description || ''),
            h('div', { className: 'sg-skill-scenes' },
              h('span', { className: 'sg-path-chip', title: currentPath }, currentPath))),
          h('div', { className: 'sg-tree-actions' },
            h('button', {
              className: 'sg-icon-btn',
              title: '从当前场景解除挂载',
              onClick: (event) => {
                event.stopPropagation();
                onDetachSkill(scene.id, skillName);
              },
            }, h(Icon, { name: 'close' }))));
      };

      return h('div', { className: 'sg-tree-node', key: scene.id },
        h('div', {
          className: cx('sg-tree-row', selectedId === scene.id && 'sg-is-selected'),
          style: { paddingLeft: 8 + depth * 16 },
          tabIndex: 0,
          role: 'button',
          onClick: () => onSelect(scene.id),
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(scene.id);
            }
          },
        },
          hasChildren
            ? h('button', {
                className: cx('sg-tree-caret', expanded && 'sg-is-expanded'),
                type: 'button',
                title: expanded ? '折叠' : '展开',
                onClick: (event) => {
                  event.stopPropagation();
                  onToggle(scene.id);
                },
              }, h(Icon, { name: 'chevron-right' }))
            : h('span', { className: 'sg-tree-spacer' }),
          h('span', { className: 'sg-tree-icon' }, h(Icon, { name: 'folder' })),
          h('div', { className: 'sg-tree-main' },
            h('div', { className: 'sg-tree-title-line' },
              h('span', { className: 'sg-tree-title' }, scene.name),
              hasChildren ? h('span', { className: 'sg-badge sg-neutral' }, `${scene.children.length} 子场景`) : null,
              (scene.skills || []).length ? h('span', { className: 'sg-badge sg-primary' }, `${scene.skills.length} 技能`) : null),
            scene.description ? h('div', { className: 'sg-tree-desc' }, scene.description) : null,
            (scene.tags || []).length
              ? h('div', { className: 'sg-tree-tags' },
                  scene.tags.map((tag) => h('span', { className: 'sg-tag', key: tag }, tag)))
              : null),
          h('div', { className: 'sg-tree-actions' },
            h('button', {
              className: 'sg-icon-btn',
              type: 'button',
              title: '新建子场景',
              onClick: (event) => {
                event.stopPropagation();
                onAddChild(scene.id);
              },
            }, h(Icon, { name: 'plus' })),
            h('button', {
              className: 'sg-icon-btn',
              type: 'button',
              title: '管理场景挂载的技能',
              onClick: (event) => {
                event.stopPropagation();
                onManageSkills(scene.id);
              },
            }, h(Icon, { name: 'link' })),
            scene.id !== catalog.rootSceneId
              ? h('button', {
                  className: 'sg-icon-btn',
                  type: 'button',
                  title: '编辑场景',
                  onClick: (event) => {
                    event.stopPropagation();
                    onEdit(scene.id);
                  },
                }, h(Icon, { name: 'edit' }))
              : null,
            scene.id !== catalog.rootSceneId
              ? h('button', {
                  className: 'sg-icon-btn sg-danger',
                  type: 'button',
                  title: '删除场景',
                  onClick: (event) => {
                    event.stopPropagation();
                    onDelete(scene.id);
                  },
                }, h(Icon, { name: 'trash' }))
              : null)),
        expanded ? visibleSkills.map(renderSkillRow) : null,
        expanded ? (scene.children || []).map((childId) => {
          const child = catalog.scenes[childId];
          return child
            ? h(SceneTreeNode, {
                key: child.id,
                catalog,
                scene: child,
                depth: depth + 1,
                query,
                collapsed,
                selectedId,
                onSelect,
                onToggle,
                onAddChild,
                onEdit,
                onDelete,
                onManageSkills,
                onSkillDetail,
                onDetachSkill,
              })
            : null;
        }) : null);
    }

    function SkillListCard({ catalog, query, onClearSearch, onUpload, onSkillDetail, onAttachSkill, onDeleteSkill }) {
      const skills = Object.values(catalog.skills || {})
        .filter((skill) => !query || skillMetaMatches(skill, query))
        .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0) || a.name.localeCompare(b.name, 'en'));

      if (!skills.length) {
        return h('div', { className: 'sg-card' },
          h('div', { className: 'sg-empty' },
            h('div', { className: 'sg-empty-icon' }, h(Icon, { name: 'skill' })),
            h('h3', { className: 'sg-empty-title' }, query ? '没有匹配的技能' : '目录中还没有技能'),
            h('p', { className: 'sg-empty-desc' },
              query ? '换个关键词试试。' : '上传文件夹后，含 SKILL.md 的文件夹会自动识别为技能。'),
            h('div', { className: 'sg-empty-actions' },
              query
                ? h('button', { className: 'sg-btn sg-btn-secondary', type: 'button', onClick: onClearSearch }, '清除搜索')
                : null,
              h('button', { className: 'sg-btn sg-btn-ghost', type: 'button', onClick: onUpload }, '上传'))));
      }

      return h('div', { className: 'sg-card' },
        h('div', { className: 'sg-table-head' },
          h('span', { className: 'sg-table-title' }, '全部技能'),
          h('span', { className: 'sg-table-count' }, `${skills.length} 个技能 · 挂载点可在详情中管理`)),
        h('div', { className: 'sg-skill-list' },
          skills.map((skill) => {
            const paths = scenePathsForSkill(catalog, skill.name);
            return h('div', {
              className: 'sg-skill-list-item',
              key: skill.name,
              tabIndex: 0,
              role: 'button',
              onClick: () => onSkillDetail(skill.name),
              onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSkillDetail(skill.name);
                }
              },
            },
              h('span', { className: 'sg-tree-icon' }, h(Icon, { name: 'skill' })),
              h('div', { className: 'sg-skill-list-main' },
                h('div', { className: 'sg-skill-name-line' },
                  h('span', { className: 'sg-skill-name sg-mono' }, skill.name),
                  paths.length
                    ? h('span', { className: 'sg-badge sg-primary' }, `${paths.length} 个挂载点`)
                    : h('span', { className: 'sg-badge sg-warning' }, '未分类')),
                h('div', { className: 'sg-skill-desc' }, skill.description || ''),
                paths.length
                  ? h('div', { className: 'sg-skill-scenes' },
                      paths.map((path) => h('span', { className: 'sg-path-chip', title: path, key: path }, path)))
                  : null),
              h('div', { className: 'sg-skill-list-actions' },
                h('button', {
                  className: 'sg-icon-btn',
                  type: 'button',
                  title: '挂载到场景',
                  onClick: (event) => {
                    event.stopPropagation();
                    onAttachSkill(skill.name);
                  },
                }, h(Icon, { name: 'link' })),
                h('button', {
                  className: 'sg-icon-btn',
                  type: 'button',
                  title: '查看详情与文件',
                  onClick: (event) => {
                    event.stopPropagation();
                    onSkillDetail(skill.name);
                  },
                }, h(Icon, { name: 'eye' })),
                h('button', {
                  className: 'sg-icon-btn sg-danger',
                  type: 'button',
                  title: '删除技能',
                  onClick: (event) => {
                    event.stopPropagation();
                    onDeleteSkill(skill.name);
                  },
                }, h(Icon, { name: 'trash' }))));
          })));
    }

    function UnclassifiedCard({ catalog, onSkillDetail, onAttachSkill }) {
      const skills = Object.values(catalog.skills || {})
        .filter((skill) => !scenePathsForSkill(catalog, skill.name).length)
        .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0) || a.name.localeCompare(b.name, 'en'));

      if (!skills.length) return null;
      return h('div', { className: 'sg-card sg-unclassified-card' },
        h('div', { className: 'sg-table-head' },
          h('span', { className: 'sg-table-title' }, '未分类技能'),
          h('span', { className: 'sg-table-count' }, `${skills.length} 个 · 尚未挂到任何场景，网关发现不返回；可手动挂载或触发「一键整理」`)),
        h('div', { className: 'sg-skill-list' },
          skills.map((skill) => h('div', {
            className: 'sg-skill-list-item',
            key: skill.name,
            tabIndex: 0,
            role: 'button',
            onClick: () => onSkillDetail(skill.name),
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSkillDetail(skill.name);
              }
            },
          },
            h('span', { className: 'sg-tree-icon' }, h(Icon, { name: 'skill' })),
            h('div', { className: 'sg-skill-list-main' },
              h('div', { className: 'sg-skill-name-line' },
                h('span', { className: 'sg-skill-name sg-mono' }, skill.name),
                h('span', { className: 'sg-badge sg-warning' }, '未分类')),
              h('div', { className: 'sg-skill-desc' }, skill.description || '')),
            h('div', { className: 'sg-skill-list-actions' },
              h('button', {
                className: 'sg-icon-btn',
                type: 'button',
                title: '挂载到场景',
                onClick: (event) => {
                  event.stopPropagation();
                  onAttachSkill(skill.name);
                },
              }, h(Icon, { name: 'link' })),
              h('button', {
                className: 'sg-icon-btn',
                type: 'button',
                title: '查看详情与文件',
                onClick: (event) => {
                  event.stopPropagation();
                  onSkillDetail(skill.name);
                },
              }, h(Icon, { name: 'eye' })))))));
    }

    const ORGANIZE_MODE_LABELS = { classify: '技能分类', full: '一键整理', detect: '冲突检测' };

    function OrganizeTab({ state, cwd, onChanged, notify, setModal, onOpenSession }) {
      const { organize } = state;
      const running = organize && organize.running;
      const report = state.organizeReport;
      const snapshots = state.snapshots || {};

      const trigger = async (mode) => {
        if (running) return;
        try {
          const result = await api('POST', withCwd('/skill-gateway/organize/trigger', cwd), { mode, cwd });
          if (!result.ok) {
            notify(result.error || '触发失败。', 'danger', 6000);
            return;
          }
          notify(mode === 'detect' ? '冲突检测会话已开启。' : '一键整理会话已开启。', 'success', 6000);
          if (result.sessionId && onOpenSession) onOpenSession(result.sessionId);
          await onChanged();
        } catch (err) {
          notify(err.message, 'danger');
        }
      };

      const openRollback = (slot) => {
        setModal({ type: 'rollback-confirm', payload: { slot } });
      };

      const renderChanges = (changes) => {
        if (!changes) return null;
        const items = [];
        if (changes.scenesCreated && changes.scenesCreated.length) items.push(`新建场景 ${changes.scenesCreated.length} 个（${changes.scenesCreated.map((scene) => scene.name).join('、')}）`);
        if (changes.scenesDeleted && changes.scenesDeleted.length) items.push(`删除场景 ${changes.scenesDeleted.length} 个（${changes.scenesDeleted.map((scene) => scene.name).join('、')}）`);
        if (changes.scenesRenamed && changes.scenesRenamed.length) items.push(`场景改名 ${changes.scenesRenamed.length} 个`);
        if (changes.scenesChanged && changes.scenesChanged.length) items.push(`更新场景 ${changes.scenesChanged.length} 个（描述/标签/位置）`);
        if (changes.addedSkills && changes.addedSkills.length) items.push(`技能入库 ${changes.addedSkills.length} 个`);
        if (changes.overwrittenSkills && changes.overwrittenSkills.length) items.push(`技能覆盖 ${changes.overwrittenSkills.length} 个`);
        if (changes.removedSkills && changes.removedSkills.length) items.push(`技能删除 ${changes.removedSkills.length} 个`);
        if (changes.attachChanges && changes.attachChanges.length) {
          const attached = changes.attachChanges.filter((entry) => entry.kind === 'attach').length;
          const detached = changes.attachChanges.filter((entry) => entry.kind === 'detach').length;
          items.push(`挂载变动 ${attached + detached} 处（挂载 ${attached}、解链 ${detached}）`);
        }
        return items;
      };

      return h('div', { className: 'sg-panel-section' },
        h('div', { className: 'sg-section-head' },
          h('div', { className: 'sg-section-title-row' },
            h('div', null,
              h('h2', { className: 'sg-section-title' }, '整理'),
              h('p', { className: 'sg-section-sub' }, '一键整理整棵场景树、只读冲突检测；最近一次整理报告与回滚入口。'))),
          h('div', { className: 'sg-section-actions' },
            h('button', {
              className: 'sg-btn sg-btn-sm sg-btn-secondary',
              type: 'button',
              disabled: running,
              title: running ? '整理会话进行中，请等待完成' : '让 Agent 对整棵场景树做一次完整整理（可回滚）',
              onClick: () => trigger('full'),
            }, h(Icon, { name: 'layers' }), '一键整理'),
            h('button', {
              className: 'sg-btn sg-btn-sm sg-btn-ghost',
              type: 'button',
              disabled: running,
              title: running ? '整理会话进行中，请等待完成' : '只读检测冲突与重复技能，不改动场景树',
              onClick: () => trigger('detect'),
            }, h(Icon, { name: 'search' }), '冲突检测'))),
        h('div', { className: 'sg-card sg-report-card' },
          h('div', { className: 'sg-report-head' },
            h('span', { className: 'sg-report-title' }, '整理报告与回滚'),
            running
              ? h('span', { className: 'sg-badge sg-primary' }, `整理会话进行中：${ORGANIZE_MODE_LABELS[organize.mode] || organize.mode || ''}`)
              : null),
          !report
            ? h('div', { className: 'sg-empty', style: { padding: '12px 0 4px' } },
                h('h3', { className: 'sg-empty-title', style: { fontSize: 13 } }, '还没有整理报告'),
                h('p', { className: 'sg-empty-desc' },
                  running ? '整理会话完成后会在这里展示改动摘要与冲突清单。' : '上传后会自动开启技能分类会话；也可手动触发「一键整理」或「冲突检测」。'))
            : h('div', null,
                h('div', { className: 'sg-report-section' },
                  h('div', { className: 'sg-report-section-title' },
                    `最近报告 · ${ORGANIZE_MODE_LABELS[report.mode] || report.mode || '整理'}${report.startedAt ? ` · ${fmtDateTime(report.startedAt)}` : ''}${report.sessionId ? ` · ${report.sessionId}` : ''}`),
                  (() => {
                    const items = renderChanges(report.changes);
                    if (!items || !items.length) {
                      return h('ul', { className: 'sg-report-list' },
                        h('li', { key: 'none' }, report.mode === 'detect' ? '检测为只读，未改动场景树。' : '本次整理没有产生改动。'));
                    }
                    return h('ul', { className: 'sg-report-list' },
                      items.map((item, index) => h('li', { key: index }, item)));
                  })()),
                (report.conflicts && report.conflicts.length)
                  ? h('div', { className: 'sg-report-section' },
                      h('div', { className: 'sg-report-section-title' }, '冲突'),
                      h('ul', { className: 'sg-report-list' },
                        report.conflicts.map((item, index) => h('li', { key: index }, item))))
                  : null,
                (report.duplicates && report.duplicates.length)
                  ? h('div', { className: 'sg-report-section' },
                      h('div', { className: 'sg-report-section-title' }, '重复技能'),
                      h('ul', { className: 'sg-report-list' },
                        report.duplicates.map((item, index) => h('li', { key: index }, item))))
                  : null,
                (report.overwrites && report.overwrites.length)
                  ? h('div', { className: 'sg-report-section' },
                      h('div', { className: 'sg-report-section-title' }, '同名覆盖'),
                      h('div', { className: 'sg-report-chips' },
                        report.overwrites.map((name) => h('span', { className: 'sg-path-chip', key: name }, name))))
                  : null),
          h('div', { className: 'sg-report-foot' },
            h('button', {
              className: 'sg-btn sg-btn-sm sg-btn-ghost',
              type: 'button',
              disabled: !snapshots.upload,
              title: snapshots.upload ? '回滚最近一次上传：还原整棵树、删除本批新增技能文件、恢复被覆盖的原文件' : '还没有可回滚的上传快照',
              onClick: () => openRollback('upload'),
            }, '回滚上传'),
            h('button', {
              className: 'sg-btn sg-btn-sm sg-btn-ghost',
              type: 'button',
              disabled: !snapshots.organize,
              title: snapshots.organize ? '回滚最近一次整理：仅还原场景树，不触碰技能文件' : '还没有可回滚的整理快照',
              onClick: () => openRollback('organize'),
            }, '回滚整理'),
            h('span', { style: { fontSize: 12, color: 'var(--sg-ink-3)', alignSelf: 'center' } },
              '每个槽位只保留最近一份快照；回滚将把整棵树还原到该操作之前。'))));
    }

    function LocationCard({ location, onRelocate }) {
      let displayPath = location && location.dataDir ? location.dataDir : '.skillgate/';
      if (location && location.cwd && location.dataDir && location.dataDir.startsWith(location.cwd)) {
        displayPath = './' + location.dataDir.slice(location.cwd.length).replace(/^[\\/]+/, '');
      }
      const anchorText = location && location.hasAnchor ? '由 .skillgate-anchor 指向' : 'catalog.json · usage.json · config.json · skills/';
      return h('div', { className: 'sg-card sg-location-card' },
        h('span', { className: 'sg-location-icon' }, h(Icon, { name: 'database' })),
        h('div', { className: 'sg-location-main' },
          h('div', { className: 'sg-location-title' }, '数据落点'),
          h('div', { className: 'sg-location-path', title: displayPath }, displayPath),
          h('div', { className: 'sg-location-sub' }, anchorText)),
        h('button', { className: 'sg-btn sg-btn-sm sg-btn-ghost', type: 'button', onClick: onRelocate }, '迁移'));
    }

    function CatalogTab(props) {
      const { state, cwd, onChanged, notify, setModal, onOpenSession } = props;
      const catalog = state.catalog;
      const [view, setView] = useState('tree');
      const [query, setQuery] = useState('');
      const [selectedId, setSelectedId] = useState(catalog.rootSceneId);
      const [collapsed, setCollapsed] = useState(() => new Set());
      const [busyAction, setBusyAction] = useState(null);

      const selectedScene = catalog.scenes[selectedId] || catalog.scenes[catalog.rootSceneId];

      useEffect(() => {
        if (!catalog.scenes[selectedId]) setSelectedId(catalog.rootSceneId);
      }, [catalog, selectedId]);

      const refreshAfter = useCallback(async () => {
        await onChanged();
      }, [onChanged]);

      const detachSkill = async (sceneId, skillName) => {
        if (busyAction) return;
        setBusyAction(`detach:${sceneId}:${skillName}`);
        try {
          const result = await api('POST', withCwd('/skill-gateway/scenes/skills', cwd), {
            action: 'detach',
            sceneId,
            skillName,
            cwd,
          });
          notify(result.ok ? `已从「${catalog.scenes[sceneId].name}」解链 ${skillName}，回到未分类。` : (result.error || '解链失败'), result.ok ? 'success' : 'danger');
          if (result.ok) await refreshAfter();
        } catch (error) {
          notify(error.message, 'danger');
        } finally {
          setBusyAction(null);
        }
      };

      const searchText = query.trim();
      const treeRoot = catalog.scenes[catalog.rootSceneId];

      return h('div', { className: 'sg-panel-section' },
        h('div', { className: 'sg-section-head' },
          h('div', { className: 'sg-section-title-row' },
            h('div', null,
              h('h2', { className: 'sg-section-title' }, '场景树管理'),
              h('p', { className: 'sg-section-sub' }, '单根、不限深度；技能可挂载到多个场景。'))),
          h('div', { className: 'sg-section-actions' },
            h('button', {
              className: 'sg-btn sg-btn-sm sg-btn-ghost',
              type: 'button',
              onClick: () => setModal({ type: 'upload', payload: null }),
            }, h(Icon, { name: 'upload' }), '上传'),
            h('button', {
              className: 'sg-btn sg-btn-sm sg-btn-secondary',
              type: 'button',
              onClick: () => setModal({
                type: 'scene-create',
                payload: {
                  parentId: selectedId,
                  onCreated: (newSceneId, parentId) => {
                    setSelectedId(newSceneId);
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      next.delete(parentId);
                      return next;
                    });
                  },
                },
              }),
            }, h(Icon, { name: 'plus' }), '新建场景'))),
        h('div', { className: 'sg-segmented sg-sm sg-view-switch' },
          h('button', {
            type: 'button',
            className: view === 'tree' ? 'sg-is-active' : undefined,
            onClick: () => setView('tree'),
          }, '场景树'),
          h('button', {
            type: 'button',
            className: view === 'skills' ? 'sg-is-active' : undefined,
            onClick: () => setView('skills'),
          }, '全部技能')),
        h('label', { className: 'sg-search' },
          h(Icon, { name: 'search' }),
          h('input', {
            type: 'search',
            value: query,
            placeholder: '搜索场景名称、描述、标签或技能',
            onChange: (event) => setQuery(event.target.value),
          })),
        view === 'tree'
          ? h(React.Fragment, null,
              searchText && !sceneTreeMatches(catalog, catalog.rootSceneId, searchText)
                ? h('div', { className: 'sg-card' },
                    h('div', { className: 'sg-empty' },
                      h('div', { className: 'sg-empty-icon' }, h(Icon, { name: 'search' })),
                      h('h3', { className: 'sg-empty-title' }, '没有匹配的场景或技能'),
                      h('p', { className: 'sg-empty-desc' }, '换个关键词，或先创建场景、上传技能。'),
                      h('div', { className: 'sg-empty-actions' },
                        h('button', {
                          className: 'sg-btn sg-btn-secondary',
                          type: 'button',
                          onClick: () => setQuery(''),
                        }, '清除搜索'))))
                : h('div', { className: 'sg-card sg-tree-card' },
                    h(SceneTreeNode, {
                      key: treeRoot ? treeRoot.id : 'missing',
                      catalog,
                      scene: treeRoot,
                      depth: 0,
                      query: searchText,
                      collapsed,
                      selectedId,
                      onSelect: setSelectedId,
                      onToggle: (sceneId) => {
                        setCollapsed((prev) => {
                          const next = new Set(prev);
                          if (next.has(sceneId)) next.delete(sceneId);
                          else next.add(sceneId);
                          return next;
                        });
                      },
                      onAddChild: (parentId) => setModal({
                        type: 'scene-create',
                        payload: {
                          parentId,
                          onCreated: (newSceneId, createdParentId) => {
                            setSelectedId(newSceneId);
                            setCollapsed((prev) => {
                              const next = new Set(prev);
                              next.delete(createdParentId);
                              return next;
                            });
                          },
                        },
                      }),
                      onEdit: (sceneId) => setModal({ type: 'scene-edit', payload: { sceneId } }),
                      onDelete: (sceneId) => setModal({ type: 'delete-scene', payload: { sceneId } }),
                      onManageSkills: (sceneId) => setModal({ type: 'skill-picker', payload: { sceneId } }),
                      onSkillDetail: (skillName) => setModal({ type: 'skill-detail', payload: { skillName } }),
                      onDetachSkill: detachSkill,
                    })),
              !searchText
                ? h(UnclassifiedCard, {
                    catalog,
                    onSkillDetail: (skillName) => setModal({ type: 'skill-detail', payload: { skillName } }),
                    onAttachSkill: (skillName) => setModal({ type: 'attach-skill', payload: { skillName } }),
                  })
                : null)
          : h(SkillListCard, {
              catalog,
              query: searchText,
              onClearSearch: () => setQuery(''),
              onUpload: () => setModal({ type: 'upload', payload: null }),
              onSkillDetail: (skillName) => setModal({ type: 'skill-detail', payload: { skillName } }),
              onAttachSkill: (skillName) => setModal({ type: 'attach-skill', payload: { skillName } }),
              onDeleteSkill: (skillName) => setModal({ type: 'delete-skill', payload: { skillName } }),
            }),
        h(LocationCard, {
          location: state.location,
          onRelocate: () => setModal({ type: 'relocate', payload: null }),
        }));
    }

    /* ------------------------------------------------------------------ */
    /* 统计 tab                                                             */
    /* ------------------------------------------------------------------ */

    function sessionConfigForm(value) {
      const source = value && typeof value === 'object' ? value : {};
      const text = (key) => (typeof source[key] === 'string' ? source[key] : '');
      return {
        mode: text('mode').trim(),
        provider: text('provider').trim(),
        model: text('model').trim(),
        reasoningEffort: text('reasoningEffort').trim(),
        permission: text('permission').trim(),
      };
    }

    function SessionConfigTab({ state, cwd, notify, onChanged }) {
      const savedSession = (state.config && state.config.session) || {};
      const [form, setForm] = useState(() => sessionConfigForm(savedSession));
      const [options, setOptions] = useState(null);
      const [optionsError, setOptionsError] = useState('');
      const [models, setModels] = useState([]);
      const [modelsLoading, setModelsLoading] = useState(false);
      const [modelsError, setModelsError] = useState('');
      const [modelInfo, setModelInfo] = useState(null);
      const [infoLoading, setInfoLoading] = useState(false);
      const [saving, setSaving] = useState(false);
      const lastCwd = useRef('');

      useEffect(() => {
        if (lastCwd.current !== cwd) {
          lastCwd.current = cwd;
          setForm(sessionConfigForm(savedSession));
          setOptions(null);
          setModels([]);
          setModelInfo(null);
        }
      }, [cwd, savedSession]);

      useEffect(() => {
        let cancelled = false;
        setOptionsError('');
        api('GET', withCwd('/skill-gateway/session-config/options', cwd))
          .then((data) => {
            if (cancelled) return;
            setOptions(data);
          })
          .catch((err) => {
            if (!cancelled) setOptionsError(err.message);
          });
        return () => {
          cancelled = true;
        };
      }, [cwd]);

      useEffect(() => {
        const provider = form.provider.trim();
        if (!provider) {
          setModels([]);
          setModelsError('');
          setModelsLoading(false);
          setModelInfo(null);
          return undefined;
        }
        let cancelled = false;
        setModelsLoading(true);
        setModelsError('');
        api('GET', withParams(withCwd('/skill-gateway/session-config/models', cwd), { provider }))
          .then((data) => {
            if (cancelled) return;
            if (!data || data.ok === false) throw new Error((data && data.error) || '读取模型列表失败。');
            setModels(Array.isArray(data.models) ? data.models : []);
            setModelsLoading(false);
          })
          .catch((err) => {
            if (cancelled) return;
            setModels([]);
            setModelsError(err.message);
            setModelsLoading(false);
          });
        return () => {
          cancelled = true;
        };
      }, [cwd, form.provider]);

      useEffect(() => {
        const provider = form.provider.trim();
        const model = form.model.trim();
        if (!provider || !model) {
          setModelInfo(null);
          setInfoLoading(false);
          return undefined;
        }
        let cancelled = false;
        setInfoLoading(true);
        api('GET', withParams(withCwd('/skill-gateway/session-config/model-info', cwd), { provider, model }))
          .then((data) => {
            if (cancelled) return;
            if (!data || data.ok === false) throw new Error((data && data.error) || '读取模型推理等级失败。');
            setModelInfo(data);
            setInfoLoading(false);
          })
          .catch(() => {
            if (cancelled) return;
            setModelInfo(null);
            setInfoLoading(false);
          });
        return () => {
          cancelled = true;
        };
      }, [cwd, form.provider, form.model]);

      const update = (key, value) => {
        setForm((prev) => {
          const next = { ...prev, [key]: String(value || '').trim() };
          if (key === 'provider') {
            next.model = '';
            next.reasoningEffort = '';
          } else if (key === 'model') {
            next.reasoningEffort = '';
          }
          return next;
        });
      };

      const save = async () => {
        if (Boolean(form.provider.trim()) !== Boolean(form.model.trim())) {
          notify('模型与提供方必须同时填写，或同时留空以跟随部署默认。', 'danger');
          return;
        }
        setSaving(true);
        try {
          const result = await api('POST', withCwd('/skill-gateway/session-config', cwd), { cwd, session: form });
          setForm(sessionConfigForm(result.session));
          notify('会话配置已保存：上传、一键整理、冲突检测创建的工作区会话将使用该配置。', 'success', 6000);
          if (onChanged) await onChanged();
        } catch (err) {
          notify(err.message, 'danger', 6000);
        } finally {
          setSaving(false);
        }
      };

      const reset = () => {
        setForm(sessionConfigForm(savedSession));
        setModelInfo(null);
      };

      const modeOptions = (options && options.modes) || [];
      const permissionOptions = (options && options.permissions) || [];
      const providerOptions = (options && options.providers) || [];
      const efforts = modelInfo && modelInfo.reasoning && Array.isArray(modelInfo.reasoning.efforts)
        ? [...modelInfo.reasoning.efforts]
        : [];
      const modelChoices = [...models];
      const modeChoices = [...modeOptions];
      const permissionChoices = [...permissionOptions];
      const providerChoices = [...providerOptions];
      if (form.model && !modelChoices.some((item) => item.id === form.model)) {
        modelChoices.push({ id: form.model, name: form.model, description: '' });
      }
      if (form.mode && !modeChoices.some((item) => item.id === form.mode)) {
        modeChoices.push({ id: form.mode, name: form.mode, description: '', broken: '' });
      }
      if (form.provider && !providerChoices.some((item) => item.id === form.provider)) {
        providerChoices.push({ id: form.provider, name: form.provider });
      }
      if (form.permission && !permissionChoices.some((item) => item.id === form.permission)) {
        permissionChoices.push({ id: form.permission, name: form.permission, description: '' });
      }
      if (form.reasoningEffort && !efforts.some((item) => item.id === form.reasoningEffort)) {
        efforts.push({ id: form.reasoningEffort, name: form.reasoningEffort, description: '' });
      }

      const defaultModeName = modeChoices.find((item) => item.id === options.defaultMode);
      const defaultModeLabel = defaultModeName ? defaultModeName.name : options.defaultMode;
      const defaultPermissionName = permissionChoices.find((item) => item.id === options.defaultPermission);
      const defaultPermissionLabel = defaultPermissionName ? defaultPermissionName.name : options.defaultPermission;
      const currentModelLabel = options.currentModel
        ? `${options.currentModel.provider} / ${options.currentModel.model}`
        : '';

      const fieldBlock = h('div', null,
        h('div', { className: 'sg-field' },
          h('label', { className: 'sg-field-label', htmlFor: 'sg-session-mode' }, '模式（Agent 预设）'),
          h('select', {
            id: 'sg-session-mode',
            value: form.mode,
            onChange: (event) => update('mode', event.target.value),
          },
            h('option', { value: '' }, `跟随部署默认${defaultModeLabel ? `（${defaultModeLabel}）` : ''}`),
            modeChoices.map((item) => h('option', {
              key: item.id,
              value: item.id,
              disabled: Boolean(item.broken),
            }, `${item.name}${item.broken ? `（不可用：${item.broken}）` : ''}`))),
          h('p', { className: 'sg-field-hint' },
            modeOptions.length
              ? '整理会话会挂载所选模式对应的工具、提示词与能力。'
              : '宿主未提供 Agent 预设服务；留空时使用部署当前组合。')),
        h('div', { className: 'sg-field' },
          h('label', { className: 'sg-field-label', htmlFor: 'sg-session-provider' }, '模型提供方'),
          h('select', {
            id: 'sg-session-provider',
            value: form.provider,
            onChange: (event) => update('provider', event.target.value),
          },
            h('option', { value: '' }, currentModelLabel
              ? `跟随部署默认（${currentModelLabel}）`
              : '跟随部署默认'),
            providerChoices.map((item) => h('option', { key: item.id, value: item.id }, item.name || item.id))),
          h('p', { className: 'sg-field-hint' },
            providerOptions.length
              ? '选择提供方后可继续选择该提供方下的模型。'
              : '宿主未提供模型目录；可留空跟随部署默认模型。')),
        h('div', { className: 'sg-field' },
          h('label', { className: 'sg-field-label', htmlFor: 'sg-session-model' }, '模型'),
          h('select', {
            id: 'sg-session-model',
            value: form.model,
            disabled: !form.provider || modelsLoading || Boolean(modelsError),
            onChange: (event) => update('model', event.target.value),
          },
            h('option', { value: '' }, form.provider
              ? (modelsLoading ? '加载模型中…' : '跟随提供方默认模型')
              : '请先选择模型提供方'),
            modelChoices.map((item) => h('option', { key: item.id, value: item.id }, item.name || item.id))),
          modelsError ? h('p', { className: 'sg-field-error' }, modelsError) : null,
          h('p', { className: 'sg-field-hint' }, '留空提供方与模型时，整理会话使用部署当前默认模型。')),
        h('div', { className: 'sg-field' },
          h('label', { className: 'sg-field-label', htmlFor: 'sg-session-effort' }, '模型推理等级'),
          h('select', {
            id: 'sg-session-effort',
            value: form.reasoningEffort,
            disabled: !form.model || infoLoading || !efforts.length,
            onChange: (event) => update('reasoningEffort', event.target.value),
          },
            h('option', { value: '' }, modelInfo && modelInfo.reasoning && modelInfo.reasoning.defaultEffort
              ? `使用模型默认（${modelInfo.reasoning.defaultEffort}）`
              : '使用模型/提供方默认'),
            efforts.map((item) => h('option', { key: item.id, value: item.id }, item.name || item.id))),
          h('p', { className: 'sg-field-hint' },
            form.model
              ? (infoLoading
                  ? '正在读取模型推理等级…'
                  : (efforts.length
                      ? '选择模型支持的推理等级；留空使用模型默认。'
                      : '该模型未提供可选推理等级，留空使用提供方默认。'))
              : '选择模型后可配置推理等级。')),
        h('div', { className: 'sg-field' },
          h('label', { className: 'sg-field-label', htmlFor: 'sg-session-permission' }, '权限'),
          h('select', {
            id: 'sg-session-permission',
            value: form.permission,
            onChange: (event) => update('permission', event.target.value),
          },
            h('option', { value: '' }, `跟随部署默认${defaultPermissionLabel ? `（${defaultPermissionLabel}）` : ''}`),
            permissionChoices.map((item) => h('option', { key: item.id, value: item.id }, item.name || item.id))),
          permissionOptions.map((item) => (item.description
            ? h('p', { className: 'sg-field-hint', key: `permission-hint-${item.id}` }, `${item.name}：${item.description}`)
            : null)),
          h('p', { className: 'sg-field-hint' },
            permissionOptions.length
              ? '权限预设同时决定会话的沙箱模式与审批策略。'
              : '宿主未提供权限预设服务；留空时由部署默认策略决定。')),
        h('div', { className: 'sg-upload-result-actions' },
          h('button', {
            className: 'sg-btn sg-btn-primary',
            type: 'button',
            disabled: saving,
            onClick: save,
          }, saving ? '保存中…' : '保存会话配置'),
          h('button', {
            className: 'sg-btn sg-btn-ghost',
            type: 'button',
            disabled: saving,
            onClick: reset,
          }, '撤销修改'),
          optionsError
            ? h('span', {
                style: { fontSize: 12, color: 'var(--sg-danger)', alignSelf: 'center' },
              }, optionsError)
            : null));

      return h('div', { className: 'sg-panel-section' },
        h('div', { className: 'sg-section-head' },
          h('div', null,
            h('h2', { className: 'sg-section-title' }, '会话配置'),
            h('p', { className: 'sg-section-sub' }, '配置由上传、一键整理、冲突检测创建的工作区会话。'))),
        h('div', { className: 'sg-notice sg-info' },
          h(Icon, { name: 'info' }),
          h('span', null, '上传成功后自动开启的「技能分类」会话，以及手动触发的「一键整理」「冲突检测」会话，都会按这里保存的配置创建。')),
        !options
          ? h('div', { className: 'sg-card' },
              h('div', { className: 'sg-empty' },
                h('div', { className: 'sg-empty-icon' }, h(Icon, { name: 'refresh' })),
                h('h3', { className: 'sg-empty-title' }, optionsError ? '加载会话配置选项失败' : '加载中…'),
                optionsError ? h('p', { className: 'sg-empty-desc' }, optionsError) : null))
          : h('div', { className: 'sg-card' }, fieldBlock));
    }

    function StatsTab({ cwd, sessionId, setTab, active }) {
      const [source, setSource] = useState('all');
      const [stats, setStats] = useState(null);
      const [error, setError] = useState('');

      const refresh = useCallback(async () => {
        const data = await api('GET', withParams(withCwd('/skill-gateway/stats', cwd), {
          source,
          sessionId,
        }));
        setStats(data);
        setError('');
      }, [cwd, source, sessionId]);

      useEffect(() => {
        if (!active) return;
        refresh().catch((err) => setError(err.message));
      }, [active, refresh]);

      const aggregate = stats && stats.stats ? stats.stats : { total: 0, skills: [], scenes: [] };
      const timeline = stats ? [...(stats.usage || [])].sort((a, b) => Number(b.timestamp) - Number(a.timestamp)) : [];
      const sessionTotal = stats ? stats.sessionTotal : 0;
      const workspaceTotal = stats ? stats.workspaceTotal : 0;

      const tableRows = (entries, key) => entries.map((entry) => {
        const max = entries.length ? entries[0].count : 1;
        return h('tr', { key: `${key}-${entry[key]}` },
          h('td', null,
            h('span', { className: 'sg-primary-cell sg-mono' }, entry[key]),
            h('div', { className: 'sg-cell-progress sg-progress' },
              h('span', { className: 'sg-progress-track' },
                h('span', {
                  className: 'sg-progress-fill',
                  style: { width: `${Math.max(entry.count ? 3 : 0, (Number(entry.share) || 0) * 100)}%` },
                })),
              h('span', { className: 'sg-progress-text' }, fmtShare(entry.share)))),
          h('td', { className: 'sg-num' }, entry.count),
          h('td', null, fmtShare(entry.share)),
          h('td', { className: 'sg-num' }, fmtRelative(entry.lastUsed)));
      });

      if (!stats) {
        if (error) {
          return h('div', { className: 'sg-card' },
            h('div', { className: 'sg-notice sg-danger' }, h(Icon, { name: 'error' }), error));
        }
        return h('div', { className: 'sg-card' },
          h('div', { className: 'sg-empty' },
            h('div', { className: 'sg-empty-icon' }, h(Icon, { name: 'stats' })),
            h('h3', { className: 'sg-empty-title' }, '正在读取统计…')));
      }

      return h('div', { className: 'sg-panel-section' },
        error ? h('div', { className: 'sg-notice sg-danger' }, h(Icon, { name: 'error' }), error) : null,
        h('div', { className: 'sg-section-head' },
          h('div', null,
            h('h2', { className: 'sg-section-title' }, '统计'),
            h('p', { className: 'sg-section-sub' }, '会话内时间线 + 仓库级全局聚合；来源可过滤。'))),
        h('div', { className: 'sg-segmented sg-sm' },
          [['all', '全部'], ['gateway', 'gateway'], ['agent-skills', 'agent-skills']].map(([value, label]) =>
            h('button', {
              key: value,
              type: 'button',
              className: source === value ? 'sg-is-active' : undefined,
              onClick: () => setSource(value),
            }, label))),
        h('div', { className: 'sg-stat-cards' },
          h('div', { className: 'sg-card sg-stat-card' },
            h('div', { className: 'sg-stat-label' }, '本会话使用'),
            h('div', { className: 'sg-stat-value' }, sessionTotal),
            h('div', { className: 'sg-stat-foot' }, source === 'all' ? 'gateway 与 agent-skills 合计' : `来源过滤：${source}`)),
          h('div', { className: 'sg-card sg-stat-card' },
            h('div', { className: 'sg-stat-label' }, '仓库累计使用'),
            h('div', { className: 'sg-stat-value' }, workspaceTotal),
            h('div', { className: 'sg-stat-foot' }, '所有会话 · 所有时间'))),
        workspaceTotal
          ? h('div', null,
              h('div', { className: 'sg-card sg-table-card' },
                h('div', { className: 'sg-table-head' },
                  h('span', { className: 'sg-table-title' }, '全局统计 · 按技能'),
                  h('span', { className: 'sg-table-count' }, `${aggregate.skills.length} 个技能 / ${aggregate.total} 次触发`)),
                aggregate.skills.length
                  ? h('div', { className: 'sg-table-wrap' },
                      h('table', { className: 'sg-data-table' },
                        h('thead', null,
                          h('tr', null,
                            h('th', null, '技能'), h('th', { className: 'sg-num' }, '次数'), h('th', null, '占比'), h('th', { className: 'sg-num' }, '最近使用'))),
                        h('tbody', null, tableRows(aggregate.skills, 'skillName'))))
                  : h('div', { className: 'sg-empty' }, h('h3', { className: 'sg-empty-title' }, '暂无聚合数据。'))),
              h('div', { className: 'sg-card sg-table-card' },
                h('div', { className: 'sg-table-head' },
                  h('span', { className: 'sg-table-title' }, '全局统计 · 按场景'),
                  h('span', { className: 'sg-table-count' }, `${aggregate.scenes.length} 个场景路径`)),
                aggregate.scenes.length
                  ? h('div', { className: 'sg-table-wrap' },
                      h('table', { className: 'sg-data-table' },
                        h('thead', null,
                          h('tr', null,
                            h('th', null, '场景路径'), h('th', { className: 'sg-num' }, '次数'), h('th', null, '占比'), h('th', { className: 'sg-num' }, '最近使用'))),
                        h('tbody', null, tableRows(aggregate.scenes, 'scenePath'))))
                  : h('div', { className: 'sg-empty' }, h('h3', { className: 'sg-empty-title' }, '暂无带场景路径的使用记录。'))),
              h('div', { className: 'sg-card sg-table-card' },
                h('div', { className: 'sg-table-head' },
                  h('span', { className: 'sg-table-title' }, '会话内使用时间线'),
                  h('span', { className: 'sg-table-count' }, `${timeline.length} 条 · 当前会话`)),
                timeline.length
                  ? h('ol', { className: 'sg-timeline' },
                      timeline.map((record) => h('li', {
                        className: cx('sg-timeline-item', record.source === 'agent-skills' && 'sg-agent'),
                        key: record.id || `${record.timestamp}-${record.skillName}`,
                      },
                        h('div', { className: 'sg-timeline-line' },
                          h('span', { className: 'sg-timeline-time' }, fmtClock(record.timestamp)),
                          h('span', { className: 'sg-timeline-skill sg-mono' }, record.skillName),
                          record.source === 'gateway'
                            ? h('span', { className: 'sg-badge sg-primary' }, 'gateway')
                            : h('span', { className: 'sg-badge sg-neutral' }, 'agent-skills')),
                        record.scenePath
                          ? h('div', { className: 'sg-timeline-path' }, h(Icon, { name: 'folder' }), record.scenePath)
                          : h('div', { className: 'sg-timeline-path' }, 'harness 默认技能加载，无场景路径'))))
                  : h('div', { className: 'sg-empty' }, h('h3', { className: 'sg-empty-title' }, '该来源筛选下暂无使用记录。'))))
          : h('div', { className: 'sg-card' },
              h('div', { className: 'sg-empty' },
                h('div', { className: 'sg-empty-icon' }, h(Icon, { name: 'stats' })),
                h('h3', { className: 'sg-empty-title' }, source === 'all' ? '还没有使用记录' : '该来源下没有记录'),
                h('p', { className: 'sg-empty-desc' }, 'gateway load 与 harness 默认 skill 调用都会被观察器记录；开关关闭时统计仍然生效。'),
                h('div', { className: 'sg-empty-actions' },
                  h('button', {
                    className: 'sg-btn sg-btn-secondary',
                    type: 'button',
                    onClick: () => setTab('gateway'),
                  }, '去网关取用演示')))));
    }

    /* ------------------------------------------------------------------ */
    /* 网关取用 tab（只 browse，不提供页面端“加载全文”）                    */
    /* ------------------------------------------------------------------ */

    function GatewayTab({ state, notify }) {
      const catalog = state.catalog;
      const [stack, setStack] = useState([catalog.rootSceneId]);

      useEffect(() => {
        setStack([catalog.rootSceneId]);
      }, [catalog.rootSceneId]);

      useEffect(() => {
        const currentId = stack[stack.length - 1];
        if (currentId && !catalog.scenes[currentId]) setStack([catalog.rootSceneId]);
      }, [catalog, stack]);

      const currentId = stack[stack.length - 1] || catalog.rootSceneId;
      const result = browseFromCatalog(catalog, currentId);
      if (!result.ok) {
        return h('div', { className: 'sg-card' },
          h('div', { className: 'sg-notice sg-danger' }, h(Icon, { name: 'error' }), result.error));
      }

      const enabled = state.config.enabled;
      const breadcrumbParts = result.path.split(' / ');
      const enter = (sceneId) => {
        if (!enabled) return notify('skill gateway 已关闭。', 'warning');
        setStack((prev) => [...prev, sceneId]);
      };

      return h('div', { className: 'sg-panel-section' },
        h('div', { className: 'sg-section-head' },
          h('div', null,
            h('h2', { className: 'sg-section-title' }, '网关取用'),
            h('p', { className: 'sg-section-sub' }, '逐层 browse 场景树，选定后由 Agent 调用 load 取用技能。'))),
        enabled
          ? h('div', { className: 'sg-notice sg-info' },
              h(Icon, { name: 'info' }),
              h('span', null, h('b', null, '开关 ON：'), 'skill_gateway 工具已注册，系统提示词已注入。'))
          : h('div', { className: 'sg-notice sg-danger' },
              h(Icon, { name: 'error' }),
              h('div', null,
                '开关 OFF：工具与提示词已卸下。',
                h('pre', { className: 'sg-prompt-pre' }, JSON.stringify({ ok: false, action: 'browse', error: 'skill gateway 已关闭。', usageRecorded: false }, null, 2)))),
        h('div', { className: 'sg-card' },
          h('div', { className: 'sg-table-head', style: { padding: '0 0 10px' } },
            h('div', { className: 'sg-breadcrumb' },
              breadcrumbParts.map((part, index) => h('span', { key: `${part}-${index}`, className: index === breadcrumbParts.length - 1 ? 'sg-current' : undefined },
                index ? h(Icon, { name: 'chevron-right' }) : null, part))),
            h('div', { style: { display: 'flex', gap: 8, flex: '0 0 auto' } },
              stack.length > 1
                ? h('button', {
                    className: 'sg-btn sg-btn-sm sg-btn-ghost',
                    type: 'button',
                    disabled: !enabled,
                    onClick: () => setStack((prev) => prev.slice(0, -1)),
                  }, h(Icon, { name: 'arrow-left' }), '后退')
                : null,
              result.parentId
                ? h('button', {
                    className: 'sg-btn sg-btn-sm sg-btn-ghost',
                    type: 'button',
                    disabled: !enabled,
                    onClick: () => setStack((prev) => [...prev, result.parentId]),
                  }, h(Icon, { name: 'arrow-up' }), '父场景')
                : null,
              stack.length > 1
                ? h('button', {
                    className: 'sg-btn sg-btn-sm sg-btn-secondary',
                    type: 'button',
                    disabled: !enabled,
                    onClick: () => setStack([catalog.rootSceneId]),
                  }, '根场景')
                : null)),
          h('p', { className: 'sg-gateway-scene-desc' }, result.description || ''),
          (result.tags || []).length
            ? h('div', { className: 'sg-tree-tags', style: { marginTop: 8 } },
                result.tags.map((tag) => h('span', { className: 'sg-tag', key: tag }, tag)))
            : null),
        h('div', { className: 'sg-card' },
          h('div', { className: 'sg-table-head', style: { padding: '0 0 10px' } },
            h('span', { className: 'sg-table-title' }, '直接子场景'),
            h('span', { className: 'sg-table-count' }, `${result.children.length} 个`)),
          result.children.length
            ? h('div', { className: 'sg-gateway-list' },
                result.children.map((child) => h('div', { className: 'sg-gateway-item', key: child.id },
                  h('span', { className: 'sg-tree-icon' }, h(Icon, { name: 'folder' })),
                  h('div', { className: 'sg-gateway-item-main' },
                    h('div', { className: 'sg-gateway-item-title' }, child.name),
                    h('div', { className: 'sg-gateway-item-desc' }, child.description || ''),
                    h('div', { className: 'sg-gateway-item-meta' },
                      h('span', { className: 'sg-badge sg-neutral' }, `${child.childCount} 子场景`),
                      h('span', { className: 'sg-badge sg-primary' }, `${child.skillCount} 直接技能`))),
                  h('button', {
                    className: 'sg-btn sg-btn-sm sg-btn-secondary',
                    type: 'button',
                    disabled: !enabled,
                    onClick: () => enter(child.id),
                  }, '进入'))))
            : h('div', { className: 'sg-notice sg-info' }, h(Icon, { name: 'info' }), '当前场景没有直接子场景。')),
        h('div', { className: 'sg-card' },
          h('div', { className: 'sg-table-head', style: { padding: '0 0 10px' } },
            h('span', { className: 'sg-table-title' }, '直接挂载的技能'),
            h('span', { className: 'sg-table-count' }, `${result.skills.length} 个 · 由 Agent 经网关取用`)),
          result.skills.length
            ? h('div', { className: 'sg-gateway-list' },
                result.skills.map((skill) => h('div', { className: 'sg-gateway-item', key: skill.name },
                  h('span', { className: 'sg-tree-icon' }, h(Icon, { name: 'skill' })),
                  h('div', { className: 'sg-gateway-item-main' },
                    h('div', { className: 'sg-gateway-item-title sg-mono' }, skill.name),
                    h('div', { className: 'sg-gateway-item-desc' }, skill.description || ''),
                    h('div', { className: 'sg-gateway-item-meta' },
                      h('span', { className: 'sg-badge sg-neutral' }, '元数据已返回'))),
                  h('span', { className: 'sg-badge sg-neutral', title: '由 Agent 调用 skill_gateway load 取用全文' }, 'load 由 Agent 执行'))))
            : h('div', { className: 'sg-notice sg-info' }, h(Icon, { name: 'info' }), '当前场景没有直接挂载的技能，继续进入子场景浏览。'),
          h('div', { className: 'sg-notice sg-info', style: { marginTop: 10 } },
            h(Icon, { name: 'info' }),
            '按需求本管理页不提供“加载全文”功能；请让 Agent 调用 skill_gateway(action: "load") 完成渐进式加载。')),
        h('details', { className: 'sg-card' },
          h('summary', null, h(Icon, { name: 'chevron-right' }), '系统提示词（开关 ON 时注入）'),
          h('pre', { className: 'sg-prompt-pre' }, [
            '在任何设计、执行开始前，先通过 skill_gateway 逐层深入，探索合适的 skill 加载至上下文中。',
            '1. browse() 返回根场景的直接子场景和直接技能。',
            '2. browse(sceneId) 逐层进入，不要跳过场景或猜测 scene id。',
            '3. load(skillName, scenePath?) 一次性加载选定技能的文件夹全文。',
            '4. 有多个合适场景时可以分别进入并加载多个技能。'
          ].join('\n'))));
    }

    /* ------------------------------------------------------------------ */
    /* 弹窗系统                                                             */
    /* ------------------------------------------------------------------ */

    function ModalShell({ title, children, footer, size }) {
      return h('div', {
        className: 'sg-modal-backdrop',
        onMouseDown: (event) => {
          if (event.target === event.currentTarget && footer && typeof footer.onClose === 'function') footer.onClose();
        },
      },
        h('section', {
          className: cx('sg-modal', size === 'large' && 'sg-large', size === 'confirm' && 'sg-confirm'),
          role: 'dialog',
          'aria-modal': true,
          'aria-label': title,
        },
          h('header', { className: 'sg-modal-header' },
            h('h2', { className: 'sg-modal-title' }, title),
            h('button', { className: 'sg-icon-btn', type: 'button', onClick: footer ? footer.onClose : undefined, 'aria-label': '关闭弹窗' },
              h(Icon, { name: 'close' }))),
          h('div', { className: 'sg-modal-body' }, children),
          footer
            ? h('footer', { className: 'sg-modal-footer' }, footer.buttons)
            : null));
    }

    function ModalFooter({ onClose, busy, submitLabel, submitKind, onSubmit, disabled }) {
      const blocked = busy || disabled;
      return {
        onClose,
        buttons: [
          h('button', {
            className: 'sg-btn sg-btn-ghost',
            type: 'button',
            disabled: busy,
            onClick: onClose,
          }, '取消'),
          h('button', {
            className: cx('sg-btn', submitKind === 'danger' ? 'sg-btn-danger-soft' : 'sg-btn-primary'),
            type: 'button',
            disabled: blocked,
            onClick: onSubmit,
          }, busy ? '处理中…' : submitLabel),
        ],
      };
    }

    function SceneFormModal({ modal, state, cwd, onClose, onSaved, notify }) {
      const isEdit = Boolean(modal.payload && modal.payload.sceneId);
      const sceneId = isEdit ? modal.payload.sceneId : null;
      const scene = isEdit ? state.catalog.scenes[sceneId] : null;
      const defaultParentId = modal.payload && modal.payload.parentId ? modal.payload.parentId : state.catalog.rootSceneId;
      const [form, setForm] = useState({
        name: scene ? scene.name : '',
        description: scene ? scene.description : '',
        tags: scene ? (scene.tags || []).join(', ') : '',
        parentId: defaultParentId,
      });
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);
      const options = flattenSceneOptions(state.catalog);

      const submit = async () => {
        if (busy) return;
        setError('');
        setBusy(true);
        try {
          const body = {
            action: isEdit ? 'update' : 'create',
            sceneId: isEdit ? sceneId : undefined,
            parentId: isEdit ? undefined : form.parentId,
            input: { name: form.name, description: form.description, tags: form.tags },
            cwd,
          };
          const result = await api('POST', withCwd('/skill-gateway/scenes', cwd), body);
          if (!result.ok) {
            setError(result.error || '保存失败');
            return;
          }
          notify(isEdit ? '场景已更新。' : '场景已创建。', 'success');
          if (!isEdit && result.sceneId && modal.payload && typeof modal.payload.onCreated === 'function') {
            modal.payload.onCreated(result.sceneId, form.parentId);
          }
          onClose();
          await onSaved();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      };

      return h(ModalShell, {
        title: isEdit ? '编辑场景' : '新建场景',
        footer: ModalFooter({
          onClose,
          busy,
          submitLabel: isEdit ? '保存修改' : '创建场景',
          onSubmit: submit,
        }),
      },
        h('div', { className: 'sg-field' },
          isEdit
            ? h('div', null,
                h('span', { className: 'sg-field-label' }, '父场景'),
                h('div', { className: 'sg-notice sg-info' }, h(Icon, { name: 'folder' }), scenePathOf(state.catalog, scene.parentId)))
            : h('div', null,
                h('label', { className: 'sg-field-label' }, '父场景'),
                h('select', {
                  className: 'sg-field-select',
                  value: form.parentId,
                  onChange: (event) => setForm({ ...form, parentId: event.target.value }),
                },
                  options.map((option) => h('option', { key: option.id, value: option.id },
                    `${'　'.repeat(option.depth)}${option.name}`))))),
        h('div', { className: 'sg-field' },
          h('label', { className: 'sg-field-label' },
            h('span', { className: 'sg-required' }, '*'), '场景名称'),
          h('input', {
            className: cx('sg-field-input', error && 'sg-is-invalid'),
            type: 'text',
            maxLength: 40,
            value: form.name,
            placeholder: '如：后端开发',
            onChange: (event) => setForm({ ...form, name: event.target.value }),
          }),
          h('div', { className: 'sg-field-hint' }, '全局唯一，不能为空。根场景不可删除。')),
        h('div', { className: 'sg-field' },
          h('label', { className: 'sg-field-label' }, '场景描述'),
          h('textarea', {
            className: 'sg-field-textarea',
            rows: 3,
            maxLength: 160,
            value: form.description,
            placeholder: '这个场景用于完成什么目的？',
            onChange: (event) => setForm({ ...form, description: event.target.value }),
          })),
        h('div', { className: 'sg-field' },
          h('label', { className: 'sg-field-label' }, '标签'),
          h('input', {
            className: 'sg-field-input',
            type: 'text',
            value: form.tags,
            placeholder: '用逗号分隔，如 api, service',
            onChange: (event) => setForm({ ...form, tags: event.target.value }),
          }),
          h('div', { className: 'sg-field-hint' }, '标签会参与 skill_gateway 匹配，可留空。')),
        error ? h('div', { className: 'sg-form-error' }, error) : null);
    }

    function DeleteSceneModal({ modal, state, cwd, onClose, onSaved, notify }) {
      const sceneId = modal.payload.sceneId;
      const scene = state.catalog.scenes[sceneId];
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      if (!scene) return null;

      const deletedIds = collectDescendants(state.catalog, sceneId);
      const affectedSkills = new Set();
      deletedIds.forEach((id) => {
        (state.catalog.scenes[id].skills || []).forEach((skillName) => affectedSkills.add(skillName));
      });

      const submit = async () => {
        setBusy(true);
        setError('');
        try {
          const result = await api('POST', withCwd('/skill-gateway/scenes', cwd), { action: 'delete', sceneId, cwd });
          if (!result.ok) {
            setError(result.error || '删除失败');
            return;
          }
          notify(`已删除 ${result.deletedIds ? result.deletedIds.length : deletedIds.length} 个场景，技能均已解链。`, 'success');
          onClose();
          await onSaved();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      };

      return h(ModalShell, {
        title: '删除场景',
        size: 'confirm',
        footer: ModalFooter({
          onClose,
          busy,
          submitLabel: '删除场景',
          submitKind: 'danger',
          onSubmit: submit,
        }),
      },
        h('div', { className: 'sg-notice sg-warning' },
          h(Icon, { name: 'warning' }),
          h('span', null, '即将删除 ', h('b', null, `${deletedIds.length}`), ` 个场景（含 ${Math.max(deletedIds.length - 1, 0)} 个子场景）。子场景会级联删除。`)),
        h('div', { className: 'sg-field', style: { margin: '16px 0 0' } },
          h('span', { className: 'sg-field-label' }, '受影响技能'),
          affectedSkills.size
            ? h('div', null,
                h('div', { className: 'sg-skill-scenes' },
                  [...affectedSkills].map((skillName) => h('span', { className: 'sg-badge sg-neutral', key: skillName }, skillName))),
                h('div', { className: 'sg-field-hint' }, '技能只会从这些场景解除挂载，技能文件与历史统计都会保留。'))
            : h('div', { className: 'sg-field-hint' }, '这些场景没有直接或间接挂载技能。')),
        error ? h('div', { className: 'sg-form-error' }, error) : null);
    }

    function SkillPickerModal({ modal, state, cwd, onClose, onSaved, notify }) {
      const sceneId = modal.payload.sceneId;
      const scene = state.catalog.scenes[sceneId];
      const skills = Object.values(state.catalog.skills || {}).sort((a, b) => a.name.localeCompare(b.name, 'en'));
      const [checked, setChecked] = useState(() => new Set(scene ? scene.skills || [] : []));
      const [filter, setFilter] = useState('');
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      if (!scene) return null;

      const visibleSkills = skills.filter((skill) =>
        !filter || `${skill.name} ${skill.description}`.toLowerCase().includes(filter.toLowerCase()));

      const submit = async () => {
        if (busy) return;
        setBusy(true);
        setError('');
        const before = new Set(scene.skills || []);
        const after = new Set(checked);
        let attached = 0;
        let detached = 0;
        try {
          for (const skillName of after) {
            if (before.has(skillName)) continue;
            const result = await api('POST', withCwd('/skill-gateway/scenes/skills', cwd), {
              action: 'attach', sceneId, skillName, cwd,
            });
            if (!result.ok) throw new Error(result.error || `挂载 ${skillName} 失败`);
            if (result.added) attached += 1;
          }
          for (const skillName of before) {
            if (after.has(skillName)) continue;
            const result = await api('POST', withCwd('/skill-gateway/scenes/skills', cwd), {
              action: 'detach', sceneId, skillName, cwd,
            });
            if (!result.ok) throw new Error(result.error || `解链 ${skillName} 失败`);
            if (result.removed) detached += 1;
          }
          notify(attached || detached ? `挂载 ${attached} 个，解链 ${detached} 个。` : '挂载关系没有变化。', attached || detached ? 'success' : 'info');
          onClose();
          await onSaved();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      };

      return h(ModalShell, {
        title: '管理场景挂载的技能',
        size: 'large',
        footer: ModalFooter({
          onClose,
          busy,
          submitLabel: '保存挂载',
          onSubmit: submit,
        }),
      },
        h('label', { className: 'sg-search' },
          h(Icon, { name: 'search' }),
          h('input', {
            type: 'search',
            placeholder: '搜索技能名称或描述',
            value: filter,
            onChange: (event) => setFilter(event.target.value),
          })),
        h('div', { className: 'sg-field', style: { margin: '16px 0 0' } },
          h('span', { className: 'sg-field-label' }, `${scene.name} 的直接技能`),
          h('div', { className: 'sg-check-list' },
            visibleSkills.map((skill) => {
              const isChecked = checked.has(skill.name);
              return h('label', { className: 'sg-check-row', key: skill.name },
                h('input', {
                  type: 'checkbox',
                  checked: isChecked,
                  onChange: () => {
                    setChecked((prev) => {
                      const next = new Set(prev);
                      if (next.has(skill.name)) next.delete(skill.name);
                      else next.add(skill.name);
                      return next;
                    });
                  },
                }),
                h('span', { className: 'sg-check-row-main' },
                  h('span', { className: 'sg-check-row-title sg-mono' }, skill.name),
                  h('span', { className: 'sg-check-row-desc' }, skill.description || '')),
                h('span', { className: cx('sg-badge', isChecked ? 'sg-primary' : 'sg-neutral') },
                  isChecked ? '已挂载' : '未挂载'));
            })),
          h('div', { className: 'sg-field-hint' }, '一个技能可以同时挂载到多个场景；取消勾选只会解除当前场景的挂载。')),
        error ? h('div', { className: 'sg-form-error' }, error) : null);
    }

    function AttachSkillModal({ modal, state, cwd, onClose, onSaved, notify }) {
      const skillName = modal.payload.skillName;
      const skill = state.catalog.skills[skillName];
      const firstPath = scenePathsForSkill(state.catalog, skillName)[0];
      const firstScene = Object.values(state.catalog.scenes).find((scene) => scenePathOf(state.catalog, scene.id) === firstPath);
      const [sceneId, setSceneId] = useState(firstScene ? firstScene.id : state.catalog.rootSceneId);
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      if (!skill) return null;
      const options = flattenSceneOptions(state.catalog);

      const submit = async () => {
        setBusy(true);
        setError('');
        try {
          const result = await api('POST', withCwd('/skill-gateway/scenes/skills', cwd), {
            action: 'attach', sceneId, skillName, cwd,
          });
          if (!result.ok) throw new Error(result.error || '挂载失败');
          const scene = state.catalog.scenes[sceneId];
          notify(result.added ? `已挂载到「${scene.name}」。` : '该场景已挂载此技能。', result.added ? 'success' : 'info');
          onClose();
          await onSaved();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      };

      return h(ModalShell, {
        title: '挂载技能到场景',
        footer: ModalFooter({ onClose, busy, submitLabel: '确认挂载', onSubmit: submit }),
      },
        h('div', { className: 'sg-notice sg-info', style: { marginBottom: 16 } },
          h(Icon, { name: 'skill' }),
          h('span', null, h('b', { className: 'sg-mono' }, skillName), `：${skill.description || ''}`)),
        h('div', { className: 'sg-field' },
          h('label', { className: 'sg-field-label' }, '目标场景'),
          h('select', {
            className: 'sg-field-select',
            value: sceneId,
            onChange: (event) => setSceneId(event.target.value),
          },
            options.map((option) => h('option', { key: option.id, value: option.id },
              `${'　'.repeat(option.depth)}${option.name}`)))),
        h('div', { className: 'sg-field-hint' }, '同一技能可挂载到多个场景；重复挂载同一场景不会产生重复记录。'),
        error ? h('div', { className: 'sg-form-error' }, error) : null);
    }

    function SkillDetailModal({ modal, state, cwd, onClose, notify, setModal }) {
      const skillName = modal.payload.skillName;
      const skill = state.catalog.skills[skillName];
      const paths = skill ? scenePathsForSkill(state.catalog, skillName) : [];
      const [files, setFiles] = useState(null);
      const [loadError, setLoadError] = useState('');

      useEffect(() => {
        let alive = true;
        setFiles(null);
        setLoadError('');
        api('GET', withParams(withCwd('/skill-gateway/skills/files', cwd), { skillName }))
          .then((data) => {
            if (!alive) return;
            if (!data.ok) {
              setLoadError(data.error || '读取技能文件失败');
            } else {
              setFiles(data.files || {});
            }
          })
          .catch((err) => {
            if (alive) setLoadError(err.message);
          });
        return () => {
          alive = false;
        };
      }, [skillName, cwd]);

      if (!skill) return null;
      const fileNames = files ? Object.keys(files).sort() : [];

      return h(ModalShell, {
        title: `技能详情 · ${skillName}`,
        size: 'large',
        footer: {
          onClose,
          buttons: [
            h('button', {
              className: 'sg-btn sg-btn-danger-soft',
              type: 'button',
              onClick: () => setModal({ type: 'delete-skill', payload: { skillName } }),
            }, '删除技能'),
            h('button', { className: 'sg-btn sg-btn-ghost', type: 'button', onClick: onClose }, '关闭'),
          ],
        },
      },
        h('div', { className: 'sg-notice sg-info', style: { marginBottom: 16 } },
          h(Icon, { name: 'info' }), skill.description || '（无描述）'),
        h('div', { className: 'sg-stat-cards', style: { gridTemplateColumns: '1fr 1fr', marginBottom: 16 } },
          h('div', { className: 'sg-stat-card', style: { padding: 12, border: '1px solid var(--sg-line-soft)', borderRadius: 'var(--sg-r-sm)' } },
            h('div', { className: 'sg-stat-label' }, '创建时间'),
            h('div', { className: 'sg-stat-value', style: { fontSize: 14 } }, fmtDateTime(skill.createdAt))),
          h('div', { className: 'sg-stat-card', style: { padding: 12, border: '1px solid var(--sg-line-soft)', borderRadius: 'var(--sg-r-sm)' } },
            h('div', { className: 'sg-stat-label' }, '最近更新'),
            h('div', { className: 'sg-stat-value', style: { fontSize: 14 } }, fmtRelative(skill.updatedAt)))),
        h('div', { className: 'sg-field' },
          h('span', { className: 'sg-field-label' }, `挂载场景（${paths.length}）`),
          paths.length
            ? h('div', { className: 'sg-skill-scenes' },
                paths.map((path) => h('span', { className: 'sg-path-chip', title: path, key: path }, path)))
            : h('div', { className: 'sg-notice sg-warning' },
                h(Icon, { name: 'warning' }), '尚未挂载到任何场景，Agent 无法经场景树发现该技能。')),
        h('div', { className: 'sg-field' },
          h('span', { className: 'sg-field-label' }, `技能文件夹（${fileNames.length} 个文件）`),
          loadError
            ? h('div', { className: 'sg-notice sg-danger' }, h(Icon, { name: 'error' }), loadError)
            : !files
              ? h('div', { className: 'sg-notice sg-info' }, h(Icon, { name: 'info' }), '正在读取文件列表…')
              : h('div', { className: 'sg-check-list' },
                  fileNames.map((file) => h('button', {
                    className: 'sg-check-row',
                    key: file,
                    type: 'button',
                    style: { border: '1px solid var(--sg-line)', background: 'var(--sg-bg)', width: '100%', textAlign: 'left' },
                    onClick: () => setModal({ type: 'file-preview', payload: { skillName, files, active: file } }),
                  },
                    h(Icon, { name: 'file' }),
                    h('span', { className: 'sg-check-row-main' },
                      h('span', { className: 'sg-check-row-title sg-mono' }, file))))),
          h('div', { className: 'sg-field-hint' }, '管理面板中的文件预览不会记录使用；只有 skill_gateway load 才记录 gateway 使用。')));
    }

    function FilePreviewModal({ modal, onClose }) {
      const payload = modal.payload || {};
      const files = payload.files || {};
      const [active, setActive] = useState(payload.active || Object.keys(files).includes('SKILL.md') ? 'SKILL.md' : Object.keys(files)[0] || '');
      const fileNames = Object.keys(files).sort();

      return h(ModalShell, {
        title: `文件预览 · ${payload.skillName || ''}`,
        size: 'large',
        footer: {
          onClose,
          buttons: [h('button', { className: 'sg-btn sg-btn-ghost', type: 'button', onClick: onClose }, '关闭')],
        },
      },
        payload.notice
          ? h('div', { className: 'sg-notice sg-success', style: { marginBottom: 12 } },
              h(Icon, { name: 'check' }), payload.notice)
          : null,
        h('div', { className: 'sg-file-preview' },
          h('aside', { className: 'sg-file-tree' },
            fileNames.map((file) => h('button', {
              key: file,
              type: 'button',
              className: file === active ? 'sg-is-active' : undefined,
              onClick: () => setActive(file),
            },
              h(Icon, { name: 'file' }),
              h('span', { className: 'sg-mono' }, file)))),
          h('section', { className: 'sg-file-content' },
            h('div', { className: 'sg-file-content-head sg-mono' }, active),
            h('pre', null, files[active] || ''))));
    }

    function DeleteSkillModal({ modal, state, cwd, onClose, onSaved, notify }) {
      const skillName = modal.payload.skillName;
      const skill = state.catalog.skills[skillName];
      const paths = skill ? scenePathsForSkill(state.catalog, skillName) : [];
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      if (!skill) return null;

      const submit = async () => {
        setBusy(true);
        setError('');
        try {
          const result = await api('POST', withCwd('/skill-gateway/skills/delete', cwd), { skillName, cwd });
          if (!result.ok) throw new Error(result.error || '删除失败');
          notify(`技能「${skillName}」已删除，历史统计保留。`, 'success');
          onClose();
          await onSaved();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      };

      return h(ModalShell, {
        title: '删除技能',
        size: 'confirm',
        footer: ModalFooter({
          onClose,
          busy,
          submitLabel: '删除技能',
          submitKind: 'danger',
          onSubmit: submit,
        }),
      },
        h('div', { className: 'sg-notice sg-danger' },
          h(Icon, { name: 'error' }),
          h('span', null, '删除后将永久移除技能文件夹「', h('b', { className: 'sg-mono' }, skillName), '」及其资源文件。')),
        h('div', { className: 'sg-notice sg-success', style: { marginTop: 8 } },
          h(Icon, { name: 'check' }), '历史使用统计会保留，来源与场景路径仍然可见。'),
        h('div', { className: 'sg-field', style: { margin: '16px 0 0' } },
          h('span', { className: 'sg-field-label' }, `将从以下场景解链（${paths.length}）`),
          paths.length
            ? h('div', { className: 'sg-skill-scenes' },
                paths.map((path) => h('span', { className: 'sg-path-chip', key: path }, path)))
            : h('div', { className: 'sg-field-hint' }, '该技能当前未挂载到任何场景。')),
        error ? h('div', { className: 'sg-form-error' }, error) : null);
    }

    function skillMd(skillName, description, body) {
      return `---\nname: ${skillName}\ndescription: ${description}\n---\n\n${body}`;
    }

    function sampleSuccessUploadItem() {
      return {
        name: 'skills-sample',
        files: [
          {
            path: '运维与可靠性/incident-review/SKILL.md',
            content: skillMd('incident-review', '线上事故复盘流程：时间线还原、根因分析与行动项跟踪。', '# Incident Review\n\n1. 还原时间线。\n2. 定位根因。\n3. 输出行动项并跟踪。'),
          },
          {
            path: '运维与可靠性/incident-review/runbook.md',
            content: '# Runbook\n\n- 先止损，再定位。\n- 恢复后保留现场。\n- 复盘行动项必须可验证。',
          },
          {
            path: '运维与可靠性/可观测性/slo-checklist/SKILL.md',
            content: skillMd('slo-checklist', 'SLO 与监控告警清单：指标口径、告警分级与排班响应。', '# SLO Checklist\n\n1. 明确指标口径。\n2. 告警分级。\n3. 空页与排班确认。'),
          },
          {
            path: '后端开发/sql-review/SKILL.md',
            content: skillMd('sql-review', 'SQL 与索引评审（示例更新版），新增深分页游标检查。', '# SQL Review\n\n更新：深分页优先使用游标，并对 OFFSET 超阈值告警。'),
          },
          {
            path: '后端开发/sql-review/checklist.sql',
            content: '-- 检查：过滤条件、JOIN、排序、分页\nSELECT 1;\n',
          },
          {
            path: '说明.md',
            content: '# 散文件\n\n技能文件夹之外的文件不会导入。',
          },
        ],
      };
    }

    function sampleFailureUploadItem() {
      return {
        name: 'skills-invalid-sample',
        files: [
          { path: 'frontend-api/SKILL.md', content: '---\nname: frontend-api\n---\n\n缺少 description。' },
          { path: '新技能/Bad_Name/SKILL.md', content: '---\nname: Bad_Name\ndescription: name 含大写和下划线，不符合约束。\n---\n' },
          { path: '新技能/no-frontmatter/SKILL.md', content: '# 没有 frontmatter\n' },
        ],
      };
    }

    async function filesToUploadItem(fileList) {
      const files = [];
      let rootName = '';
      for (const file of fileList) {
        const raw = file.webkitRelativePath || file.name || '';
        if (raw.endsWith('/')) continue;
        const segments = raw.split('/').filter(Boolean);
        if (!segments.length) continue;
        if (!rootName && file.webkitRelativePath) rootName = segments[0];
        const path = file.webkitRelativePath ? segments.slice(1).join('/') : segments.join('/');
        if (!path) continue;
        let content = '';
        try {
          content = await file.text();
        } catch {
          content = '';
        }
        files.push({ path, content });
      }
      return { name: rootName || 'selected-folder', files };
    }

    function UploadModal({ modal, state, cwd, onClose, onSaved, notify, onOpenSession }) {
      const inputRef = useRef(null);
      const [pending, setPending] = useState(null);
      const [busy, setBusy] = useState(false);
      const [reading, setReading] = useState(false);
      const [result, setResult] = useState(null);

      const chooseFolder = () => {
        if (inputRef.current) inputRef.current.click();
      };

      const setPendingUpload = useCallback(async (item) => {
        setResult(null);
        setPending({ item, preview: null });
        try {
          const preview = await api('POST', withCwd('/skill-gateway/upload/preview', cwd), { item, cwd });
          setPending({ item, preview });
        } catch (err) {
          setPending({ item, preview: { ok: false, reasons: [err.message], name: item.name } });
        }
      }, [cwd]);

      const onChooseFiles = async (event) => {
        const input = event.target;
        const fileList = [...(input.files || [])];
        input.value = '';
        if (!fileList.length) {
          setPending({ item: { name: '技能文件夹', files: [] }, preview: { ok: false, reasons: ['文件夹为空。'] } });
          return;
        }
        setReading(true);
        try {
          const roots = new Set();
          for (const file of fileList) {
            const raw = file.webkitRelativePath || file.name || '';
            const first = raw.split('/').filter(Boolean)[0];
            if (first) roots.add(first);
          }
          if (roots.size > 1) {
            setPending({ item: { name: '技能文件夹', files: [] }, preview: { ok: false, reasons: ['一次只能选择一个文件夹。'] } });
            return;
          }
          await setPendingUpload(await filesToUploadItem(fileList));
        } catch (err) {
          setPending({ item: { name: '技能文件夹', files: [] }, preview: { ok: false, reasons: [err.message] } });
        } finally {
          setReading(false);
        }
      };

      const submit = async () => {
        if (!pending || !pending.preview || !pending.preview.ok || busy) return;
        setBusy(true);
        try {
          const uploadResult = await api('POST', withCwd('/skill-gateway/upload', cwd), { item: pending.item, cwd });
          if (!uploadResult.ok) {
            notify(uploadResult.reasons ? uploadResult.reasons[0] : '上传失败。', 'danger');
            return;
          }
          setResult(uploadResult);
          const session = uploadResult.session || {};
          if (session.started) {
            notify(`上传完成：新增 ${uploadResult.added.length} 个技能，覆盖 ${uploadResult.overwritten.length} 个。整理会话已开启。`, 'success', 6000);
          } else {
            notify(`上传完成：新增 ${uploadResult.added.length} 个技能，覆盖 ${uploadResult.overwritten.length} 个。${session.error || '整理会话未能自动开启。'}`, 'warning', 6000);
          }
          await onSaved();
        } catch (err) {
          notify(err.message, 'danger');
        } finally {
          setBusy(false);
        }
      };

      const preview = pending ? pending.preview : null;
      const previewOk = preview && preview.ok;
      const renderPreview = () => {
        if (reading) {
          return h('div', { className: 'sg-upload-preview' },
            h('div', { className: 'sg-notice sg-info' }, h(Icon, { name: 'info' }), '正在读取文件夹，请稍候…'));
        }
        if (!pending) return null;
        if (!preview) {
          return h('div', { className: 'sg-upload-preview' },
            h('div', { className: 'sg-notice sg-info' }, h(Icon, { name: 'info' }), '正在解析并校验技能…'));
        }
        if (!preview.ok) {
          return h('div', { className: 'sg-upload-preview' },
            h('div', { className: 'sg-notice sg-danger' },
              h(Icon, { name: 'error' }),
              h('div', null,
                h('b', null, '校验失败，本次上传不会导入任何内容。'),
                h('ul', { className: 'sg-reason-list' },
                  (preview.reasons || [preview.error]).filter(Boolean).map((reason) => h('li', { key: reason }, reason))))));
        }
        const ignored = preview.ignoredFiles || [];
        return h('div', { className: 'sg-upload-preview' },
          h('div', { className: 'sg-notice sg-success' },
            h(Icon, { name: 'check' }),
            `已解析文件夹「${preview.name || pending.item.name || 'selected-folder'}」，校验通过。`),
          h('div', { className: 'sg-upload-summary' },
            h('div', { className: 'sg-upload-summary-item' },
              h('div', { className: 'sg-upload-summary-label' }, '技能'),
              h('div', { className: 'sg-upload-summary-value' }, preview.skillCount || 0)),
            h('div', { className: 'sg-upload-summary-item' },
              h('div', { className: 'sg-upload-summary-label' }, '文件'),
              h('div', { className: 'sg-upload-summary-value' }, preview.fileCount || 0)),
            h('div', { className: 'sg-upload-summary-item' },
              h('div', { className: 'sg-upload-summary-label' }, '忽略文件'),
              h('div', { className: 'sg-upload-summary-value' }, ignored.length))),
          h('div', { className: 'sg-upload-list' },
            (preview.skills || []).map((skill) => h('div', { className: 'sg-upload-skill-row', key: skill.name },
              h('div', { className: 'sg-upload-skill-head' },
                h('span', { className: 'sg-tree-icon' }, h(Icon, { name: 'skill' })),
                h('span', { className: 'sg-upload-skill-name sg-mono' }, skill.name),
                skill.overwrite
                  ? h('span', { className: 'sg-badge sg-warning' }, '同名更新')
                  : h('span', { className: 'sg-badge sg-success' }, '新技能'),
                h('span', { style: { marginLeft: 'auto', fontSize: 12, color: 'var(--sg-ink-3)' } }, `${skill.fileCount} 文件`)),
              h('div', { className: 'sg-upload-skill-desc' }, skill.description || '')))),
          ignored.length
            ? h('div', { className: 'sg-field-hint', style: { marginTop: 8 } },
                `技能文件夹之外的散文件会被忽略：${ignored.slice(0, 4).join('、')}${ignored.length > 4 ? ' 等' : ''}`)
            : null);
      };

      const renderResult = () => {
        if (!result) return null;
        const session = result.session || {};
        return h('div', { className: 'sg-upload-result' },
          h('div', { className: 'sg-notice sg-success' },
            h(Icon, { name: 'check' }),
            h('div', null,
              h('b', null, '上传完成。'),
              h('div', { className: 'sg-upload-result-title' }, '技能已落盘并处于「未分类」状态；网关发现不会返回它们，直到整理会话把它们挂到场景。'),
              h('ul', { className: 'sg-reason-list' },
                h('li', { key: 'added' }, `新增技能：${result.added.length ? result.added.join('、') : '无'}`),
                h('li', { key: 'overwritten' }, `同名覆盖：${result.overwritten.length ? result.overwritten.join('、') : '无'}`),
                h('li', { key: 'ignored' }, `忽略散文件：${(result.ignoredFiles || []).length} 个`)))),
          h('div', { className: 'sg-upload-result-actions' },
            session.started
              ? h('button', {
                  className: 'sg-btn sg-btn-secondary',
                  type: 'button',
                  onClick: () => {
                    if (onOpenSession && session.sessionId) onOpenSession(session.sessionId);
                  },
                }, h(Icon, { name: 'link' }), '打开整理会话')
              : h('div', { className: 'sg-notice sg-warning', style: { flex: 1 } },
                  h(Icon, { name: 'warning' }), session.error || '整理会话未能自动开启，可稍后在「一键整理」中触发。'),
            h('button', { className: 'sg-btn sg-btn-ghost', type: 'button', onClick: onClose }, '完成')));
      };

      return h(ModalShell, {
        title: '上传',
        size: 'large',
        footer: result
          ? ModalFooter({ onClose, busy: false, submitLabel: '再传一批', onSubmit: () => { setResult(null); setPending(null); } })
          : ModalFooter({
              onClose,
              busy: busy || reading,
              submitLabel: '上传技能',
              onSubmit: submit,
              disabled: !previewOk,
            }),
      },
        h('input', {
          ref: inputRef,
          type: 'file',
          webkitdirectory: '',
          multiple: true,
          style: { display: 'none' },
          onChange: onChooseFiles,
        }),
        result
          ? renderResult()
          : h('div', { className: 'sg-dropzone' },
              h('span', { className: 'sg-dropzone-icon' }, h(Icon, { name: 'upload' })),
              h('div', { className: 'sg-dropzone-title' }, '选择一个技能文件夹'),
              h('p', { className: 'sg-dropzone-desc' },
                '递归收集所选文件夹下的每一个技能（含直接 SKILL.md 的文件夹整体为一个技能，子树资源全部保留）。文件夹层级不再产生场景：上传的技能处于「未分类」，由整理会话把它们归入场景。ZIP 上传已移除。'),
              h('div', { className: 'sg-dropzone-actions' },
                h('button', { className: 'sg-btn sg-btn-secondary', type: 'button', onClick: chooseFolder },
                  h(Icon, { name: 'upload' }), '选择文件夹'),
                h('button', { className: 'sg-btn sg-btn-ghost', type: 'button', onClick: () => setPendingUpload(sampleSuccessUploadItem()) },
                  h(Icon, { name: 'check' }), '载入成功示例'),
                h('button', { className: 'sg-btn sg-btn-ghost', type: 'button', onClick: () => setPendingUpload(sampleFailureUploadItem()) },
                  h(Icon, { name: 'error' }), '载入校验失败示例'))),
        result ? null : renderPreview());
    }

    function RelocateModal({ state, cwd, onClose, onSaved, notify }) {
      const [dataDir, setDataDir] = useState(state.location ? state.location.dataDir : '');
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');

      const submit = async () => {
        setBusy(true);
        setError('');
        try {
          const result = await api('POST', withCwd('/skill-gateway/relocate', cwd), { dataDir, cwd });
          if (!result.ok) throw new Error(result.error || '迁移失败');
          notify(`数据落点已迁移到 ${result.dataDir || dataDir}，统计不丢失。`, 'success');
          onClose();
          await onSaved();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      };

      return h(ModalShell, {
        title: '迁移数据落点',
        size: 'confirm',
        footer: ModalFooter({ onClose, busy, submitLabel: '迁移', onSubmit: submit }),
      },
        h('div', { className: 'sg-notice sg-info', style: { marginBottom: 16 } },
          h(Icon, { name: 'info' }),
          h('span', null, '数据默认落在工作目录根 ', h('span', { className: 'sg-mono' }, '.skillgate/'),
            '，也可由 ', h('span', { className: 'sg-mono' }, '.skillgate-anchor'), ' 指向自定义位置。')),
        h('div', { className: 'sg-field' },
          h('label', { className: 'sg-field-label' }, '数据目录'),
          h('input', {
            className: 'sg-field-input',
            type: 'text',
            value: dataDir,
            placeholder: '如 .skillgate/ 或 .config/skillgate/',
            onChange: (event) => setDataDir(event.target.value),
          }),
          h('div', { className: 'sg-field-hint' }, '迁移会先复制数据、再更新锚点、最后删除旧目录，统计不丢失。')),
        error ? h('div', { className: 'sg-form-error' }, error) : null);
    }

    function RollbackConfirmModal({ modal, state, cwd, onClose, onSaved, notify }) {
      const { slot } = modal.payload;
      const isUpload = slot === 'upload';
      const label = isUpload ? '上传' : '整理';
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      const [result, setResult] = useState(null);

      const submit = async () => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
          const response = await api('POST', withCwd('/skill-gateway/organize/rollback', cwd), { slot, cwd });
          if (!response.ok) {
            setError(response.error || '回滚失败。');
            return;
          }
          setResult(response);
          notify(`已回滚${label}：场景树已还原到${label}前的状态。`, 'success', 6000);
          await onSaved();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      };

      const affected = result && result.affected ? result.affected : null;
      const affectedItems = [];
      if (affected) {
        if (affected.scenesDeleted && affected.scenesDeleted.length) affectedItems.push(`删除场景 ${affected.scenesDeleted.length} 个（${affected.scenesDeleted.map((scene) => scene.name).join('、')}）`);
        if (affected.scenesRenamed && affected.scenesRenamed.length) affectedItems.push(`场景改名还原 ${affected.scenesRenamed.length} 个`);
        if (affected.scenesChanged && affected.scenesChanged.length) affectedItems.push(`场景内容还原 ${affected.scenesChanged.length} 个`);
        if (affected.removedSkills && affected.removedSkills.length) affectedItems.push(`删除本批新增技能文件 ${affected.removedSkills.length} 个（${affected.removedSkills.join('、')}）`);
        if (affected.overwrittenSkills && affected.overwrittenSkills.length) affectedItems.push(`恢复被覆盖技能原文件 ${affected.overwrittenSkills.length} 个（${affected.overwrittenSkills.join('、')}）`);
        if (affected.attachChanges && affected.attachChanges.length) affectedItems.push(`挂载关系还原 ${affected.attachChanges.length} 处`);
      }

      return h(ModalShell, {
        title: `回滚${label}`,
        footer: ModalFooter({
          onClose,
          busy,
          submitLabel: result ? '完成' : `确认回滚${label}`,
          submitKind: 'danger',
          onSubmit: result ? onClose : submit,
        }),
      },
        result
          ? h('div', null,
              h('div', { className: 'sg-notice sg-success' },
                h(Icon, { name: 'check' }),
                `回滚完成：场景树已还原到${label}前的整棵树。`),
              affectedItems.length
                ? h('div', { className: 'sg-field', style: { margin: '14px 0 0' } },
                    h('span', { className: 'sg-field-label' }, '受影响内容'),
                    h('ul', { className: 'sg-report-list' },
                      affectedItems.map((item, index) => h('li', { key: index }, item))))
                : null)
          : h('div', null,
              h('div', { className: 'sg-notice sg-warning' },
                h(Icon, { name: 'warning' }),
                h('div', null,
                  h('b', null, `将还原到${label}前的整棵树。`),
                  h('div', { className: 'sg-field-hint', style: { marginTop: 6 } },
                    isUpload
                      ? '上传回滚会删除本批新增技能的文件、恢复被覆盖技能的原文件，并还原场景树。'
                      : '整理回滚只还原场景树（catalog），不触碰任何技能文件。'))),
              error ? h('div', { className: 'sg-form-error' }, error) : null));
    }

    function ModalHost(props) {
      const { modal, state, cwd, onClose, onSaved, notify, setModal } = props;
      const shared = { modal, state, cwd, onClose, onSaved, notify };
      switch (modal.type) {
        case 'scene-create':
        case 'scene-edit':
          return h(SceneFormModal, shared);
        case 'delete-scene':
          return h(DeleteSceneModal, shared);
        case 'skill-picker':
          return h(SkillPickerModal, shared);
        case 'attach-skill':
          return h(AttachSkillModal, shared);
        case 'skill-detail':
          return h(SkillDetailModal, { ...shared, setModal });
        case 'file-preview':
          return h(FilePreviewModal, shared);
        case 'delete-skill':
          return h(DeleteSkillModal, shared);
        case 'upload':
          return h(UploadModal, shared);
        case 'rollback-confirm':
          return h(RollbackConfirmModal, shared);
        case 'relocate':
          return h(RelocateModal, shared);
        default:
          return null;
      }
    }

    /* ------------------------------------------------------------------ */
    /* 根组件：面板、launcher、toast、宽度拖拽                               */
    /* ------------------------------------------------------------------ */

    function ToastItem({ toast, onDismiss }) {
      useEffect(() => {
        const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration || 3000);
        return () => window.clearTimeout(timer);
      }, [toast.id, toast.duration, onDismiss]);

      return h('div', { className: cx('sg-toast', toast.kind === 'success' ? 'sg-success' : toast.kind === 'danger' ? 'sg-danger' : toast.kind === 'warning' ? 'sg-warning' : 'sg-info') },
        h(Icon, { name: toast.kind === 'success' ? 'check' : toast.kind === 'danger' ? 'error' : toast.kind === 'warning' ? 'warning' : 'info' }),
        h('span', null, toast.message));
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
      const [everOpen, setEverOpen] = useState(false);
      const [tab, setTab] = useState('catalog');
      const [state, setState] = useState(null);
      const [error, setError] = useState('');
      const [busyToggle, setBusyToggle] = useState(false);
      const [modal, setModal] = useState(null);
      const [toasts, setToasts] = useState([]);
      const [resizing, setResizing] = useState(false);
      const toastSeq = useRef(0);

      const [panelWidth, setPanelWidth] = useState(() => {
        if (typeof window === 'undefined') return 440;
        let saved = 0;
        try {
          saved = Number(window.localStorage && window.localStorage.getItem('skill-gateway.dsh.panelWidth'));
        } catch {
          saved = 0;
        }
        const maximum = Math.max(360, Math.min(760, window.innerWidth - 80));
        return Number.isFinite(saved) && saved > 0 ? clamp(saved, 360, maximum) : 440;
      });

      useEffect(() => {
        try {
          if (window.localStorage) window.localStorage.setItem('skill-gateway.dsh.panelWidth', String(panelWidth));
        } catch {
          // localStorage 不可用时忽略。
        }
      }, [panelWidth]);

      const notify = useCallback((message, kind = 'info', duration) => {
        const id = ++toastSeq.current;
        setToasts((prev) => [...prev, { id, message, kind, duration: duration || (kind === 'danger' || kind === 'warning' ? 5000 : 3000) }]);
      }, []);

      const dismissToast = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, []);

      const refresh = useCallback(async () => {
        const next = await api('GET', withCwd('/skill-gateway/state', cwd));
        setState(next);
        setError('');
        return next;
      }, [cwd]);

      useEffect(() => {
        if (open) setEverOpen(true);
        if (!open) return;
        refresh().catch((err) => setError(err.message));
      }, [open, refresh]);

      const toggleGateway = async () => {
        if (!state || busyToggle) return;
        setBusyToggle(true);
        try {
          const next = !state.config.enabled;
          await api('POST', withCwd('/skill-gateway/toggle', cwd), { enabled: next, cwd });
          notify(next ? '网关已开启：skill_gateway 工具与提示词恢复。' : '网关已关闭：工具与提示词卸下，统计观察器仍生效。', next ? 'success' : 'warning');
          await refresh();
        } catch (err) {
          setError(err.message);
          notify(err.message, 'danger');
        } finally {
          setBusyToggle(false);
        }
      };

      const closeModal = useCallback(() => setModal(null), []);

      const onSaved = useCallback(async () => {
        await refresh();
      }, [refresh]);

      const maximumPanelWidth = () => Math.max(360, Math.min(760, window.innerWidth - 80));

      useEffect(() => {
        const handleViewportResize = () => {
          setPanelWidth((value) => clamp(value, 360, maximumPanelWidth()));
        };
        window.addEventListener('resize', handleViewportResize);
        return () => window.removeEventListener('resize', handleViewportResize);
      }, []);

      const beginResize = (event) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = panelWidth;
        setResizing(true);
        const handleMove = (moveEvent) => {
          const maximum = maximumPanelWidth();
          setPanelWidth(clamp(startWidth + startX - moveEvent.clientX, 360, maximum));
        };
        const handleUp = () => {
          window.removeEventListener('pointermove', handleMove);
          window.removeEventListener('pointerup', handleUp);
          window.removeEventListener('pointercancel', handleUp);
          setResizing(false);
        };
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        window.addEventListener('pointercancel', handleUp);
      };

      const tabDefs = [
        ['catalog', '场景树', 'layers'],
        ['organize', '整理', 'refresh'],
        ['session', '会话配置', 'panel'],
        ['stats', '统计', 'stats'],
        ['gateway', '网关取用', 'gateway'],
      ];

      return h('div', { className: cx('sg-root', resizing && 'sg-is-resizing') },
        !open
          ? h('button', {
              className: 'sg-launcher',
              type: 'button',
              onClick: () => {
                setEverOpen(true);
                setOpen(true);
              },
              'aria-label': '打开 Skill Gateway',
            },
              h(GatewayLogo, { size: 22 }),
              'Skill Gateway')
          : null,
        everOpen
          ? h('aside', {
              className: cx('sg-panel', !open && 'sg-panel-closed'),
              'aria-label': 'Skill Gateway 侧边栏',
              style: { width: panelWidth },
            },
          h('div', {
            className: 'sg-resizer',
            role: 'separator',
            'aria-orientation': 'vertical',
            'aria-label': '拖拽调整 Skill Gateway 侧边栏宽度',
            'aria-valuenow': panelWidth,
            'aria-valuemin': 360,
            'aria-valuemax': 760,
            title: '拖拽调整宽度，双击恢复默认',
            onPointerDown: beginResize,
            onDoubleClick: () => setPanelWidth(clamp(440, 360, maximumPanelWidth())),
          }),
          h('header', { className: 'sg-panel-header' },
            h(PanelMark),
            h('div', { className: 'sg-panel-title-wrap' },
              h('div', { className: 'sg-panel-title' }, 'Skill Gateway'),
              h('div', { className: 'sg-panel-subtitle' }, '场景化管理 · 渐进式取用')),
            h('label', { className: 'sg-switch', title: '网关开关：关闭后卸下工具与提示词，统计观察器仍生效' },
              h('input', {
                type: 'checkbox',
                checked: state ? state.config.enabled : false,
                disabled: busyToggle || !state,
                onChange: toggleGateway,
              }),
              h('span', { className: 'sg-switch-track' }),
              h('span', { className: 'sg-switch-label' }, '网关')),
            h('button', {
              className: 'sg-icon-btn',
              type: 'button',
              onClick: () => setOpen(false),
              'aria-label': '关闭面板',
            }, h(Icon, { name: 'close' }))),
          h('nav', { className: 'sg-panel-tabs', 'aria-label': '面板导航' },
            h('div', { className: 'sg-segmented' },
              tabDefs.map(([value, label, iconName]) => h('button', {
                key: value,
                type: 'button',
                className: tab === value ? 'sg-is-active' : undefined,
                onClick: () => setTab(value),
              },
                h(Icon, { name: iconName }), label)))),
          h('div', { className: 'sg-panel-body' },
            error ? h('div', { className: 'sg-notice sg-danger', style: { marginBottom: 12 } },
              h(Icon, { name: 'error' }), error) : null,
            !state ? h('div', { className: 'sg-card' },
              h('div', { className: 'sg-empty' },
                h('div', { className: 'sg-empty-icon' }, h(Icon, { name: 'refresh' })),
                h('h3', { className: 'sg-empty-title' }, '加载中…'))) : null,
            state
              ? h('div', { style: { display: tab === 'catalog' ? 'block' : 'none' } },
                  h(CatalogTab, { state, cwd, onChanged: refresh, notify, setModal, onOpenSession: props.onOpenSession }))
              : null,
            state
              ? h('div', { style: { display: tab === 'organize' ? 'block' : 'none' } },
                  h(OrganizeTab, { state, cwd, onChanged: refresh, notify, setModal, onOpenSession: props.onOpenSession }))
              : null,
            state
              ? h('div', { style: { display: tab === 'session' ? 'block' : 'none' } },
                  h(SessionConfigTab, { state, cwd, notify, onChanged: refresh }))
              : null,
            state
              ? h('div', { style: { display: tab === 'stats' ? 'block' : 'none' } },
                  h(StatsTab, { cwd, sessionId, setTab, active: tab === 'stats' }))
              : null,
            state
              ? h('div', { style: { display: tab === 'gateway' ? 'block' : 'none' } },
                  h(GatewayTab, { state, notify }))
              : null))
          : null,
        modal
          ? h('div', { className: 'sg-modal-root' },
              h(ModalHost, {
                modal,
                state,
                cwd,
                onClose: closeModal,
                onSaved,
                notify,
                setModal,
                onOpenSession: props.onOpenSession,
              }))
          : null,
        toasts.length
          ? h('div', { className: 'sg-toast-root', 'aria-live': 'polite' },
              toasts.map((toast) => h(ToastItem, {
                key: toast.id,
                toast,
                onDismiss: dismissToast,
              })))
          : null);
    }

    function apply(ctx) {
      if (!ctx || !ctx.slots) return;
      const openSession = (sessionId) => {
        try {
          const sessions = ctx.get ? ctx.get('sessions') : ctx.sessions;
          if (sessions && typeof sessions.open === 'function' && sessionId) sessions.open(sessionId);
        } catch {
          // 会话服务不可用时忽略跳转。
        }
      };
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          { name: 'shell.overlay', id: 'skill-gateway-sidebar', order: 50, label: () => 'Skill Gateway' },
          (props) => h(SkillGatewayOverlay, Object.assign({}, props || {}, { onOpenSession: openSession })),
        ));
    }

    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
