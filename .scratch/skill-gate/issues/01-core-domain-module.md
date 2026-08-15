# 01 — 核心领域模块 + 测试

**What to build:** 一个纯函数核心模块(无 DSH/Cordis 依赖,输入输出为纯 JSON),承载 skill-gate 全部决策逻辑:数据形状、场景树 CRUD(含多父挂载)、上传校验、关键词匹配 find、browse/load 形状、使用记录与全局聚合,并带单元测试。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [x] 核心模块是纯函数/纯 JSON 接口,不依赖 DSH/Cordis,可直接在 Node 单测中运行。
- [x] 场景树操作:单根建/删场景、不限深度嵌套、场景可同时含子场景与技能、一个技能可挂多个场景、解链不删文件。
- [x] 上传校验:根目录唯一 SKILL.md、frontmatter 含非空 name(匹配 `[a-z0-9][a-z0-9-]*`)与 description;不合规返回逐条原因。
- [x] 关键词匹配 find:主匹配场景 name/description/tags、次级匹配技能 name/description;返回命中场景路径 + 递归子树技能元数据(去重、分组)。
- [x] 使用记录与全局聚合:次数、占比、最近使用时间、按场景聚合、按 source 过滤。
- [x] 测试只断言外部行为(输入→输出),全绿。

## Comments

实现于 `packages/core/`（纯 ESM/JSON，无 DSH 依赖）：

- `catalog.js`：单根场景树 CRUD、多父挂载、解链/级联删除。
- `matching.js`：tokenize、find/browse/load、场景路径与子树收集。
- `upload.js`：SKILL.md frontmatter 与上传校验。
- `usage.js`：使用记录与次数/占比/最近使用/按场景/来源过滤聚合。
- `test/core.test.js`：外部行为测试，`npm run test:core` 全绿。
