# skill-gateway-dsh

DeepSeek Harness 动态插件：把仓库中的技能组织为场景树，通过 `skill_gateway`
工具渐进式发现和加载技能，并持久化记录会话内与仓库级技能使用统计。

## 模块

- `@skill-gate/core`：纯函数核心（场景树 CRUD、browse/load、上传校验、使用聚合）。
- `@skill-gate/repo-store`：仓库文件持久化（默认 `<cwd>/.skillgate/`，支持锚点换址）。
- `skill-gateway-dsh/src/host.js`：DSH Host 适配器（工具注册、提示词、观察器、JSON 路由）。
- `skill-gateway-dsh/client/client.js`：DSH Web 右侧 Skill Gateway 侧边栏（shell.overlay）。

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
