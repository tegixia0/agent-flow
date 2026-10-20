import { skillFiles, sq, yq, globsStr } from '../../lib/render.mjs';

export const id = 'trae';
export const label = 'Trae';
export const tokens = {
  DELEGATE_HINT: 'Trae：内置 Agent 调用 `.trae/agents/`；Cursor：`.cursor/agents/`',
  PREVIEW_HINT: ' Trae、Cursor ',
  SKILL_READ_HINT_TEMPLATE: '`.trae/skills/{{SKILL}}/SKILL.md`（在 Cursor 中是 `.cursor/skills/{{SKILL}}/SKILL.md`）',
};
export const notes = [
  'Trae：Settings > Rules 打开「导入 AGENTS.md」开关；Settings > Beta 打开 Subagents；只有内置 Agent 能调用子代理。',
];

export const ruleFile = (r) =>
  `---\ndescription: ${r.description ? yq(r.description) : ''}\nglobs: ${globsStr(r.globs)}\nalwaysApply: ${r.alwaysApply}\n---\n${r.body}`;

export function render(m) {
  return [
    ...skillFiles('.trae/skills', m.skills),
    ...m.rules.map((r) => ({ path: `.trae/rules/${r.name}.md`, content: ruleFile(r) })),
    ...m.agents.map((a) => ({
      path: `.trae/agents/${a.name}.md`,
      content: `---\nname: ${a.name}\ndescription: ${sq(a.description)}\ntools: ${a.tools.join(', ')}\n---\n${a.body}`,
    })),
  ];
}
