import * as vscode from 'vscode';
import { TodoItem, filterByTag } from './scanner';

type Node =
  | { kind: 'file'; uri: vscode.Uri; items: TodoItem[] }
  | { kind: 'todo'; uri: vscode.Uri; item: TodoItem };

export class TodoTreeProvider implements vscode.TreeDataProvider<Node> {
  private readonly emitter = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private readonly byFile = new Map<string, { uri: vscode.Uri; items: TodoItem[] }>();

  /** 用一个文件的最新结果替换旧结果；items 为空时移除该文件（AC-4） */
  setFile(uri: vscode.Uri, items: TodoItem[]): void {
    if (items.length === 0) { this.byFile.delete(uri.toString()); }
    else { this.byFile.set(uri.toString(), { uri, items }); }
  }

  clear(): void { this.byFile.clear(); }
  refresh(): void { this.emitter.fire(undefined); }

  private tag: string | undefined;                 // P-1：当前筛选，undefined = 全部
  get filter(): string | undefined { return this.tag; }
  setFilter(tag: string | undefined): void { this.tag = tag; }

  /** 每个标签的条目数（不受筛选影响），供 QuickPick 显示（P-1 联动 P-3） */
  countsByTag(): Map<string, number> {
    const m = new Map<string, number>();
    for (const f of this.byFile.values()) {
      for (const i of f.items) { m.set(i.tag, (m.get(i.tag) ?? 0) + 1); }
    }
    return m;
  }

  get total(): number {
    let n = 0;
    for (const f of this.byFile.values()) { n += f.items.length; }
    return n;
  }

  getChildren(node?: Node): Node[] {
    if (!node) {
      return [...this.byFile.values()]
        .map(f => ({ kind: 'file' as const, uri: f.uri, items: filterByTag(f.items, this.tag) }))
        .filter(f => f.items.length > 0)            // AC-2：无匹配的文件不显示
        .sort((a, b) => a.uri.fsPath.localeCompare(b.uri.fsPath));
    }
    return node.kind === 'file'
      ? node.items.map(item => ({ kind: 'todo' as const, uri: node.uri, item }))
      : [];
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === 'file') {
      const ti = new vscode.TreeItem(node.uri, vscode.TreeItemCollapsibleState.Expanded);
      ti.description = `${node.items.length}`;
      return ti;
    }
    const { item } = node;
    const ti = new vscode.TreeItem(`${item.tag}: ${item.text || '(无说明)'}`);
    ti.description = `L${item.line + 1}`;
    ti.iconPath = new vscode.ThemeIcon(item.tag === 'FIXME' ? 'warning' : 'circle-outline');
    const pos = new vscode.Position(item.line, Math.max(0, item.column));
    ti.command = {                      // AC-2：点击跳转到对应行
      command: 'vscode.open',
      title: '打开',
      arguments: [node.uri, { selection: new vscode.Range(pos, pos) } satisfies vscode.TextDocumentShowOptions],
    };
    return ti;
  }

  dispose(): void { this.emitter.dispose(); }
}
