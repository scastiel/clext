import * as vscode from "vscode";
import { GitService } from "./gitService";
import { ChangedFilesTreeProvider } from "./changedFilesTree";
import { ReviewCommentsProvider, addReviewComment, addFileReviewComment } from "./reviewComments";
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

  const reviewProvider = new ReviewCommentsProvider();
  const reviewView = vscode.window.createTreeView("clext.reviewComments", {
    treeDataProvider: reviewProvider,
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
    reviewView,
    gitService,
    treeProvider,
    reviewProvider,

    // Mode switching
    vscode.commands.registerCommand("clext.switchMode.working", () => switchMode(DiffMode.Working)),
    vscode.commands.registerCommand("clext.switchMode.working.active", () => {}),
    vscode.commands.registerCommand("clext.switchMode.lastCommit", () =>
      switchMode(DiffMode.LastCommit)
    ),
    vscode.commands.registerCommand("clext.switchMode.lastCommit.active", () => {}),
    vscode.commands.registerCommand("clext.switchMode.branch", () => switchMode(DiffMode.Branch)),
    vscode.commands.registerCommand("clext.switchMode.branch.active", () => {}),

    // Tree controls
    vscode.commands.registerCommand("clext.refresh", () => treeProvider.refresh()),
    vscode.commands.registerCommand("clext.showMessage", (text: string) =>
      vscode.window.showInformationMessage(text)
    ),
    vscode.commands.registerCommand("clext.collapseAll", async () => {
      await vscode.commands.executeCommand(
        "workbench.actions.treeView.clext.changedFiles.collapseAll"
      );
      setCollapsed(true);
    }),
    vscode.commands.registerCommand("clext.expandAll", async () => {
      const revealAll = async (nodes: ReturnType<typeof treeProvider.getChildren>) => {
        for (const node of nodes) {
          await treeView.reveal(node, { expand: true });
          const children = treeProvider.getChildren(node);
          await revealAll(children);
        }
      };
      await revealAll(treeProvider.getRootNodes());
      setCollapsed(false);
    }),

    // Review comments
    vscode.commands.registerCommand("clext.addReviewComment", () =>
      addReviewComment(reviewProvider)
    ),
    vscode.commands.registerCommand("clext.addFileReviewComment", (fileNode) =>
      addFileReviewComment(reviewProvider, fileNode)
    ),
    vscode.commands.registerCommand("clext.removeReviewComment", (comment) => {
      if (comment.id === "") return;
      reviewProvider.remove(comment.id);
    }),
    vscode.commands.registerCommand("clext.copyReviewComments", async () => {
      const text = reviewProvider.copyAll();
      if (!text) {
        vscode.window.showInformationMessage("No review comments to copy.");
        return;
      }
      await vscode.env.clipboard.writeText(text);
      vscode.window.showInformationMessage("Review comments copied to clipboard.");
    }),
    vscode.commands.registerCommand("clext.clearReviewComments", () => {
      reviewProvider.clearAll();
    }),

    // Auto-refresh
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
