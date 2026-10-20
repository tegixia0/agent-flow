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
/path/to/agent-flow/bin/agent-flow init . --tool trae,cursor --mode brownfield   # 先打印安装计划，再询问 y/N
# 自动检测技术栈（--packs auto 为默认）：package.json 有 engines.vscode → vscode-extension；next/vite → web；pom.xml/build.gradle → java-backend
```

然后填写项目根目录 `AGENTS.md` 的「项目信息」一节，在 IDE 里说：`走流程：<需求>` 或 `改造：<需求>`。

## CLI

| 命令 | 作用 |
|---|---|
| `agent-flow init <目录> --tool trae\|cursor\|claude\|codeagent\|generic\|all [--packs auto\|none\|a,b] [--mode auto\|greenfield\|brownfield]` | 安装。**`--tool` 必填**（不会默认装全部）。不覆盖已有的非 agent-flow 文件；已有 `AGENTS.md` 时写 `AGENTS.flow.md`；记录 `.agent-flow/lock.json` |
| `agent-flow upgrade [目录]` | 按 lock 中记录的工具、packs、模式重新渲染（不接受 `--tool`）。**只覆盖你没改过的文件**；改过的写成 `<文件>.agent-flow-new` |
| `agent-flow uninstall <目录> [--tool x,y]` | 按 lock 删除 agent-flow 生成且**未被修改**的文件和它新建的空目录；改过的文件列出并保留。不加 `--tool` 卸载全部 |
| `agent-flow list-packs [--project 目录]` | 列出 pack；带 `--project` 时用 ✔ 标出检测命中的 pack |
| `agent-flow new-pack <名称> [--packs-dir 目录]` | 从 `packs/_template` 生成新 pack |
| `agent-flow build [--packs stable\|all\|none\|a,b]` | 为每个工具渲染 `dist/<tool>/`（便于查看或手动复制） |

### 安全措施（2.2.0 起）

- **严格参数**：未知选项、多余的位置参数、错误的工具/模式/pack 名都会报错（退出码 2）并给出建议。比如漏写 `--` 的 `init . tool cac` 会提示「是不是想写 --tool cac？」，不会再悄悄安装默认工具。
- **`--tool` 必填**：`init` 必须明确写出要装哪些工具；`upgrade` 使用 lock 中记录的工具。
- **先看计划再确认**：`init` / `upgrade` / `uninstall` 会先打印计划（目标目录、工具、模式、packs、新建/跳过/冲突数量、`AGENTS.flow.md` 提示等），在终端里询问 `y/N`。
  - `--dry-run`：只打印计划，不写不删。
  - `--yes` / `-y`：跳过确认。**非交互环境（CI、脚本、管道）必须加 `--yes`**，否则直接报错退出，不会写入。
- 装错了？`agent-flow uninstall <目录> --dry-run` 看一下，再 `--yes` 执行。2.1.0 及更早版本的 lock 没有记录新建目录，uninstall 会删除被删文件所在的空目录，但永远不删项目根、`docs/`、`docs/flow/`。

`--tool all` = trae + cursor + claude。generic 需单独指定（它会把规则内联进 AGENTS.md）；**codeagent（别名 `cac`）也需单独指定**：它的布局来自用户描述、没有公开文档核对，不默认安装。
第三方 pack：`--packs-dir ./my-packs` 或环境变量 `AGENT_FLOW_PACKS_PATH`。

## 各工具生成什么

| | Trae | Cursor | Claude Code | CodeAgent（`cac`，假定） | generic |
|---|---|---|---|---|---|
| 技能 | `.trae/skills/flow-*/` | `.cursor/skills/flow-*/` | `.claude/skills/flow-*/` | `.cac/skills/flow-*/` | `docs/agent-flow/skills/` |
| 规则 | `.trae/rules/*.md` | `.cursor/rules/*.mdc` | `.claude/rules/*.md`（`paths`） | `.cac/rules/*.md`（`paths`） | 内联到 `AGENTS.md` |
| 子代理 | `.trae/agents/` | `.cursor/agents/` | `.claude/agents/`（`skills` 预加载） | `.cac/agents/` | `docs/agent-flow/agents/`（参考） |
| 入口说明 | `AGENTS.md`（需打开设置开关） | `AGENTS.md` | `CLAUDE.md` → `@AGENTS.md` | `.cac/AGENTS.md`（单独安装时不写根目录 AGENTS.md） | `AGENTS.md` |

CodeAgent：agent-flow **不会**创建或修改 `.cac/settings.json`、`.cac/AGENTS.local.md`、`output-styles/`、`hooks/`、`agent-memory/`、`agent-memory-local/`。

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
├── adapters/       trae · cursor · claude-code · codeagent · generic
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
- 项目介绍页（中文，单文件 HTML）→ [docs/intro.html](docs/intro.html)

## 许可

MIT，见 [LICENSE](LICENSE)。
