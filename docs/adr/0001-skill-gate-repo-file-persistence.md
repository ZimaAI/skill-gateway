# skill-gate 数据落仓库文件而非 DSH storage/设置

场景树、技能内容与使用统计是 skill-gate 的持久数据。我们决定把它们落成仓库内文件(默认 `<工作目录根>/.skillgate/`,位置可自定义),而不是 DSH 的 storage domain 或 settings 服务;理由是这些数据天然按仓库隔离、需可审查、可随仓库 git 走。

## Considered Options

- **仓库内文件(选定)**:按 workspace 隔离、git 可跟踪、跨会话/跨重启稳定;代价是自管读写与并发、需自行版本化。
- **DSH storage domain**:进程外持久化,但数据不进仓库、不可 git 审查,且按 workspace 分域需额外约定。
- **仅内存**:动态插件生命周期内存在,重启即失,不满足"全局统计"的持久要求。

## Consequences

- 数据格式需自设 schema + version 字段,未来演进需迁移。
- 多会话并发写 `usage.json` 需合并/加锁策略。
