// 纯函数：不依赖 vscode，便于单元测试（AC-5）
export interface TodoItem {
  line: number;      // 0-based
  column: number;    // 0-based，关键字起始列
  tag: string;       // 命中的关键字，如 TODO
  text: string;      // 关键字之后的说明文字
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function buildMatcher(keywords: readonly string[]): RegExp | undefined {
  const clean = keywords.map(k => k.trim()).filter(k => k.length > 0);
  if (clean.length === 0) { return undefined; }
  // 只匹配注释里的关键字：// # /* * <!-- -- 之后
  return new RegExp(`(?:\\/\\/|#|\\/\\*|\\*|<!--|--)\\s*\\b(${clean.map(escapeRe).join('|')})\\b[:：]?\\s*(.*)$`);
}

export function parseTodos(content: string, keywords: readonly string[]): TodoItem[] {
  const re = buildMatcher(keywords);
  if (!re) { return []; }
  const items: TodoItem[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = re.exec(lines[i]);
    if (m) {
      const tag = m[1];
      items.push({
        line: i,
        column: lines[i].indexOf(tag, m.index),
        tag,
        text: m[2].replace(/\s*(\*\/|-->)\s*$/, '').trim(),
      });
    }
  }
  return items;
}

/** 按标签筛选；tag 为 undefined 表示"全部"（P-6，AC-2） */
export function filterByTag(items: readonly TodoItem[], tag: string | undefined): TodoItem[] {
  return tag === undefined ? [...items] : items.filter(i => i.tag === tag);
}
