import * as vscode from 'vscode';
import { parseTodos } from './scanner';
import { TodoTreeProvider } from './todoTree';

function config() {
  const c = vscode.workspace.getConfiguration('todoLens');
  return {
    keywords: c.get<string[]>('keywords', ['TODO', 'FIXME']),
    exclude: c.get<string>('exclude', '**/{node_modules,dist,out,.git}/**'),
    maxFiles: c.get<number>('maxFiles', 2000),
  };
}

export function activate(context: vscode.ExtensionContext) {
  const tree = new TodoTreeProvider();
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  status.command = 'workbench.view.extension.todoLens';

  const updateStatus = () => {             // AC-3：状态栏显示总数
    status.text = `$(checklist) ${tree.total}`;
    status.tooltip = `TODO Lens：共 ${tree.total} 条`;
    status.show();
  };

  const scanFile = async (uri: vscode.Uri, keywords: string[]) => {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      tree.setFile(uri, parseTodos(Buffer.from(bytes).toString('utf8'), keywords));
    } catch {
      tree.setFile(uri, []);               // 读失败（二进制/权限）视为无 TODO
    }
  };

  const scanAll = async () => {            // AC-1
    const { keywords, exclude, maxFiles } = config();
    await vscode.window.withProgress(
      { location: { viewId: 'todoLens.list' }, title: '扫描 TODO…' },
      async () => {
        const files = await vscode.workspace.findFiles('**/*', exclude, maxFiles);
        tree.clear();
        await Promise.all(files.map(f => scanFile(f, keywords)));
        if (files.length >= maxFiles) {
          vscode.window.showWarningMessage(`TODO Lens：文件数达到上限 ${maxFiles}，结果可能不完整。`);
        }
      },
    );
    tree.refresh();
    updateStatus();
  };

  const view = vscode.window.createTreeView('todoLens.list', { treeDataProvider: tree });

  const pickTag = async () => {            // P-3：AC-1、AC-3
    const counts = tree.countsByTag();
    const picks: (vscode.QuickPickItem & { tag: string | undefined })[] = [
      { label: '全部', description: `${tree.total}`, tag: undefined },
      ...config().keywords.map(k => ({ label: k, description: `${counts.get(k) ?? 0}`, tag: k })),
    ];
    const sel = await vscode.window.showQuickPick(picks, { placeHolder: '按标签筛选 TODO' });
    if (!sel) { return; }
    tree.setFilter(sel.tag);
    view.description = sel.tag ? `筛选：${sel.tag}` : undefined;
    tree.refresh();
  };

  context.subscriptions.push(
    tree,
    status,
    view,
    vscode.commands.registerCommand('todoLens.refresh', scanAll),
    vscode.commands.registerCommand('todoLens.filterByTag', pickTag),
    vscode.workspace.onDidSaveTextDocument(async doc => {   // AC-4：保存后增量刷新
      if (doc.uri.scheme !== 'file' || !vscode.workspace.getWorkspaceFolder(doc.uri)) { return; }
      tree.setFile(doc.uri, parseTodos(doc.getText(), config().keywords));
      tree.refresh();
      updateStatus();
    }),
    vscode.workspace.onDidChangeConfiguration(e => {        // AC-5：改关键字后重扫
      if (e.affectsConfiguration('todoLens')) { void scanAll(); }
    }),
  );

  void scanAll();
}

export function deactivate() {}
