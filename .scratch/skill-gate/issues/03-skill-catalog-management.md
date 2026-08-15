# 03 — 技能目录管理(端到端)

**What to build:** 面板「场景树管理」tab 的完整管理路径:用户建/删/嵌套场景、编辑 name/description/tags、把技能挂到多个场景、上传文件夹/zip(校验/同名更新/删除语义),并切换网关开关。

**Blocked by:** 02 — 仓库文件持久化

**Status:** ready-for-agent

- [x] 侧边栏底部入口按钮打开面板,含「场景树管理」tab。
- [x] 可建/删/嵌套场景(单根、不限深度),编辑 name/description/tags。
- [x] 可把一个技能挂到多个场景;删除场景级联删子场景、对技能只解链不删文件。
- [x] 上传文件夹/zip(多选),一个文件夹=一个技能;校验失败给逐条原因。
- [x] 同名上传=原地更新(二次确认,保留统计);删除技能=全场景解链 + 删文件 + 保留历史统计。
- [x] 开关可开/关,状态持久化。

## Comments

实现于 `packages/dsh-plugin/client/client.js` + `src/gateway-service.js` + Host JSON 路由：

- `shell.overlay` 注册右侧 Skill Gateway 侧边栏；面板含「场景树管理」tab。
- 建/删/嵌套场景，编辑 name/description/tags。
- 技能多父挂载；删场景级联删子场景且只解链技能。
- 文件夹/多选 ZIP 上传，一个文件夹/zip=一个技能；校验逐条原因。
- 同名上传二次确认后原地更新；删技能全场景解链+删文件+保留历史统计。
- 开关状态持久化于 config.json。
