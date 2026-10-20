第 6 步「平台要点」补充（TODO(未验证)）：

   - **Java 后端**：说明接口契约（DTO）、事务边界、数据库迁移、缓存与幂等、异常与错误码。
- 测试：单元测试（JUnit 5 + Mockito），切片测试（`@WebMvcTest`、`@DataJpaTest`），需要真实数据库时用 Testcontainers。
- TODO(未验证)：Testcontainers 在用户 CI 环境中是否可用。
