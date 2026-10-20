import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const read = (p) => fs.readFileSync(p, 'utf8');
export const exists = (p) => fs.existsSync(p);
export const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

/** Recursively list files (relative paths, posix separators, sorted). */
export function walk(dir, base = dir) {
  if (!exists(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out.sort();
}

export function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

/** getPath({a:{b:1}}, 'a.b') → 1 */
export const getPath = (obj, dotted) =>
  dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/** Replace {{TOKEN}} placeholders; unknown tokens are left as-is. */
export const fill = (text, tokens) =>
  text.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in tokens ? String(tokens[k]) : m));

/** Keep/strip <!--@only a,b--> … <!--@end--> and <!--@except a--> … <!--@end--> blocks for a tool. */
export function conditional(text, tool) {
  return text.replace(/<!--@(only|except) ([\w,-]+)-->\n([\s\S]*?)<!--@end-->\n/g, (_, kind, list, inner) => {
    const hit = list.split(',').includes(tool);
    return (kind === 'only' ? hit : !hit) ? inner : '';
  });
}

export const asList = (v) => (v == null || v === '' ? [] : Array.isArray(v) ? v : String(v).split(',').map((s) => s.trim()).filter(Boolean));
