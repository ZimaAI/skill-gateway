# skill-gateway

一个面向 DeepSeek Harness 的「技能工具网关」插件：把海量技能按**场景**组织成一棵**场景树**，Agent 只能通过 `skill_gateway` 工具按目的、渐进式地取用技能，并持久化记录**会话内使用记录**与**全局统计**。

## 仓库结构

```
packages/
  core/         纯函数核心（无 DSH/Cordis 依赖，输入输出为纯 JSON）
  repo-store/   仓库文件持久化（.skillgate/，锚点换址，并发合并）
  dsh-plugin/   DeepSeek Harness 动态插件（Host 工具/观察器 + Client 面板）
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

- core：场景树 CRUD、find/browse/load、上传校验、使用聚合；
- repo-store：默认/锚点数据目录、重启读回、并发追加合并、换址迁移；
- dsh-plugin：网关服务编排、ZIP 解析。

## 核心契约

`skill_gateway` 工具提供三个 action：

| action | 输入 | 输出 |
| --- | --- | --- |
| `find` | `purpose` | 命中场景路径 + 该子树递归收集的技能元数据（去重、分组） |
| `browse` | `sceneId?` | 一个场景节点的 `{ name, description, tags, children, skills }` |
| `load` | `skillName, scenePath?` | 技能文件夹 `{ 相对路径: 文件内容 }`，并记录一条 `gateway` 使用 |

## 数据落点

默认 `<工作目录根>/.skillgate/`：

```
catalog.json            # 单根场景树 + 技能元数据
usage.json              # { skillName, source, scenePath?, timestamp, sessionId }
config.json             # { enabled: true }
skills/<skill-name>/    # 一个文件夹 = 一个技能
```

工作目录根下的 `.skillgate-anchor` 可写一行路径指向自定义位置；换址时先复制数据、再更新锚点、最后删除旧目录，统计不丢失。
