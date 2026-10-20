// Minimal, dependency-free YAML subset parser — enough for pack.yaml, core manifests and
// Markdown frontmatter. Supported: nested maps (indent), block lists ("- x", "- k: v" + continuation),
// inline lists [a, b], inline maps {a: b}, quoted/plain scalars, true/false/null/numbers,
// block scalars "|" and ">", comments. Not supported: anchors, tags, multi-docs, complex keys.

function stripComment(s) {
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q && s[i - 1] !== '\\') q = null; continue; }
    if (c === '"' || c === "'") { if (i === 0 || /[\s:\[{,-]/.test(s[i - 1])) q = c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i).trimEnd();
  }
  return s;
}

function splitTop(s, sep) {
  const out = []; let depth = 0, q = null, cur = '';
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '[' || c === '{') depth++;
    if (c === ']' || c === '}') depth--;
    if (c === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}

export function parseScalar(raw) {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) return JSON.parse(s);
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) return s.slice(1, -1).replace(/''/g, "'");
  if (s.startsWith('[') && s.endsWith(']')) return splitTop(s.slice(1, -1), ',').map(parseScalar);
  if (s.startsWith('{') && s.endsWith('}')) {
    const o = {};
    for (const part of splitTop(s.slice(1, -1), ',')) {
      const i = part.indexOf(':'); o[part.slice(0, i).trim()] = parseScalar(part.slice(i + 1));
    }
    return o;
  }
  return s;
}

const keyRe = /^([^\s"'#\-\[{][^:]*?|"[^"]*"|'[^']*'):(\s+|$)(.*)$/;

export function parseYaml(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map(l => ({ raw: l, ind: l.match(/^ */)[0].length }));
  let i = 0;
  const isBlank = l => stripComment(l.raw).trim() === '';
  const skip = () => { while (i < lines.length && isBlank(lines[i])) i++; };

  function blockScalar(style, parentInd) {
    const buf = []; let ind = null;
    while (i < lines.length) {
      const l = lines[i];
      if (l.raw.trim() === '') { buf.push(''); i++; continue; }
      if (l.ind <= parentInd) break;
      if (ind === null) ind = l.ind;
      buf.push(l.raw.slice(ind)); i++;
    }
    while (buf.length && buf[buf.length - 1] === '') buf.pop();
    return style.startsWith('>') ? buf.join(' ').replace(/ {2,}/g, ' ') + '\n' : buf.join('\n') + '\n';
  }

  function value(rest, ind) {
    const r = stripComment(rest).trim();
    if (r === '|' || r === '|-' || r === '>' || r === '>-') return blockScalar(r, ind);
    if (r === '') { skip(); return i < lines.length && lines[i].ind > ind ? node(lines[i].ind) : (i < lines.length && lines[i].ind === ind && stripComment(lines[i].raw).trim().startsWith('- ') ? node(ind) : null); }
    return parseScalar(r);
  }

  function node(ind) {
    skip();
    if (i >= lines.length) return null;
    const first = stripComment(lines[i].raw).trim();
    if (first === '-' || first.startsWith('- ')) {
      const arr = [];
      while (i < lines.length) {
        skip(); if (i >= lines.length) break;
        const l = lines[i]; const t = stripComment(l.raw).trim();
        if (l.ind !== ind || !(t === '-' || t.startsWith('- '))) break;
        const after = t === '-' ? '' : t.slice(2);
        const itemInd = ind + 2;
        if (after === '') { i++; arr.push(node(lines[i] ? lines[i].ind : itemInd)); continue; }
        const m = after.match(keyRe);
        if (m && !after.startsWith('{') && !after.startsWith('[')) {
          // map item: rewrite current line as a key line at itemInd
          lines[i] = { raw: ' '.repeat(itemInd) + after, ind: itemInd };
          arr.push(map(itemInd));
        } else { i++; arr.push(parseScalar(after)); }
      }
      return arr;
    }
    return map(ind);
  }

  function map(ind) {
    const obj = {};
    while (i < lines.length) {
      skip(); if (i >= lines.length) break;
      const l = lines[i];
      if (l.ind < ind) break;
      if (l.ind > ind) throw new Error(`YAML: 意外的缩进，第 ${i + 1} 行：${l.raw}`);
      const t = stripComment(l.raw).slice(ind);
      if (t.startsWith('- ')) break;
      const m = t.match(keyRe);
      if (!m) throw new Error(`YAML: 无法解析第 ${i + 1} 行：${l.raw}`);
      i++;
      obj[String(parseScalar(m[1]))] = value(m[3], ind);
    }
    return obj;
  }

  skip();
  if (i >= lines.length) return {};
  return node(lines[i].ind);
}

/** Split "---\nyaml\n---\nbody" → { data, body, raw }; returns null data when no frontmatter. */
export function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: null, body: text, raw: '' };
  return { data: parseYaml(m[1]), body: m[2], raw: m[1] };
}
