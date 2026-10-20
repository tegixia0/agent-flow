---
name: flow-handoff-format
description: 
globs: docs/flow/**
alwaysApply: false
---

# 交接文件格式（docs/flow/**）

- 每个文件开头都有 YAML frontmatter：`stage`、`status`（draft | approved | changes-requested | done）、`inputs`、`updated`（YYYY-MM-DD）；`00-requirement.md` 中还有 `mode`（greenfield | brownfield）。
- 编号：`US-x` 用户故事 · `AC-x` 验收标准 · `P-x` 改动点（01b）· `ADR-x` 设计决策 · `T-x` 任务 · `R-x` 评审问题。
- 代码位置使用**相对于本文件**的可点击链接：`[src/a.ts#L10-L30](../../src/a.ts#L10-L30)`。
- 01b 中的代码摘录必须逐字复制、标注行号区间，并且不超过 15 行；改动预览使用 ```diff 代码块。
- 01b frontmatter 中的 `approved`、`rejected`、`pending`、`allowed_files` 要与正文清单保持一致。
- 不要粘贴完整日志；单个 .md 文件尽量控制在 200 行以内（01b 可以适当放宽）。
- mermaid 节点 id 用英文，中文文字放在 `["…"]` 里。
