#!/usr/bin/env node
// agent-flow CLI —— 零依赖（仅 Node ≥18 内置模块）
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, VERSION, loadCore, listPacks, detectPacks, packDirs } from '../lib/model.mjs';
import { resolve, lockEntry } from '../lib/render.mjs';
import { read, exists, sha, writeFile, walk } from '../lib/util.mjs';
import * as trae from '../adapters/trae/adapter.mjs';
import * as cursor from '../adapters/cursor/adapter.mjs';
import * as claude from '../adapters/claude-code/adapter.mjs';
import * as generic from '../adapters/generic/adapter.mjs';
import * as codeagent from '../adapters/codeagent/adapter.mjs';

export const ADAPTERS = { trae, cursor, claude, generic, codeagent };
/** 工具别名 */
export const ALIASES = { cac: 'codeagent', 'claude-code': 'claude' };
// codeagent 不在 all 中：它的布局来自用户描述、未经官方文档核对，需显式选择（见 docs/adapters.md）
const ALL = ['trae', 'cursor', 'claude'];
const LOCK = '.agent-flow/lock.json';

export const MODES = ['auto', 'greenfield', 'brownfield'];

const HELP = `agent-flow ${VERSION} —— 分阶段 AI 开发流程（分析→定位→设计→草图→实现→评审）

用法：
  agent-flow init <项目目录> --tool <工具> [--packs auto|none|a,b] [--mode auto|greenfield|brownfield] [--force] [--dry-run] [--yes]
      --tool 必填：trae | cursor | claude | codeagent（别名 cac）| generic | all（= trae,cursor,claude）| 逗号分隔组合
  agent-flow upgrade [项目目录] [--force] [--dry-run] [--yes]     按 .agent-flow/lock.json 重新生成；只覆盖未被修改的文件
  agent-flow uninstall <项目目录> [--tool <工具>] [--dry-run] [--yes]   只删除 agent-flow 生成且未被修改的文件
  agent-flow list-packs [--project <目录>]     列出可用 pack（及是否命中自动检测）
  agent-flow new-pack <名称> [--packs-dir <目录>]
  agent-flow build [--out dist] [--packs stable|all|none|a,b]   为每个工具渲染 dist/<tool>/

写入或删除前会先打印计划并询问 y/N；--yes / -y 跳过确认（非交互环境必须加），--dry-run 只打印计划。
通用选项：--packs-dir <目录>（可重复；也可用环境变量 AGENT_FLOW_PACKS_PATH）  --help / -h`;

export class UsageError extends Error {}

/** 每个命令允许的选项：bool = 开关；value = 需要值；multi = 可重复。positional = 位置参数个数上限 */
const COMMON = { help: 'bool' };
export const COMMANDS = {
  init: { positional: 1, required: 1, flags: { ...COMMON, tool: 'value', packs: 'value', mode: 'value', force: 'bool', 'dry-run': 'bool', yes: 'bool', 'packs-dir': 'multi' } },
  upgrade: { positional: 1, required: 0, flags: { ...COMMON, force: 'bool', 'dry-run': 'bool', yes: 'bool' } },
  uninstall: { positional: 1, required: 1, flags: { ...COMMON, tool: 'value', 'dry-run': 'bool', yes: 'bool' } },
  'list-packs': { positional: 0, required: 0, flags: { ...COMMON, project: 'value', 'packs-dir': 'multi' } },
  'new-pack': { positional: 1, required: 1, flags: { ...COMMON, 'packs-dir': 'multi' } },
  build: { positional: 0, required: 0, flags: { ...COMMON, out: 'value', packs: 'value', 'packs-dir': 'multi' } },
  help: { positional: 1, required: 0, flags: {} },
  version: { positional: 0, required: 0, flags: {} },
};
const SHORT = { y: 'yes', h: 'help' };
const camel = (k) => k.replace(/-(\w)/g, (_, c) => c.toUpperCase());

export function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
export const closest = (word, candidates, max = 2) => {
  let best = null, bd = Infinity;
  for (const c of candidates) { const x = distance(word.toLowerCase(), c); if (x < bd) { bd = x; best = c; } }
  return bd <= Math.max(max, Math.floor(word.length / 3)) ? best : null;
};
const TOOL_WORDS = () => [...Object.keys(ADAPTERS), ...Object.keys(ALIASES), 'all'];

/** 给多余的位置参数猜测本意：`tool cac` → `--tool cac`，`cac` → `--tool cac`，`brownfield` → `--mode brownfield` */
function guessPositional(words, flags) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/^-(?=\w{2,})/, ''); // 单横线的长选项：-tool
    const flag = flags[w] ? w : closest(w, Object.keys(flags), 1);
    if (flag && flags[flag] !== 'bool' && words[i + 1] !== undefined) { out.push(`--${flag} ${words[++i]}`); continue; }
    if (flag) { out.push(`--${flag}`); continue; }
    if (flags.tool && w.split(',').every((x) => TOOL_WORDS().includes(x))) { out.push(`--tool ${w}`); continue; }
    if (flags.mode && MODES.includes(w)) { out.push(`--mode ${w}`); continue; }
    if (flags.packs && ['auto', 'none', 'stable'].includes(w)) { out.push(`--packs ${w}`); continue; }
  }
  return out;
}

/** 严格解析：未知命令 / 未知选项 / 缺值 / 多余位置参数 一律报 UsageError（附建议） */
export function parseArgs(argv) {
  const a = { _: [], packsDir: [] };
  let i = 0;
  const cmdRaw = argv[0];
  if (cmdRaw === undefined || cmdRaw === '--help' || cmdRaw === '-h') return { cmd: 'help', ...a };
  if (cmdRaw === '--version' || cmdRaw === '-v') return { cmd: 'version', ...a };
  const spec = COMMANDS[cmdRaw];
  if (!spec) {
    const sug = /^(inst|setup|add)/i.test(cmdRaw) ? 'init' : /^(remove|rm|del|uninst)/i.test(cmdRaw) ? 'uninstall' : /^(update|up)/i.test(cmdRaw) ? 'upgrade' : closest(cmdRaw, Object.keys(COMMANDS), 3);
    throw new UsageError(`未知命令：${cmdRaw}${sug ? `。是不是想用 ${sug}？` : ''}`);
  }
  a.cmd = cmdRaw;
  for (i = 1; i < argv.length; i++) {
    const s = argv[i];
    if (s === '--') { a._.push(...argv.slice(i + 1)); break; }
    if (!s.startsWith('-') || s === '-') { a._.push(s); continue; }
    let k, inline;
    if (s.startsWith('--')) [k, inline] = [s.slice(2).split('=')[0], s.includes('=') ? s.slice(s.indexOf('=') + 1) : undefined];
    else if (SHORT[s.slice(1)]) k = SHORT[s.slice(1)];
    else {
      const w = s.slice(1).split('=')[0];
      const sug = spec.flags[w] ? w : closest(w, Object.keys(spec.flags));
      throw new UsageError(`${a.cmd} 不支持选项 ${s}${sug ? `。是不是想写 --${sug}？（长选项要用两个横线）` : ''}`);
    }
    const type = spec.flags[k];
    if (!type) {
      const sug = closest(k, Object.keys(spec.flags));
      throw new UsageError(`${a.cmd} 不支持选项 ${s}${sug ? `。是不是想写 --${sug}？` : ''}`);
    }
    if (type === 'bool') {
      if (inline !== undefined) throw new UsageError(`选项 --${k} 是开关，不接受值（去掉 =${inline}）`);
      a[camel(k)] = true; continue;
    }
    const v = inline ?? argv[++i];
    if (v === undefined || (inline === undefined && v.startsWith('--'))) throw new UsageError(`选项 --${k} 需要一个值，例如 --${k} ${k === 'tool' ? 'cac' : k === 'mode' ? 'brownfield' : '<值>'}`);
    if (type === 'multi') a.packsDir.push(v); else a[camel(k)] = v;
  }
  if (a._.length > spec.positional) {
    const extra = a._.slice(spec.positional);
    const guess = guessPositional(extra, spec.flags);
    throw new UsageError(`${a.cmd} 多了位置参数：${extra.join(' ')}${guess.length ? `\n  是不是想写 ${guess.join(' ')}？（选项前要加 --）` : ''}`);
  }
  if (a._.length < spec.required && !a.help) throw new UsageError(`${a.cmd} 缺少参数：${a.cmd === 'new-pack' ? '<pack 名>' : '<项目目录>'}`);
  return a;
}

export const toolsOf = (s) => {
  if (s === undefined || s === true || s === '') throw new UsageError('请用 --tool 指定要安装的工具（不会默认安装全部），例如 --tool cac 或 --tool trae,cursor');
  const list = [...new Set((s === 'all' ? ALL : s.split(',').map((x) => x.trim()).filter(Boolean)).flatMap((x) => (x === 'all' ? ALL : [ALIASES[x] || x])))];
  for (const t of list) if (!ADAPTERS[t]) {
    const sug = closest(t, TOOL_WORDS());
    throw new UsageError(`未知工具：${t}${sug ? `。是不是想写 ${sug}？` : ''}（可选 ${Object.keys(ADAPTERS).join(' / ')} / all；别名 cac = codeagent）`);
  }
  return list;
};

const checkMode = (mode) => {
  if (!MODES.includes(mode)) {
    const sug = closest(mode, MODES);
    throw new UsageError(`未知模式：${mode}${sug ? `。是不是想写 ${sug}？` : ''}（可选 ${MODES.join(' / ')}）`);
  }
  return mode;
};

function selectPacks(spec = 'auto', project, extraDirs) {
  const all = listPacks(extraDirs);
  if (spec === 'none' || spec === '') return [];
  if (spec === 'auto') return project ? detectPacks(project, all) : [];
  if (spec === 'stable') return all.filter((p) => p.status === 'stable');
  if (spec === 'all') return all;
  return spec.split(',').map((n) => {
    const p = all.find((x) => x.name === n.trim());
    if (!p) {
      const sug = closest(n.trim(), [...all.map((x) => x.name), 'auto', 'none', 'stable', 'all']);
      throw new UsageError(`找不到 pack：${n}${sug ? `。是不是想写 ${sug}？` : ''}（agent-flow list-packs 查看）`);
    }
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
  // 只有选中了需要根目录 AGENTS.md 的工具时才写（codeagent 自带 .cac/AGENTS.md，单独安装时不写根目录文件）
  if (tools.some((t) => !ADAPTERS[t].ownInstructions)) add({ path: 'AGENTS.md', content: agentsMd, agentsMd: true });
  add({ path: 'docs/flow/README.md', content: flowReadme });
  return [...files.values()];
}

function applyFiles(project, files, { lock = {}, force = false, dry = false, log = console.log }) {
  const hashes = {}, report = { written: [], created: [], updated: [], skipped: [], conflicts: [], flowFiles: [], dirs: [] };
  const write = (rel, content) => {
    // 记录本次新建的目录（uninstall 时只删除这些目录，且仅在为空时删除）
    for (let d = path.posix.dirname(rel); d !== '.' && !exists(path.join(project, d)) && !report.dirs.includes(d); d = path.posix.dirname(d)) report.dirs.push(d);
    if (!dry) writeFile(path.join(project, rel), content);
  };
  for (const f of files) {
    let target = f.path;
    const abs = path.join(project, target);
    const cur = exists(abs) ? read(abs) : null;
    const known = lock[target];
    if (cur === null) { /* new */ }
    else if (cur === f.content) { hashes[target] = sha(f.content); report.skipped.push(target); continue; }
    else if (f.ifAbsent) { log(`  · 保留已有：${target}`); report.skipped.push(target); continue; }
    else if (f.agentsMd && !known) {
      target = target.replace(/AGENTS\.md$/, 'AGENTS.flow.md');
      report.flowFiles.push(target);
      log(`  ! 已有 ${f.path}：写入 ${target}，请把「开发流程」等小节合并进去`);
    }
    else if (!force && !(known && sha(cur) === known)) {
      if (!known) { log(`  · 跳过（已存在、非 agent-flow 生成）：${target}`); report.skipped.push(target); continue; }
      target += '.agent-flow-new';
      log(`  ! 你修改过 ${f.path}：新版本写到 ${target}，请手动合并`);
      report.conflicts.push(f.path);
      hashes[f.path] = known;
      write(target, f.content);
      continue;
    }
    (exists(path.join(project, target)) ? report.updated : report.created).push(target);
    write(target, f.content);
    hashes[target] = sha(f.content);
    report.written.push(target);
    log(`  + ${target}`);
  }
  return { hashes, report };
}

export function init(project, opts = {}, log = console.log) {
  if (!exists(project)) throw new Error(`目录不存在：${project}`);
  const tools = toolsOf(opts.tool);
  const mode = checkMode(opts.mode || 'auto');
  const packs = selectPacks(opts.packs || 'auto', project, opts.packsDir || []);
  log(`agent-flow ${VERSION} → ${project}\n  工具：${tools.join(', ')}  模式：${mode}  packs：${packs.map((p) => p.name).join(', ') || '（无）'}`);
  const files = renderAll({ tools, packs, mode });
  const prev = exists(path.join(project, LOCK)) ? JSON.parse(read(path.join(project, LOCK))) : null;
  const { hashes, report } = applyFiles(project, files, { lock: prev?.files || {}, force: opts.force, dry: opts.dryRun, log });
  const dirs = [...new Set([...(prev?.dirs || []), ...report.dirs.filter((d) => d !== '.agent-flow')])].sort();
  const allTools = [...new Set([...(opts.replaceTools ? [] : prev?.tools || []), ...tools])];
  const lock = { version: VERSION, tools: allTools, packs: packs.map((p) => p.name), packsDir: opts.packsDir || [], mode, files: { ...(prev?.files || {}), ...hashes }, dirs };
  if (!opts.dryRun) writeFile(path.join(project, LOCK), JSON.stringify(lock, null, 2) + '\n');
  if (mode === 'brownfield' && !exists(path.join(project, '.git'))) log('  ! 存量模式建议先 git init 并提交一次：01b 用 git baseline 做定位和范围核对');
  for (const t of tools) for (const n of ADAPTERS[t].notes) log(`  i ${n}`);
  return { files, report, lock };
}

const upgradeOpts = (lock) => ({ tool: lock.tools.join(','), packs: lock.packs.join(',') || 'none', mode: lock.mode, packsDir: lock.packsDir, replaceTools: true });
const readLock = (project) => {
  const lp = path.join(project, LOCK);
  if (!exists(lp)) throw new UsageError(`${project} 中没有 ${LOCK}：这个目录没有用 agent-flow 安装过（或 lock 已被删除）`);
  return JSON.parse(read(lp));
};

/** 计算 init / upgrade 的计划（不写文件） */
export function plan(project, opts) {
  const res = init(project, { ...opts, dryRun: true }, () => {});
  return { tools: toolsOf(opts.tool), mode: res.lock.mode, packs: res.lock.packs, report: res.report };
}

export function upgrade(project, opts = {}, log = console.log) {
  const lock = readLock(project);
  log(`升级 ${lock.version} → ${VERSION}`);
  return init(project, { ...upgradeOpts(lock), force: opts.force, dryRun: opts.dryRun }, log);
}

export function newPack(name, opts = {}, log = console.log) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error('pack 名只能包含小写字母、数字和连字符');
  const dest = path.join(path.resolve(opts.packsDir?.[0] || path.join(ROOT, 'packs')), name);
  if (exists(dest)) throw new Error(`已存在：${dest}`);
  const src = path.join(ROOT, 'packs', '_template');
  for (const rel of walk(src)) {
    const out = rel.replace(/__PACK_NAME__/g, name);
    writeFile(path.join(dest, out), read(path.join(src, rel)).replace(/\{\{PACK_NAME\}\}/g, name));
    log(`  + ${path.join(dest, out)}`); // 本地路径，按系统分隔符显示
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
  if (opts.project && !exists(opts.project)) throw new UsageError(`目录不存在：${opts.project}`);
  const packs = listPacks(opts.packsDir || []);
  const hit = opts.project ? new Set(detectPacks(opts.project, packs).map((p) => p.name)) : null;
  for (const p of packs) log(`${hit ? (hit.has(p.name) ? '✔ ' : '  ') : ''}${p.name.padEnd(18)} ${String(p.version || '').padEnd(7)} ${p.status.padEnd(9)} ${p.description}`);
  log(`\n搜索路径：${packDirs(opts.packsDir || []).join(' : ')}`);
}

/** 某个工具在当前版本会生成的路径（AGENTS.md 也对应 AGENTS.flow.md） */
function pathsOfTools(tools, lock) {
  const set = new Set();
  if (!tools.length) return set;
  const packs = (() => { try { return selectPacks(lock.packs.join(',') || 'none', null, lock.packsDir || []); } catch { return []; } })();
  for (const f of renderAll({ tools, packs, mode: lock.mode || 'auto' })) {
    set.add(f.path);
    if (f.agentsMd) set.add(f.path.replace(/AGENTS\.md$/, 'AGENTS.flow.md'));
  }
  return set;
}

/** 卸载计划：只删除 lock 中记录、且内容哈希未变的文件；被修改的保留 */
export function uninstallPlan(project, opts = {}) {
  const lock = readLock(project);
  const remove = opts.tool ? toolsOf(opts.tool) : lock.tools;
  const notInstalled = remove.filter((t) => !lock.tools.includes(t));
  if (notInstalled.length) throw new UsageError(`lock 中没有安装这些工具：${notInstalled.join(', ')}（已安装：${lock.tools.join(', ')}）`);
  const keepTools = lock.tools.filter((t) => !remove.includes(t));
  const mine = pathsOfTools(remove, lock), others = pathsOfTools(keepTools, lock);
  // 不再属于任何仍保留工具的文件才删除；不指定 --tool 时删除 lock 中的全部文件
  const targets = Object.keys(lock.files).filter((f) => (keepTools.length ? mine.has(f) && !others.has(f) : true)).sort();
  const p = { lock, remove, keepTools, delete: [], modified: [], missing: [], leftovers: [] };
  for (const f of targets) {
    const abs = path.join(project, f);
    if (!exists(abs)) p.missing.push(f);
    else if (sha(read(abs)) === lock.files[f]) p.delete.push(f);
    else p.modified.push(f);
    if (exists(abs + '.agent-flow-new')) p.leftovers.push(f + '.agent-flow-new');
  }
  return p;
}

export function uninstall(project, opts = {}, log = console.log) {
  const p = uninstallPlan(project, opts);
  if (opts.dryRun) return p;
  for (const f of p.delete) fs.rmSync(path.join(project, f));
  // 删除空目录：优先用 lock.dirs（2.2.0+ 记录的、由 agent-flow 新建的目录）；
  // 旧 lock 没有 dirs 时，退回为"被删文件的上级目录"，但绝不删除项目根、docs、docs/flow
  const PROTECT = new Set(['', '.', 'docs', 'docs/flow']);
  const candidates = new Set(p.lock.dirs || []);
  if (!p.lock.dirs) for (const f of p.delete) for (let d = path.posix.dirname(f); !PROTECT.has(d); d = path.posix.dirname(d)) candidates.add(d);
  const removedDirs = [];
  for (const d of [...candidates].sort((a, b) => b.split('/').length - a.split('/').length || b.localeCompare(a))) {
    const abs = path.join(project, d);
    if (PROTECT.has(d) || !exists(abs)) continue;
    if (fs.readdirSync(abs).length === 0) { fs.rmdirSync(abs); removedDirs.push(d); }
  }
  const files = { ...p.lock.files };
  for (const f of [...p.delete, ...p.missing]) delete files[f];
  const lp = path.join(project, LOCK);
  if (!p.keepTools.length && !Object.keys(files).length) {
    fs.rmSync(lp);
    if (fs.readdirSync(path.dirname(lp)).length === 0) fs.rmdirSync(path.dirname(lp));
  } else {
    const dirs = (p.lock.dirs || []).filter((d) => !removedDirs.includes(d));
    writeFile(lp, JSON.stringify({ ...p.lock, tools: p.keepTools, files, ...(p.lock.dirs ? { dirs } : {}) }, null, 2) + '\n');
  }
  p.removedDirs = removedDirs;
  return p;
}

// ---------------- 交互：计划 + 确认 ----------------

function printInitPlan(project, pl, log, title = '安装计划') {
  const r = pl.report;
  log(`agent-flow ${VERSION} ${title}`);
  log(`  目标目录：${project}`);
  log(`  工具：${pl.tools.join(', ')}    模式：${pl.mode}    packs：${pl.packs.join(', ') || '（无）'}`);
  log(`  新建 ${r.created.length} 个文件，更新 ${r.updated.length} 个，跳过 ${r.skipped.length} 个（已存在或内容相同）${r.conflicts.length ? `，冲突 ${r.conflicts.length} 个（写成 *.agent-flow-new）` : ''}`);
  for (const f of r.flowFiles) log(`  ! ${f.replace(/AGENTS\.flow\.md$/, 'AGENTS.md')} 已存在且不是 agent-flow 生成的：将写入 ${f}，需要你手动合并`);
  for (const f of r.conflicts) log(`  ! 你修改过 ${f}：新版本会写到 ${f}.agent-flow-new`);
  const roots = [...new Set(r.created.map((f) => f.split('/')[0]))];
  if (roots.length) log(`  将新建：${roots.join('  ')}`);
}

function printUninstallPlan(project, p, log) {
  log(`agent-flow ${VERSION} 卸载计划`);
  log(`  目标目录：${project}`);
  log(`  卸载工具：${p.remove.join(', ')}${p.keepTools.length ? `    保留：${p.keepTools.join(', ')}` : ''}`);
  log(`  删除 ${p.delete.length} 个未修改的文件；保留 ${p.modified.length} 个被你修改过的文件${p.missing.length ? `；${p.missing.length} 个已不存在（只更新 lock）` : ''}`);
  for (const f of p.modified) log(`  · 保留（已修改）：${f}`);
  for (const f of p.leftovers) log(`  · 未处理（请手动删除）：${f}`);
  const roots = [...new Set(p.delete.map((f) => f.split('/')[0]))];
  if (roots.length) log(`  涉及：${roots.join('  ')}`);
}

/** 返回 true = 继续。--yes 直接继续；TTY 询问 y/N；非 TTY 且没有 --yes → UsageError */
export async function confirm(question, { yes = false, input = process.stdin, output = process.stdout } = {}) {
  if (yes) return true;
  if (!input.isTTY) throw new UsageError('当前不是交互终端：确认无误后请加 --yes（或 -y）再运行；只想查看计划请用 --dry-run');
  const rl = (await import('node:readline')).createInterface({ input, output });
  const ans = await new Promise((res) => rl.question(`${question} [y/N] `, res));
  rl.close();
  return /^y(es)?$/i.test(ans.trim());
}

export async function main(argv = process.argv.slice(2), io = {}) {
  const log = io.log || console.log, err = io.error || console.error;
  let a;
  try {
    a = parseArgs(argv);
    const [arg] = a._;
    if (a.cmd === 'help' || a.help) return log(HELP);
    if (a.cmd === 'version') return log(VERSION);
    if (a.cmd === 'init' || a.cmd === 'upgrade') {
      const project = path.resolve(arg || '.');
      if (!exists(project)) throw new UsageError(`目录不存在：${project}`);
      const opts = a.cmd === 'init' ? { ...a, mode: a.mode && checkMode(a.mode) } : { ...upgradeOpts(readLock(project)), force: a.force };
      toolsOf(opts.tool);
      const pl = plan(project, opts);
      printInitPlan(project, pl, log, a.cmd === 'init' ? '安装计划' : '升级计划');
      if (a.dryRun) return log('（--dry-run：未写入任何文件）');
      if (!pl.report.written.length && !pl.report.conflicts.length) log('  没有需要写入的文件。');
      if (!(await confirm('继续写入？', { yes: a.yes, ...io }))) { log('已取消，未写入任何文件。'); process.exitCode = 1; return; }
      init(project, opts, log);
    } else if (a.cmd === 'uninstall') {
      const project = path.resolve(arg);
      const p = uninstallPlan(project, a);
      printUninstallPlan(project, p, log);
      if (a.dryRun) return log('（--dry-run：未删除任何文件）');
      if (!(await confirm('继续删除？', { yes: a.yes, ...io }))) { log('已取消，未删除任何文件。'); process.exitCode = 1; return; }
      const r = uninstall(project, a, log);
      log(`完成：删除 ${r.delete.length} 个文件、${r.removedDirs.length} 个空目录${r.modified.length ? `；保留 ${r.modified.length} 个已修改文件` : ''}${r.keepTools.length ? `；仍安装：${r.keepTools.join(', ')}` : '；lock 已移除'}`);
    } else if (a.cmd === 'list-packs') listPacksCmd({ ...a, project: a.project && path.resolve(a.project) }, log);
    else if (a.cmd === 'new-pack') newPack(arg, a, log);
    else if (a.cmd === 'build') { if (a.packs) selectPacks(a.packs, null, a.packsDir); build(a, log); }
  } catch (e) {
    err(`错误：${e.message}`);
    if (e instanceof UsageError) err(`\n${HELP}`);
    process.exitCode = 2;
  }
}

// 直接运行时执行 main()（Windows 下 argv[1] 是 C:\\… 路径，需转成 file:// URL 再比较）
const invoked = process.argv[1] && (() => { try { return pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return ''; } })();
if (invoked === import.meta.url || /agent-flow(\.mjs)?$/.test(process.argv[1] || '')) main();
