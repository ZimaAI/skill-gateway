# Skill Gate(工具网关)

本仓库的领域上下文:一个面向 DeepSeek Harness 的"技能工具网关"插件——把海量技能按场景组织成一棵分类树,Agent 只能通过网关按需、渐进式取用技能,并记录会话内与仓库级的技能使用统计。目的是避免一次性把所有技能注入上下文导致触发不准、幻觉。

## 术语

**工具网关(skill gate)**
Agent 获取网关内技能的唯一入口;必须经它查询才能拿到技能。
_Avoid_: 技能路由器、skill router、skill picker

**场景(scene)**
场景树上的一个节点,代表一类工作目的(如"后端开发"、"数据库设计")。由 name、description、tags 描述,可含子场景与技能。
_Avoid_: 分类、category、分组、bucket

**场景树(scene tree)**
由场景节点构成的分类树,单根、不限深度;技能挂在场景节点下。
_Avoid_: 分类树、taxonomy

**技能(skill)**
一个上传进网关的技能文件夹(标准 SKILL.md + 资源文件),以 SKILL.md 的 name 为唯一标识。
_Avoid_: 插件、tool、prompt、模版

**技能元数据(skill metadata)**
技能的 name、description 等轻量描述,供发现阶段返回;不含正文。

**渐进式加载(progressive loading)**
两段式取用:先取元数据完成发现,harness 决定用哪个技能后,再二次加载该技能全文。
_Avoid_: 懒加载、lazy load

**技能来源(skill source)**
一次技能使用记录的出处:gateway(经网关取用)或 agent-skills(harness 默认从 `.agents/skills/` 加载)。
_Avoid_: origin、type

**会话内使用记录(session usage record)**
当前会话内每个技能被取用的时间线(时间戳 + 技能 + 来源 + 场景路径)。

**全局统计(global stats)**
当前仓库(workspace)范围内、所有会话累计的技能使用统计(触发次数、占比、最近使用时间)。
_Avoid_: 总量统计、站点统计

**网关开关(skillgate toggle)**
控制是否启用网关:开=Agent 经网关取用技能;关=回退到 harness 默认技能加载。统计不受开关影响、恒生效。
_Avoid_: enable/disable flag

**上传(upload)**
把本地文件夹递归扫描为一批技能并写入网关的操作。只识别技能(含直接 SKILL.md 的文件夹),不识别场景;场景归属由整理会话决定。同名技能原地覆盖,保留使用历史。
_Avoid_: 上传场景树、导入场景树

**未分类技能(unclassified skill)**
已上传落盘、但尚未挂到任何场景的技能。管理 UI 以"未分类"分组展示;网关发现(browse/find)不返回它。整理会话负责把它归入合适场景;整理中被解链的技能也回到未分类。
_Avoid_: 未挂载技能、游离技能

**整理会话(organize session)**
由网关自动开启(上传后)或用户手动触发(一键整理、冲突检测)的新会话,注入整理提示词,Agent 通过组织工具修改场景树。会话完成后保留在侧边栏,用户可查看、继续或打断。
_Avoid_: 整理任务、后台整理

**一键整理(full organize)**
手动触发的整理会话:Agent 对整棵场景树整理边界、删除多余场景、归类未分类技能,并给出含冲突与重复技能清单的整理报告。结果可回滚。
_Avoid_: 全局整理、场景树整理

**组织工具(organize tool)**
整理会话中供 Agent 修改场景树的工具集:场景的创建、改名、改描述、移动、删除,技能的挂载、解链、迁移。技能文件与技能描述(取自 SKILL.md)只读,技能删除仅用户可操作。
_Avoid_: 管理工具、admin 工具

**整理报告(organize report)**
整理会话结束时给出的结构化结果:改动摘要(新建/删除/改名场景、技能归类)与冲突、重复清单。持久化供查看,侧边栏展示。
_Avoid_: 整理总结、变更日志

**冲突检测(conflict detection)**
只读的整理会话:检测内容高度相似的重复技能、语义重叠的模糊场景、挂载过散的技能,产出检测报告,不改动场景树。
_Avoid_: 冲突排查、一致性检查

**快照回滚(snapshot rollback)**
每次整理会话开始前对场景树及本批技能文件变更打快照;用户可一键把场景树回滚到整理/上传前的状态。上传与一键整理各自保留最近一份快照。
_Avoid_: undo、撤销
