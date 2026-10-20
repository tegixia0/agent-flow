import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { init, upgrade, newPack, build, ADAPTERS, uninstall, uninstallPlan, parseArgs, confirm } from '../bin/agent-flow.mjs';
import { ROOT, listPacks } from '../lib/model.mjs';
import { walk, read } from '../lib/util.mjs';
import { splitFrontmatter, parseYaml } from '../lib/yaml.mjs';

// js-yaml 是可选的交叉校验；没有就退回内置解析器
let jsYaml = null;
try { jsYaml = createRequire(import.meta.url)('js-yaml'); } catch {
  try { jsYaml = createRequire(path.join(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 'x'))('js-yaml'); } catch {}
}
console.log(`# frontmatter parser: ${jsYaml ? 'js-yaml' : 'internal'}`);
const yamlLoad = (s) => (jsYaml ? jsYaml.load(s) : parseYaml(s));

const quiet = () => {};
const tmp = (files = {}) => {
  // realpath.native 展开 Windows 8.3 短路径（C:\Users\ADMINI~1\…），避免路径比较不一致
  const d = fs.realpathSync.native(fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'agent-flow-')));
  for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), c); }
  return d;
};
const fm = (file) => {
  const m = read(file).match(/^---\n([\s\S]*?)\n---\n/);
  return m ? yamlLoad(m[1]) ?? {} : null;
};
const FIX = path.join(ROOT, 'test/fixtures/kit-v1.1');
const SKILLS = ['flow-orchestrator', 'flow-analyze', 'flow-locate', 'flow-design', 'flow-sketch', 'flow-implement', 'flow-review'];
const AGENTS = ['flow-analyst', 'flow-locator', 'flow-designer', 'flow-sketcher', 'flow-implementer', 'flow-reviewer'];

const TOOLS = {
  trae: { skills: '.trae/skills', rules: ['.trae/rules', '.md'], agents: '.trae/agents' },
  cursor: { skills: '.cursor/skills', rules: ['.cursor/rules', '.mdc'], agents: '.cursor/agents' },
  claude: { skills: '.claude/skills', rules: ['.claude/rules', '.md'], agents: '.claude/agents' },
  generic: { skills: 'docs/agent-flow/skills', rules: null, agents: 'docs/agent-flow/agents' },
};

function checkSkill(dir, name) {
  const data = fm(path.join(dir, 'SKILL.md'));
  assert.ok(data, `${dir}/SKILL.md 缺少 frontmatter`);
  assert.equal(data.name, name);
  assert.match(data.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.ok(data.name.length <= 64);
  assert.ok(typeof data.description === 'string' && data.description.length > 0 && data.description.length <= 1024, `${name} description`);
}

for (const [tool, spec] of Object.entries(TOOLS)) {
  test(`init --tool ${tool}：文件齐全、frontmatter 合法`, () => {
    const d = tmp({ 'package.json': JSON.stringify({ engines: { vscode: '^1.90.0' }, devDependencies: { vite: '^8.0.0' } }) });
    init(d, { tool, mode: 'brownfield' }, quiet);
    const skillDirs = fs.readdirSync(path.join(d, spec.skills));
    for (const s of [...SKILLS, 'vscode-release', 'web-verify-ui']) { assert.ok(skillDirs.includes(s), `${tool} 缺少技能 ${s}`); checkSkill(path.join(d, spec.skills, s), s); }
    for (const a of AGENTS) {
      const data = fm(path.join(d, spec.agents, `${a}.md`));
      assert.equal(data.name, a);
      assert.ok(data.description.length > 20);
      if (tool === 'cursor') { assert.equal(data.model, 'inherit'); assert.equal(typeof data.readonly, 'boolean'); }
      if (tool === 'trae') assert.match(String(data.tools), /Read/);
      if (tool === 'claude') { assert.deepEqual(data.skills, [fm(path.join(ROOT, 'core/agents', `${a}.md`)).skill]); assert.doesNotMatch(String(data.tools), /Skill/); }
      assert.doesNotMatch(read(path.join(d, spec.agents, `${a}.md`)), /\{\{|<!--@/, '未替换的 token / 条件块');
    }
    if (spec.rules) {
      const rules = fs.readdirSync(path.join(d, spec.rules[0]));
      for (const r of ['flow-workflow', 'flow-handoff-format', 'flow-scope-guard', 'vscode-extension', 'vscode-webview', 'web-frontend']) assert.ok(rules.includes(r + spec.rules[1]), `${tool} 缺少规则 ${r}`);
      for (const r of rules) {
        const data = fm(path.join(d, spec.rules[0], r));
        if (tool === 'claude') { if (data) assert.deepEqual(Object.keys(data), ['paths']); }
        else assert.deepEqual(Object.keys(data), ['description', 'globs', 'alwaysApply']);
      }
    } else {
      assert.match(read(path.join(d, 'AGENTS.md')), /## 流程规则（agent-flow）[\s\S]*### flow-scope-guard/);
    }
    for (const f of walk(d)) if (/\.(md|mdc)$/.test(f)) assert.doesNotMatch(read(path.join(d, f)), /\{\{[A-Z_]+\}\}/, `${f} 有未替换 token`);
    assert.match(read(path.join(d, 'AGENTS.md')), /默认模式：brownfield/);
    assert.ok(fs.existsSync(path.join(d, 'docs/flow/README.md')));
    const lock = JSON.parse(read(path.join(d, '.agent-flow/lock.json')));
    assert.deepEqual(lock.packs, ['vscode-extension', 'web']);
    assert.ok(Object.keys(lock.files).length > 20);
  });
}

test('兼容性：trae/cursor + --packs none 与 kit v1.1 一致（仅 design/implement 正文中技术栈段落除外）', () => {
  const d = tmp();
  init(d, { tool: 'trae,cursor', packs: 'none' }, quiet);
  const EXEMPT = /skills\/flow-(design|implement)\/SKILL\.md$/;
  const old = walk(FIX);
  assert.deepEqual(walk(d).filter((f) => !f.startsWith('.agent-flow/')), old, '文件集合一致');
  for (const f of old) {
    const a = read(path.join(d, f)), b = read(path.join(FIX, f));
    if (EXEMPT.test(f)) assert.equal(splitFrontmatter(a).raw, splitFrontmatter(b).raw, `${f} frontmatter`);
    else assert.equal(a, b, `${f} 应逐字节一致`);
  }
});

test('兼容性：启用 vscode-extension,web 后，v1.1 中被移出的原文逐字出现', () => {
  const d = tmp();
  init(d, { tool: 'trae,cursor', packs: 'vscode-extension,web' }, quiet);
  for (const tool of ['trae', 'cursor']) for (const s of ['flow-design', 'flow-implement']) {
    const now = read(path.join(d, `.${tool}/skills/${s}/SKILL.md`));
    const oldText = read(path.join(FIX, `.${tool}/skills/${s}/SKILL.md`));
    const coreText = read(path.join(ROOT, `core/skills/${s}/SKILL.md`));
    const moved = oldText.split('\n').filter((l) => l.trim() && !coreText.includes(l) && !/^6\. 平台要点：$/.test(l));
    assert.ok(moved.length >= 2, `${s}：应识别出被移出的行`);
    for (const l of moved) assert.ok(now.includes(l), `${tool}/${s} 缺少原文：${l}`);
  }
});

test('自动检测 pack', () => {
  const cases = [
    [{ 'package.json': '{"engines":{"vscode":"^1.90.0"}}' }, ['vscode-extension']],
    [{ 'package.json': '{"dependencies":{"next":"16.0.0"}}' }, ['web']],
    [{ 'package.json': '{}', 'vite.config.ts': '' }, ['web']],
    [{ 'pom.xml': '<project/>' }, ['java-backend']],
    [{ 'build.gradle.kts': '' }, ['java-backend']],
    [{ 'README.md': '' }, []],
  ];
  for (const [files, want] of cases) {
    const d = tmp(files);
    assert.deepEqual(init(d, { tool: 'generic', packs: 'auto' }, quiet).lock.packs, want, JSON.stringify(files));
  }
});

test('java-backend（骨架）的 hook 与验证命令被注入', () => {
  const d = tmp({ 'pom.xml': '<project/>' });
  init(d, { tool: 'claude' }, quiet);
  const impl = read(path.join(d, '.claude/skills/flow-implement/SKILL.md'));
  assert.match(impl, /## 技术栈补充（pack: java-backend）/);
  assert.match(impl, /\.\/mvnw -q verify/);
  assert.ok(fs.existsSync(path.join(d, '.claude/rules/java-spring.md')));
});

test('upgrade：未改文件被覆盖，改过的写 .agent-flow-new', () => {
  const d = tmp();
  init(d, { tool: 'cursor', packs: 'none' }, quiet);
  const lockPath = path.join(d, '.agent-flow/lock.json');
  const edited = path.join(d, '.cursor/rules/flow-workflow.mdc');
  const pristine = path.join(d, '.cursor/rules/flow-scope-guard.mdc');
  fs.appendFileSync(edited, '\n- 我的自定义规则\n');
  // 模拟旧版本生成的未修改文件：改内容并同步更新 lock 哈希
  const lock = JSON.parse(read(lockPath));
  fs.writeFileSync(pristine, 'old version\n');
  lock.files['.cursor/rules/flow-scope-guard.mdc'] = (await_sha('old version\n'));
  fs.writeFileSync(lockPath, JSON.stringify(lock));
  const { report } = upgrade(d, {}, quiet);
  assert.match(read(edited), /我的自定义规则/);
  assert.ok(fs.existsSync(edited + '.agent-flow-new'));
  assert.deepEqual(report.conflicts, ['.cursor/rules/flow-workflow.mdc']);
  assert.doesNotMatch(read(pristine), /old version/);
});
function await_sha(s) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16); }

test('init 不覆盖已有文件：AGENTS.md → AGENTS.flow.md；CLAUDE.md 保留', () => {
  const d = tmp({ 'AGENTS.md': '# mine\n', 'CLAUDE.md': '# my claude\n', '.cursor/rules/flow-workflow.mdc': 'custom\n' });
  init(d, { tool: 'claude,cursor', packs: 'none' }, quiet);
  assert.equal(read(path.join(d, 'AGENTS.md')), '# mine\n');
  assert.match(read(path.join(d, 'AGENTS.flow.md')), /## 开发流程/);
  assert.equal(read(path.join(d, 'CLAUDE.md')), '# my claude\n');
  assert.equal(read(path.join(d, '.cursor/rules/flow-workflow.mdc')), 'custom\n');
});

test('Claude Code：CLAUDE.md 导入 @AGENTS.md；规则只用 paths', () => {
  const d = tmp();
  init(d, { tool: 'claude', packs: 'none' }, quiet);
  assert.match(read(path.join(d, 'CLAUDE.md')), /^@AGENTS\.md$/m);
  assert.deepEqual(fm(path.join(d, '.claude/rules/flow-handoff-format.md')), { paths: ['docs/flow/**'] });
  assert.equal(fm(path.join(d, '.claude/rules/flow-workflow.md')), null);
  assert.deepEqual(fm(path.join(d, '.claude/agents/flow-reviewer.md')).skills, ['flow-review']);
  assert.match(read(path.join(d, '.claude/skills/flow-orchestrator/SKILL.md')), /\.claude\/agents\//);
});

test('new-pack 生成可被加载的 pack', () => {
  const dir = tmp();
  const dest = newPack('rust-cli', { packsDir: [dir] }, quiet);
  const p = listPacks([dir]).find((x) => x.name === 'rust-cli');
  assert.ok(p, 'list-packs 能找到');
  assert.equal(p.status, 'skeleton');
  checkSkill(path.join(dest, 'skills/rust-cli-example'), 'rust-cli-example');
  const d = tmp({ 'package.json': '{"dependencies":{"example":"1"}}' });
  assert.ok(init(d, { tool: 'trae', packsDir: [dir] }, quiet).lock.packs.includes('rust-cli'));
});

test('build 渲染 dist/<tool>/，默认只含 stable pack', () => {
  const out = tmp();
  build({ out }, quiet);
  for (const t of Object.keys(TOOLS)) assert.ok(fs.existsSync(path.join(out, t, 'AGENTS.md')));
  assert.ok(fs.existsSync(path.join(out, 'codeagent/.cac/AGENTS.md')));
  assert.ok(!fs.existsSync(path.join(out, 'claude/.claude/rules/java-spring.md')));
  assert.ok(fs.existsSync(path.join(out, 'cursor/.cursor/rules/web-frontend.mdc')));
});

test('所有 pack 与 core 源文件 frontmatter 合法', () => {
  for (const p of listPacks()) {
    assert.match(p.name, /^[a-z0-9-]+$/);
    assert.ok(p.description);
    for (const s of p.skills) checkSkill(path.join(p.dir, 'skills', s.name), s.name);
  }
  for (const f of walk(path.join(ROOT, 'core/agents'))) assert.ok(fm(path.join(ROOT, 'core/agents', f)).skill);
});

test('CLI 可通过 node 运行（跨平台）', () => {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'bin', 'agent-flow.mjs'), 'list-packs']).toString();
  assert.match(out, /vscode-extension/);
  const d = tmp();
  execFileSync(process.execPath, [path.join(ROOT, 'bin', 'agent-flow.mjs'), 'init', d, '--tool', 'cursor', '--packs', 'none', '--yes']);
  assert.ok(fs.existsSync(path.join(d, '.cursor', 'rules', 'flow-workflow.mdc')));
});

const hasBash = process.platform !== 'win32' && (() => { try { execFileSync('bash', ['-c', 'true']); return true; } catch { return false; } })();
test('bash 包装可运行（仅 POSIX）', { skip: !hasBash && '非 POSIX 或没有 bash' }, () => {
  const out = execFileSync('bash', [path.join(ROOT, 'bin', 'agent-flow'), 'list-packs']).toString();
  assert.match(out, /vscode-extension/);
});

test('Windows .cmd 包装可运行（仅 Windows）', { skip: process.platform !== 'win32' && '非 Windows' }, () => {
  const out = execSync(`"${path.join(ROOT, 'bin', 'agent-flow.cmd')}" list-packs`).toString();
  assert.match(out, /vscode-extension/);
});

test('CRLF 源文件也能正确解析', () => {
  const crlf = '---\r\nname: x\r\ndescription: \'a: b\'\r\ntools: [Read, Write]\r\n---\r\n\r\nbody\r\n';
  const { data, body } = splitFrontmatter(crlf);
  assert.deepEqual(data, { name: 'x', description: 'a: b', tools: ['Read', 'Write'] });
  assert.equal(body, '\nbody\n');
  const dir = tmp();
  newPack('crlf-pack', { packsDir: [dir] }, quiet);
  for (const f of walk(path.join(dir, 'crlf-pack'))) {
    const abs = path.join(dir, 'crlf-pack', f);
    fs.writeFileSync(abs, fs.readFileSync(abs, 'utf8').replace(/\n/g, '\r\n'));
  }
  const p = listPacks([dir]).find((x) => x.name === 'crlf-pack');
  assert.equal(p.status, 'skeleton');
  assert.equal(p.rules[0].name, 'crlf-pack');
  assert.ok(Array.isArray(p.verify) && p.verify.length === 1);
});

test('生成文件一律 LF，lock 中路径用 /', () => {
  const d = tmp();
  const { lock } = init(d, { tool: 'all', packs: 'web' }, quiet);
  for (const k of Object.keys(lock.files)) {
    assert.doesNotMatch(k, /\\/, k);
    assert.doesNotMatch(fs.readFileSync(path.join(d, k), 'utf8'), /\r/, k);
  }
});

test('upgrade：文件被 git 转成 CRLF 不算修改', () => {
  const d = tmp();
  init(d, { tool: 'trae', packs: 'none' }, quiet);
  const f = path.join(d, '.trae', 'rules', 'flow-workflow.md');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/\n/g, '\r\n'));
  const { report } = upgrade(d, {}, quiet);
  assert.deepEqual(report.conflicts, []);
});

// ---------------- codeagent（.cac/，布局按 Claude Code 假定） ----------------
const CAC_USER_FILES = {
  '.cac/settings.json': '{"model":"x"}\n',
  '.cac/AGENTS.local.md': '# 我的本地说明\n',
  '.cac/output-styles/terse.md': 'terse\n',
  '.cac/hooks/pre.sh': 'echo hi\n',
  '.cac/agent-memory/notes.md': 'mem\n',
  '.cac/agent-memory-local/notes.md': 'local mem\n',
};

test('codeagent：init 生成 .cac 布局、frontmatter 合法，不写根目录 AGENTS.md', () => {
  const d = tmp({ 'package.json': '{"engines":{"vscode":"^1.90.0"}}' });
  const { lock } = init(d, { tool: 'codeagent', mode: 'brownfield' }, quiet);
  assert.deepEqual(lock.tools, ['codeagent']);
  for (const s of [...SKILLS, 'vscode-release']) checkSkill(path.join(d, '.cac/skills', s), s);
  for (const a of AGENTS) {
    const data = fm(path.join(d, '.cac/agents', `${a}.md`));
    assert.equal(data.name, a);
    assert.equal(data.model, 'inherit');
    assert.deepEqual(data.skills, [fm(path.join(ROOT, 'core/agents', `${a}.md`)).skill]);
    assert.doesNotMatch(String(data.tools), /Skill/);
  }
  for (const r of ['flow-workflow', 'flow-handoff-format', 'flow-scope-guard', 'vscode-extension', 'vscode-webview']) {
    const data = fm(path.join(d, '.cac/rules', `${r}.md`));
    if (data) assert.deepEqual(Object.keys(data), ['paths']);
  }
  assert.deepEqual(fm(path.join(d, '.cac/rules/flow-handoff-format.md')), { paths: ['docs/flow/**'] });
  const ag = read(path.join(d, '.cac/AGENTS.md'));
  assert.match(ag, /## 开发流程/);
  assert.match(ag, /默认模式：brownfield/);
  assert.match(ag, /## CodeAgent（agent-flow）/);
  assert.match(read(path.join(d, '.cac/skills/flow-orchestrator/SKILL.md')), /\.cac\/agents\//);
  assert.match(read(path.join(d, '.cac/agents/flow-reviewer.md')), /\.cac\/skills\/flow-review\/SKILL\.md/);
  assert.ok(!fs.existsSync(path.join(d, 'AGENTS.md')), '单独安装 codeagent 不写根目录 AGENTS.md');
  assert.ok(!fs.existsSync(path.join(d, 'CLAUDE.md')));
  assert.ok(!fs.existsSync(path.join(d, '.claude')));
  for (const f of walk(d)) if (/\.md$/.test(f)) assert.doesNotMatch(read(path.join(d, f)), /\{\{[A-Z_]+\}\}|<!--@/, f);
});

test('codeagent：别名 cac；不在 --tool all 中；与其他工具同装时写根目录 AGENTS.md', () => {
  const d1 = tmp();
  assert.deepEqual(init(d1, { tool: 'cac', packs: 'none' }, quiet).lock.tools, ['codeagent']);
  const d2 = tmp();
  init(d2, { tool: 'all', packs: 'none' }, quiet);
  assert.ok(!fs.existsSync(path.join(d2, '.cac')));
  const d3 = tmp();
  init(d3, { tool: 'cursor,cac', packs: 'none' }, quiet);
  assert.ok(fs.existsSync(path.join(d3, 'AGENTS.md')) && fs.existsSync(path.join(d3, '.cac/AGENTS.md')));
});

test('codeagent：不触碰用户文件；已有 .cac/AGENTS.md → .cac/AGENTS.flow.md', () => {
  const d = tmp({ ...CAC_USER_FILES, '.cac/AGENTS.md': '# 我的项目说明\n' });
  const { files } = init(d, { tool: 'codeagent', packs: 'none' }, quiet);
  for (const [f, c] of Object.entries(CAC_USER_FILES)) assert.equal(read(path.join(d, f)), c, `${f} 被修改`);
  assert.equal(read(path.join(d, '.cac/AGENTS.md')), '# 我的项目说明\n');
  assert.match(read(path.join(d, '.cac/AGENTS.flow.md')), /## 开发流程/);
  const { PROTECTED } = ADAPTERS.codeagent;
  for (const f of files) assert.ok(!PROTECTED.some((p) => f.path === p || f.path.startsWith(p)), f.path);
  const lock = JSON.parse(read(path.join(d, '.agent-flow/lock.json')));
  for (const k of Object.keys(lock.files)) assert.ok(!PROTECTED.some((p) => k === p || k.startsWith(p)), k);
});

test('codeagent：upgrade 覆盖未改文件、保留改过的文件和用户文件', () => {
  const d = tmp(CAC_USER_FILES);
  init(d, { tool: 'codeagent', packs: 'none' }, quiet);
  const edited = path.join(d, '.cac/rules/flow-workflow.md');
  const agentsMd = path.join(d, '.cac/AGENTS.md');
  fs.appendFileSync(edited, '\n- 自定义\n');
  fs.writeFileSync(agentsMd, read(agentsMd).replace('<例如', '<我的'));
  const pristine = path.join(d, '.cac/agents/flow-analyst.md');
  const lockPath = path.join(d, '.agent-flow/lock.json');
  const lock = JSON.parse(read(lockPath));
  fs.writeFileSync(pristine, 'old\n');
  lock.files['.cac/agents/flow-analyst.md'] = await_sha('old\n');
  fs.writeFileSync(lockPath, JSON.stringify(lock));
  const { report } = upgrade(d, {}, quiet);
  assert.deepEqual(report.conflicts.sort(), ['.cac/AGENTS.md', '.cac/rules/flow-workflow.md']);
  assert.ok(fs.existsSync(edited + '.agent-flow-new') && fs.existsSync(agentsMd + '.agent-flow-new'));
  assert.match(read(edited), /自定义/);
  assert.match(read(pristine), /^---\nname: flow-analyst/);
  for (const [f, c] of Object.entries(CAC_USER_FILES)) assert.equal(read(path.join(d, f)), c);
});


// ---------------- 2.2.0：严格参数、显式 --tool、计划确认、uninstall ----------------
const CLI = path.join(ROOT, 'bin', 'agent-flow.mjs');
const run = (args, opts = {}) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts });
  return { code: r.status, out: r.stdout, err: r.stderr };
};

test('严格参数：漏写 -- 的 `init . tool cac` 报错并提示 --tool cac，不写任何文件', () => {
  const d = tmp();
  const r = run(['init', d, 'tool', 'cac', '--mode', 'brownfield']);
  assert.equal(r.code, 2);
  assert.match(r.err, /多了位置参数：tool cac/);
  assert.match(r.err, /是不是想写 --tool cac？/);
  assert.match(r.err, /用法：/);
  assert.deepEqual(fs.readdirSync(d), []);
});

test('严格参数：各种错误都给出建议', () => {
  const cases = [
    [['init', '.', 'cac'], /是不是想写 --tool cac？/],
    [['init', '.', '--tool', 'cac', 'brownfield'], /是不是想写 --mode brownfield？/],
    [['init', '.', '--tol', 'cac'], /不支持选项 --tol。是不是想写 --tool？/],
    [['init', '.', '-tool', 'cac'], /是不是想写 --tool？/],
    [['init', '.', '--tool', 'cak'], /未知工具：cak。是不是想写 cac？/],
    [['init', '.', '--tool', 'trae,cusor'], /未知工具：cusor。是不是想写 cursor？/],
    [['init', '.', '--tool', 'cac', '--mode', 'brownfeild'], /未知模式：brownfeild。是不是想写 brownfield？/],
    [['init', '.', '--tool', 'cac', '--packs', 'wbe'], /找不到 pack：wbe。是不是想写 web？/],
    [['init', '.', '--tool'], /--tool 需要一个值/],
    [['init', '.', '--tool', '--yes'], /--tool 需要一个值/],
    [['init', '.', '--yes=1', '--tool', 'cac'], /是开关，不接受值/],
    [['init'], /缺少参数：<项目目录>/],
    [['instal', '.'], /未知命令：instal。是不是想用 init？/],
    [['remove', '.'], /是不是想用 uninstall？/],
    [['upgrade', '.', '--tool', 'cac'], /upgrade 不支持选项 --tool/],
    [['build', 'extra'], /build 多了位置参数：extra/],
    [['list-packs', '--projct', '.'], /是不是想写 --project？/],
  ];
  for (const [args, re] of cases) {
    const r = run(args, { cwd: tmp() });
    assert.equal(r.code, 2, args.join(' '));
    assert.match(r.err, re, `${args.join(' ')}\n${r.err}`);
  }
});

test('init 必须显式 --tool（不再默认 all）', () => {
  const d = tmp();
  const r = run(['init', d, '--yes']);
  assert.equal(r.code, 2);
  assert.match(r.err, /请用 --tool 指定/);
  assert.deepEqual(fs.readdirSync(d), []);
  assert.throws(() => init(d, {}, quiet), /请用 --tool 指定/);
});

test('计划 + 确认：非 TTY 无 --yes 拒绝；--dry-run 只打印计划；--yes 写入', () => {
  const d = tmp({ 'AGENTS.md': '# mine\n' });
  const noYes = run(['init', d, '--tool', 'cac,cursor', '--mode', 'brownfield', '--packs', 'none']);
  assert.equal(noYes.code, 2);
  assert.match(noYes.out, /安装计划[\s\S]*目标目录：[\s\S]*工具：codeagent, cursor\s+模式：brownfield\s+packs：（无）/);
  assert.match(noYes.out, /新建 \d+ 个文件/);
  assert.match(noYes.out, /AGENTS\.md 已存在且不是 agent-flow 生成的：将写入 AGENTS\.flow\.md/);
  assert.match(noYes.err, /请加 --yes/);
  assert.deepEqual(fs.readdirSync(d), ['AGENTS.md']);
  const dry = run(['init', d, '--tool', 'cac', '--dry-run']);
  assert.equal(dry.code, 0);
  assert.match(dry.out, /--dry-run：未写入任何文件/);
  assert.deepEqual(fs.readdirSync(d), ['AGENTS.md']);
  const ok = run(['init', d, '--tool', 'cac', '-y', '--packs', 'none']);
  assert.equal(ok.code, 0, ok.err);
  assert.ok(fs.existsSync(path.join(d, '.cac/AGENTS.md')));
});

test('confirm：y 继续，回车/其他取消', async () => {
  const { PassThrough } = await import('node:stream');
  const ask = async (answer) => {
    const input = new PassThrough(); input.isTTY = true;
    const output = new PassThrough();
    const p = confirm('继续？', { input, output });
    input.end(answer + '\n');
    return p;
  };
  assert.equal(await ask('y'), true);
  assert.equal(await ask('YES'), true);
  assert.equal(await ask(''), false);
  assert.equal(await ask('n'), false);
  assert.equal(await confirm('x', { yes: true }), true);
  await assert.rejects(confirm('x', { input: { isTTY: false } }), /--yes/);
});

test('uninstall：只删未修改文件和新建的空目录，保留用户文件与已修改文件', () => {
  const d = tmp({ 'docs/flow/00-requirement.md': '# 我的需求\n', '.cursor/rules/mine.mdc': 'mine\n', 'src/a.ts': 'x\n' });
  init(d, { tool: 'all', packs: 'none' }, quiet);
  fs.appendFileSync(path.join(d, '.trae/rules/flow-workflow.md'), '\n- 我改的\n');
  const dry = uninstallPlan(d, {});
  assert.deepEqual(dry.modified, ['.trae/rules/flow-workflow.md']);
  assert.ok(dry.delete.length > 50);
  const r = uninstall(d, {}, quiet);
  assert.deepEqual(r.modified, ['.trae/rules/flow-workflow.md']);
  assert.equal(read(path.join(d, '.trae/rules/flow-workflow.md')).includes('我改的'), true);
  assert.equal(read(path.join(d, '.cursor/rules/mine.mdc')), 'mine\n');
  assert.equal(read(path.join(d, 'docs/flow/00-requirement.md')), '# 我的需求\n');
  assert.ok(!fs.existsSync(path.join(d, '.claude')), '.claude 整个被删除');
  assert.ok(!fs.existsSync(path.join(d, 'CLAUDE.md')) && !fs.existsSync(path.join(d, 'AGENTS.md')));
  assert.ok(!fs.existsSync(path.join(d, '.cursor/skills')) && fs.existsSync(path.join(d, '.cursor/rules')), '.cursor 原有目录保留');
  assert.ok(fs.existsSync(path.join(d, 'docs/flow')) && !fs.existsSync(path.join(d, 'docs/flow/README.md')));
  const lock = JSON.parse(read(path.join(d, '.agent-flow/lock.json')));
  assert.deepEqual(Object.keys(lock.files), ['.trae/rules/flow-workflow.md']);
  assert.deepEqual(lock.tools, []);
});

test('uninstall --tool：只卸载指定工具，共享文件留给其他工具', () => {
  const d = tmp();
  init(d, { tool: 'trae,cursor,claude', packs: 'none' }, quiet);
  const r = uninstall(d, { tool: 'claude,cursor' }, quiet);
  assert.deepEqual(r.keepTools, ['trae']);
  assert.ok(!fs.existsSync(path.join(d, '.claude')) && !fs.existsSync(path.join(d, '.cursor')) && !fs.existsSync(path.join(d, 'CLAUDE.md')));
  assert.ok(fs.existsSync(path.join(d, '.trae/skills/flow-review/SKILL.md')) && fs.existsSync(path.join(d, 'AGENTS.md')) && fs.existsSync(path.join(d, 'docs/flow/README.md')));
  const lock = JSON.parse(read(path.join(d, '.agent-flow/lock.json')));
  assert.deepEqual(lock.tools, ['trae']);
  assert.ok(Object.keys(lock.files).every((f) => !f.startsWith('.cursor') && !f.startsWith('.claude')));
  assert.equal(upgrade(d, {}, quiet).report.conflicts.length, 0);
  assert.throws(() => uninstall(d, { tool: 'cac' }, quiet), /lock 中没有安装这些工具：codeagent/);
});

test('uninstall：完全卸载后移除 lock；兼容 2.1.0 旧 lock（没有 dirs）', () => {
  const d = tmp({ 'docs/notes.md': 'keep\n' });
  init(d, { tool: 'trae,cursor,claude', packs: 'none' }, quiet);
  const lp = path.join(d, '.agent-flow/lock.json');
  const lock = JSON.parse(read(lp)); delete lock.dirs; lock.version = '2.1.0';
  fs.writeFileSync(lp, JSON.stringify(lock));
  uninstall(d, {}, quiet);
  assert.deepEqual(fs.readdirSync(d).sort(), ['docs']);
  assert.deepEqual(walk(d), ['docs/notes.md']);
  assert.ok(fs.existsSync(path.join(d, 'docs/flow')), 'docs/flow 永不删除');
});

test('uninstall CLI：计划、--dry-run、--yes', () => {
  const d = tmp();
  init(d, { tool: 'cursor', packs: 'none' }, quiet);
  const dry = run(['uninstall', d, '--dry-run']);
  assert.equal(dry.code, 0);
  assert.match(dry.out, /卸载计划[\s\S]*卸载工具：cursor[\s\S]*删除 \d+ 个未修改的文件/);
  assert.ok(fs.existsSync(path.join(d, '.cursor')));
  assert.equal(run(['uninstall', d]).code, 2);
  const ok = run(['uninstall', d, '--yes']);
  assert.equal(ok.code, 0, ok.err);
  assert.match(ok.out, /完成：删除 \d+ 个文件/);
  assert.deepEqual(fs.readdirSync(d).sort(), ['docs']);
  assert.match(run(['uninstall', d, '--yes']).err, /没有用 agent-flow 安装过/);
});

test('parseArgs：-- 之后都是位置参数；短选项 -y -h', () => {
  assert.equal(parseArgs(['init', '.', '-y', '--tool=cac']).yes, true);
  assert.equal(parseArgs(['init', '.', '--tool=cac']).tool, 'cac');
  assert.equal(parseArgs(['init', '-h']).help, true);
  assert.throws(() => parseArgs(['init', '.', '--', 'x']), /多了位置参数：x/);
});
