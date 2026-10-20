# Adapters：各工具的落盘规则

每个 adapter 是 `adapters/<tool>/adapter.mjs`，导出：

- `tokens`：替换 core 正文中的 `{{DELEGATE_HINT}}`、`{{PREVIEW_HINT}}`，以及 `SKILL_READ_HINT_TEMPLATE`（代理中"先读取技能文件 …"）。
- `render(model)`：返回 `[{ path, content, ifAbsent? }]`。`AGENTS.md` 与 `docs/flow/README.md` 由 CLI 统一追加。
- 可选 `agentsMdExtra(model)`：往 AGENTS.md 末尾追加内容（generic 使用）。
- `notes`：安装后提示。

## Trae（`--tool trae`）

| 产物 | 路径 | 格式 |
|---|---|---|
| 技能 | `.trae/skills/<name>/SKILL.md` | agentskills.io |
| 规则 | `.trae/rules/<name>.md` | `description` / `globs` / `alwaysApply`（列表 globs 用逗号拼接） |
| 子代理 | `.trae/agents/<name>.md` | `name`、`description`、`tools: Read, Glob, …`（含 `Skill`） |

依据：docs.trae.ai 的 Rules / Skills / Subagents 页面（2026-10 核对）。AGENTS.md 需要在设置 > 规则中打开开关；子代理需要设置 > Beta > Subagents，且只有内置 Agent 能调用。

## Cursor（`--tool cursor`）

| 产物 | 路径 | 格式 |
|---|---|---|
| 技能 | `.cursor/skills/<name>/SKILL.md` | 同上，用 `/name` 调用 |
| 规则 | `.cursor/rules/<name>.mdc` | `description` / `globs` / `alwaysApply` |
| 子代理 | `.cursor/agents/<name>.md` | `name`、`description`、`model: inherit`、`readonly` |

reviewer 为 `readonly: true`：Cursor 的只读子代理不能写文件，所以正文改为"把 05-review.md 内容返回给主代理"（core 中用 `<!--@only cursor-->` 条件块实现）。

## Claude Code（`--tool claude`）

依据 code.claude.com 文档（memory、skills、sub-agents 页面，2026-10 核对）：

| 产物 | 路径 | 格式 |
|---|---|---|
| 入口 | `CLAUDE.md` | 第一行 `@AGENTS.md` 导入；已存在则**不覆盖**（请自行加一行 `@AGENTS.md`） |
| 技能 | `.claude/skills/<name>/SKILL.md` | 同上 |
| 规则 | `.claude/rules/<name>.md` | 唯一的 frontmatter 字段是 `paths`（列表）；没有 globs 的规则不写 frontmatter，始终加载，原 `description` 以"适用场景"引用块写在正文开头 |
| 子代理 | `.claude/agents/<name>.md` | `name`、`description`、`tools`（去掉 `Skill`）、`model: inherit`、`skills: [对应技能]`（预加载） |

> Claude Code 只在没有 CLAUDE.md 时才读取 AGENTS.md，所以用 `@AGENTS.md` 导入最稳妥。
> Cursor 也会读取 `.claude/skills/`；同时安装 cursor 与 claude 时，Cursor 中可能看到两份同名技能，内容只在路径提示上不同。

## CodeAgent（`--tool codeagent`，别名 `cac`）

> ⚠️ **没有公开文档。** 目录布局来自用户提供的说明；下表中所有 frontmatter 格式都是**照搬 Claude Code 的假定（assumed, unverified）**。拿到官方文档后请逐项核对并更新本节与 `adapters/codeagent/adapter.mjs`。

用户提供的项目目录布局：`.cac/settings.json`（共享设置）、`.cac/AGENTS.md`（项目说明，共享）、`.cac/AGENTS.local.md`（本地）、`rules/`（按需规则）、`agents/`（项目子代理）、`skills/`（项目技能）、`output-styles/`、`hooks/`、`agent-memory/`、`agent-memory-local/`。

| 产物 | 路径 | 格式 | 依据 |
|---|---|---|---|
| 项目说明 | `.cac/AGENTS.md` | 与根目录 AGENTS.md 同内容 + 「CodeAgent（agent-flow）」小节；已存在且不是 agent-flow 生成的 → 写 `.cac/AGENTS.flow.md` | 路径：用户提供；内容格式：assumed, unverified |
| 技能 | `.cac/skills/<name>/SKILL.md` | agentskills.io（`name` / `description`） | 路径：用户提供；格式：assumed, unverified |
| 规则 | `.cac/rules/<name>.md` | 只用 `paths` 列表；无 globs 的规则不写 frontmatter（假定"始终加载"） | 路径：用户提供；`paths` 字段与"无 frontmatter 即始终加载"：assumed, unverified |
| 子代理 | `.cac/agents/<name>.md` | `name`、`description`、`tools`（逗号分隔，去掉 `Skill`）、`model: inherit`、`skills: [对应技能]` | 路径：用户提供；全部字段：assumed, unverified |

实现：`adapters/codeagent/adapter.mjs` 复用 `claude-code` adapter 导出的 `renderClaudeLayout(model, '.cac')`，只替换目录、token 和入口说明。

**绝不触碰**（adapter 内有断言，测试也会校验）：`.cac/settings.json`、`.cac/AGENTS.local.md`、`.cac/output-styles/`、`.cac/hooks/`、`.cac/agent-memory/`、`.cac/agent-memory-local/`。需要改设置或钩子请用户自己处理。

**根目录 AGENTS.md 的取舍**：`.cac/AGENTS.md` 已经是完整的项目说明，所以

- 只装 `codeagent` 时**不写**根目录 `AGENTS.md`，避免 CodeAgent 若同时读取两处而重复加载（是否会读根目录未知）。
- 与其他工具同装（如 `--tool cursor,cac`）时，根目录 `AGENTS.md` 照常写给其他工具，`.cac/AGENTS.md` 也写一份完整内容；两份由 lock 分别跟踪，`upgrade` 时同步更新。重复加载的风险同上，未验证。

**为什么不在 `--tool all` 中**：布局与格式都未经核对；`all` 应只包含已核对的工具。需要时显式写 `--tool all,cac` 或 `--tool trae,cursor,claude,codeagent`。

## generic（`--tool generic`）

给只认 AGENTS.md 的工具（Codex、Copilot coding agent、Jules、Zed、Windsurf 等）：

- 规则内联到 `AGENTS.md` 末尾的「流程规则（agent-flow）」一节（含技能清单）。
- 技能和代理放在 `docs/agent-flow/skills/`、`docs/agent-flow/agents/`，按路径引用。

## 新增一个 adapter

1. 复制 `adapters/generic/adapter.mjs` 为 `adapters/<tool>/adapter.mjs`，改 `tokens` 与 `render`。
2. 在 `bin/agent-flow.mjs` 的 `ADAPTERS` 中注册（别名写进 `ALIASES`；是否纳入 `all` 自行决定，未核对的工具不要纳入）。
   - 若该工具有自己的项目说明文件、不需要根目录 AGENTS.md，导出 `ownInstructions = true`，并在 render 中输出带 `agentsMd: true` 的说明文件（沿用"已存在则写 *.flow.md"策略）。
3. 在 `test/cli.test.mjs` 的 `TOOLS` 中加一项期望路径；写明官方文档链接和核对日期。
