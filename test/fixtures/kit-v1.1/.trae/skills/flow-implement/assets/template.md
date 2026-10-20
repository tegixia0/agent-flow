---
stage: 04-plan
status: draft        # draft → approved（人工确认计划）→ done（实现完成）
inputs: [docs/flow/01-analysis.md, docs/flow/02-design.md, docs/flow/03-sketch.md]   # 存量模式：[01-analysis.md, 01b-impact.md]
mode: greenfield    # greenfield | brownfield
updated: YYYY-MM-DD
---

# 04 实现计划：<功能名>

## 任务清单
- [ ] T-1 <任务>（文件：…；AC：…；验证：…）

## 命令
- 编译：`…`  测试：`…`

## 偏差
（无）

## 实施记录
| 时间 | 任务 | 结果 |
|---|---|---|

## 按点变更摘要（仅存量模式）
| 点 | 决定 | 实际修改（链接到新代码） | 与预览差异 | 验证 |
|---|---|---|---|---|
| P-1 | ✅ | [src/a.ts#L10-L34](../../src/a.ts#L10-L34) | 无 | 单测 … |
| P-2 | ❌ | 未修改 | — | `git diff` 中该区间无变化 |

**范围核对**：`git diff --name-only <baseline>` 的结果 = {…} ⊆ allowed_files {…} ✅
