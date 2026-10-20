---
stage: 05-review
status: approved
mode: brownfield
inputs: [docs/flow/01-analysis.md, docs/flow/01b-impact.md, docs/flow/04-plan.md, docs/flow/04-changes.diff]
updated: 2026-10-19
---

# 05 评审：按标签筛选

## 结论
**通过（附 1 条建议）**：范围核对全部通过，没有 🔴 问题。建议在发布前修复 R-1（🟡）。按照你的决定，AC-4 和 AC-5 没有实现。

## 范围核对
| 检查 | 结果 |
|---|---|
| 改动文件 ⊆ allowed_files | ✅ 5/5 |
| 被驳回的 P-4、P-5 未被修改 | ✅ `src/extension.ts` L14-L23 与 baseline 一致；仓库中没有 `workspaceState` |
| 按点变更摘要覆盖了 P-1…P-7 | ✅ |
| 实现中途追加的点都经过审批 | ✅ P-6、P-7（11:41） |

## AC 核对
| AC | 结论 | 证据 |
|---|---|---|
| AC-1 | ✅ | `package.json` L48-L52、L61-L65；`src/extension.ts` L53-L64 |
| AC-2 | ✅ | `src/todoTree.ts` L44-L45；`test/scanner.test.ts` L29-L35 |
| AC-3 | ✅ | `src/extension.ts` L62 设置了 `view.description` |
| AC-4 | ➖ 按决定不实现 | 01b 中 P-4 被驳回 |
| AC-5 | ➖ 按决定不实现 | 01b 中 P-5 被驳回 |

## 问题清单
| 编号 | 级别 | 位置 | 问题 | 建议 |
|---|---|---|---|---|
| R-1 | 🟡 | `package.json` L36-L41（viewsWelcome）+ `src/todoTree.ts` L45 | 筛选结果为空时，视图会显示"当前工作区没有找到 TODO / FIXME 注释"，这会误导用户。该位置在 01b 中列为"未触及"，所以本次没有修改，符合范围 | 下一轮作为新的改动点：用 `setContext('todoLens.filtered', …)`，并为 viewsWelcome 增加一条带 `when` 条件的"当前筛选无结果，[清除筛选]"文案 |
| R-2 | 🔵 | `src/extension.ts` L78-L80 | 当关键字配置中删除了当前筛选的标签时，筛选不会自动清除，列表会变空 | 在 `onDidChangeConfiguration` 中，如果 `tree.filter` 不在新关键字中，就调用 `setFilter(undefined)` |

## 下一步
- 回复「通过」：流程结束，然后归档 docs/flow。
- 想现在修复 R-1：回复「回到 1b：修复 R-1」。R-1 会作为新的改动点重新定位并审批，**不会**直接修改代码。
