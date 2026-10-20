#!/usr/bin/env node
// agent-flow CLI —— 零依赖（仅 Node ≥18 内置模块）
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, VERSION, loadCore, listPacks, detectPacks, packDirs } from '../lib/model.mjs';
import { resolve, lockEntry } from '../lib/render.mjs';
import { read, exists, sha, writeFile, walk } from '../lib/util.mjs';
import * as trae from '../adapters/trae/adapter.mjs';
import * as cursor from '../adapters/cursor/adapter.mjs';
import * as claude from '../adapters/claude-code/adapter.mjs';
import * as generic from '../adapters/generic/adapter.mjs';

export const ADAPTERS = { trae, cursor, claude, generic };
const ALL = ['trae', 'cursor', 'claude'];
const LOCK = '.agent-flow/lock.json';

const HELP = `agent-flow ${VERSION} —— 分阶段 AI 开发流程（分析→定位→设计→草图→实现→评审）

用法：
  agent-flow init <项目目录> [--tool trae|cursor|claude|generic|all|a,b] [--packs auto|none|a,b] [--mode auto|greenfield|brownfield] [--force] [--dry-run]
  agent-flow upgrade [项目目录] [--force]     按 .agent-flow/lock.json 重新生成；只覆盖未被修改的文件
  agent-flow list-packs [--project <目录>]     列出可用 pack（及是否命中自动检测）
  agent-flow new-pack <名称> [--packs-dir <目录>]
  agent-flow build [--out dist] [--packs stable|all|none|a,b]   为每个工具渲染 dist/<tool>/

通用选项：--packs-dir <目录>（可重复；也可用环境变量 AGENT_FLOW_PACKS_PATH）`;

export function parseArgs(argv) {
  const a = { _: [], packsDir: [] };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (!s.startsWith('--')) { a._.push(s); continue; }
    const [k, inline] = s.slice(2).split('=');
    const flag = ['force', 'dry-run', 'help', 'json'].includes(k);
    const v = flag ? true : inline ?? argv[++i];
    if (k === 'packs-dir') a.packsDir.push(v); else a[k.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v;
  }
  return a;
}

const toolsOf = (s = 'all') => {
  const list = s === 'all' ? ALL : s.split(',').map((x) => x.trim()).filter(Boolean);
  for (const t of list) if (!ADAPTERS[t]) throw new Error(`未知工具：${t}（可选 ${Object.keys(ADAPTERS).join('/')}/all）`);
  return list;
};

function selectPacks(spec = 'auto', project, extraDirs) {
  const all = listPacks(extraDirs);
  if (spec === 'none' || spec === '') return [];
  if (spec === 'auto') return project ? detectPacks(project, all) : [];
  if (spec === 'stable') return all.filter((p) => p.status === 'stable');
  if (spec === 'all') return all;
  return spec.split(',').map((n) => {
    const p = all.find((x) => x.name === n.trim());
    if (!p) throw new Error(`找不到 pack：${n}（agent-flow list-packs 查看）`);
    return p;
  });
}

/** Render every file for a config. Pure: returns [{path, content, ifAbsent?}]. */
export function renderAll({ tools, packs, mode }) {
  const core = loadCore();
  const files = new Map();
  const add = (f) => { if (!files.has(f.path)) files.set(f.path, f); };
  let agentsMd = null, flowReadme = null;
  for (const t of tools) {
    const ad = ADAPTERS[t];
    const m = resolve(core, packs, { tool: t, mode, tokens: ad.tokens });
    ad.render(m).forEach(add);
    agentsMd ??= m.agentsMd;
    flowReadme ??= m.flowReadme;
    if (ad.agentsMdExtra) agentsMd = agentsMd.replace(/\n*$/, '\n') + ad.agentsMdExtra(m);
  }
  add({ path: 'AGENTS.md', content: agentsMd, agentsMd: true });
  add({ path: 'docs/flow/README.md', content: flowReadme });
  return [...files.values()];
}

function applyFiles(project, files, { lock = {}, force = false, dry = false, log = console.log }) {
  const hashes = {}, report = { written: [], skipped: [], conflicts: [] };
  for (const f of files) {
    let target = f.path;
    const abs = path.join(project, target);
    const cur = exists(abs) ? read(abs) : null;
    const known = lock[target];
    if (cur === null) { /* new */ }
    else if (cur === f.content) { hashes[target] = sha(f.content); report.skipped.push(target); continue; }
    else if (f.ifAbsent) { log(`  · 保留已有：${target}`); report.skipped.push(target); continue; }
    else if (f.agentsMd && !known) { target = 'AGENTS.flow.md'; log('  ! 已有 AGENTS.md：写入 AGENTS.flow.md，请把「开发流程」等小节合并进去'); }
    else if (!force && !(known && sha(cur) === known)) {
      if (!known) { log(`  · 跳过（已存在、非 agent-flow 生成）：${target}`); report.skipped.push(target); continue; }
      target += '.agent-flow-new';
      log(`  ! 你修改过 ${f.path}：新版本写到 ${target}，请手动合并`);
      report.conflicts.push(f.path);
      hashes[f.path] = known;
      if (!dry) writeFile(path.join(project, target), f.content);
      continue;
    }
    if (!dry) writeFile(path.join(project, target), f.content);
    hashes[target] = sha(f.content);
    report.written.push(target);
    log(`  + ${target}`);
  }
  return { hashes, report };
}

export function init(project, opts = {}, log = console.log) {
  if (!exists(project)) throw new Error(`目录不存在：${project}`);
  const tools = toolsOf(opts.tool);
  const mode = opts.mode || 'auto';
  if (!['auto', 'greenfield', 'brownfield'].includes(mode)) throw new Error(`未知模式：${mode}`);
  const packs = selectPacks(opts.packs || 'auto', project, opts.packsDir || []);
  log(`agent-flow ${VERSION} → ${project}\n  工具：${tools.join(', ')}  模式：${mode}  packs：${packs.map((p) => p.name).join(', ') || '（无）'}`);
  const files = renderAll({ tools, packs, mode });
  const prev = exists(path.join(project, LOCK)) ? JSON.parse(read(path.join(project, LOCK))) : null;
  const { hashes, report } = applyFiles(project, files, { lock: prev?.files || {}, force: opts.force, dry: opts.dryRun, log });
  const lock = { version: VERSION, tools, packs: packs.map((p) => p.name), packsDir: opts.packsDir || [], mode, files: { ...(prev?.files || {}), ...hashes } };
  if (!opts.dryRun) writeFile(path.join(project, LOCK), JSON.stringify(lock, null, 2) + '\n');
  if (mode === 'brownfield' && !exists(path.join(project, '.git'))) log('  ! 存量模式建议先 git init 并提交一次：01b 用 git baseline 做定位和范围核对');
  for (const t of tools) for (const n of ADAPTERS[t].notes) log(`  i ${n}`);
  return { files, report, lock };
}

export function upgrade(project, opts = {}, log = console.log) {
  const lp = path.join(project, LOCK);
  if (!exists(lp)) throw new Error(`没有 ${LOCK}：请先运行 agent-flow init`);
  const lock = JSON.parse(read(lp));
  log(`升级 ${lock.version} → ${VERSION}`);
  return init(project, { tool: lock.tools.join(','), packs: lock.packs.join(',') || 'none', mode: lock.mode, packsDir: lock.packsDir, force: opts.force }, log);
}

export function newPack(name, opts = {}, log = console.log) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error('pack 名只能包含小写字母、数字和连字符');
  const dest = path.join(path.resolve(opts.packsDir?.[0] || path.join(ROOT, 'packs')), name);
  if (exists(dest)) throw new Error(`已存在：${dest}`);
  const src = path.join(ROOT, 'packs', '_template');
  for (const rel of walk(src)) {
    const out = rel.replace(/__PACK_NAME__/g, name);
    writeFile(path.join(dest, out), read(path.join(src, rel)).replace(/\{\{PACK_NAME\}\}/g, name));
    log(`  + ${path.join(dest, out)}`);
  }
  log(`完成。编辑 ${path.join(dest, 'pack.yaml')}，然后运行：agent-flow list-packs`);
  return dest;
}

export function build(opts = {}, log = console.log) {
  const out = path.resolve(opts.out || path.join(ROOT, 'dist'));
  const packs = selectPacks(opts.packs || 'stable', null, opts.packsDir || []);
  fs.rmSync(out, { recursive: true, force: true });
  for (const t of Object.keys(ADAPTERS)) {
    const files = renderAll({ tools: [t], packs, mode: 'auto' });
    for (const f of files) writeFile(path.join(out, t, f.path), f.content);
    log(`  ${t}: ${files.length} 个文件 → ${path.join(out, t)}`);
  }
  return out;
}

function listPacksCmd(opts, log = console.log) {
  const packs = listPacks(opts.packsDir || []);
  const hit = opts.project ? new Set(detectPacks(opts.project, packs).map((p) => p.name)) : null;
  for (const p of packs) log(`${hit ? (hit.has(p.name) ? '✔ ' : '  ') : ''}${p.name.padEnd(18)} ${String(p.version || '').padEnd(7)} ${p.status.padEnd(9)} ${p.description}`);
  log(`\n搜索路径：${packDirs(opts.packsDir || []).join(' : ')}`);
}

export function main(argv = process.argv.slice(2)) {
  const a = parseArgs(argv);
  const [cmd, arg] = a._;
  try {
    if (!cmd || a.help || cmd === 'help') return console.log(HELP);
    if (cmd === '--version' || cmd === 'version') return console.log(VERSION);
    if (cmd === 'init') { if (!arg) throw new Error('请指定项目目录'); init(path.resolve(arg), a); }
    else if (cmd === 'upgrade') upgrade(path.resolve(arg || '.'), a);
    else if (cmd === 'list-packs') listPacksCmd({ ...a, project: a.project && path.resolve(a.project) });
    else if (cmd === 'new-pack') { if (!arg) throw new Error('请指定 pack 名'); newPack(arg, a); }
    else if (cmd === 'build') build(a);
    else throw new Error(`未知命令：${cmd}\n\n${HELP}`);
  } catch (e) {
    console.error(`错误：${e.message}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('agent-flow.mjs')) main();
