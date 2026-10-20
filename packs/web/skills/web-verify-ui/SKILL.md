---
name: web-verify-ui
description: 用浏览器实际打开页面验证 UI：启动开发服务器，用 Playwright CLI（playwright-cli）或 Playwright MCP 访问页面、点击、截图并检查控制台错误。用户说"看看页面 / 验证 UI / 截图 / 点一下试试"时使用。
---

# 浏览器验证 UI

## 步骤

1. 启动开发服务器（`npm run dev`），记下地址；不要使用生产凭据。
2. 首选 Playwright CLI（`npm i -g @playwright/cli`，可用 `playwright-cli install --skills` 安装官方技能）；没有时用 Playwright MCP。
3. 依次访问 01-analysis.md 中验收标准涉及的页面：桌面与 390px 宽度各截一张图，记录控制台错误和失败的网络请求。
4. 把截图路径和发现写进当前阶段的交接文件（不要粘贴完整日志）。
5. 结束时关闭开发服务器。
