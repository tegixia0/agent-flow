import { skillFiles, sq, yq, globsStr } from '../../lib/render.mjs';
import { asList } from '../../lib/util.mjs';

export const id = 'claude';
export const label = 'Claude Code';
export const tokens = {
  DELEGATE_HINT: 'Claude Code：使用 `.claude/agents/` 中的子代理',
  PREVIEW_HINT: '编辑器（如 VS Code）',
  SKILL_READ_HINT_TEMPLATE: '`.claude/skills/{{SKILL}}/SKILL.md`',
};
export const notes = ['Claude Code：CLAUDE.md 通过 @AGENTS.md 导入项目说明；子代理用 skills 字段预加载对应技能。'];

const CLAUDE_MD = `@AGENTS.md

## Claude Code（agent-flow）

- 流程技能在 \`.claude/skills/flow-*\`，阶段子代理在 \`.claude/agents/flow-*\`，规则在 \`.claude/rules/\`。
- 说"走流程 / 下一步 / 通过 1,3 / 驳回 2"即可驱动 flow-orchestrator。
`;

/**
 * Claude Code 风格目录的通用渲染（codeagent adapter 复用）：
 * <dir>/skills/<name>/…、<dir>/rules/<name>.md（只用 paths）、<dir>/agents/<name>.md（skills 预加载）。
 */
export function renderClaudeLayout(m, dir) {
  return [
    ...skillFiles(`${dir}/skills`, m.skills),
    ...m.rules.map((r) => {
      const paths = asList(globsStr(r.globs));
      const fm = paths.length ? `---\npaths:\n${paths.map((p) => `  - "${p}"`).join('\n')}\n---\n` : '';
      const desc = r.description && !r.alwaysApply ? `\n> 适用场景：${r.description}\n` : '';
      return { path: `${dir}/rules/${r.name}.md`, content: fm + desc + r.body.replace(/^\n/, desc ? '\n' : '') };
    }),
    ...m.agents.map((a) => {
      const tools = a.tools.filter((t) => t !== 'Skill');
      return {
        path: `${dir}/agents/${a.name}.md`,
        content: `---\nname: ${a.name}\ndescription: ${sq(a.description)}\ntools: ${tools.join(', ')}\nmodel: inherit\nskills:\n  - ${a.skill}\n---\n${a.body}`,
      };
    }),
  ];
}

export function render(m) {
  return [...renderClaudeLayout(m, '.claude'), { path: 'CLAUDE.md', content: CLAUDE_MD, ifAbsent: true }];
}
