---
stage: 05-review
status: approved
inputs: [docs/flow/01-analysis.md, docs/flow/02-design.md, docs/flow/04-plan.md, git diff]
updated: 2026-10-19
---

# 05 评审：TODO Lens

## 结论
**通过（附建议）**：没有 🔴 问题。发布到 Marketplace 之前，建议先修复 R-1、R-2（🟡），R-3、R-4 可以放到下一个版本。

## AC 核对
| AC | 结论 | 证据 |
|---|---|---|
| AC-1 | ✅ | `src/extension.ts:39-41` 用 findFiles 扫描并解析；`src/todoTree.ts:31` 按路径排序分组；集成测试 `命令已注册` |
| AC-2 | ✅ | `src/todoTree.ts:50` 中的 `vscode.open` 加 `selection`；需要手动验证 |
| AC-3 | ✅ | `src/extension.ts` 的 `updateStatus`，`status.command` 打开视图容器；需要手动验证 |
| AC-4 | ✅ | `src/extension.ts:56-60` 只对单个文件调用 `setFile`；需要手动验证 1 秒内完成 |
| AC-5 | ✅ | `src/extension.ts:63` 在配置变更时重扫；`test/scanner.test.ts` 有 4 个用例通过 |
| AC-6 | ✅ | `package.json` 中的 `viewsWelcome`；`src/extension.ts` 中 `files.length >= maxFiles` 时警告 |

## 问题清单
| 编号 | 级别 | 位置 | 问题 | 建议 |
|---|---|---|---|---|
| R-1 | 🟡 | `src/extension.ts:41` | `Promise.all` 会同时读取最多 2000 个文件，大仓库会出现 IO 和内存峰值；大文件也会被整份读入 | 改成分批并发（例如每批 50 个），并先用 `workspace.fs.stat` 跳过大于 1 MB 的文件 |
| R-2 | 🟡 | `src/extension.ts:63` | 编辑 settings.json 时可能连续触发多次配置变更，多个 `scanAll` 并发执行，`tree.clear()` 和写入交错，结果可能残缺 | 加 300ms 防抖，或用递增的 scanId，只保留最后一次扫描的结果 |
| R-3 | 🔵 | `src/scanner.ts:15` | 关键字以非单词字符开头或结尾时（例如 `@todo`、`C++`），`\b` 导致永远匹配不到；用户配置后没有任何提示 | 改用 `(?<![\w])`/`(?![\w])` 断言，或在配置说明中注明"仅支持单词字符" |
| R-4 | 🔵 | `src/extension.ts:39` | `'**/*'` 会把图片和二进制文件也读入并按 UTF-8 解码，浪费资源 | 在 exclude 中默认加入常见的二进制扩展名，或检测到 NUL 字节就跳过 |

## 测试评估
- 单测覆盖了 AC-5 的解析逻辑，断言的是真实行为（行号、列号、文本）✅
- AC-2、AC-3、AC-4 只有手动验证。建议补一个集成测试：打开 fixture 工作区 → 保存文件 → 断言 `tree.total` 变化（需要从 `activate` 返回 API 才能测试）
- 集成测试在示例环境中没有运行，合入前请在本机运行 `npm test`

## 下一步
- 如果接受评审：回复「通过」，流程结束，把 `docs/flow/` 归档。
- 如果要先修 R-1、R-2：回复「回到 4：修复 R-1 R-2」。flow-implement 会在 04 的实施记录中追加修复记录，然后重新评审。
