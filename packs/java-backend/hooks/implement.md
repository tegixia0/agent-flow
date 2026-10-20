- 构造器注入；`@Transactional` 只放在 Service；不要在 Controller 返回实体。
- 新增数据库字段必须附带迁移脚本，不使用 `ddl-auto=update`。

完成后运行：

{{VERIFY_COMMANDS}}
