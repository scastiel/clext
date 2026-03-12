import * as vscode from "vscode";

export interface ReviewComment {
  id: number;
  filePath: string;
  startLine: number | undefined;
  endLine: number | undefined;
  text: string;
  uri: vscode.Uri;
}

export class ReviewCommentsProvider implements vscode.TreeDataProvider<ReviewComment> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private comments: ReviewComment[] = [];
  private nextId = 1;

  add(comment: Omit<ReviewComment, "id">): void {
    this.comments.push({ ...comment, id: this.nextId++ });
    this.onDidChangeTreeDataEmitter.fire();
  }

  remove(id: number): void {
    this.comments = this.comments.filter((c) => c.id !== id);
    this.onDidChangeTreeDataEmitter.fire();
  }

  clearAll(): void {
    this.comments = [];
    this.onDidChangeTreeDataEmitter.fire();
  }

  copyAll(): string {
    if (this.comments.length === 0) {
      return "";
    }

    const lines = this.comments.map((c) => {
      const location = c.startLine ? `${c.filePath}:${c.startLine}-${c.endLine}` : c.filePath;
      return `- ${location}: ${c.text}`;
    });

    return `Review comments:\n${lines.join("\n")}`;
  }

  getTreeItem(element: ReviewComment): vscode.TreeItem {
    const item = new vscode.TreeItem(element.text, vscode.TreeItemCollapsibleState.None);

    const location = element.startLine
      ? `${element.filePath}:${element.startLine}-${element.endLine}`
      : element.filePath;
    item.description = location;
    item.tooltip = `${location}\n${element.text}`;
    item.contextValue = "reviewComment";
    item.iconPath = new vscode.ThemeIcon("comment");

    if (element.startLine) {
      item.command = {
        command: "vscode.open",
        title: "Go to Code",
        arguments: [
          element.uri,
          { selection: new vscode.Range(element.startLine - 1, 0, element.startLine - 1, 0) },
        ],
      };
    } else {
      item.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [element.uri],
      };
    }

    return item;
  }

  getChildren(): ReviewComment[] {
    return this.comments;
  }

  dispose(): void {
    this.onDidChangeTreeDataEmitter.dispose();
  }
}

export function addFileReviewComment(
  provider: ReviewCommentsProvider,
  fileNode: { change: { uri: vscode.Uri } }
): void {
  const uri = fileNode.change.uri;
  const filePath = vscode.workspace.asRelativePath(uri);

  vscode.window
    .showInputBox({
      prompt: `Review comment for ${filePath}`,
      placeHolder: "e.g., this file should be split into smaller modules",
    })
    .then((text) => {
      if (!text) {
        return;
      }
      provider.add({
        filePath,
        startLine: undefined,
        endLine: undefined,
        text,
        uri,
      });
    });
}

export function addReviewComment(provider: ReviewCommentsProvider): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor.");
    return;
  }

  const selection = editor.selection;
  const filePath = vscode.workspace.asRelativePath(editor.document.uri);

  let location: string;
  let startLine: number | undefined;
  let endLine: number | undefined;

  if (selection.isEmpty) {
    location = filePath;
  } else {
    startLine = selection.start.line + 1;
    endLine = selection.end.line + 1;
    location = `${filePath}:${startLine}-${endLine}`;
  }

  vscode.window
    .showInputBox({
      prompt: `Review comment for ${location}`,
      placeHolder: "e.g., this should use async/await instead",
    })
    .then((text) => {
      if (!text) {
        return;
      }
      provider.add({
        filePath,
        startLine,
        endLine,
        text,
        uri: editor.document.uri,
      });
    });
}
