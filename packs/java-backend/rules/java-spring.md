---
name: java-spring
description: 编写或修改 Java / Spring Boot 后端代码时使用
globs: [src/main/java/**, src/test/java/**, src/main/resources/**]
alwaysApply: false
---

# Java / Spring Boot 约定（骨架）

- 分层：Controller（只做参数校验与转换）→ Service（业务与事务）→ Repository；Controller 不直接调用 Repository。
- 使用构造器注入，不使用字段 `@Autowired`。
- `@Transactional` 放在 Service 的 public 方法上；同类内部自调用不会经过代理，事务不生效。
- 对外接口用 DTO，不直接返回 JPA 实体；请求体用 `@Valid` + Bean Validation。
- 集合关联默认 LAZY；列表查询注意 N+1（`@EntityGraph` 或 `join fetch`）。
- TODO(未验证)：统一异常处理（`@RestControllerAdvice` + ProblemDetail）的项目约定。
- TODO(未验证)：Spring Boot 3.x / 4.x 版本差异（`jakarta.*` 包名、虚拟线程开关）。
