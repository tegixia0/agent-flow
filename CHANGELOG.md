# 更新日志

## 2.0.0 — 2026-10-20

从 `agent-workflow-kit` v1.1 重构为 `agent-flow`。

### 新增
- `core/` + `packs/` + `adapters/` 三层结构；`core/manifest.yaml` 描述阶段。
- 零依赖 CLI：`init`、`upgrade`（基于 `.agent-flow/lock.json` 哈希，只覆盖未修改文件，冲突写 `*.agent-flow-new`）、`list-packs`、`new-pack`、`build`。
- 新工具：Claude Code（`.claude/skills|rules|agents` + `CLAUDE.md` 导入 `@AGENTS.md`）、generic（仅 AGENTS.md）。
- packs：`vscode-extension`、`web`（Next.js/Vite）稳定版；`java-backend` 骨架；`_template`。
- pack 自动检测（`engines.vscode`、`next`/`vite`、`pom.xml`/`build.gradle`）。
- 测试：各工具 init、frontmatter 校验、v1.1 兼容性、检测、升级、new-pack。

### 变更
- `flow-design` 第 6 步（VS Code / Web 平台要点）与第 7 步（`@vscode/test-cli`、Playwright）移入 `vscode-extension` / `web` pack 的 design hook；core 中改为通用表述。
- `flow-implement` 中 TypeScript/VS Code 与 Webview 两条约定移入 pack 的 implement hook。
- 示例移到 `examples/todo-lens`（含 `RUN-LOG.md`）。
- `install.sh` / `sync-skills.sh` 被 CLI 取代。

## 1.1.0 — 2026-10-19
- 存量改造（brownfield）模式：`flow-locate`、`01b-impact.md` 逐点审批、范围护栏、按点变更摘要。

## 1.0.0 — 2026-10-19
- 首版：5 阶段技能、编排器、Trae/Cursor 布局、TODO Lens 示例。
