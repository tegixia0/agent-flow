# agent-flow

> 分阶段 AI 开发流程：**分析 → (定位) → 设计 → 草图 → 实现 → 评审**，每一步之间都有人工确认。
> 一份与工具无关的源码（`core/` + `packs/`），渲染到 **Trae / Cursor / Claude Code / 任意读取 AGENTS.md 的工具**。

```
需求 ─▶ 01 分析 ─✋─▶ [01b 影响定位：逐点审批] ─✋─▶ 02 设计 ─✋─▶ 03 草图 ─✋─▶ 04 计划/实现 ─✋─▶ 05 评审
```

前身是 `agent-workflow-kit` v1.1（只支持 Trae/Cursor、手工复制模板）。v2 把它重构成可扩展的项目：

- **core/**：流程本身（7 个技能、交接格式、范围护栏规则、阶段代理），不包含任何工具路径或技术栈细节。
- **packs/**：技术栈扩展包。`vscode-extension`、`web`（Next.js/Vite）为稳定版；`java-backend` 为骨架。
- **adapters/**：每个工具一个渲染器，决定文件放在哪、frontmatter 怎么写。
- **bin/agent-flow**：零依赖 CLI（Node ≥ 18），负责安装、自动检测 pack、安全升级。

## 快速开始

```bash
git clone <本仓库> agent-flow        # 或解压 agent-flow.zip
cd your-project
/path/to/agent-flow/bin/agent-flow init . --tool trae,cursor --mode brownfield
# 自动检测技术栈（--packs auto 为默认）：package.json 有 engines.vscode → vscode-extension；next/vite → web；pom.xml/build.gradle → java-backend
```

然后填写项目根目录 `AGENTS.md` 的「项目信息」一节，在 IDE 里说：`走流程：<需求>` 或 `改造：<需求>`。

## CLI

| 命令 | 作用 |
|---|---|
| `agent-flow init <目录> --tool trae\|cursor\|claude\|generic\|all --packs auto\|none\|a,b --mode auto\|greenfield\|brownfield` | 安装。不覆盖已有的非 agent-flow 文件；已有 `AGENTS.md` 时写 `AGENTS.flow.md`；记录 `.agent-flow/lock.json` |
| `agent-flow upgrade [目录]` | 按 lock 重新渲染。**只覆盖你没改过的文件**；改过的写成 `<文件>.agent-flow-new` 让你合并 |
| `agent-flow list-packs [--project 目录]` | 列出 pack；带 `--project` 时用 ✔ 标出检测命中的 pack |
| `agent-flow new-pack <名称> [--packs-dir 目录]` | 从 `packs/_template` 生成新 pack |
| `agent-flow build [--packs stable\|all\|none\|a,b]` | 为每个工具渲染 `dist/<tool>/`（便于查看或手动复制） |

### Windows / PowerShell

不需要 bash，只需要 Node.js ≥ 18：

```powershell
git clone https://github.com/tegixia0/agent-flow.git C:\tools\agent-flow
cd C:\path\to\your-project
node C:\tools\agent-flow\bin\agent-flow.mjs init . --tool trae,cursor --mode brownfield
# 或使用 .cmd 包装（cmd 与 PowerShell 都可以）：
C:\tools\agent-flow\bin\agent-flow.cmd list-packs --project .
# 想直接输入 agent-flow：在 agent-flow 目录运行一次 npm link
```

- 仓库带 `.gitattributes`（`eol=lf`），即使全局 `core.autocrlf=true` 也会以 LF 检出；读取时也会把 CRLF 统一成 LF，所以被编辑器存成 CRLF 的文件同样能解析，`upgrade` 也不会因换行不同而误判为"已修改"。
- 生成的文件一律是 LF、路径一律用 `/`（`lock.json` 中也是）；Trae / Cursor / Claude Code 在 Windows 上都能正常读取。
- 运行测试：`npm test`（`test/run.mjs` 会列出测试文件，兼容 Node 18–24；bash 包装的测试在 Windows 上自动跳过）。

`--tool all` = trae + cursor + claude（generic 需单独指定，因为它会把规则内联进 AGENTS.md）。
第三方 pack：`--packs-dir ./my-packs` 或环境变量 `AGENT_FLOW_PACKS_PATH`。

## 各工具生成什么

| | Trae | Cursor | Claude Code | generic |
|---|---|---|---|---|
| 技能 | `.trae/skills/flow-*/` | `.cursor/skills/flow-*/` | `.claude/skills/flow-*/` | `docs/agent-flow/skills/` |
| 规则 | `.trae/rules/*.md` | `.cursor/rules/*.mdc` | `.claude/rules/*.md`（`paths`） | 内联到 `AGENTS.md` |
| 子代理 | `.trae/agents/` | `.cursor/agents/` | `.claude/agents/`（`skills` 预加载） | `docs/agent-flow/agents/`（参考） |
| 入口说明 | `AGENTS.md`（需打开设置开关） | `AGENTS.md` | `CLAUDE.md` → `@AGENTS.md` | `AGENTS.md` |

详见 [docs/adapters.md](docs/adapters.md)。

### Trae 必做开关
1. 设置 > 规则：打开「将 AGENTS.md 包含在上下文中」。
2. 设置 > Beta > Subagents：启用 Subagents 目录。
3. 对话时选内置 **Agent**（只有它能调用 `.trae/agents/` 的子智能体）。

## 怎么触发

| 想做什么 | 说 |
|---|---|
| 完整流程 | `走流程：<需求>`（Cursor/Claude：`/flow-orchestrator 走流程：…`） |
| 在已有代码上改 | `改造：<需求>` |
| 逐点审批 | `通过 1,3` · `驳回 2：理由` · `修改 2：…` · `全部通过` · `按清单` · `重新定位` |
| 下一阶段 / 回退 / 进度 | `通过` · `回到 2` · `流程状态` |
| 单独跑一个阶段 | `/flow-review`、`/flow-locate` … |

建议每个阶段开新对话，说「继续流程」：编排器读取 `docs/flow/` 判断进度，最省 token。

## 目录

```
agent-flow/
├── bin/            agent-flow.mjs（CLI）+ agent-flow（bash 包装）
├── lib/            yaml / model（加载、检测）/ render（解析 token、注入 hook）/ util
├── core/           manifest.yaml · skills/ · rules/ · agents/ · project/（AGENTS.md 模板）
├── packs/          vscode-extension · web · java-backend（骨架）· _template
├── adapters/       trae · cursor · claude-code · generic
├── examples/       todo-lens（两轮完整示例：新建 + 存量“按标签筛选”）
├── docs/           architecture · how-to-add-a-pack · adapters · intro.html
└── test/           cli.test.mjs + fixtures/kit-v1.1（旧版快照，用于兼容性测试）
```

## 示例

`examples/todo-lens`：VS Code 扩展。第 1 轮（新建模式）在 `docs/flow/archive/`；第 2 轮（存量模式）从 `docs/flow/01b-impact.md` 看起，对话见 `RUN-LOG.md`。

## 扩展

- 新技术栈 → [docs/how-to-add-a-pack.md](docs/how-to-add-a-pack.md)
- 新工具 → [docs/adapters.md](docs/adapters.md)
- 架构 → [docs/architecture.md](docs/architecture.md)；贡献 → [CONTRIBUTING.md](CONTRIBUTING.md)

## 许可

MIT，见 [LICENSE](LICENSE)。
