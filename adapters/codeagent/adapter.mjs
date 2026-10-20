// CodeAgent（--tool codeagent，别名 cac）
// 没有公开文档：布局来自用户描述，frontmatter 格式假定与 Claude Code 相同（assumed, unverified）。
// 只写 .cac/AGENTS.md、.cac/rules、.cac/agents、.cac/skills；
// 绝不触碰 .cac/settings.json、AGENTS.local.md、output-styles/、hooks/、agent-memory*/。
import { renderClaudeLayout } from '../claude-code/adapter.mjs';

export const id = 'codeagent';
export const label = 'CodeAgent';
export const DIR = '.cac';
/** 自带项目说明（.cac/AGENTS.md），不依赖根目录 AGENTS.md */
export const ownInstructions = true;
export const tokens = {
  DELEGATE_HINT: 'CodeAgent：使用 `.cac/agents/` 中的子代理',
  PREVIEW_HINT: '编辑器（如 VS Code）',
  SKILL_READ_HINT_TEMPLATE: '`.cac/skills/{{SKILL}}/SKILL.md`',
};
export const notes = [
  'CodeAgent：项目说明在 .cac/AGENTS.md；个人设置请写 .cac/AGENTS.local.md（agent-flow 不会碰它和 settings.json / hooks / output-styles / agent-memory*）。',
  'CodeAgent：布局与 frontmatter 按 Claude Code 假定，未经官方文档核对（见 docs/adapters.md）。',
];

/** 绝不生成或修改的路径（测试会校验） */
export const PROTECTED = ['.cac/settings.json', '.cac/AGENTS.local.md', '.cac/output-styles/', '.cac/hooks/', '.cac/agent-memory/', '.cac/agent-memory-local/'];

const SECTION = `
## CodeAgent（agent-flow）

- 流程技能在 \`.cac/skills/flow-*\`，阶段子代理在 \`.cac/agents/flow-*\`，按需规则在 \`.cac/rules/\`。
- 说"走流程 / 下一步 / 通过 1,3 / 驳回 2"即可驱动 flow-orchestrator。
- 个人偏好写在 \`.cac/AGENTS.local.md\`（不提交）；本文件由 agent-flow 生成，\`agent-flow upgrade\` 只在你没改过时覆盖。
`;

export function render(m) {
  const files = renderClaudeLayout(m, DIR);
  for (const f of files) if (PROTECTED.some((p) => f.path === p || f.path.startsWith(p))) throw new Error(`codeagent adapter 不应写入 ${f.path}`);
  return [...files, { path: `${DIR}/AGENTS.md`, content: m.agentsMd.replace(/\n*$/, '\n') + SECTION, agentsMd: true }];
}
