---
description: 在存量项目中按已批准的影响定位（docs/flow/01b-impact.md）修改代码，或在实现阶段准备编辑、新建文件时使用
globs: 
alwaysApply: false
---

# 存量改造范围护栏（brownfield scope guard）

当 `docs/flow/01b-impact.md` 存在、且 `docs/flow/04-plan.md` 尚未 `done` 时，修改任何文件之前都要检查：

1. 目标文件是否在 01b frontmatter 的 `allowed_files` 中？**不在 → 不要修改**。
2. 这次改动是否属于某个 approved 的 `P-n`？属于 rejected 的点，或者不属于任何点 → **不要修改**。
3. 遇到 1 或 2 不满足的情况：在 01b 的"新发现点"中追加 `P-n`（pending），附上位置、原因、diff 预览和风险，然后回复「⛔ 需要超出已批准的范围 … 请回复「通过 n」或「驳回 n」」，并**结束本轮**。
4. 新建文件同样适用这条护栏：新文件也必须属于某个已批准的点。
