import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from './baseTool';

/**
 * Tool for interacting with the file system
 */
export class FileSystemTool extends BaseTool {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    super();
    this.context = context;
  }

  /**
   * Get the name of the tool
   */
  get name(): string {
    return 'file-system';
  }

  /**
   * Get the description of the tool
   */
  get description(): string {
    return 'Read and write files, list directories, and perform other file system operations';
  }

  /**
   * Get the JSON schema for the tool's parameters
   */
  get parameters(): Record<string, any> {
    return {
      type: 'object',
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: ['read', 'write', 'list', 'exists', 'delete', 'mkdir'],
          description: 'The file system action to perform'
        },
        path: {
          type: 'string',
          description: 'The path to the file or directory'
        },
        content: {
          type: 'string',
          description: 'The content to write to the file (required for write action)'
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to recursively create directories (for mkdir action)'
        }
      }
    };
  }

  /**
   * Execute the file system tool with the given input
   */
  public async execute(input: any): Promise<any> {
    // Normalize the path
    if (input.path) {
      if (!path.isAbsolute(input.path)) {
        // If path is relative, resolve it against the workspace root
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          throw new Error('No workspace folder is open');
        }
        input.path = path.join(workspaceFolders[0].uri.fsPath, input.path);
      }
    }

    switch (input.action) {
      case 'read':
        return this.readFile(input.path);
      case 'write':
        return this.writeFile(input.path, input.content);
      case 'list':
        return this.listDirectory(input.path);
      case 'exists':
        return this.fileExists(input.path);
      case 'delete':
        return this.deleteFile(input.path);
      case 'mkdir':
        return this.makeDirectory(input.path, input.recursive);
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  }

  /**
   * Read the content of a file
   */
  private async readFile(filePath: string): Promise<string> {
    try {
      // Use VS Code API to read file
      const uri = vscode.Uri.file(filePath);
      const content = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(content).toString('utf-8');
    } catch (error: any) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Write content to a file
   */
  private async writeFile(filePath: string, content: string): Promise<{ success: boolean; path: string }> {
    try {
      // Ensure the directory exists
      const dirPath = path.dirname(filePath);
      await this.ensureDirectoryExists(dirPath);

      // Use VS Code API to write file
      const uri = vscode.Uri.file(filePath);
      const uint8Array = Buffer.from(content, 'utf-8');
      await vscode.workspace.fs.writeFile(uri, uint8Array);
      
      return { success: true, path: filePath };
    } catch (error: any) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  /**
   * List the contents of a directory
   */
  private async listDirectory(dirPath: string): Promise<{ name: string; type: string; path: string }[]> {
    try {
      // Use VS Code API to list directory
      const uri = vscode.Uri.file(dirPath);
      const entries = await vscode.workspace.fs.readDirectory(uri);
      
      return entries.map(([name, type]) => {
        return {
          name,
          type: type === vscode.FileType.Directory ? 'directory' : 'file',
          path: path.join(dirPath, name)
        };
      });
    } catch (error: any) {
      throw new Error(`Failed to list directory: ${error.message}`);
    }
  }

  /**
   * Check if a file or directory exists
   */
  private async fileExists(filePath: string): Promise<{ exists: boolean; type?: string }> {
    try {
      const uri = vscode.Uri.file(filePath);
      const stat = await vscode.workspace.fs.stat(uri);
      
      let type = 'unknown';
      if (stat.type === vscode.FileType.Directory) {
        type = 'directory';
      } else if (stat.type === vscode.FileType.File) {
        type = 'file';
      }
      
      return { exists: true, type };
    } catch (error) {
      return { exists: false };
    }
  }

  /**
   * Delete a file or directory
   */
  private async deleteFile(filePath: string): Promise<{ success: boolean }> {
    try {
      const uri = vscode.Uri.file(filePath);
      await vscode.workspace.fs.delete(uri, { recursive: true });
      return { success: true };
    } catch (error: any) {
      throw new Error(`Failed to delete: ${error.message}`);
    }
  }

  /**
   * Create a directory
   */
  private async makeDirectory(dirPath: string, _recursive: boolean = false): Promise<{ success: boolean; path: string }> {
    try {
      const uri = vscode.Uri.file(dirPath);
      await vscode.workspace.fs.createDirectory(uri);
      return { success: true, path: dirPath };
    } catch (error: any) {
      throw new Error(`Failed to create directory: ${error.message}`);
    }
  }

  /**
   * Ensure that a directory exists, creating it if necessary
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(dirPath);
      await vscode.workspace.fs.createDirectory(uri);
    } catch (error: any) {
      throw new Error(`Failed to ensure directory exists: ${error.message}`);
    }
  }
}
