# skill-gateway

一个面向 DeepSeek Harness 的「技能工具网关」插件：把海量技能按**场景**组织成一棵**场景树**，Agent 只能通过 `skill_gateway` 工具沿场景树逐层深入、渐进式地取用技能，并持久化记录**会话内使用记录**与**全局统计**。

## 仓库结构

```
packages/
  core/         纯函数核心（无 DSH/Cordis 依赖，输入输出为纯 JSON）
  repo-store/   仓库文件持久化（.skillgate/，锚点换址，并发合并）
  dsh-plugin/   DeepSeek Harness 动态插件（Host 工具/观察器 + 右侧 Skill Gateway 侧边栏）
prototype/      先行的自包含 HTML 原型（一次性，非生产代码）
.scratch/
  skill-gate/          领域 spec 与实现 tickets（网关核心）
  skill-gate-organize/ 上传改版 + Agent 整理 spec 与 tickets
docs/adr/       架构决策
```

## 快速开始

```bash
npm test
```

三个测试组覆盖：

- core：场景树 CRUD、browse/load、仅收集技能的上传、未分类查询、组织工具校验、快照/回滚语义、使用聚合；
- repo-store：默认/锚点数据目录、重启读回、并发追加合并、换址迁移、快照槽位与回滚；
- dsh-plugin：网关服务编排、技能视角上传预览/落盘、整理动作与报告提取（会话机制由 GUI 集成验证）。

## 核心契约

`skill_gateway` 工具提供两个 action：

| action | 输入 | 输出 |
| --- | --- | --- |
| `browse` | `sceneId?` | 一个场景节点的 `{ name, description, tags, children, skills }`；省略 `sceneId` 返回根场景 |
| `load` | `skillName, scenePath?` | 技能文件夹 `{ 相对路径: 文件内容 }`，并记录一条 `gateway` 使用 |

## 上传

侧边栏「场景树管理」可选择并上传一个文件夹：

- **上传只收集技能**：递归扫描所选文件夹下的每一个技能（含直接 `SKILL.md` 的文件夹整体为一个技能，子树资源全部保留）；
- 文件夹层级不再产生场景，也不会创建/复用任何场景；
- 任一技能 frontmatter 校验失败（缺 name、name 非法、缺 description）则**整体拒绝**，逐条给出原因；
- 同名技能原地覆盖（保留使用历史），预览与响应中报告覆盖清单；
- 技能文件夹之外的散文件进入忽略清单；
- 上传成功的技能处于**未分类**状态：管理 UI「未分类」分组可见，但网关发现（browse/find）不返回；
- ZIP 上传已移除，只接受文件夹上传。

## 整理（Agent 整理会话）

上传成功后网关自动开启一个**技能分类**会话（侧边栏可见、可打断、完成后保留），Agent 把每个技能挂到最合适的场景；没有合适场景时创建带详细描述的新场景。整理会话结束后，侧边栏「整理」标签页展示**整理报告卡片**（改动摘要 + 冲突/重复清单 + 覆盖清单）与两个回滚入口。

用户可手动触发：

- **一键整理**：Agent 对整棵场景树整理边界、删除多余场景、归类未分类技能，并给出冲突与重复清单；
- **冲突检测**：只读会话，检测内容高度相似的重复技能、语义重叠的场景、挂载过散的技能，不改动场景树。

**回滚**：每次上传与每次整理（自动分类 / 一键整理）开始前各自打快照（两个槽位各自保留最近一份）。整理回滚只还原场景树；上传回滚额外删除本批新增技能文件并恢复被覆盖技能的原文件。回滚前 UI 会明确提示「将还原到操作前的整棵树」。

**组织工具**：整理会话中的 Agent 通过 `skill_organize` 工具修改场景树（createScene / updateScene / deleteScene / moveScene / attachSkill / detachSkill），技能文件与技能描述只读，技能删除仅用户可操作。同一仓库同一时间只允许一个整理会话。

## 数据落点

默认 `<工作目录根>/.skillgate/`：

```
catalog.json            # 单根场景树 + 技能元数据
usage.json              # { skillName, source, scenePath?, timestamp, sessionId }
config.json             # { enabled: true }
organize-report.json    # 最近一份整理报告
snapshots/              # 上传/整理两个回滚槽位（含被覆盖技能原文件备份）
skills/<skill-name>/    # 一个文件夹 = 一个技能
```

工作目录根下的 `.skillgate-anchor` 可写一行路径指向自定义位置；换址时先复制数据、再更新锚点、最后删除旧目录，统计不丢失。
