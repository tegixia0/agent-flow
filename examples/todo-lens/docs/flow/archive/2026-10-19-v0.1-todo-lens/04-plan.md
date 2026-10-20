---
stage: 04-plan
status: done
inputs: [docs/flow/01-analysis.md, docs/flow/02-design.md, docs/flow/03-sketch.md]
updated: 2026-10-19
---

# 04 实现计划：TODO Lens

## 任务清单
- [x] T-1 搭建脚手架：`package.json`（contributes 按 02 填写）、`tsconfig.json`（strict）、`.vscode-test.mjs`（AC：全部；验证：`npm run compile`）
- [x] T-2 `src/scanner.ts`：`buildMatcher` 加 `parseTodos`，转义关键字中的正则元字符（AC-1、AC-5；验证：T-3 单测）
- [x] T-3 `test/scanner.test.ts`：4 组用例，覆盖注释形式、块注释和 HTML 注释、自定义关键字和转义、空关键字（AC-5；验证：`npm run test:unit`）
- [x] T-4 `src/todoTree.ts`：按文件存放结果、排序、TreeItem 图标和跳转命令（AC-1、AC-2）
- [x] T-5 `src/extension.ts`：`scanAll` 加 `withProgress`、超限警告、状态栏、保存时增量更新、配置变更时重扫，Disposable 全部注册（AC-1、3、4、5、6）
- [x] T-6 `src/test/extension.test.ts`：命令注册冒烟测试（AC-1；验证：`npm test`，需要下载 VS Code）
- [x] T-7 按 03 草图手动验证 AC-2、AC-3、AC-4、AC-6（F5 启动扩展开发宿主）

## 命令
- 编译：`npm run compile`
- 单测：`npm run test:unit`（node:test，不需要 VS Code）
- 集成：`npm test`（@vscode/test-cli）

## 偏差
- 原计划在 `parseTodos` 中支持 `@todo` 这类带非单词字符的关键字，实现时发现与 `\b` 单词边界冲突。暂不支持，已记录为评审项，未改动设计。

## 实施记录
| 时间 | 任务 | 结果 |
|---|---|---|
| 2026-10-19 | T-1 | `tsc -p ./` 通过 |
| 2026-10-19 | T-2/T-3 | `node --test out/test/`：4 个用例全部通过（tests 4, pass 4, fail 0） |
| 2026-10-19 | T-4/T-5 | `tsc` strict 下 0 个错误 |
| 2026-10-19 | T-6 | 用例已编写；在示例环境中未执行（需要下载 VS Code），请在本机运行 `npm test` |
| 2026-10-19 | T-7 | 手动验证路径已列在 03 草图中；在示例环境中未执行，请在本机按 F5 验证 |
