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
  claudeIntegration.ts  - "Ask Claude" command
  types.ts              - Shared types and enums
media/
  icon.svg              - Activity bar icon
docs/
  PRD.md                - Product requirements
```

## Testing the extension

Press F5 in VSCode to launch the Extension Development Host. This opens a new VSCode window with the extension loaded. Use the command palette and the CLext sidebar panel to test.
