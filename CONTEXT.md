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
