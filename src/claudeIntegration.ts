import * as vscode from "vscode";

export async function askClaude(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor.");
    return;
  }

  const selection = editor.selection;
  const filePath = vscode.workspace.asRelativePath(editor.document.uri);

  // Build context prefix
  let context: string;
  if (selection.isEmpty) {
    context = filePath;
  } else {
    const startLine = selection.start.line + 1;
    const endLine = selection.end.line + 1;
    context = `${filePath}:${startLine}-${endLine}`;
  }

  const request = await vscode.window.showInputBox({
    prompt: `Ask Claude about ${context}`,
    placeHolder: "e.g., refactor this to use async/await",
  });

  if (!request) {
    return;
  }

  const message = `In ${context}, ${request}`;
  const terminal = findClaudeTerminal();

  if (!terminal) {
    vscode.window.showWarningMessage(
      "No Claude Code terminal found. Start Claude Code in the terminal first."
    );
    return;
  }

  terminal.show();
  terminal.sendText(message);
}

function findClaudeTerminal(): vscode.Terminal | undefined {
  const terminals = vscode.window.terminals;

  // Look for a terminal running claude (by name)
  const claudeTerminal = terminals.find(
    (t) => t.name.toLowerCase().includes("claude") || t.name.toLowerCase().includes("claud")
  );
  if (claudeTerminal) {
    return claudeTerminal;
  }

  // Fall back to the active terminal
  return vscode.window.activeTerminal;
}
