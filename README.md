# CLext - Claude Code Diff Navigator

A minimalist VSCode extension for reviewing code changes made by Claude Code.

https://github.com/user-attachments/assets/75a2427f-e8b8-49cb-aada-400bebb3114f

## Features

### Diff Mode Switcher
Three modes to quickly switch which changes you're reviewing:
- **Working Changes** - local unstaged/staged changes vs HEAD
- **Last Commit** - changes in the latest commit (HEAD~1..HEAD)
- **vs Main** - all changes on your branch vs main

The active mode is shown as a filled dot in the toolbar. The base branch is configurable (defaults to `main`).

### Changed Files Tree
- Files grouped by directory (like the Explorer), not a flat list
- Click any file to open its diff in the correct scope
- Collapse/expand toggle button
- Auto-refreshes when git state changes (in Working mode)

### Review Comments
- Select code in any editor, right-click -> **"Add Review Comment"**
- Right-click a file in the Changed Files tree -> **"Add Review Comment"** to comment on a file without selecting lines
- **Add Global Comment** button (➕) in the Review Comments panel to add comments not tied to any file
- Comments appear in the Review Comments panel below the file tree
- Click a comment to jump to the relevant code
- **Copy All** button formats comments as a list for pasting into Claude:
  ```
  Review comments:
  - (general): consider splitting this into smaller commits
  - src/foo.ts: this file should be split into smaller modules
  - src/foo.ts:10-15: this should use async/await
  - src/bar.ts:42-50: rename this variable
  ```
- **Clear All** button to reset

## Install

1. Download the latest `.vsix` file from the [Releases page](https://github.com/scastiel/clext/releases)
2. Install it:
   ```bash
   code --install-extension clext-*.vsix
   ```
   Or in VSCode: Extensions view -> `...` menu -> **Install from VSIX...** -> select the `.vsix` file.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `clext.baseBranch` | `main` | Base branch for the "vs Main" diff mode |

## Development

```bash
npm install
npm run build      # bundle with esbuild
npm run watch      # bundle in watch mode
npm run typecheck   # type-check with tsc
npm run lint       # run ESLint
npm run format     # format with Prettier
npm run package    # package as .vsix
```

Press **Fn+F5** in VSCode to launch the Extension Development Host for testing.
