# skill-gateway-dsh

DeepSeek Harness 动态插件：把仓库中的技能组织为场景树，通过 `skill_gateway`
工具渐进式发现和加载技能，并持久化记录会话内与仓库级技能使用统计。

## 模块

- `@skill-gate/core`：纯函数核心（场景树 CRUD、browse/load、场景树上传合并、使用聚合）。
- `@skill-gate/repo-store`：仓库文件持久化（默认 `<cwd>/.skillgate/`，支持锚点换址）。
- `skill-gateway-dsh/src/host.js`：DSH Host 适配器（工具注册、提示词、观察器、JSON 路由）。
- `skill-gateway-dsh/client/client.js`：DSH Web 右侧 Skill Gateway 侧边栏（shell.overlay）。
- `skill-gateway-dsh/client/logo.svg`：Skill Gateway 产品 Logo（场景树 + 网关 + skill）。

## 安装与挂载

```bash
dsh plugin add skill-gateway-dsh
```

或手动挂载：

```yaml
- insert:
    - id: skill-gateway
      name: 'skill-gateway-dsh'
```

## 上传场景树

`POST /skill-gateway/scene-tree/upload`（或兼容路径 `/skill-gateway/upload`）接收
`{ cwd?, item: { name, files: [{ path, content }] } }`。所选文件夹作为场景树根目录：
没有 `SKILL.md` 的文件夹是场景，含 `SKILL.md` 的文件夹整体作为技能导入；
已有场景按路径复用，同名技能覆盖更新。ZIP 上传已移除。

## 侧边栏页面

页面按 `prototype/version2` 的 Skill Gateway 侧边栏与
`docs/style/deepseek/design.md` 设计规范实现：

- 场景树管理：场景树 / 全部技能双视图、搜索、场景 CRUD、技能多场景挂载、技能文件预览。
- 上传场景树：文件夹选择、成功/失败示例、导入前校验预览。
- 统计：会话时间线与仓库级按技能 / 按场景聚合，支持 gateway / agent-skills 来源过滤。
- 网关取用：逐层 browse 演示；按需求管理页不提供“加载全文”，
  技能全文仍由 Agent 通过 `skill_gateway(action: "load")` 取用。
- 侧边栏左边缘可拖拽调整宽度（360px ~ 760px），双击恢复 440px；宽度会保存在浏览器本地。

## 数据落点

默认在 `<工作目录根>/.skillgate/`：

```
catalog.json            # 场景树 + 技能元数据
usage.json              # 会话内/跨会话使用记录
config.json             # { enabled: true }
skills/<skill-name>/    # 一个文件夹 = 一个技能
```

工作目录根下的 `.skillgate-anchor` 文件可写一行路径指向其他数据目录；
插件会先复制再更新锚点并删除旧目录，统计不丢失。
