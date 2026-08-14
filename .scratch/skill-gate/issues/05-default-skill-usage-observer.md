# 05 — 默认技能使用观察器 + 全局聚合接线

**What to build:** 观察 harness 默认 `skill` 工具调用并记 `agent-skills` 使用;全局统计(次数/占比/最近使用/按场景/来源过滤)可算出;无论开关都生效。

**Blocked by:** 02 — 仓库文件持久化

**Status:** ready-for-agent

- [ ] 监听工具结果,当 harness 默认 `skill` 工具被调用时记 source=agent-skills 的使用记录(技能名 + 时间戳 + 会话)。
- [ ] 与 gateway 记录共存于同一 usage 数据,按 source 可区分。
- [ ] 全局聚合(次数/占比/最近使用/按场景)在两种来源下都正确。
- [ ] 开关 OFF 时观察器仍生效。
