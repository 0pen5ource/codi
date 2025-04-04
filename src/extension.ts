import * as vscode from 'vscode';
import { AgentManager } from './agents/agentManager';
import { InputPanel } from './ui/inputPanel';
import { OutputPanel } from './ui/outputPanel';
import { setupTools } from './tools/toolRegistry';

/**
 * Extension activation function that runs when the extension is loaded
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('Code Agent extension is now active');

  // Initialize components
  const agentManager = new AgentManager(context);
  const outputPanel = new OutputPanel(context);
  const inputPanel = new InputPanel(context, agentManager, outputPanel);
  
  // Register all available tools
  const tools = setupTools(context, outputPanel);
  agentManager.registerTools(tools);

  // Register commands
  const generateCodeCommand = vscode.commands.registerCommand('code-agent.generateCode', async () => {
    inputPanel.show("Generate Code");
  });

  const fixCodeCommand = vscode.commands.registerCommand('code-agent.fixCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }
    
    const selection = editor.selection;
    const text = editor.document.getText(selection.isEmpty ? undefined : selection);
    
    inputPanel.show("Fix Code", text);
  });

  const validateCodeCommand = vscode.commands.registerCommand('code-agent.validateCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }
    
    await agentManager.validateCode(editor.document);
  });

  const runCodeCommand = vscode.commands.registerCommand('code-agent.runCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }
    
    await agentManager.runCode(editor.document);
  });

  // Add disposables to context
  context.subscriptions.push(
    generateCodeCommand,
    fixCodeCommand,
    validateCodeCommand,
    runCodeCommand,
    inputPanel,
    outputPanel,
    agentManager
  );
}

/**
 * Extension deactivation function that runs when the extension is unloaded
 */
export function deactivate() {
  console.log('Code Agent extension is now deactivated');
}
