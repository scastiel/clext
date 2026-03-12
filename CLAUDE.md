# CLext - VSCode Extension

## Project overview

CLext is a minimalist VSCode extension for reviewing code changes made by Claude Code. See `docs/PRD.md` for the full product spec.

## Tech stack

- **Language**: TypeScript (strict mode)
- **Runtime**: VSCode Extension Host (Node.js, CommonJS)
- **Bundler**: esbuild (single bundle, `vscode` marked as external)
- **Min VSCode version**: 1.84.0
- **Formatting**: Prettier
- **Linting**: ESLint (flat config with @typescript-eslint)

## Commands

- `npm run build` - Bundle the extension with esbuild
- `npm run watch` - Bundle in watch mode for development
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check formatting without writing
- `npm run typecheck` - Run TypeScript type checking (tsc --noEmit)
- `npm run package` - Package the extension as .vsix

## Code style

- Prettier handles all formatting. Do not manually format code.
- ESLint enforces code quality rules. All code must pass `npm run lint` before committing.
- Use `import type` for type-only imports.
- Prefer `const` over `let`. Never use `var`.
- Use async/await, not raw Promises or callbacks.
- No `any` types. Use `unknown` and narrow with type guards when the type is truly unknown.

## Git workflow

- Make small, focused commits.
- Run `npm run lint` and `npm run format:check` before committing.
- Commit messages: imperative mood, lowercase, no period (e.g., "add changed files tree view").

## Architecture rules

- **Do not reimplement git operations.** Use the VSCode Git Extension API (`vscode.git`).
- **Do not reimplement diff rendering.** Use `vscode.commands.executeCommand('vscode.diff', ...)`.
- **Minimize dependencies.** The extension should have zero runtime npm dependencies — only `@types/vscode`, `typescript`, `esbuild`, `eslint`, `prettier`, and their configs as devDependencies.
- Keep files small and focused. One responsibility per module.
- All disposables must be pushed to `context.subscriptions` in `activate()`.

## Project structure

```
src/
  extension.ts          - Entry point (activate/deactivate)
  gitService.ts         - Git Extension API wrapper
  changedFilesTree.ts   - TreeDataProvider for changed files
  reviewComments.ts     - Review comments panel and logic
  types.ts              - Shared types and enums
media/
  icon.svg              - Activity bar icon
docs/
  PRD.md                - Product requirements
```

## Testing the extension

Press F5 in VSCode to launch the Extension Development Host. This opens a new VSCode window with the extension loaded. Use the command palette and the CLext sidebar panel to test.

## Fixing issues

When asked to fix issues or work on the next task:

1. **Find an issue to work on.** List open issues with the `accepted` label:
   ```
   gh issue list --label accepted --state open
   ```
   Pick the one that looks easiest and has the fewest dependencies on other issues. If unsure, read the issue details with `gh issue view <number>`.

   **Skip issues that already have an open PR.** Check with:
   ```
   gh pr list --state open --search "fixes #<issue-number>"
   ```
   If a PR exists for that issue, move on to the next one.

2. **Create a branch** named after the issue:
   ```
   git checkout -b fix/<issue-number>-<short-description> main
   ```

3. **Implement the fix.** Follow all code style and architecture rules above. Run `npm run typecheck`, `npm run lint`, and `npm run format:check` before committing.

4. **Update the README.** If the change affects user-facing features, commands, or behavior, update `README.md` to keep it in sync.

5. **Push and open a PR** referencing the issue:
   ```
   git push -u origin HEAD
   gh pr create --title "<short description>" --body "Fixes #<issue-number>"
   ```
   The PR description should explain what changed and why. Always include `Fixes #<number>` so the issue auto-closes on merge.
