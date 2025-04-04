import * as vscode from 'vscode';
import { BaseTool } from './baseTool';
import { FileSystemTool } from './fileSystemTool';
import { TerminalTool } from './terminalTool';
import { BrowserPreviewTool } from './browserPreviewTool';
import { CodeAnalysisTool } from './codeAnalysisTool';
import { OutputPanel } from '../ui/outputPanel';

/**
 * Sets up and registers all available tools
 * @param context Extension context
 * @param outputPanel Output panel for displaying tool results
 * @returns Array of initialized tools
 */
export function setupTools(context: vscode.ExtensionContext, outputPanel: OutputPanel): BaseTool[] {
  const tools: BaseTool[] = [
    new FileSystemTool(context),
    new TerminalTool(context, outputPanel),
    new BrowserPreviewTool(context),
    new CodeAnalysisTool(context)
  ];

  // Add language-specific tools based on installed language extensions
  // This would be expanded to automatically detect and load appropriate language tools
  
  return tools;
}
