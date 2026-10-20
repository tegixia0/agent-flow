import { skillFiles, sq, yq } from '../../lib/render.mjs';
import { ruleFile } from '../trae/adapter.mjs';
import * as trae from '../trae/adapter.mjs';

export const id = 'cursor';
export const label = 'Cursor';
// 与 Trae 共用措辞：老版本套件两套布局中的技能文本完全一致，便于同时安装。
export const tokens = { ...trae.tokens };
export const notes = ['Cursor：规则在 .cursor/rules/*.mdc；技能用 /技能名 调用；子代理在 .cursor/agents/。'];

export function render(m) {
  return [
    ...skillFiles('.cursor/skills', m.skills),
    ...m.rules.map((r) => ({ path: `.cursor/rules/${r.name}.mdc`, content: ruleFile(r) })),
    ...m.agents.map((a) => ({
      path: `.cursor/agents/${a.name}.md`,
      content: `---\nname: ${a.name}\ndescription: ${sq(a.description)}\nmodel: inherit\nreadonly: ${a.readonly === true}\n---\n${a.body}`,
    })),
  ];
}
