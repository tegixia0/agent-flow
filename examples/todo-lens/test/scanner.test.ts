// 单元测试（node:test），不需要启动 VS Code：npm run test:unit
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { parseTodos, filterByTag } from '../src/scanner';

test('匹配 // 与 # 注释中的 TODO/FIXME，并给出 0-based 行号', () => {
  const src = 'const a = 1; // TODO: 改成配置\n# FIXME 处理空值\nconst TODO = 3;';
  const r = parseTodos(src, ['TODO', 'FIXME']);
  assert.equal(r.length, 2);
  assert.deepEqual(r.map(x => [x.line, x.tag, x.text]), [[0, 'TODO', '改成配置'], [1, 'FIXME', '处理空值']]);
  assert.equal(r[0].column, src.split('\n')[0].indexOf('TODO'));
});

test('块注释与 HTML 注释去掉结尾符号', () => {
  const r = parseTodos('/* TODO 拆分函数 */\n<!-- FIXME：对齐 -->', ['TODO', 'FIXME']);
  assert.deepEqual(r.map(x => x.text), ['拆分函数', '对齐']);
});

test('自定义关键字，且会转义正则元字符', () => {
  assert.equal(parseTodos('// HACK x\n// TODO y', ['HACK']).length, 1);
  assert.equal(parseTodos('// C++ 注意', ['C++']).length, 0, '\\b 边界下 C++ 不匹配，也不应抛错');
});

test('关键字为空时返回空数组', () => {
  assert.deepEqual(parseTodos('// TODO x', []), []);
  assert.deepEqual(parseTodos('// TODO x', ['  ']), []);
});

test('filterByTag：按标签筛选，undefined 表示全部（AC-2）', () => {
  const items = parseTodos('// TODO a\n// FIXME b\n// TODO c', ['TODO', 'FIXME']);
  assert.deepEqual(filterByTag(items, 'TODO').map(i => i.text), ['a', 'c']);
  assert.deepEqual(filterByTag(items, 'FIXME').map(i => i.line), [1]);
  assert.equal(filterByTag(items, undefined).length, 3);
  assert.deepEqual(filterByTag(items, 'HACK'), []);
});
