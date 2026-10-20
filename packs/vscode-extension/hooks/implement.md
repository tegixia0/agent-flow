- TypeScript 开启 `strict`，不使用 `any`；VS Code 扩展中所有监听器、Provider 都要放进 `context.subscriptions`。
- Webview：启用 CSP、使用 nonce、设置 `localResourceRoots`；消息使用带判别字段的联合类型。

完成后依次运行：

{{VERIFY_COMMANDS}}
