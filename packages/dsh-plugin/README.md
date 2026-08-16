# skill-gateway-dsh

DeepSeek Harness 动态插件：把仓库中的技能组织为场景树，通过 `skill_gateway`
工具渐进式发现和加载技能，并持久化记录会话内与仓库级技能使用统计。
上传只收集技能，场景归类交给可见的 Agent 整理会话，每次整理可一键回滚。

## 模块

- `@skill-gate/core`：纯函数核心（场景树 CRUD、browse/load、仅收集技能的上传、未分类查询、组织工具校验、快照/回滚语义、使用聚合）。
- `@skill-gate/repo-store`：仓库文件持久化（默认 `<cwd>/.skillgate/`，支持锚点换址；上传/整理快照槽位与回滚）。
- `skill-gateway-dsh/src/host.js`：DSH Host 适配器（工具注册、提示词、观察器、JSON 路由）。
- `skill-gateway-dsh/src/organize-prompts.js`：三种整理模式的提示词与报告提取（纯函数）。
- `skill-gateway-dsh/src/organize-session.js`：整理会话启动器（`agents.create` + `followup` + `whenIdle`）、互斥、`skill_organize` 工具。
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

## 上传（仅收集技能）

`POST /skill-gateway/upload` 接收 `{ cwd?, item: { name, files: [{ path, content }] } }`。
递归收集所选文件夹下的每一个技能（含直接 `SKILL.md` 的文件夹整体为一个技能，子树资源全部保留）；
文件夹层级不再产生场景。任一技能校验失败则整体拒绝；同名技能原地覆盖并保留
使用历史；散文件进入忽略清单。上传成功后自动开启「技能分类」整理会话。

预览：`POST /skill-gateway/upload/preview`。

## 会话配置

会话配置按工作区持久化在 `config.json` 的 `session` 字段中：

```json
{
  "enabled": true,
  "session": {
    "mode": "standard",
    "provider": "deepseek",
    "model": "deepseek-chat",
    "reasoningEffort": "high",
    "permission": "workspace-write"
  }
}
```

四个字段留空均表示“跟随部署默认”。`mode` 是 Agent 预设 id（标准 / PTC /
极简 / 创造等模式）；`provider` 与 `model` 必须同时填写或同时留空；
`reasoningEffort` 是模型适配器提供的推理等级 id；`permission` 是权限预设 id
（同时决定沙箱模式与审批策略）。

HTTP 路由：

- `GET /skill-gateway/session-config/options`：读取可选的模式 / 权限 / 模型提供方选项与当前默认模型；
- `GET /skill-gateway/session-config/models?provider=...`：读取提供方模型列表；
- `GET /skill-gateway/session-config/model-info?provider=...&model=...`：读取模型可选推理等级；
- `POST /skill-gateway/session-config` `{ cwd?, session }`：保存并校验工作区会话配置。

## 整理会话

- `POST /skill-gateway/organize/trigger` `{ mode: 'full' | 'detect' }`：一键整理 /
  冲突检测（只读）。同一仓库同一时间只允许一个整理会话。
- `POST /skill-gateway/organize/rollback` `{ slot: 'upload' | 'organize' }`：回滚。
  整理回滚仅还原场景树；上传回滚还删除本批新增技能文件、恢复被覆盖技能原文件。
- `GET /skill-gateway/organize/report` / `GET /skill-gateway/organize/status`。
- 整理会话中的 Agent 通过 `skill_organize` 工具修改场景树（createScene /
  updateScene / deleteScene / moveScene / attachSkill / detachSkill）；
  技能文件与技能描述只读，技能删除仅用户可操作。工具只挂载进整理会话的 agent 作用域。

## 侧边栏页面

页面按 `prototype/version2` 的 Skill Gateway 侧边栏与
`docs/style/deepseek/design.md` 设计规范实现：

- 场景树管理：场景树 / 全部技能双视图、搜索、场景 CRUD、技能多场景挂载、技能文件预览、未分类分组。
- 上传：文件夹选择、成功/失败示例、技能视角的校验预览（覆盖/忽略清单）；上传成功后提供「打开整理会话」。
- 整理：一键整理 / 冲突检测入口（会话进行中禁用）、最近一份整理报告卡片、上传/整理回滚（确认整树还原范围）；
  整理会话创建在**当前工作区**（与仓库路径匹配的工作区）中，而不是「未分组」。
- 统计：会话时间线与仓库级按技能 / 按场景聚合，支持 gateway / agent-skills 来源过滤。
- 网关取用：逐层 browse 演示；按需求管理页不提供“加载全文”，
  技能全文仍由 Agent 通过 `skill_gateway(action: "load")` 取用。
- 会话配置：为当前工作区配置整理会话采用的 Agent 模式（预设）、模型提供方 /
  模型、模型推理等级与权限预设。保存后，上传成功后自动开启的技能分类会话、
  一键整理与冲突检测会话都按该配置创建；留空字段表示跟随部署默认。
- 侧边栏左边缘可拖拽调整宽度（360px ~ 760px），双击恢复 440px；宽度会保存在浏览器本地。

## 数据落点

默认在 `<工作目录根>/.skillgate/`：

```
catalog.json            # 场景树 + 技能元数据
usage.json              # 会话内/跨会话使用记录
config.json             # { enabled: true, session: { mode, provider, model, reasoningEffort, permission } }
organize-report.json    # 最近一份整理报告
snapshots/upload.json   # 上传槽位快照（catalog + 批次清单）
snapshots/organize.json # 整理槽位快照（catalog）
snapshots/<slot>/overwrites/<skill>/   # 被覆盖技能的原文件备份
skills/<skill-name>/    # 一个文件夹 = 一个技能
```

工作目录根下的 `.skillgate-anchor` 文件可写一行路径指向其他数据目录；
插件会先复制再更新锚点并删除旧目录，统计不丢失。
