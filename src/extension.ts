import * as vscode from "vscode";
import { GitService } from "./gitService";
import { ChangedFilesTreeProvider } from "./changedFilesTree";
import { DiffMode, DIFF_MODE_LABELS } from "./types";

export async function activate(context: vscode.ExtensionContext) {
  const gitService = new GitService();
  const initialized = await gitService.initialize();

  if (!initialized) {
    vscode.window.showWarningMessage("CLext: Git extension not found.");
    return;
  }

  const treeProvider = new ChangedFilesTreeProvider(gitService);
  const treeView = vscode.window.createTreeView("clext.changedFiles", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  // Update view title with current mode
  const updateTitle = () => {
    treeView.title = DIFF_MODE_LABELS[treeProvider.getMode()];
  };

  const switchMode = async (mode: DiffMode) => {
    await treeProvider.setMode(mode);
    updateTitle();
  };

  context.subscriptions.push(
    treeView,
    gitService,
    treeProvider,

    vscode.commands.registerCommand("clext.switchMode.working", () => switchMode(DiffMode.Working)),
    vscode.commands.registerCommand("clext.switchMode.lastCommit", () =>
      switchMode(DiffMode.LastCommit)
    ),
    vscode.commands.registerCommand("clext.switchMode.branch", () => switchMode(DiffMode.Branch)),
    vscode.commands.registerCommand("clext.refresh", () => treeProvider.refresh()),

    gitService.onDidChange(() => {
      if (treeProvider.getMode() === DiffMode.Working) {
        treeProvider.refresh();
      }
    })
  );

  updateTitle();
  await treeProvider.refresh();
}

export function deactivate() {}
