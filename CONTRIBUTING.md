# 贡献指南

## 开发

```bash
node -v            # ≥ 18
npm test           # node:test；js-yaml 可选（有则用它交叉校验 frontmatter）
node bin/agent-flow.mjs build && ls dist
```

CLI 与库**不引入运行时依赖**（只用 Node 内置模块）。

## 改什么放哪里

| 想改 | 位置 |
|---|---|
| 流程本身（阶段步骤、交接格式、审批指令） | `core/` |
| 某个技术栈的约定、验证命令 | `packs/<name>/` |
| 某个工具的路径或 frontmatter | `adapters/<tool>/` |

core 中不要写工具路径（用 `{{DELEGATE_HINT}}` 等 token 或 `<!--@only tool-->` 条件块），也不要写技术栈细节（放进 pack hook）。

## 规则

- 工具路径和字段必须附官方文档链接与核对日期（写在 `docs/adapters.md`）。没有核对过的写 `TODO(未验证)`。
- 改动 core 若影响 Trae/Cursor 输出，需同步更新 `test/fixtures/kit-v1.1` 的兼容性说明，并在 CHANGELOG 注明。
- 提交信息：`feat(core|pack|adapter|cli): …`、`fix: …`、`docs: …`、`test: …`。
- 一个 PR 只做一件事；附上 `npm test` 输出。
