# skill-gateway 插件原型（一次性）

`index.html` 是一个自包含、双击即可运行的 HTML 原型，模拟 DeepSeek Harness 中 skill gateway 插件的完整工作流。它不是生产代码，状态只存在内存里，刷新即重置。

## 运行

```bash
# 方式一：直接双击 prototype/index.html
# 方式二：
python3 -m http.server 8000 --directory prototype
# 浏览器打开 http://127.0.0.1:8000/index.html
```

## 原型问题

在真实 Harness 密度下，侧边栏入口 + 「场景树管理」 + 「统计」两个 tab 的工作流是否顺手？网关工具 find / browse / load 的渐进式取用和 usage observer 能否被非开发者看懂？

因为 brief 已经把面板结构写死（issue 03 / issue 06），这里采用 UI 分支的**单一功能候选**，而不是多方案比稿；核心逻辑以纯函数形式写在页面内，方便验证后提走。

## 覆盖的需求

- 侧边栏底部入口 + 面板（场景树管理 / 统计 / 网关三个 tab，网关 tab 用于原型演示工具调用）。
- 场景树：单根、不限深度、子场景与直接技能并存、一个技能多父挂载。
- 上传：文件夹（webkitdirectory）与 zip（内置最小解析器），根 SKILL.md 校验、逐条原因、同名更新二次确认。
- 删除：技能全场景解链 + 移除文件 + 保留历史统计；场景级联删除子场景但只解链技能。
- 网关：find（场景主匹配、技能次级匹配）→ browse → load，渐进式加载；load 记录 source=gateway。
- 统计：会话时间线、全局按技能 / 按场景聚合、来源过滤；模拟 harness 默认 skill 调用记录 source=agent-skills。
- 开关：OFF 时工具与提示词消失，默认技能旁路和统计观察器继续运行。
- 数据落点：展示默认 `.skillgate/` 与锚点迁移说明；原型本身不写文件。
- 面板顶部的双路由信号条是签名元素：网关开关、默认技能旁路、usage observer 恒开一眼可读。

## 边界

- 状态仅存内存，不实现 ADR-0001 的文件持久化与并发合并。
- zip 解析支持标准 ZIP（store / deflate），不支持 zip64 和加密 zip。
- 上传的真实文件读取依赖浏览器 File API；旧浏览器请用「导入示例技能」体验流程。
