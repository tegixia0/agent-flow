---
name: vscode-extension
description: 编写或修改 VS Code 扩展代码（src/**/*.ts、package.json 的 contributes）时使用
globs: [src/**/*.ts, package.json]
alwaysApply: false
---

# VS Code 扩展约定

- 所有命令、监听器、Provider、Watcher 都要 `context.subscriptions.push(...)`，不能泄漏 Disposable。
- `package.json` 的 `contributes`（commands、views、configuration、menus）与代码中的注册必须一一对应；命令 id 统一前缀。
- 激活事件尽量精确；VS Code 1.74+ 已根据 contributes 自动生成命令/视图的激活事件，不要再手写 `*`。
- 读取配置用 `workspace.getConfiguration('<前缀>')`，并监听 `onDidChangeConfiguration`。
- 文件扫描用 `workspace.findFiles` 并尊重 `files.exclude`；大仓库要可取消（CancellationToken）。
- 不使用 `any`；`tsconfig` 开启 `strict`。
