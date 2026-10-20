---
name: vscode-webview
description: 编写 Webview、Webview View 或自定义编辑器时使用
globs: [src/**/webview/**, src/**/*Panel.ts, src/**/*View.ts, media/**]
alwaysApply: false
---

# Webview 约定

- 必须设置 CSP（`default-src 'none'`），脚本用 nonce；`localResourceRoots` 只放必要目录；资源用 `asWebviewUri`。
- 扩展与 Webview 的消息用带判别字段（`type`）的联合类型，两端共享类型定义，并校验输入。
- UI 组件不使用已弃用的 `@vscode/webview-ui-toolkit`（2025-01-06 起停止维护），改用 `@vscode-elements/elements` 或 `--vscode-*` CSS 变量。
- 面板关闭时释放资源（`onDidDispose`）；需要保持状态时用 `getState/setState`，不要滥用 `retainContextWhenHidden`。
