import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync, execSync } from 'node:child_process';
import crypto from 'node:crypto';
import { init, upgrade, newPack, build } from '../bin/agent-flow.mjs';
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
  execFileSync(process.execPath, [path.join(ROOT, 'bin', 'agent-flow.mjs'), 'init', d, '--tool', 'cursor', '--packs', 'none']);
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
