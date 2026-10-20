import { skillFiles, globsStr } from '../../lib/render.mjs';

export const id = 'generic';
export const label = 'Generic (AGENTS.md only)';
export const tokens = {
  DELEGATE_HINT: '支持子代理的工具可按 `docs/agent-flow/agents/` 中的定义创建；否则由主代理直接执行',
  PREVIEW_HINT: '编辑器',
  SKILL_READ_HINT_TEMPLATE: '`docs/agent-flow/skills/{{SKILL}}/SKILL.md`',
};
export const notes = ['Generic：任何读取 AGENTS.md 的工具（Codex、Copilot、Jules、Zed、Windsurf…）都能用；技能按路径手动引用。'];

/** Appended to AGENTS.md: rules inline + skill index. */
export function agentsMdExtra(m) {
  const rules = m.rules.map((r) => {
    const when = r.alwaysApply ? '始终适用' : [r.description, globsStr(r.globs) && `文件：${globsStr(r.globs)}`].filter(Boolean).join('；');
    return `### ${r.name}\n\n> 适用：${when}\n${r.body.replace(/^\n+/, '\n').replace(/^# .*\n/m, '')}`;
  });
  const skills = m.skills.map((s) => `- \`docs/agent-flow/skills/${s.name}/SKILL.md\``).join('\n');
  return `\n## 流程规则（agent-flow）\n\n本项目没有工具专属的规则目录，以下规则对所有代理生效。开始流程时先读 \`docs/agent-flow/skills/flow-orchestrator/SKILL.md\`。\n\n技能清单：\n\n${skills}\n\n${rules.join('\n')}`;
}

export function render(m) {
  return [
    ...skillFiles('docs/agent-flow/skills', m.skills),
    ...m.agents.map((a) => ({
      path: `docs/agent-flow/agents/${a.name}.md`,
      content: `---\nname: ${a.name}\ndescription: '${a.description.replace(/'/g, "''")}'\nskill: ${a.skill}\ntools: [${a.tools.join(', ')}]\nreadonly: ${a.readonly === true}\n---\n${a.body}`,
    })),
  ];
}
