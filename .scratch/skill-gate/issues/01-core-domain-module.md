# 01 — 核心领域模块 + 测试

**What to build:** 一个纯函数核心模块(无 DSH/Cordis 依赖,输入输出为纯 JSON),承载 skill-gate 全部决策逻辑:数据形状、场景树 CRUD(含多父挂载)、上传校验、关键词匹配 find、browse/load 形状、使用记录与全局聚合,并带单元测试。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 核心模块是纯函数/纯 JSON 接口,不依赖 DSH/Cordis,可直接在 Node 单测中运行。
- [ ] 场景树操作:单根建/删场景、不限深度嵌套、场景可同时含子场景与技能、一个技能可挂多个场景、解链不删文件。
- [ ] 上传校验:根目录唯一 SKILL.md、frontmatter 含非空 name(匹配 `[a-z0-9][a-z0-9-]*`)与 description;不合规返回逐条原因。
- [ ] 关键词匹配 find:主匹配场景 name/description/tags、次级匹配技能 name/description;返回命中场景路径 + 递归子树技能元数据(去重、分组)。
- [ ] 使用记录与全局聚合:次数、占比、最近使用时间、按场景聚合、按 source 过滤。
- [ ] 测试只断言外部行为(输入→输出),全绿。
