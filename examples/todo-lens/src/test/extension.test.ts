// 集成测试（@vscode/test-cli 会下载 VS Code 并运行）：npm test
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('TODO Lens 集成', () => {
  test('注册了 todoLens.refresh 命令（AC-1）', async () => {
    const cmds = await vscode.commands.getCommands(true);
    assert.ok(cmds.includes('todoLens.refresh'));
  });
});
