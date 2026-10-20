---
name: flow-design
description: 流程阶段 2：技术与交互设计。基于已确认的需求分析，产出架构、模块划分、数据模型、接口与事件、交互流程（mermaid）、技术选型取舍，输出 docs/flow/02-design.md。当编排器进入阶段 2，或用户要求"出设计""做技术方案""画架构"时使用。
license: MIT
metadata:
  kit: agent-workflow-kit
  stage: "2"
---

# 阶段 2：设计

## 输入
- `docs/flow/01-analysis.md`（必需，且必须是 `status: approved`，否则停止并提醒用户）
- `docs/flow/00-requirement.md`
- `AGENTS.md` 和现有代码结构：只看目录树与关键入口文件，例如 `package.json`、`src/extension.ts`、`app/layout.tsx`
- 需要查询库或 API 用法时：优先使用项目里随包附带的文档，其次 Context7 MCP / `ctx7`，不要凭记忆写 API 签名

## 输出
- `docs/flow/02-design.md`，按 `assets/template.md` 的结构，`status: draft`

## 步骤
1. 设计概览：用 1 张 mermaid `flowchart` 或 `sequenceDiagram` 说明主要组件和数据流。
2. 模块划分：列出要**新增或修改**的文件路径及各自的职责（这是阶段 4 的输入）。
3. 数据模型与接口：TypeScript 类型或接口定义（只写签名），以及事件和消息协议（例如 webview 的 `postMessage` 消息类型）。
4. 关键决策：至少写 1 条 ADR，格式为"选项 A / B → 选择 → 理由 → 代价"。
5. 验收映射：说明每个 `AC-x` 由哪个模块或机制满足，确保没有遗漏的 AC。
6. 平台要点：参见本文件末尾的「技术栈补充」（由已启用的 pack 注入）；没有 pack 时，按项目现有约定说明构建方式、运行时边界、需要释放的资源和安全要点。
7. 测试策略：哪些写单元测试，哪些写集成测试，哪些做端到端测试（具体工具见「技术栈补充」）。

## 质量清单
- [ ] 每个 AC 都有对应的实现位置
- [ ] 新增依赖都说明了必要性；能不加依赖就不加
- [ ] 文件路径真实可落地，与现有目录约定一致
- [ ] mermaid 语法可以正常渲染（节点 id 不含空格，中文放在 `["…"]` 里）

## 不要做
- 不写实现代码（类型签名除外），不改 `src/`。
