# docs/flow

分阶段流程的交接文件都放在这里。每个功能跑一轮；开始下一个功能前，把本目录下的 0N 文件归档到 `archive/<日期>-<功能名>/`，再重新开始。评审通过后 Agent 会主动询问是否归档，回复「归档」即可；在旧流程还没归档时提新需求，Agent 也会先提醒你。

**一个需求 = 一个分支 = 一个 PR**：新需求开始时 Agent 会新建 `flow/<日期>-<功能名>` 分支；评审通过后回复「归档」，再回复「提PR」推送并创建 PR。

```
docs/flow/
├─ README.md
├─ 00-requirement.md ...           ← 当前分支的需求
└─ archive/
   ├─ 2026-10-21-view-startup/     ← 需求 A 的 00~05（随 A 的 PR 合并）
   └─ 2026-10-25-api-mock/         ← 需求 B 的 00~05（随 B 的 PR 合并）
```

| 文件 | 阶段 | 模式 | 由谁生成 |
|---|---|---|---|
| 00-requirement.md | 需求原文 + mode | 两种模式 | 你（或 Agent 逐字写入） |
| 01-analysis.md | 分析 | 两种模式 | flow-analyze |
| 01b-impact.md | 影响定位与逐点审批 | 存量 | flow-locate |
| 02-design.md | 设计 | 新建（存量模式可选） | flow-design |
| 03-sketch.md / .html | 草图 / 原型 | 新建（存量模式可选） | flow-sketch |
| 04-plan.md | 计划、实施记录、按点变更摘要 | 两种模式 | flow-implement |
| 05-review.md | 评审（存量模式含范围核对） | 两种模式 | flow-review |
