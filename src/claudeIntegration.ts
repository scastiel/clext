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

  // Try sending to a Claude Code terminal first
  const terminal = findClaudeTerminal();
  if (terminal) {
    terminal.show();
    terminal.sendText(message);
    return;
  }

  // Fall back: copy to clipboard and focus Claude Code sidebar
  await vscode.env.clipboard.writeText(message);

  // Try to focus the Claude Code panel
  try {
    await vscode.commands.executeCommand("claude-dev.focus");
  } catch {
    // Ignore if command doesn't exist
  }

  vscode.window.showInformationMessage("Copied to clipboard — paste in Claude Code.");
}

function findClaudeTerminal(): vscode.Terminal | undefined {
  const terminals = vscode.window.terminals;
  return terminals.find(
    (t) => t.name.toLowerCase().includes("claude") || t.name.toLowerCase().includes("claud")
  );
}
