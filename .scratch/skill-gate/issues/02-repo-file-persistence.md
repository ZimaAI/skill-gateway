# 02 — 仓库文件持久化

**What to build:** 从数据目录(默认工作目录根 `.skillgate/`,锚点文件可自定义 + 换址迁移)读写 catalog/usage/config,跨重启存活。

**Blocked by:** 01 — 核心领域模块 + 测试

**Status:** ready-for-agent

- [ ] 目录默认为工作目录根 `.skillgate/`;锚点文件可指向自定义位置,缺省回落默认。
- [ ] catalog、usage、config 可写入并读回,结构与核心模块一致。
- [ ] 换址时迁移现有数据,统计不丢失。
- [ ] 写入 → 重启 → 读回一致。
- [ ] 并发/重复写不损坏数据(合并或加锁策略)。
