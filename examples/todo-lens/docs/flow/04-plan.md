---
stage: 04-plan
status: done
mode: brownfield
inputs: [docs/flow/01-analysis.md, docs/flow/01b-impact.md]
updated: 2026-10-19
---

# 04 实现计划：按标签筛选

**范围**：只实现 P-1、P-2、P-3（之后追加了 P-6、P-7）。P-4、P-5 已驳回，**不做**。
**白名单（allowed_files）**：`src/todoTree.ts`、`package.json`、`src/extension.ts`，后来追加了 `src/scanner.ts`、`test/scanner.test.ts`。

## 任务清单
- [x] T-1（P-2）在 package.json 中新增 `todoLens.filterByTag` 命令和 view/title 菜单（验证：`tsc`；手动查看标题栏图标）
- [x] T-2（P-1）todoTree：`tag` 字段、`filter`、`setFilter`、`countsByTag`，以及 `getChildren` 的筛选（验证：`tsc`）
- [x] T-3（P-3）extension：`createTreeView`、`pickTag`、注册命令（验证：`tsc`、集成测试）
- [x] T-4（P-6、P-7，追加）抽出 `filterByTag` 并补单测（验证：`npm run test:unit`）
- ~~T-x（P-4）状态栏~~：已驳回，不做 · ~~T-y（P-5）持久化~~：已驳回，不做

## 命令
编译 `npm run compile` · 单测 `npm run test:unit` · 集成 `npm test`

## 偏差
- **11:38 ⛔ 暂停**：实现 T-2 时发现，`todoTree.ts` 依赖 vscode，筛选逻辑没法单测。需要修改白名单之外的 `src/scanner.ts` 和 `test/scanner.test.ts`，因此暂停，并在 01b 中追加 P-6、P-7 → 11:41 用户回复「通过 6,7」后继续。

## 实施记录
| 时间 | 任务 | 结果 |
|---|---|---|
| 11:33 | T-1 | `tsc` 通过 |
| 11:38 | T-2 | ⛔ 暂停（见"偏差"） |
| 11:43 | T-4 → T-2 | `node --test out/test/`：5/5 通过（新增 1 个用例） |
| 11:46 | T-3 | `tsc` strict 下 0 个错误 |
| 11:47 | 范围核对 | 见下表，✅ |

## 按点变更摘要
完整 diff：[04-changes.diff](./04-changes.diff)

| 点 | 决定 | 实际修改（新行号） | 与预览差异 | 验证 |
|---|---|---|---|---|
| P-1 | ✅ | [src/todoTree.ts#L22-L33](../../src/todoTree.ts#L22-L33) 新成员；[#L41-L47](../../src/todoTree.ts#L41-L47) `getChildren` | 筛选改为调用 P-6 的 `filterByTag()`；因此 **L2 的 import 多改了一处**（同一文件、同一意图，按规则允许，在此注明） | 单测（P-7）+ 手动 |
| P-2 | ✅ | [package.json#L42-L67](../../package.json#L42-L67) | 无（格式按多行展开） | `tsc`；需手动查看图标 |
| P-3 | ✅ | [src/extension.ts#L51-L71](../../src/extension.ts#L51-L71) | 无 | `tsc`；集成测试需在本机运行 |
| P-4 | ❌ | 未修改，[src/extension.ts#L19-L23](../../src/extension.ts#L19-L23) 与 baseline 一致 | — | diff 中这一段没有变化 ✅ |
| P-5 | ❌ | 未修改，`activate` 开头（L14-L17）与 baseline 一致；全仓库中没有 `workspaceState` | — | grep ✅ |
| P-6 | ✅ | [src/scanner.ts#L37-L41](../../src/scanner.ts#L37-L41) | 无 | 单测 |
| P-7 | ✅ | [test/scanner.test.ts#L4](../../test/scanner.test.ts#L4)、[#L28-L35](../../test/scanner.test.ts#L28-L35) | 无 | 5/5 通过 |

**范围核对**：改动文件 {package.json, src/extension.ts, src/scanner.ts, src/todoTree.ts, test/scanner.test.ts} ⊆ allowed_files ✅ · 没有新建文件 ✅
