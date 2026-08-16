# 03 — Host:skill_organize 组织工具

**What to build:** 独立的组织工具,供整理会话中的 Agent 修改场景树,仅挂载进整理会话(不全局注册):createScene(强制 name + 详细 description)、updateScene(含补写/改写 description)、deleteScene(级联删子场景,直接挂载技能解链回未分类)、moveScene(改父)、attachSkill/detachSkill(move = detach + attach);硬约束:技能文件与技能描述只读、技能删除被拒、场景 name 全树唯一、每次调用即时校验并持久化。core 补 moveScene 与"创建场景必填描述"校验选项。

**Blocked by:** None — 可以立即开始

**Status:** ready-for-agent

- [ ] 五个动作全部可用且每次调用即落盘;响应携带变更后的状态。
- [ ] createScene 缺 description(或过短无意义)时拒绝;name 与全树任何场景重名时拒绝。
- [ ] deleteScene 后其直接挂载技能出现在未分类查询中;级联子场景一并删除。
- [ ] 对技能 description/文件的任何修改请求被拒绝;删除技能请求被拒绝(仅用户可删)。
- [ ] moveScene 拒绝造成环(移动到自己/自己的后代之下)。
- [ ] 工具只在整理会话的 agent 上下文中可见,普通会话的 Agent 调不到。
