# AGENTS.md


## 项目信息（请填写）
- 技术栈：TypeScript strict · VS Code Extension API（engines ^1.95）· tsc · node:test 单测 · @vscode/test-cli 集成测试
- 目录：src/ 扩展源码（scanner.ts 为纯函数，可单测）· test/ 单测 · src/test/ 集成测试 · docs/flow/ 交接文件
- 命令：编译 `npm run compile` · 单测 `npm run test:unit` · 集成 `npm test` · 打包 `npx @vscode/vsce package`
- 约定：零运行时依赖；所有 Disposable 放进 context.subscriptions；不引入 Webview

## 开发流程（agent-workflow-kit）
新功能按阶段推进，**每个阶段之间都由人工确认**：
- 新建模式：`00 需求 → 01 分析 → 02 设计 → 03 草图 → 04 计划与实现 → 05 评审`
- 存量模式（在现有代码上改）：`00 → 01 → 01b 影响定位（逐点审批）→ 04 → 05`（02、03 为可选）
- 默认模式：brownfield   <!-- auto | brownfield | greenfield；install.sh --brownfield 会改为 brownfield -->

规则摘要：
- 入口技能是 `flow-orchestrator`；交接文件放在 `docs/flow/`，`status` 取 draft | approved | changes-requested | done
- 只有用户明确说"通过"或"通过 n"时，才能记为已批准；每轮最多推进一个阶段；阶段 1–3（含 1b）只能写 `docs/flow/`
- **范围护栏**：当 `docs/flow/01b-impact.md` 存在、且 04 尚未 done 时，只能修改 `allowed_files` 中、属于已批准点的代码；需要改动其他位置时，先停下询问用户
- 下一阶段只读取交接文件，不依赖聊天记录
