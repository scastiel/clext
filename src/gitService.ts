import * as vscode from "vscode";
import type { API, GitExtension, Repository, Change } from "./git";
import { DiffMode } from "./types";

export class GitService {
  private api: API | undefined;
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.onDidChangeEmitter.event;

  private stateListener: vscode.Disposable | undefined;

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
        return repo.diffBetween(baseBranch, "HEAD");
      }
    }
  }

  getDiffUris(
    change: Change,
    mode: DiffMode
  ): { left: vscode.Uri; right: vscode.Uri; title: string } | undefined {
    const repo = this.getRepository();
    if (!repo || !this.api) {
      return undefined;
    }

    const filePath = vscode.workspace.asRelativePath(change.uri);

    switch (mode) {
      case DiffMode.Working: {
        const left = this.api.toGitUri(change.uri, "HEAD");
        const right = change.uri;
        return { left, right, title: `${filePath} (Working)` };
      }

      case DiffMode.LastCommit: {
        const left = this.api.toGitUri(change.uri, "HEAD~1");
        const right = this.api.toGitUri(change.uri, "HEAD");
        return { left, right, title: `${filePath} (Last Commit)` };
      }

      case DiffMode.Branch: {
        const baseBranch = vscode.workspace
          .getConfiguration("clext")
          .get<string>("baseBranch", "main");
        const left = this.api.toGitUri(change.uri, baseBranch);
        const right = this.api.toGitUri(change.uri, "HEAD");
        return { left, right, title: `${filePath} (vs ${baseBranch})` };
      }
    }
  }

  dispose(): void {
    this.stateListener?.dispose();
    this.onDidChangeEmitter.dispose();
  }
}
