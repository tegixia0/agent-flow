---
name: vscode-release
description: 为 VS Code 扩展准备发布：核对版本号、CHANGELOG、README、图标与 .vscodeignore，并用 vsce package 生成 .vsix。用户说"打包 / 发版 / 发布扩展 / vsix"时使用。绝不自动 publish。
---

# 扩展发布准备

## 步骤

1. 核对 `package.json`：`name`、`publisher`、`version`（按语义化版本递增）、`engines.vscode`、`repository`、`icon`。
2. 更新 `CHANGELOG.md`（来自 `docs/flow/05-review.md` 和 git log）。
3. 检查 `.vscodeignore`：排除 `src/`、`test/`、`docs/flow/`、`node_modules` 中的开发依赖。
4. 运行 `npm run compile && npm test`，再运行 `npx @vscode/vsce package`，报告 .vsix 路径和大小。
5. **停下来**：`vsce publish` / `ovsx publish` 只在用户明确同意后由用户执行。
