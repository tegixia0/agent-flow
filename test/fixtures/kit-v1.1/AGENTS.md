# AGENTS.md

<!-- 用 agent-workflow-kit 安装。下方"项目信息"一节请按你的项目填写；"开发流程"一节可以保留原样。 -->

## 项目信息（请填写）
- 技术栈：<例如 TypeScript · VS Code Extension API · esbuild · @vscode/test-cli>
- 目录：<src/ 源码 · test/ 测试 · docs/flow/ 流程交接文件>
- 命令：编译 `npm run compile` · 测试 `npm test` · 打包 `npx @vscode/vsce package`
- 约定：<TypeScript strict；Webview 不使用 @vscode/webview-ui-toolkit（已弃用）>

## 开发流程（agent-workflow-kit）
新功能按阶段推进，**每个阶段之间都由人工确认**：
- 新建模式：`00 需求 → 01 分析 → 02 设计 → 03 草图 → 04 计划与实现 → 05 评审`
- 存量模式（在现有代码上改）：`00 → 01 → 01b 影响定位（逐点审批）→ 04 → 05`（02、03 为可选）
- 默认模式：auto   <!-- auto | brownfield | greenfield；install.sh --brownfield 会改为 brownfield -->

规则摘要：
- 入口技能是 `flow-orchestrator`；交接文件放在 `docs/flow/`，`status` 取 draft | approved | changes-requested | done
- 只有用户明确说"通过"或"通过 n"时，才能记为已批准；每轮最多推进一个阶段；阶段 1–3（含 1b）只能写 `docs/flow/`
- **范围护栏**：当 `docs/flow/01b-impact.md` 存在、且 04 尚未 done 时，只能修改 `allowed_files` 中、属于已批准点的代码；需要改动其他位置时，先停下询问用户
- 下一阶段只读取交接文件，不依赖聊天记录
