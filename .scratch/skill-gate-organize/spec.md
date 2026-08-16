# skill-gate organize(上传改版 + Agent 整理)

Status: ready-for-agent

## Problem Statement

当前"上传场景树"把用户硬盘上的文件夹层级直接映射为场景树:文件夹=场景,含 SKILL.md 的文件夹=技能。但文件夹结构反映的是用户本地的组织习惯,不是场景语义——上传一个装满技能的文件夹就会生成一堆名不副实的场景,场景边界模糊、冲突(重复技能、语义重叠场景、挂载过散)无人发现,整棵场景树的质量完全取决于用户手动维护。

用户需要把"上传"与"分类整理"解耦:**上传只负责把技能收进来**,场景的创建与归类、边界的整理、冲突的发现,全部交给 Agent 在可见的整理会话中完成,并且每一次 Agent 改动都可以一键回滚。

## Solution

- **上传**不再识别场景:依旧递归扫描根文件夹下的每一个技能(含直接 SKILL.md 的文件夹整体为一个技能,资源全部保留),但不再创建、复用任何场景。上传的校验(任一技能无效则整体拒绝)、同名技能原地覆盖(保留使用历史)、忽略文件清单均保留;上传成功的技能处于**未分类**状态,落盘立即可见但**网关发现(browse/find)不返回**。
- **自动整理分类**:上传成功后,网关自动开启一个新会话并注入整理提示词(会话在 GUI 侧边栏可见、可打断、完成后保留),Agent 根据技能内容把每个技能归入合适的场景;没有合适场景时,Agent 在场景树上创建合适的场景(必须填写 name 与详细 description,确保场景作用可被看懂),并给出整理报告。结果可一键回滚到上传前的样子。
- **一键整理**:用户手动触发整理会话,Agent 对整棵场景树进行整理——澄清场景边界、删除多余场景、归类未分类技能、补写场景描述——并在报告中给出冲突、重复的技能。结果可一键回滚。
- **冲突检测**:用户手动触发只读整理会话,Agent 检测场景树中的冲突(内容高度相似的重复技能、语义重叠的模糊场景、挂载过散的技能)并给出检测报告,不改动场景树。
- **组织工具**:为整理会话中的 Agent 提供 `skill_organize` 工具,对场景树的整理全部经由此工具落地,每一步即时校验与持久化。技能文件与技能描述(取自 SKILL.md)对 Agent 只读,技能删除仅用户可操作。

## User Stories

1. As a user, I want to upload a folder of skills and have it recursively collect every skill under it, so that I can bring many skills in at once without arranging them into folders first.
2. As a user, I want folder structure inside the upload to be ignored for scene purposes, so that my local organization habits never leak into the scene tree.
3. As a user, I want a skill folder's whole subtree imported verbatim as that skill's files, so that skill resources survive upload intact.
4. As a user, I want the whole upload rejected with per-item reasons when any skill's SKILL.md frontmatter is invalid, so that broken skills never enter the gateway.
5. As a user, I want uploading a same-name skill to overwrite it in place, keeping its usage history, so that iterating on a skill is cheap.
6. As a user, I want the upload result to report which skills were overwritten, so that I know which old versions were replaced.
7. As a user, I want files outside any skill folder to be reported as ignored, so that I can notice files that were not imported.
8. As a user, I want uploaded-but-unclassified skills visible in a dedicated "未分类" group in the management UI, so that I can see what still needs classification.
9. As a user, I want unclassified skills invisible to gateway discovery (browse/find), so that the gateway only ever offers organized skills.
10. As a user, I want the upload to automatically open an organize session, so that classification is done by the Agent right after upload without extra steps from me.
11. As a user, I want the automatically opened session to appear in the GUI sidebar as a normal, fixed-named conversation, so that I can watch, interrupt, or take over the Agent's work.
12. As a user, I want the classify session to assign each uploaded skill to the most suitable existing scene, so that the tree stays consistent with the skills.
13. As a user, I want the Agent to create a new scene when no existing scene fits, so that new work purposes get a home instead of being forced into a wrong scene.
14. As a user, I want every scene the Agent creates to carry a name and a detailed description, so that the scene's purpose is unambiguous to any future Agent.
15. As a user, I want the Agent to be able to attach one skill to several scenes when it genuinely applies in several contexts, with a stated reason, so that cross-cutting skills stay reachable everywhere.
16. As a user, I want the Agent to be able to rewrite the description of existing scenes to clarify boundaries, so that scene boundaries stay sharp over time.
17. As a user, I want a one-click organize action that has the Agent tidy the whole scene tree — clear boundaries, delete redundant scenes, classify unclassified skills — so that the tree degrades gracefully without manual curation.
18. As a user, I want the one-click organize report to list conflicts and duplicate skills, so that I can act on quality problems the Agent found.
19. As a user, I want a conflict detection action that reports similar-content skills, semantically overlapping scenes, and over-scattered attachments without changing the tree, so that I can inspect quality before deciding to change anything.
20. As a user, I want every organize run (auto-classify and one-click organize) to snapshot the tree before it starts, so that I can roll the tree back to its pre-run state afterwards.
21. As a user, I want the upload rollback to also remove the newly uploaded skill files and restore overwritten originals, so that rolling back truly returns to the pre-upload state.
22. As a user, I want the organize rollback to restore the catalog only, so that skill files are never touched by an organize rollback.
23. As a user, I want the most recent snapshot of each slot (upload / organize) kept persistently, so that rollback survives restarts.
24. As a user, I want rollback to restore the whole tree and to confirm this before applying, so that I understand the blast radius of the action.
25. As a user, I want only one organize session per repository at a time, so that concurrent Agent edits cannot corrupt the tree.
26. As a user, I want an interrupted or failed organize session to keep its partial changes and its snapshot, so that the Agent's completed work is not silently discarded.
27. As a user, I want skills unlinked by a scene deletion to return to the "未分类" group, so that no skill disappears from the management view.
28. As a user, I want the Agent's organize tool to reject any attempt to change skill files or skill descriptions, so that skill content stays exactly as uploaded.
29. As a user, I want the Agent's organize tool to reject skill deletion, so that deleting a skill (with its file cleanup) remains a user-only action.
30. As a user, I want the "上传场景树" button renamed to "上传" with a skill-only preview, so that the UI matches the new semantics.
31. As a user, I want "一键整理" and "冲突检测" entries in the tree page header, disabled while a session is running, so that I can trigger them where I manage the tree.
32. As a user, I want an organize report card in the sidebar (change summary + conflict/duplicate list + rollback button) after a session ends, so that I can review and undo the Agent's work in place.

## Implementation Decisions

### 模块结构

沿用既有三层切分,决策全部下沉 core:

- **core 模块**:上传解析(仅收集技能)、未分类查询、快照/回滚语义、组织工具校验规则、moveScene 等纯函数。旧"场景树导入"语义(文件夹→场景)从上传路径移除。
- **repo-store 模块**:快照持久化(两个槽位)、被覆盖技能原文件备份/恢复。
- **dsh-plugin host**:`skill_organize` 工具注册(仅挂载进整理会话)、整理会话启动器(基于 `agents.create` + `followup` + `whenIdle`,沿用 DSH headless/subagent 已验证的宿主侧会话创建路径)、三种模式提示词、整理报告提取与持久化、上传与手动触发的 JSON 路由。
- **dsh-plugin client**:上传弹窗改版、未分类分组、一键整理/冲突检测入口、整理报告卡片与回滚按钮。

### 数据形态

- **catalog 不变**:`skills` 中未被任何 `scenes[*].skills` 引用的技能即**未分类技能**;不新增显式字段。
- **快照**:每个槽位一份,包含 `{ catalog 整树, 批次清单 }`;批次清单含新增技能名列表与被覆盖技能的原始文件备份。上传槽位与整理槽位各自独立、各自保留最近一份。
- **整理报告**:结构化结果 `{ 模式, 时间, 改动摘要(新建/改名/删除场景、技能归类/挂载变动), 冲突与重复清单, 覆盖清单 }`,持久化最近一份供侧边栏展示;会话消息内保留全文。

### API 契约

**`skill_organize` 工具**(仅整理会话可见;`skill_gateway` browse/load 仍全局可用,整理会话内 Agent 用它按需深读技能全文):

- `createScene(parentId, name, description, tags?)` — name 非空且全树唯一,description 必填(详细描述场景作用);
- `updateScene(sceneId, name?, description?, tags?)` — 允许补写/改写 description 以澄清边界;name 改动保持全树唯一;
- `deleteScene(sceneId)` — 级联删除子场景,直接挂载技能解链回未分类;
- `moveScene(sceneId, parentId)` — 改父,保持全树 name 唯一;
- `attachSkill(sceneId, skillName)` / `detachSkill(sceneId, skillName)` — 挂载/解链;move = detach + attach;
- 硬约束:技能文件与技能 description 只读;技能删除拒绝;每次调用即时校验并落盘。

**上传路由**(沿用现有 JSON 路由形态):预览与上传均切到仅收集技能语义;上传响应含 `{ skills, overwritten[], ignoredFiles[], fileCount }`,不再含任何场景信息;上传成功落盘后自动开启分类整理会话,若已有整理会话在运行则拒绝并提示。

**整理会话触发路由**:一键整理(打整理槽位快照、可回滚)与冲突检测(只读、不打快照、不改树);回滚路由(上传槽位/整理槽位)返回回滚后的 catalog 与受影响内容清单。

**会话机制**(host 侧):`ctx.agents.create({ sessionId: 新顶层会话, meta: { cwd }, agentOptions, setup })` 创建独立顶层会话(非 subagent 身份,避免被会话列表隐藏),`setup` 内挂载 agentPreset 与 `skill_organize`;`followup(createUserMessage(...))` 注入提示词,`source: { kind: 'plugin' }`;`await agent.whenIdle()` 等待完成;会话完成后**不 dispose**,保留在侧边栏;提示词首句写任务名以生成固定标题("技能整理 #时间"式);同仓库互斥——同一时间只允许一个整理会话,新触发被拒。

### 具体交互

- **提示词构成**:嵌入完整场景摘要(每个场景的 name + description + 直接挂载技能名)与未分类技能列表;技能全文不嵌入,Agent 通过 `skill_gateway` browse/load 按需深读。三种模式共用提示词骨架,差异在任务指令:自动分类(仅处理本批上传技能)、一键整理(整树整理,报告含冲突/重复清单)、冲突检测(只读报告,明确禁止任何修改)。
- **冲突/重复定义**(一键整理报告与冲突检测共用):② 不同名但 SKILL.md 内容高度相似的重复技能;③ 场景名称/描述语义重叠、边界模糊;④ 一个技能挂载多个语义相距很远的场景(挂载过散)。场景检测看元数据,技能相似性读 SKILL.md 全文由 Agent 判断。
- **同名覆盖与冲突检测的关系**:同名技能在上传时已覆盖,旧版本不保留,故"同名但内容不同"不作为冲突检出项;覆盖事实以上传结果报告与整理报告的覆盖清单呈现。
- **未分类技能**:上传即落盘、UI"未分类"分组可见、可手动挂载;网关 browse/find 天然不返回(遍历只走场景挂载),以测试确认;整理中被解链的技能回到同一分组。
- **回滚语义**:整理回滚=仅还原 catalog;上传回滚=还原 catalog + 删除本批新增技能文件 + 恢复被覆盖技能的原文件;回滚前 UI 明确提示"将还原到整理/上传前的整棵树"。
- **失败/取消**:整理会话被打断或失败时,已完成修改保留、快照保留,不自动回滚;未分类技能可随时再次触发整理会话处理。
- **开关语义不变**:网关开关关闭时整理会话与组织工具是否可用保持现状约定(统计恒生效);整理功能不绕过开关状态。

## Testing Decisions

好的测试只断言外部行为——可观察的输入→输出契约,不测内部实现。沿用现有约定:core 与 repo-store 写纯函数/持久化单测;DSH 适配器(会话启动器、工具注册、互斥、RPC、Slots UI)由 GUI 集成验证,不写单元测试。

- **core 模块**(主缝,先例 `packages/core/test/core.test.js`):仅收集技能的上传解析(文件夹层级不产生场景、资源保留、整体拒绝校验、同名覆盖、覆盖/忽略清单)、未分类查询(含解链回未分类)、快照/回滚语义(整树还原、上传回滚的文件清单语义)、组织工具校验规则(场景必填 description、全树 name 唯一、技能 description 只读、技能删除拒绝)、moveScene 重挂语义、网关 browse/find 不返回未分类技能。
- **repo-store 模块**(副缝,先例 `packages/repo-store/test/repo-store.test.js`):两个槽位快照的保存/读取/覆盖、被覆盖技能文件备份与恢复、回滚的原子性与写锁交互。
- **不测**:DSH 会话创建/注入/等待、整理会话互斥、提示词实际效果、client UI——GUI 集成验证。

## Out of Scope

- Agent 修改技能文件内容或技能描述;Agent 删除技能(含文件清理)。
- 确定性"语义相似度"算法:重复/冲突判定完全由 Agent 判断,不实现相似度打分。
- 上传 ZIP;从 `.agents/skills/` 导入;URL/GitHub 拉取。
- 快照历史:每个槽位只保留最近一份,不做多版本回滚栈。
- 跨仓库/跨工作区的整理会话协调(互斥仅限单仓库)。
- 整理会话的自动重试、失败自动回滚。
- prototype/version2 原型同步(插件 client 即真实 UI,原型保持为设计参考)。

## Further Notes

- 会话标题来自首条消息:提示词首句必须直接写出任务名(如"技能整理 #2025-08-16 10:30"),保证侧边栏会话可识别。
- 整理会话保留在侧边栏且 Agent 处于 idle:用户可继续对话、要求修正或接管;整理报告卡片的回滚按钮与会话内操作并行可用。
- 场景名全树唯一是既有约束(非本次新增),组织工具只是强制它。
- CONTEXT.md 已新增术语:上传、未分类技能、整理会话、一键整理、组织工具、整理报告、冲突检测、快照回滚;spec 与术语表保持同义。
