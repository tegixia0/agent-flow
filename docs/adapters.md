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

## generic（`--tool generic`）

给只认 AGENTS.md 的工具（Codex、Copilot coding agent、Jules、Zed、Windsurf 等）：

- 规则内联到 `AGENTS.md` 末尾的「流程规则（agent-flow）」一节（含技能清单）。
- 技能和代理放在 `docs/agent-flow/skills/`、`docs/agent-flow/agents/`，按路径引用。

## 新增一个 adapter

1. 复制 `adapters/generic/adapter.mjs` 为 `adapters/<tool>/adapter.mjs`，改 `tokens` 与 `render`。
2. 在 `bin/agent-flow.mjs` 的 `ADAPTERS` 中注册（是否纳入 `all` 自行决定）。
3. 在 `test/cli.test.mjs` 的 `TOOLS` 中加一项期望路径；写明官方文档链接和核对日期。
