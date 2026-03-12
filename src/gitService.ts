import * as vscode from "vscode";
import type { API, GitExtension, Repository, Change, Status } from "./git";
import { DiffMode } from "./types";

// Status values for added/deleted files
const ADDED_STATUSES: Set<Status> = new Set([
  1, // INDEX_ADDED
  7, // UNTRACKED
  9, // INTENT_TO_ADD
  12, // ADDED_BY_US
  13, // ADDED_BY_THEM
  16, // BOTH_ADDED
] as Status[]);

const DELETED_STATUSES: Set<Status> = new Set([
  2, // INDEX_DELETED
  6, // DELETED
  14, // DELETED_BY_US
  15, // DELETED_BY_THEM
] as Status[]);

const RENAMED_STATUSES: Set<Status> = new Set([
  3, // INDEX_RENAMED
  10, // INTENT_TO_RENAME
] as Status[]);

export class GitService {
  private api: API | undefined;
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.onDidChangeEmitter.event;

  private stateListener: vscode.Disposable | undefined;

  /**
   * Resolve a branch name to its remote tracking ref if available.
   * e.g. "main" → "origin/main" when main tracks origin/main.
   * Falls back to the original name if no upstream is found.
   */
  private async resolveBaseRef(repo: Repository, branchName: string): Promise<string> {
    try {
      const branch = await repo.getBranch(branchName);
      if (branch.upstream) {
        return `${branch.upstream.remote}/${branch.upstream.name}`;
      }
    } catch {
      // Branch may not exist locally — use as-is
    }
    return branchName;
  }

  async initialize(): Promise<boolean> {
    const gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git");
    if (!gitExtension) {
      return false;
    }

    if (!gitExtension.isActive) {
      await gitExtension.activate();
    }

    this.api = gitExtension.exports.getAPI(1);

    // Listen for repository state changes
    if (this.api.repositories.length > 0) {
      this.watchRepository(this.api.repositories[0]);
    }
    this.api.onDidOpenRepository((repo) => this.watchRepository(repo));

    return true;
  }

  private watchRepository(repo: Repository): void {
    this.stateListener?.dispose();
    this.stateListener = repo.state.onDidChange(() => {
      this.onDidChangeEmitter.fire();
    });
  }

  getRepository(): Repository | undefined {
    return this.api?.repositories[0];
  }

  async getChangedFiles(mode: DiffMode): Promise<Change[]> {
    const repo = this.getRepository();
    if (!repo) {
      return [];
    }

    switch (mode) {
      case DiffMode.Working:
        return [
          ...repo.state.workingTreeChanges,
          ...repo.state.indexChanges,
          ...repo.state.untrackedChanges,
        ];

      case DiffMode.LastCommit:
        return repo.diffBetween("HEAD~1", "HEAD");

      case DiffMode.Branch: {
        const baseBranch = vscode.workspace
          .getConfiguration("clext")
          .get<string>("baseBranch", "main");
        const baseRef = await this.resolveBaseRef(repo, baseBranch);
        const mergeBase = await repo.getMergeBase(baseRef, "HEAD");
        return repo.diffBetween(mergeBase ?? baseRef, "HEAD");
      }
    }
  }

  async getFileAction(
    change: Change,
    mode: DiffMode
  ): Promise<
    | { type: "diff"; left: vscode.Uri; right: vscode.Uri; title: string }
    | { type: "open" }
    | { type: "message"; text: string }
  > {
    if (!this.api) {
      return { type: "open" };
    }

    const filePath = vscode.workspace.asRelativePath(change.uri);

    if (DELETED_STATUSES.has(change.status)) {
      return { type: "message", text: `${filePath} was deleted` };
    }

    if (RENAMED_STATUSES.has(change.status)) {
      const originalPath = vscode.workspace.asRelativePath(change.originalUri);
      return { type: "message", text: `${originalPath} was renamed to ${filePath}` };
    }

    const isAdded = ADDED_STATUSES.has(change.status);
    const emptyUri = this.api.toGitUri(change.uri, "~");

    switch (mode) {
      case DiffMode.Working: {
        const left = isAdded ? emptyUri : this.api.toGitUri(change.uri, "HEAD");
        const right = change.uri;
        return { type: "diff", left, right, title: `${filePath} (Working)` };
      }

      case DiffMode.LastCommit: {
        const left = isAdded ? emptyUri : this.api.toGitUri(change.uri, "HEAD~1");
        const right = this.api.toGitUri(change.uri, "HEAD");
        return { type: "diff", left, right, title: `${filePath} (Last Commit)` };
      }

      case DiffMode.Branch: {
        const baseBranch = vscode.workspace
          .getConfiguration("clext")
          .get<string>("baseBranch", "main");
        const repo = this.getRepository();
        const resolvedBase = repo ? await this.resolveBaseRef(repo, baseBranch) : baseBranch;
        const mergeBase = repo ? await repo.getMergeBase(resolvedBase, "HEAD") : undefined;
        const baseRef = mergeBase ?? resolvedBase;
        const left = isAdded ? emptyUri : this.api.toGitUri(change.uri, baseRef);
        const right = this.api.toGitUri(change.uri, "HEAD");
        return { type: "diff", left, right, title: `${filePath} (vs ${baseBranch})` };
      }
    }
  }

  dispose(): void {
    this.stateListener?.dispose();
    this.onDidChangeEmitter.dispose();
  }
}
