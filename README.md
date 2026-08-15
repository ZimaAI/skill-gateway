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
  skill-gate/   领域 spec 与实现 tickets
docs/adr/       架构决策
```

## 快速开始

```bash
npm test
```

三个测试组覆盖：

- core：场景树 CRUD、browse/load、场景树上传合并、使用聚合；
- repo-store：默认/锚点数据目录、重启读回、并发追加合并、换址迁移；
- dsh-plugin：网关服务编排、场景树文件夹上传。

## 核心契约

`skill_gateway` 工具提供两个 action：

| action | 输入 | 输出 |
| --- | --- | --- |
| `browse` | `sceneId?` | 一个场景节点的 `{ name, description, tags, children, skills }`；省略 `sceneId` 返回根场景 |
| `load` | `skillName, scenePath?` | 技能文件夹 `{ 相对路径: 文件内容 }`，并记录一条 `gateway` 使用 |

## 上传场景树

侧边栏「场景树管理」可选择并上传一个场景树文件夹：

- 所选文件夹作为场景树根目录，与现有根场景合并；
- 递归扫描每个文件夹：没有 `SKILL.md` 的是场景，含 `SKILL.md` 的是技能；
- 技能文件夹的整个子树（含嵌套资源）都会作为该技能的资产导入；
- 路径重叠的已有场景直接复用，不会重复创建；同名技能由新上传内容覆盖更新；
- ZIP 上传已移除，只接受文件夹上传。

## 数据落点

默认 `<工作目录根>/.skillgate/`：

```
catalog.json            # 单根场景树 + 技能元数据
usage.json              # { skillName, source, scenePath?, timestamp, sessionId }
config.json             # { enabled: true }
skills/<skill-name>/    # 一个文件夹 = 一个技能
```

工作目录根下的 `.skillgate-anchor` 可写一行路径指向自定义位置；换址时先复制数据、再更新锚点、最后删除旧目录，统计不丢失。
