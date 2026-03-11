import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("clext.refresh", () => {
    vscode.window.showInformationMessage("CLext is working!");
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
