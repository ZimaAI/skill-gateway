# 04 — 网关工具 skill_gateway + 提示词 + gateway 使用记录

**What to build:** Agent 可经 `skill_gateway` 按目的发现技能(find/browse)并二次加载全文(load),load 记录 `gateway` 使用;开关 OFF 时卸工具 + 撤提示词。

**Blocked by:** 02 — 仓库文件持久化

**Status:** ready-for-agent

- [ ] 注册 `skill_gateway` 工具,action = find / browse / load。
- [ ] find(purpose) 返回命中场景路径 + 递归子树技能元数据(去重、分组)。
- [ ] browse(sceneId?) 返回节点 `{ name, description, tags, 子场景, 直接挂的技能元数据 }`。
- [ ] load(skillName, scenePath?) 返回整个技能文件夹 `{ 相对路径: 文件内容 }`,并记一条 source=gateway 的使用记录。
- [ ] 开关 ON 注入"开始子任务前先查网关"提示词;OFF 卸工具 + 撤提示词。
