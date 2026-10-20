---
name: flow-sketch
description: 流程阶段 3：设计草图与原型。根据已确认的设计，产出 ASCII 线框图和 mermaid 交互流程（03-sketch.md），并可选输出一个可直接在浏览器打开的单文件 HTML 原型（03-sketch.html，可模拟 VS Code 主题）。当编排器进入阶段 3，或用户要求"画草图""出线框图""做原型""mockup"时使用。
license: MIT
metadata:
  kit: agent-workflow-kit
  stage: "3"
---

# 阶段 3：草图 / 原型

## 输入
- `docs/flow/02-design.md`（必需，`status: approved`）
- `docs/flow/01-analysis.md`（用于引用 AC 编号）

## 输出
- `docs/flow/03-sketch.md`（必需）：ASCII 线框图、状态说明、mermaid 状态图或流程图
- `docs/flow/03-sketch.html`（可选）：在以下情况输出——界面中有 Webview 或网页；有 3 个以上的界面状态；或用户要求可点击的原型。以 `assets/prototype-template.html` 为基础
- 两者的 frontmatter 或注释中都写 `status: draft`

## 步骤
1. 列出界面清单：每个视图或面板、命令面板项、通知和状态栏项。
2. 为每个界面画 ASCII 线框图（宽度 ≤ 72 列），并标注会引用的 `AC-x`。
3. 画出**状态**：空状态、加载中、正常、错误、无权限或大数据量。每个状态一个小线框，或一句文字说明。
4. 用 mermaid `stateDiagram-v2` 或 `flowchart` 画交互路径。
5. 如需 HTML 原型：
   - 只用一个 HTML 文件，不引用外部 CDN，也不使用构建工具，双击即可打开。
   - 颜色全部使用 `var(--vscode-*)` 变量，模板里已经提供了 Dark+ 主题的近似回退值，这样原型可以直接搬进 Webview。
   - 用少量原生 JS 模拟状态切换（顶部提供"状态切换"按钮），不要写真实的业务逻辑。
   - 如果有 Playwright MCP / `playwright-cli` 可用，可以截一张图，附在 03-sketch.md 末尾；不可用就跳过。
6. 列出"草图里刻意没画的东西"，避免实现阶段误解。

## 质量清单
- [ ] 每个 AC 至少出现在一个线框图或状态里
- [ ] 错误态和空态都已覆盖
- [ ] HTML 原型可以离线打开，没有控制台报错

## 不要做
- 不改 `src/`；原型代码不是生产代码，阶段 4 不能直接照搬原型里的 JS。
