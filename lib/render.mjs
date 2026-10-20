import { fill, conditional, sha } from './util.mjs';

/** Stage id for a core skill name (flow-analyze → analyze). */
export const stageOf = (skill) => skill.replace(/^flow-/, '');

export function verifyList(packs) {
  const lines = [];
  for (const p of packs) for (const v of p.verify) lines.push(`- \`${v.run}\`（${v.name}${v.when ? `；${v.when}` : ''}）`);
  return lines.join('\n');
}

/** Packs' AGENTS.md sections, inserted before "## 开发流程". Empty string when no packs (= old kit). */
export function packSections(packs) {
  if (!packs.some((p) => p.agentsMd)) return '';
  return packs.filter((p) => p.agentsMd).map((p) => `\n## ${p.title || p.name}（pack: ${p.name}）\n\n${p.agentsMd.trim()}\n`).join('') + '\n';
}

/**
 * Build the tool-neutral, fully resolved model for one tool:
 *   skills: [{ name, files:[{rel, content}] }]   (tokens filled, pack hooks appended)
 *   rules, agents (bodies filled), agentsMd, flowReadme
 */
export function resolve(core, packs, { tool, mode = 'auto', tokens = {} }) {
  const t = (s) => fill(conditional(s, tool), tokens);
  const skills = [...core.skills, ...packs.flatMap((p) => p.skills)].map((s) => ({
    name: s.name,
    files: s.files.map(({ rel, content }) => {
      let c = t(content);
      if (rel === 'SKILL.md') {
        for (const p of packs) {
          const hook = p.hooks[stageOf(s.name)];
          if (hook) c = c.replace(/\n*$/, '\n') + `\n## 技术栈补充（pack: ${p.name}）\n\n${fill(t(hook), { VERIFY_COMMANDS: verifyList([p]) }).trim()}\n`;
        }
      }
      return { rel, content: c };
    }),
  }));
  const rules = [...core.rules, ...packs.flatMap((p) => p.rules)].map((r) => ({ ...r, body: t(r.body) }));
  const agents = core.agents.map((a) => ({
    ...a,
    body: fill(t(a.body), { SKILL_READ_HINT: fill(tokens.SKILL_READ_HINT_TEMPLATE || '`{{SKILL}}`', { SKILL: a.skill }) }),
  }));
  return {
    skills, rules, agents,
    agentsMd: fill(core.agentsMd, { PACK_SECTIONS: packSections(packs), MODE: mode }),
    flowReadme: t(core.flowReadme),
  };
}

export const skillFiles = (prefix, skills) =>
  skills.flatMap((s) => s.files.map((f) => ({ path: `${prefix}/${s.name}/${f.rel}`, content: f.content })));

/** YAML scalar the way the old kit wrote it: quote only when needed. */
export function yq(v) {
  const s = String(v ?? '');
  return /: |^['"\[{&*!|>%@`#-]|#/.test(s) ? `'${s.replace(/'/g, "''")}'` : s;
}

export const globsStr = (g) => (Array.isArray(g) ? g.join(',') : g ?? '');

export const lockEntry = (files) => Object.fromEntries(files.map((f) => [f.path, sha(f.content)]));

/** Always single-quoted YAML string (agent descriptions; matches kit v1.1). */
export const sq = (v) => `'${String(v ?? '').replace(/'/g, "''")}'`;
