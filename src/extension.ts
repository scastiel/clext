import * as vscode from "vscode";
import { GitService } from "./gitService";
import { ChangedFilesTreeProvider } from "./changedFilesTree";
import { askClaude } from "./claudeIntegration";
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
  });

  const setCollapsed = (value: boolean) => {
    vscode.commands.executeCommand("setContext", "clext.treeCollapsed", value);
  };

  const switchMode = async (mode: DiffMode) => {
    await treeProvider.setMode(mode);
    treeView.title = DIFF_MODE_LABELS[mode];
    vscode.commands.executeCommand("setContext", "clext.mode", mode);
    setCollapsed(false);
  };

  // Set initial context
  vscode.commands.executeCommand("setContext", "clext.mode", DiffMode.Working);
  setCollapsed(false);

  context.subscriptions.push(
    treeView,
    gitService,
    treeProvider,

    vscode.commands.registerCommand("clext.switchMode.working", () => switchMode(DiffMode.Working)),
    vscode.commands.registerCommand("clext.switchMode.working.active", () => {}),
    vscode.commands.registerCommand("clext.switchMode.lastCommit", () =>
      switchMode(DiffMode.LastCommit)
    ),
    vscode.commands.registerCommand("clext.switchMode.lastCommit.active", () => {}),
    vscode.commands.registerCommand("clext.switchMode.branch", () => switchMode(DiffMode.Branch)),
    vscode.commands.registerCommand("clext.switchMode.branch.active", () => {}),

    vscode.commands.registerCommand("clext.refresh", () => treeProvider.refresh()),
    vscode.commands.registerCommand("clext.showMessage", (text: string) =>
      vscode.window.showInformationMessage(text)
    ),
    vscode.commands.registerCommand("clext.askClaude", () => askClaude()),

    vscode.commands.registerCommand("clext.collapseAll", async () => {
      await vscode.commands.executeCommand(
        "workbench.actions.treeView.clext.changedFiles.collapseAll"
      );
      setCollapsed(true);
    }),

    vscode.commands.registerCommand("clext.expandAll", async () => {
      for (const node of treeProvider.getRootNodes()) {
        await treeView.reveal(node, { expand: 2 });
      }
      setCollapsed(false);
    }),

    gitService.onDidChange(() => {
      if (treeProvider.getMode() === DiffMode.Working) {
        treeProvider.refresh();
      }
    })
  );

  treeView.title = DIFF_MODE_LABELS[DiffMode.Working];
  await treeProvider.refresh();
}

export function deactivate() {}
