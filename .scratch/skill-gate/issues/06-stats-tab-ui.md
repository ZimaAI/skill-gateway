# 06 — 统计 tab UI

**What to build:** 面板「统计」tab,展示会话内时间线 + 全局统计,支持按来源过滤与场景聚合。

**Blocked by:** 03 — 技能目录管理(端到端);05 — 默认技能使用观察器 + 全局聚合接线

**Status:** ready-for-agent

- [x] 面板含「统计」tab(与「场景树管理」并列)。
- [x] 会话内时间线:按时间显示 `{ 技能名, 来源, 场景路径, 时间 }`。
- [x] 全局统计:每技能触发次数、占比、最近使用时间;按场景聚合。
- [x] 可按来源(gateway / agent-skills)过滤。

## Comments

实现于 `packages/dsh-plugin/client/client.js`：

- 右侧 Skill Gateway 侧边栏含「统计」tab（与「场景树管理」「网关」并列）。
- 会话内时间线：时间/技能/来源/场景路径；当前会话 id 来自 `useSessions()`，不可用时显示仓库记录。
- 全局统计：每技能与每场景的次数/占比/最近使用。
- 来源过滤 gateway / agent-skills / 全部。
