第 6 步「平台要点」补充：

   - **VS Code 扩展**：说明 `contributes`（commands、views、configuration）、激活事件、需要释放的资源（Disposable）；Webview 的 CSP/nonce、`localResourceRoots`；UI 组件不使用已弃用的 `@vscode/webview-ui-toolkit`，改用 `@vscode-elements/elements` 或 `--vscode-*` CSS 变量。
第 7 步「测试策略」按此执行：

7. 测试策略：哪些写单元测试，哪些用 `@vscode/test-cli` 写集成测试，哪些用 Playwright 做端到端测试。
