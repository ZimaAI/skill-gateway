# 02 — 仓库文件持久化

**What to build:** 从数据目录(默认工作目录根 `.skillgate/`,锚点文件可自定义 + 换址迁移)读写 catalog/usage/config,跨重启存活。

**Blocked by:** 01 — 核心领域模块 + 测试

**Status:** ready-for-agent

- [x] 目录默认为工作目录根 `.skillgate/`;锚点文件可指向自定义位置,缺省回落默认。
- [x] catalog、usage、config 可写入并读回,结构与核心模块一致。
- [x] 换址时迁移现有数据,统计不丢失。
- [x] 写入 → 重启 → 读回一致。
- [x] 并发/重复写不损坏数据(合并或加锁策略)。

## Comments

实现于 `packages/repo-store/`：

- 默认 `<cwd>/.skillgate/`，`.skillgate-anchor` 锚点可指向自定义位置。
- catalog.json / usage.json / config.json / skills/<name>/ 原子写入（temp + rename）。
- usage 追加按记录 id 合并 + 短锁，重复/并发写入不丢数据。
- `relocate()` 先复制、再更新锚点、最后删旧目录，统计与技能文件保留。
- `test/repo-store.test.js` 覆盖重启读回、并发追加与换址迁移。
