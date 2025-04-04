import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { BaseTool } from './baseTool';
import { OutputPanel } from '../ui/outputPanel';

/**
 * Tool for executing terminal commands
 */
export class TerminalTool extends BaseTool {
  private context: vscode.ExtensionContext;
  private outputPanel: OutputPanel;
  private terminals: Map<string, vscode.Terminal> = new Map();
  private runningProcesses: Map<string, child_process.ChildProcess> = new Map();

  constructor(context: vscode.ExtensionContext, outputPanel: OutputPanel) {
    super();
    this.context = context;
    this.outputPanel = outputPanel;
  }

  /**
   * Get the name of the tool
   */
  get name(): string {
    return 'terminal';
  }

  /**
   * Get the description of the tool
   */
  get description(): string {
    return 'Execute commands in a terminal and capture their output';
  }

  /**
   * Get the JSON schema for the tool's parameters
   */
  get parameters(): Record<string, any> {
    return {
      type: 'object',
      required: ['command'],
      properties: {
        command: {
          type: 'string',
          description: 'The command to execute'
        },
        cwd: {
          type: 'string',
          description: 'The working directory for the command'
        },
        captureOutput: {
          type: 'boolean',
          description: 'Whether to capture the output of the command',
          default: true
        },
        showTerminal: {
          type: 'boolean',
          description: 'Whether to show the terminal window',
          default: false
        },
        terminalName: {
          type: 'string',
          description: 'Name for the terminal instance'
        }
      }
    };
  }

  /**
   * Execute the terminal tool with the given input
   */
  public async execute(input: any): Promise<any> {
    const cwd = this.resolveCwd(input.cwd);
    
    if (input.showTerminal) {
      return this.executeInTerminal(input.command, cwd, input.terminalName);
    } else {
      return this.executeWithOutput(input.command, cwd, input.captureOutput);
    }
  }

  /**
   * Execute a command in a VS Code terminal
   */
  private async executeInTerminal(
    command: string,
    cwd: string,
    terminalName: string = 'Code Agent'
  ): Promise<{ success: boolean; terminalName: string }> {
    try {
      // Get or create a terminal
      let terminal = this.terminals.get(terminalName);
      if (!terminal) {
        terminal = vscode.window.createTerminal({
          name: terminalName,
          cwd: cwd
        });
        this.terminals.set(terminalName, terminal);
      }

      // Show the terminal and execute the command
      terminal.show();
      terminal.sendText(command);

      return { success: true, terminalName };
    } catch (error: any) {
      throw new Error(`Failed to execute in terminal: ${error.message}`);
    }
  }

  /**
   * Execute a command and capture its output
   */
  private executeWithOutput(
    command: string,
    cwd: string,
    captureOutput: boolean = true
  ): Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise((resolve, reject) => {
      // Log the command being executed
      this.outputPanel.appendLine(`Executing: ${command} in ${cwd}`);

      const process = child_process.exec(
        command,
        { cwd, maxBuffer: 1024 * 1024 * 5 },
        (error, stdout, stderr) => {
          this.runningProcesses.delete(command);

          if (error && error.code !== 0) {
            this.outputPanel.appendLine(`Error executing command: ${error.message}`);
            this.outputPanel.appendLine(`Command output (stderr): ${stderr}`);
            
            resolve({
              success: false,
              stdout,
              stderr,
              exitCode: error.code
            });
          } else {
            if (captureOutput) {
              this.outputPanel.appendLine(`Command output:\n${stdout}`);
            }
            
            resolve({
              success: true,
              stdout,
              stderr,
              exitCode: 0
            });
          }
        }
      );

      this.runningProcesses.set(command, process);

      // Capture real-time output if requested
      if (captureOutput) {
        if (process.stdout) {
          process.stdout.on('data', (data) => {
            this.outputPanel.append(data.toString());
          });
        }
        
        if (process.stderr) {
          process.stderr.on('data', (data) => {
            this.outputPanel.append(data.toString(), true);
          });
        }
      }
    });
  }

  /**
   * Resolve the working directory for a command
   */
  private resolveCwd(cwd?: string): string {
    if (cwd) {
      return cwd;
    }
    
    // Use the first workspace folder as the default working directory
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].uri.fsPath;
    }
    
    // Fallback to the user's home directory
    return require('os').homedir();
  }

  /**
   * Clean up resources on disposal
   */
  dispose() {
    // Kill any running processes
    for (const [command, process] of this.runningProcesses.entries()) {
      try {
        process.kill();
      } catch (error) {
        console.error(`Failed to kill process for command '${command}':`, error);
      }
    }
    
    // Dispose of terminals
    for (const terminal of this.terminals.values()) {
      try {
        terminal.dispose();
      } catch (error) {
        console.error('Failed to dispose terminal:', error);
      }
    }
  }
}
