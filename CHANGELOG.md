# 更新日志

## 未发布

### 新增
- 一个需求 = 一个分支 = 一个 PR：新需求自动新建 `flow/<日期>-<功能名>` 分支（工作区不干净时先询问）；00 记录 `branch`；归档后回复「提PR」提交、推送并用 `gh` 创建 PR，PR 描述由 00/05 生成。
- 流程归档：05 评审通过后，编排器会询问是否归档，回复「归档」后交接文件移到 `docs/flow/archive/<日期>-<功能名>/`；在旧流程没归档时提新需求，会先提醒。
- intro.html 新增「专业定位与术语」章节。

## 2.2.0 — 2026-10-20

### 修复
- 漏写 `--` 的参数（如 `init . tool cac`）以前会被静默忽略并安装默认工具。现在所有命令都**严格解析**：未知命令/选项、单横线长选项、缺值、开关带值、多余位置参数都会报错（退出码 2），附「是不是想写 --tool cac？」之类的建议并打印用法。
- `--tool` / `--mode` / `--packs` 的值做校验，拼错时给出最接近的候选。

### 变更（不兼容）
- `init` **必须显式 `--tool`**，不再默认 `all`。`upgrade` 继续使用 lock 中记录的工具，不接受 `--tool`。
- `init` / `upgrade` 先打印计划并询问 `y/N`；新增 `--yes` / `-y` 跳过确认，`--dry-run` 只打印计划。**非 TTY 下没有 `--yes` 会拒绝执行。**
- 错误退出码由 1 改为 2；用户在确认时取消返回 1。
- 再次 `init` 新工具时，lock 中保留之前安装的工具（以前会被覆盖）。

### 新增
- `agent-flow uninstall <目录> [--tool x]`：只删除 lock 中记录且哈希未变的文件，以及 agent-flow 新建的空目录；修改过的文件列出并保留；按工具卸载时保留其他工具仍需要的共享文件（AGENTS.md、docs/flow/README.md）；支持计划确认、`--dry-run`、`--yes`。
- lock 新增 `dirs`（agent-flow 新建的目录）。旧 lock 没有 `dirs` 时，退回为删除被删文件所在的空目录（不删项目根、`docs/`、`docs/flow/`）。
- 测试：严格参数与建议、必填 `--tool`、计划/确认/dry-run、TTY 确认、uninstall（全部、按工具、旧 lock、CLI）。

## 2.1.0 — 2026-10-20

### 新增
- 新 adapter **codeagent**（`--tool codeagent`，别名 `cac`）：生成 `.cac/AGENTS.md`、`.cac/rules/*.md`、`.cac/agents/*.md`、`.cac/skills/flow-*/`。复用 claude-code adapter 的渲染（新导出 `renderClaudeLayout`）。
  - 布局来自用户描述，frontmatter 照搬 Claude Code，**assumed, unverified**（见 docs/adapters.md）。
  - 不触碰 `.cac/settings.json`、`AGENTS.local.md`、`output-styles/`、`hooks/`、`agent-memory*/`。
  - 已有非 agent-flow 生成的 `.cac/AGENTS.md` → 写 `.cac/AGENTS.flow.md`。
  - 只装 codeagent 时不写根目录 AGENTS.md；**不包含在 `--tool all` 中**。
- CLI 支持工具别名（`cac`、`claude-code`）；adapter 可声明 `ownInstructions`。
- 测试：codeagent 布局、frontmatter、用户文件不被触碰、`.cac/AGENTS.flow.md`、别名与 `all`、upgrade。

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
