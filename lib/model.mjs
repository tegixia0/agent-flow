import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { read, exists, walk, getPath } from './util.mjs';
import { parseYaml, splitFrontmatter } from './yaml.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VERSION = JSON.parse(read(path.join(ROOT, 'package.json'))).version;

/** Load the tool-neutral core: skills, rules, agents, project files. */
export function loadCore(root = ROOT) {
  const core = path.join(root, 'core');
  const manifest = parseYaml(read(path.join(core, 'manifest.yaml')));
  const skills = fs.readdirSync(path.join(core, 'skills')).sort().map((name) => loadSkillDir(path.join(core, 'skills', name), name));
  const rules = walk(path.join(core, 'rules')).map((f) => loadRule(path.join(core, 'rules', f)));
  const agents = walk(path.join(core, 'agents')).map((f) => {
    const { data, body } = splitFrontmatter(read(path.join(core, 'agents', f)));
    return { ...data, body };
  });
  return {
    manifest, skills, rules, agents,
    agentsMd: read(path.join(core, 'project', 'AGENTS.md')),
    flowReadme: read(path.join(core, 'project', 'flow-README.md')),
  };
}

export function loadSkillDir(dir, name) {
  return { name, files: walk(dir).map((rel) => ({ rel, content: read(path.join(dir, rel)) })) };
}

/** Neutral rule: frontmatter name/description/globs/alwaysApply + body. */
export function loadRule(file) {
  const { data, body } = splitFrontmatter(read(file));
  return {
    name: data?.name || path.basename(file, '.md'),
    description: data?.description ?? '',
    globs: data?.globs ?? '',
    alwaysApply: data?.alwaysApply === true,
    body,
  };
}

/** Pack search path: built-in packs/, AGENT_FLOW_PACKS_PATH (":"-separated), extra dirs. */
export function packDirs(extra = []) {
  const env = (process.env.AGENT_FLOW_PACKS_PATH || '').split(path.delimiter).filter(Boolean);
  return [...extra, ...env, path.join(ROOT, 'packs')].map((d) => path.resolve(d));
}

export function loadPack(dir) {
  const spec = parseYaml(read(path.join(dir, 'pack.yaml')));
  const rel = (f) => path.join(dir, f);
  return {
    ...spec,
    dir,
    status: spec.status || 'stable',
    verify: spec.verify || [],
    rules: (spec.rules || []).map((f) => loadRule(rel(f))),
    skills: (spec.skills || []).map((d) => loadSkillDir(rel(d), path.basename(d))),
    hooks: Object.fromEntries(Object.entries(spec.hooks || {}).map(([stage, f]) => [stage, read(rel(f))])),
    agentsMd: spec.agentsMd ? read(rel(spec.agentsMd)) : null,
  };
}

/** All packs found (first dir wins on name clash); names starting with "_" are templates and skipped. */
export function listPacks(extra = []) {
  const seen = new Map();
  for (const d of packDirs(extra)) {
    if (!exists(d)) continue;
    for (const name of fs.readdirSync(d).sort()) {
      if (name.startsWith('_') || seen.has(name) || !exists(path.join(d, name, 'pack.yaml'))) continue;
      seen.set(name, loadPack(path.join(d, name)));
    }
  }
  return [...seen.values()];
}

/** One detect condition: { file (supports *), jsonPath?, contains? } */
export function matchCondition(project, c) {
  let files = [c.file];
  if (c.file.includes('*')) {
    const dir = path.join(project, path.dirname(c.file));
    const re = new RegExp('^' + path.basename(c.file).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    files = exists(dir) ? fs.readdirSync(dir).filter((n) => re.test(n)).map((n) => path.join(path.dirname(c.file), n)) : [];
  }
  return files.some((f) => {
    const p = path.join(project, f);
    if (!exists(p) || !fs.statSync(p).isFile()) return false;
    if (c.jsonPath) {
      try {
        const json = JSON.parse(read(p));
        return c.jsonPath.split('|').some((jp) => getPath(json, jp.trim()) !== undefined);
      } catch { return false; }
    }
    if (c.contains) return read(p).includes(c.contains);
    return true;
  });
}

export function matchDetect(project, detect) {
  if (!detect) return false;
  const any = detect.any || [], all = detect.all || [];
  if (!any.length && !all.length) return false;
  return (!any.length || any.some((c) => matchCondition(project, c))) && all.every((c) => matchCondition(project, c));
}

export const detectPacks = (project, packs) => packs.filter((p) => matchDetect(project, p.detect));
