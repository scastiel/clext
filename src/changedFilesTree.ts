import * as vscode from "vscode";
import type { Change, Status } from "./git";
import type { GitService } from "./gitService";
import { DiffMode } from "./types";

export type TreeNode = FolderNode | FileNode;

interface FolderNode {
  type: "folder";
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  parent: FolderNode | undefined;
}

export interface FileNode {
  type: "file";
  name: string;
  change: Change;
  parent: FolderNode | undefined;
}

const STATUS_ICONS: Partial<Record<Status, string>> = {
  0: "M", // INDEX_MODIFIED
  1: "A", // INDEX_ADDED
  2: "D", // INDEX_DELETED
  3: "R", // INDEX_RENAMED
  5: "M", // MODIFIED
  6: "D", // DELETED
  7: "U", // UNTRACKED
};

export class ChangedFilesTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private mode: DiffMode = DiffMode.Working;
  private tree: Map<string, TreeNode> = new Map();

  constructor(private readonly gitService: GitService) {}

  getMode(): DiffMode {
    return this.mode;
  }

  async setMode(mode: DiffMode): Promise<void> {
    this.mode = mode;
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const changes = await this.gitService.getChangedFiles(this.mode);
    this.tree = this.buildTree(changes);
    this.onDidChangeTreeDataEmitter.fire();
  }

  private buildTree(changes: Change[]): Map<string, TreeNode> {
    const root = new Map<string, TreeNode>();

    for (const change of changes) {
      const relativePath = vscode.workspace.asRelativePath(change.uri);
      const parts = relativePath.split("/");

      let current = root;
      let parentNode: FolderNode | undefined;
      for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i];
        let existing = current.get(folderName);
        if (!existing || existing.type !== "folder") {
          existing = {
            type: "folder",
            name: folderName,
            path: parts.slice(0, i + 1).join("/"),
            children: new Map(),
            parent: parentNode,
          };
          current.set(folderName, existing);
        }
        parentNode = existing;
        current = existing.children;
      }

      const fileName = parts[parts.length - 1];
      current.set(fileName, { type: "file", name: fileName, change, parent: parentNode });
    }

    return this.flattenSingleChildFolders(root, undefined);
  }

  private flattenSingleChildFolders(
    nodes: Map<string, TreeNode>,
    parent: FolderNode | undefined
  ): Map<string, TreeNode> {
    const result = new Map<string, TreeNode>();

    for (const [key, node] of nodes) {
      node.parent = parent;
      if (node.type === "folder") {
        node.children = this.flattenSingleChildFolders(node.children, node);

        if (node.children.size === 1) {
          const [childKey, child] = [...node.children.entries()][0];
          if (child.type === "folder") {
            const merged: FolderNode = {
              type: "folder",
              name: `${node.name}/${child.name}`,
              path: child.path,
              children: child.children,
              parent,
            };
            // Re-parent children to point to merged node
            for (const grandchild of merged.children.values()) {
              grandchild.parent = merged;
            }
            result.set(`${key}/${childKey}`, merged);
            continue;
          }
        }
      }
      result.set(key, node);
    }

    return result;
  }

  async getTreeItem(element: TreeNode): Promise<vscode.TreeItem> {
    if (element.type === "folder") {
      const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = vscode.ThemeIcon.Folder;
      return item;
    }

    const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
    item.iconPath = vscode.ThemeIcon.File;
    item.resourceUri = element.change.uri;
    item.contextValue = "changedFile";

    const statusChar = STATUS_ICONS[element.change.status] ?? "?";
    item.description = statusChar;

    const action = await this.gitService.getFileAction(element.change, this.mode);
    if (action.type === "diff") {
      item.command = {
        command: "vscode.diff",
        title: "Show Diff",
        arguments: [action.left, action.right, action.title],
      };
    } else if (action.type === "message") {
      item.command = {
        command: "clext.showMessage",
        title: "Show Info",
        arguments: [action.text],
      };
    } else {
      item.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [element.change.uri],
      };
    }

    return item;
  }

  getRootNodes(): TreeNode[] {
    return this.sortNodes([...this.tree.values()]);
  }

  getParent(element: TreeNode): TreeNode | undefined {
    return element.parent;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      return this.getRootNodes();
    }
    if (element.type === "folder") {
      return this.sortNodes([...element.children.values()]);
    }
    return [];
  }

  private sortNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  dispose(): void {
    this.onDidChangeTreeDataEmitter.dispose();
  }
}
