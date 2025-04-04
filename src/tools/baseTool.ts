import * as vscode from 'vscode';

/**
 * Base interface for all tools that can be used by the agent
 */
export abstract class BaseTool implements vscode.Disposable {
  /**
   * The name of the tool
   */
  abstract get name(): string;
  
  /**
   * Description of the tool's functionality for the agent
   */
  abstract get description(): string;
  
  /**
   * JSON schema for the tool's parameters
   */
  abstract get parameters(): Record<string, any>;
  
  /**
   * Execute the tool with the given input
   * @param input Input parameters for the tool
   * @returns Result of tool execution
   */
  abstract execute(input: any): Promise<any>;
  
  /**
   * Clean up resources on disposal
   */
  dispose() {
    // Default implementation does nothing
  }
}
