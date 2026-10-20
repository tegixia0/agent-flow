# 如何新增一个 pack

pack = 某个技术栈的"补充说明"：额外规则、额外技能、对各阶段的补充（hook）、验证命令、AGENTS.md 片段，以及何时自动启用（detect）。

## 1. 生成骨架

```bash
bin/agent-flow new-pack rust-cli                    # 生成 packs/rust-cli/
bin/agent-flow new-pack rust-cli --packs-dir ~/my-packs   # 放在仓库外（第三方 pack）
```

## 2. 编辑 pack.yaml

```yaml
name: rust-cli
version: 0.1.0
title: Rust 命令行工具
description: Rust CLI（clap、错误处理、cargo 验证）
status: skeleton            # 跑通真实项目前保持 skeleton；build 默认只含 stable
detect:
  any:
    - file: Cargo.toml
      contains: clap        # 可选；也可用 jsonPath（仅 JSON 文件，多个用 | 分隔）
verify:
  - { name: 测试, run: cargo test }
  - { name: Lint, run: cargo clippy -- -D warnings }
rules: [rules/rust-cli.md]
skills: [skills/rust-release]
hooks:
  implement: hooks/implement.md   # 可用阶段：orchestrator analyze locate design sketch implement review
  review: hooks/review.md
agentsMd: agents-snippet.md
```

- **rules/*.md**：中性 frontmatter（`name`、`description`、`globs` 可写列表、`alwaysApply`）。adapter 会转成 `.mdc`、Claude 的 `paths` 等。
- **skills/<名>/SKILL.md**：agentskills.io 格式，`name` 必须与目录名一致。
- **hooks/<stage>.md**：纯 Markdown，追加到该阶段技能末尾。写 `{{VERIFY_COMMANDS}}` 会展开成本 pack 的验证命令列表。
- 未在真实项目验证的内容写 `TODO(未验证)`。

## 3. 验证

```bash
bin/agent-flow list-packs --project /path/to/rust-project   # ✔ 表示检测命中
bin/agent-flow build --packs rust-cli && ls dist/*/          # 看渲染结果
npm test                                                     # 所有 pack 会被自动检查 frontmatter
```

## 4. 实例：java-backend 是怎么加的

1. `bin/agent-flow new-pack java-backend` 复制 `_template`。
2. `detect.any`：`pom.xml`、`build.gradle`、`build.gradle.kts` 任一存在。
3. `verify`：`./mvnw -q verify`（Maven）、`./gradlew build`（Gradle），用 `when` 说明适用条件。
4. `rules/java-spring.md`：分层、构造器注入、`@Transactional` 自调用陷阱、DTO、N+1；`globs` 指向 `src/main/java/**` 等。
5. hooks：analyze（接口与数据表）、locate（按层分组、迁移脚本标 🔴）、design（事务边界、测试切片）、implement / review（引用 `{{VERIFY_COMMANDS}}`）。
6. 不确定的条目标 `TODO(未验证)`，`status: skeleton`；`packs/java-backend/README.md` 列出转 stable 的检查清单。
7. `npm test` 里有一条用例：在含 `pom.xml` 的临时目录 `init`，确认 java-backend 被检测到、hook 出现在 `flow-implement` 中。

## 5. 提交

pack 改动单独提交：`feat(pack): add rust-cli (skeleton)`，并更新 CHANGELOG。
