# java-backend（骨架）

状态 `skeleton`：`agent-flow build` 默认不包含，`--packs auto` 检测到 pom.xml / build.gradle 时会启用。
转为 `stable` 前需要：

- [ ] 在一个真实 Spring Boot 3.x 项目上完整走一遍 greenfield 和 brownfield 流程
- [ ] 确认 `./mvnw -q verify` / `./gradlew build` 在该项目的 CI 中可用
- [ ] 逐条处理 `rules/` 与 `hooks/` 中的 `TODO(未验证)`
- [ ] 补一个 `skills/`（例如 spring-migration：生成并校验 Flyway 迁移）
