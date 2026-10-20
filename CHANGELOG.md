# 更新日志

## 2.0.1 — 2026-10-20

### 修复（Windows）
- 新增 `.gitattributes`（`* text=auto eol=lf`），`core.autocrlf=true` 时也以 LF 检出。
- `lib/util.read()`、`parseYaml()`、`splitFrontmatter()` 统一把 CRLF 转成 LF（并去掉 BOM），修复"缺少 frontmatter"和后续的 TypeError。
- `upgrade` 按 LF 计算哈希：文件被转成 CRLF 不再被当作用户修改。
- CLI 用 `pathToFileURL` 判断入口，Windows 路径下也能正确执行。
- 新增 `bin/agent-flow.cmd`；README 增加 Windows / PowerShell 用法。
- `npm test` 改为 `node test/run.mjs`（Node 18–24 通用；`node --test test/` 在 Node 22+ Windows 上会报 MODULE_NOT_FOUND）。
- 测试：通过 `process.execPath` 调用 CLI；bash 包装测试只在 POSIX 上运行；临时目录用 `realpathSync.native` 展开 8.3 短路径；新增 CRLF、LF 输出、`/` 路径、CRLF 升级测试。

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
