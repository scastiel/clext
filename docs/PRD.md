# CLext - Claude Code Diff Navigator

## Problem

When using Claude Code, the developer rarely edits code by hand. Their primary workflow is **reviewing changes** Claude made. VSCode's built-in Git views are designed for a traditional editing workflow and fall short in three ways:

1. **Switching between diff scopes is cumbersome.** Changes may be local (unstaged/staged), in the last commit (just committed but not pushed), or across the full branch (vs. main). There's no single control to toggle between these views.

2. **No file tree when viewing commit changes.** The built-in Git log/commit view shows a flat file list. When reviewing a commit, you lose the spatial context of the file tree, making it hard to understand the scope of changes.

3. **No way to select code and talk to Claude about it.** To ask Claude Code to tweak something you're looking at, you have to manually describe the file, line range, and context in the terminal. There should be a direct "select lines -> ask Claude" flow.

## Solution

A **minimalist VSCode extension** that adds a single sidebar panel with:

- A **mode switcher** (3 modes) that controls which diff scope is shown
- A **tree view of changed files** (always visible, grouped by folder)
- A **context menu action** on selected code to send a prompt to Claude Code

The extension **does not reimplement** git operations or diff rendering. It orchestrates existing VSCode/Git commands.

---

## Feature 1: Diff Mode Switcher

### Modes

| Mode | Label | What it shows | Git equivalent |
|------|-------|---------------|----------------|
| **Working** | `Working Changes` | Unstaged + staged changes vs HEAD | `git diff HEAD` |
| **Last Commit** | `Last Commit` | Changes in HEAD vs HEAD~1 | `git diff HEAD~1..HEAD` |
| **Branch** | `vs Main` | Changes on current branch vs main | `git diff main...HEAD` |

### UX

- Three buttons at the top of the sidebar panel (radio-style toggle).
- The active mode determines which files appear in the tree below.
- Switching mode refreshes the file tree immediately.
- The base branch for "Branch" mode defaults to `main` but is configurable via a setting (`clext.baseBranch`).

### Implementation

- Use the **Git Extension API** (`vscode.git`) to get the repository.
- For **Working** mode: read `repository.state.workingTreeChanges`, `indexChanges`, and `untrackedChanges`.
- For **Last Commit** mode: use `repository.diffBetween('HEAD~1', 'HEAD', path)` or `repository.log({ maxEntries: 1 })` to get the last commit, then list its changed files.
- For **Branch** mode: use `repository.diffBetween('main', 'HEAD', path)` and `repository.diffBetweenWithStats('main', 'HEAD')` to get changed files.
- Listen to `repository.state.onDidChange` to auto-refresh in Working mode.

---

## Feature 2: Changed Files Tree View

### UX

- Files are displayed in a **tree grouped by directory** (like the Explorer), not a flat list.
- Each file shows a status icon (modified, added, deleted, renamed) reusing VSCode's built-in theme colors.
- Clicking a file opens the **diff editor** for that file in the current mode's scope.
  - Working: `vscode.diff(HEAD version, working version)`
  - Last Commit: `vscode.diff(HEAD~1 version, HEAD version)`
  - Branch: `vscode.diff(main version, HEAD version)`
- The tree is the **primary and only view** in the extension's sidebar panel.

### Implementation

- Implement `TreeDataProvider<FileTreeItem>` where items can be **folders** (collapsible) or **files** (leaf nodes).
- Build the tree by splitting file paths on `/` and creating intermediate folder nodes.
- On file click, use `vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title)`.
- To construct URIs for git refs, use the Git extension's internal URI scheme: `git:/path?{"ref":"<ref>","path":"<path>"}` (base64-encoded query).
- Refresh the tree when:
  - The mode changes
  - `repository.state.onDidChange` fires (for Working mode)
  - The user manually triggers refresh (refresh button in the view title bar)

---

## Feature 3: Ask Claude About Selection

### UX

1. User selects lines of code in any editor (including diff editors).
2. Right-click -> **"Ask Claude About This"** (context menu), or use a keyboard shortcut.
3. A **quick input box** appears with the prompt: the file path and line range are pre-filled as context.
4. User types their request (e.g., "refactor this to use async/await").
5. The extension sends the message to the active Claude Code terminal.

### Implementation

- Register an **editor context menu** command (`editor/context` menu contribution).
- On trigger:
  - Get `vscode.window.activeTextEditor.selection` for the selected range.
  - Get the file path (relative to workspace root).
  - If in a diff editor, resolve the actual file path from the diff URI.
  - Show `vscode.window.showInputBox({ prompt: "What should Claude do with this code?" })`.
  - Compose the message: `In <file>:<startLine>-<endLine>, <user's request>`
  - Find the Claude Code terminal (search `vscode.window.terminals` for a terminal whose name contains "Claude" or that is running `claude`).
  - Use `terminal.sendText(message)` to send it.
- If no Claude Code terminal is found, show an informational message suggesting to start one.

### Edge cases

- **Diff editor**: The active file may be a virtual git URI. Extract the real file path from the URI query params.
- **No selection**: If no text is selected, use the entire file as context (just send the file path, no line range).
- **Multiple terminals**: If multiple Claude terminals exist, use the most recently active one, or let the user pick via `showQuickPick`.

---

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `clext.baseBranch` | `string` | `"main"` | Base branch for "vs Main" diff mode |

---

## Extension Manifest Summary

```
contributes:
  viewsContainers:
    activitybar:
      - id: clext
        title: CLext
        icon: media/icon.svg

  views:
    clext:
      - id: clext.changedFiles
        name: Changed Files

  commands:
    - command: clext.switchMode.working
      title: "CLext: Working Changes"
    - command: clext.switchMode.lastCommit
      title: "CLext: Last Commit"
    - command: clext.switchMode.branch
      title: "CLext: vs Main"
    - command: clext.askClaude
      title: "Ask Claude About This"
    - command: clext.refresh
      title: "CLext: Refresh"

  menus:
    editor/context:
      - command: clext.askClaude

    view/title:
      - command: clext.switchMode.working
        when: view == clext.changedFiles
        group: navigation
      - command: clext.switchMode.lastCommit
        when: view == clext.changedFiles
        group: navigation
      - command: clext.switchMode.branch
        when: view == clext.changedFiles
        group: navigation
      - command: clext.refresh
        when: view == clext.changedFiles
        group: navigation

  configuration:
    title: CLext
    properties:
      clext.baseBranch:
        type: string
        default: main
        description: Base branch for the "vs Main" diff mode
```

---

## Project Structure

```
clext/
  src/
    extension.ts          # activate/deactivate, register commands
    gitService.ts         # Wraps Git Extension API, provides changed files per mode
    changedFilesTree.ts   # TreeDataProvider for the file tree
    claudeIntegration.ts  # "Ask Claude" command logic
    types.ts              # Shared types, enums (DiffMode, etc.)
  media/
    icon.svg              # Activity bar icon
  package.json
  tsconfig.json
  .vscodeignore
```

---

## Step-by-Step Development Guide

### Prerequisites

```bash
npm install -g yo generator-code @vscode/vsce
```

### Phase 1: Scaffold & Hello World

1. We'll scaffold manually (not `yo code`) since we already have the structure planned.
2. Initialize `package.json`, `tsconfig.json`, install `@types/vscode`, `typescript`, `esbuild`.
3. Create minimal `src/extension.ts` that registers a command and shows a notification.
4. Set up `.vscode/launch.json` to launch Extension Development Host.
5. **Test**: Press F5 in VSCode -> new window opens -> run command from palette -> see notification.

### Phase 2: Git Service + Mode Switcher

1. Copy `git.d.ts` types from VSCode repo for type safety.
2. Implement `gitService.ts`: connect to `vscode.git` extension, expose `getChangedFiles(mode)`.
3. Implement the 3 mode-switching commands that update state and trigger refresh.
4. **Test**: Switch modes via command palette, verify console logs show correct file lists.

### Phase 3: Changed Files Tree

1. Implement `changedFilesTree.ts` with `TreeDataProvider`.
2. Build folder-grouped tree from flat file paths.
3. Wire file click to open `vscode.diff` with correct URIs per mode.
4. Add mode toggle buttons to the view title bar.
5. **Test**: See files in sidebar, click to open diffs, switch modes.

### Phase 4: Ask Claude

1. Implement `claudeIntegration.ts`.
2. Register editor context menu command.
3. Implement terminal discovery and `sendText`.
4. **Test**: Select code, right-click, type request, verify it appears in Claude Code terminal.

### Phase 5: Polish

1. Add proper icons for the activity bar and file status.
2. Handle edge cases (no git repo, no changes, detached HEAD).
3. Add the `clext.baseBranch` setting.
4. Package with `vsce package` for local install testing.
