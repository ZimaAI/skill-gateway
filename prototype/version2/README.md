# Skill Gateway 页面原型 v2

一个自包含的 DeepSeek Harness 插件页面原型，模拟右侧 **Skill Gateway 侧边栏**的完整工作流。视觉与组件严格遵循 `docs/style/deepseek/design.md`。

## 运行

```bash
# 方式一：直接双击 prototype/version2/index.html
# 方式二：
python3 -m http.server 8000 --directory prototype/version2
# 浏览器打开 http://127.0.0.1:8000/
```

原型状态只存在内存里，刷新即重置；不读写真文件、不调用任何后端路由。

## 文件

```
prototype/version2/
  index.html   页面骨架与 DSH 外壳
  styles.css   design.md 设计 token 与组件样式
  app.js       内联纯函数核心 + 交互逻辑
  README.md
```

## 覆盖的需求

- **场景树管理**：单根、不限深度；创建/编辑/删除场景；子场景级联删除、技能只解链；一个技能多父挂载。
- **全部技能**：技能列表、挂载到任意场景、详情与文件预览、删除技能（全场景解链 + 移除文件 + 保留历史统计）。
- **上传场景树**：文件夹选择（`webkitdirectory`）、按是否含直接 `SKILL.md` 识别场景与技能、frontmatter 校验（name 匹配 `[a-z0-9][a-z0-9-]*`、description 非空）、逐条错误原因、同名技能原地更新。
  - 浏览器不支持文件夹选择时，可用「载入成功示例 / 载入校验失败示例」体验流程。
- **网关取用**：模拟 Agent 逐层 `browse(sceneId?)` → `load(skillName, scenePath?)`；load 返回技能文件夹全文并记录 `source=gateway` 使用。
- **网关开关**：OFF 时工具与系统提示词卸下、网关取用 tab 展示关闭错误；统计观察器恒生效。
- **统计**：会话内使用时间线（时间 / 技能 / 来源 / 场景路径）、仓库级按技能与按场景聚合（次数 / 占比 / 最近使用）、来源过滤 `gateway` / `agent-skills`。
- **数据落点**：默认 `.skillgate/`，展示 `catalog.json / usage.json / config.json / skills/` 结构与迁移入口（原型只切换状态）。

## 设计规范落地

- 4px 基础栅格，主色 `#165DFF`，主色浅背景 `#E8F3FF`，主色渐变按钮。
- 成功 / 警告 / 错误辅助色与对应浅色徽章底。
- 中性色、字体栈、字号字重均按 `docs/style/deepseek/design.md` 定义为 CSS 变量。
- 组件规则：胶囊分段控件、卡片、侧边导航栏、表格、弹窗、表单校验、Toast、空状态、进度条、徽章。

## 原型边界

- 不实现 ADR-0001 的真实文件持久化、并发合并与换址迁移；只做界面状态演示。
- 不实现真实 DSH RPC / `shell.overlay` 注册；页面外壳仅用于呈现插件上下文。
- 上传读取依赖浏览器 File API，大文件未做分片或占位处理。
- 不包含 `find` action；与当前 HEAD 的 `skill_gateway` 工具契约一致，仅提供 `browse` / `load`。
