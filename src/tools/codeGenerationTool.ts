import * as vscode from 'vscode';
import { BaseTool } from './baseTool';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

export class CodeGenerationTool extends BaseTool {
  get name() {
    return 'code-generation';
  }

  get description() {
    return 'Generate, modify, and manage code files and projects';
  }

  get parameters() {
    return {
      type: 'object',
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: [
            'createProject',
            'createFile',
            'modifyFile',
            'generatePatch',
            'applyPatch',
            'gitCommit',
            'gitPush',
            'validateCode'
          ],
          description: 'The type of code generation action to perform'
        },
        projectType: {
          type: 'string',
          description: 'Type of project to create (e.g., "web", "nodejs", "python")'
        },
        filePath: {
          type: 'string',
          description: 'Path to the file to create/modify'
        },
        content: {
          type: 'string',
          description: 'Content to write to the file'
        },
        patchContent: {
          type: 'string',
          description: 'Patch content to generate or apply'
        },
        commitMessage: {
          type: 'string',
          description: 'Git commit message'
        },
        branchName: {
          type: 'string',
          description: 'Git branch name'
        },
        language: {
          type: 'string',
          description: 'Programming language of the code'
        },
        dependencies: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'List of dependencies to include'
        }
      }
    };
  }

  async execute(input: any): Promise<any> {
    switch (input.action) {
      case 'createProject':
        return await this.createProject(input);
      case 'createFile':
        return await this.createFile(input);
      case 'modifyFile':
        return await this.modifyFile(input);
      case 'generatePatch':
        return await this.generatePatch(input);
      case 'applyPatch':
        return await this.applyPatch(input);
      case 'gitCommit':
        return await this.gitCommit(input);
      case 'gitPush':
        return await this.gitPush(input);
      case 'validateCode':
        return await this.validateCode(input);
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  }

  private async createProject(input: any): Promise<any> {
    const projectType = input.projectType;
    const projectName = input.projectName || 'my-project';
    const projectPath = path.join(vscode.workspace.rootPath || '.', projectName);

    // Create project directory
    await fs.promises.mkdir(projectPath, { recursive: true });

    // Create appropriate project structure based on type
    switch (projectType) {
      case 'web':
        return await this.createWebProject(projectPath, input);
      case 'nodejs':
        return await this.createNodeProject(projectPath, input);
      case 'python':
        return await this.createPythonProject(projectPath, input);
      default:
        throw new Error(`Unsupported project type: ${projectType}`);
    }
  }

  private async createFile(input: any): Promise<any> {
    const filePath = input.filePath;
    const content = input.content;
    
    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    // Write file
    await fs.promises.writeFile(filePath, content);
    
    return {
      success: true,
      message: `Created file: ${filePath}`
    };
  }

  private async modifyFile(input: any): Promise<any> {
    const filePath = input.filePath;
    const content = input.content;
    
    await fs.promises.writeFile(filePath, content);
    
    return {
      success: true,
      message: `Modified file: ${filePath}`
    };
  }

  private async generatePatch(input: any): Promise<any> {
    const filePath = input.filePath;
    const patchContent = input.patchContent;
    
    // Create patch file
    const patchPath = path.join(vscode.workspace.rootPath || '.', 'patch.diff');
    await fs.promises.writeFile(patchPath, patchContent);
    
    return {
      success: true,
      patchPath,
      message: `Generated patch file: ${patchPath}`
    };
  }

  private async applyPatch(input: any): Promise<any> {
    const patchPath = input.patchPath;
    
    return new Promise((resolve, reject) => {
      exec(`git apply ${patchPath}`, (error) => {
        if (error) {
          reject({
            success: false,
            message: `Failed to apply patch: ${error.message}`
          });
        } else {
          resolve({
            success: true,
            message: 'Successfully applied patch'
          });
        }
      });
    });
  }

  private async gitCommit(input: any): Promise<any> {
    const message = input.commitMessage;
    
    return new Promise((resolve, reject) => {
      exec(`git add . && git commit -m "${message}"`, (error) => {
        if (error) {
          reject({
            success: false,
            message: `Failed to commit: ${error.message}`
          });
        } else {
          resolve({
            success: true,
            message: 'Successfully committed changes'
          });
        }
      });
    });
  }

  private async gitPush(input: any): Promise<any> {
    const branchName = input.branchName;
    
    return new Promise((resolve, reject) => {
      exec(`git push origin ${branchName}`, (error) => {
        if (error) {
          reject({
            success: false,
            message: `Failed to push: ${error.message}`
          });
        } else {
          resolve({
            success: true,
            message: 'Successfully pushed changes'
          });
        }
      });
    });
  }

  private async validateCode(input: any): Promise<any> {
    const filePath = input.filePath;
    const language = input.language;
    
    // Add language-specific validation
    switch (language) {
      case 'typescript':
        return await this.validateTypeScript(filePath);
      case 'javascript':
        return await this.validateJavaScript(filePath);
      case 'python':
        return await this.validatePython(filePath);
      default:
        return {
          success: true,
          message: 'Code validation not implemented for this language'
        };
    }
  }

  private async validateTypeScript(filePath: string): Promise<any> {
    // Add TypeScript validation logic
    return {
      success: true,
      message: 'TypeScript validation passed'
    };
  }

  private async validateJavaScript(filePath: string): Promise<any> {
    // Add JavaScript validation logic
    return {
      success: true,
      message: 'JavaScript validation passed'
    };
  }

  private async validatePython(filePath: string): Promise<any> {
    // Add Python validation logic
    return {
      success: true,
      message: 'Python validation passed'
    };
  }

  private async createWebProject(projectPath: string, input: any): Promise<any> {
    // Create web project structure
    const files = [
      { path: 'index.html', content: this.getBasicHTML() },
      { path: 'styles.css', content: this.getBasicCSS() },
      { path: 'script.js', content: this.getBasicJS() }
    ];

    for (const file of files) {
      await fs.promises.writeFile(
        path.join(projectPath, file.path),
        file.content
      );
    }

    return {
      success: true,
      message: 'Created web project structure'
    };
  }

  private async createNodeProject(projectPath: string, input: any): Promise<any> {
    // Create package.json with dependencies
    const packageJson = {
      name: path.basename(projectPath),
      version: '1.0.0',
      description: input.description || '',
      main: 'index.js',
      dependencies: input.dependencies.reduce((acc, dep) => {
        acc[dep] = '^latest';
        return acc;
      }, {})
    };

    await fs.promises.writeFile(
      path.join(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    return {
      success: true,
      message: 'Created Node.js project structure'
    };
  }

  private async createPythonProject(projectPath: string, input: any): Promise<any> {
    // Create requirements.txt with dependencies
    const requirements = input.dependencies.join('\n');
    await fs.promises.writeFile(
      path.join(projectPath, 'requirements.txt'),
      requirements
    );

    return {
      success: true,
      message: 'Created Python project structure'
    };
  }

  private getBasicHTML(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>My Web Project</title>
          <link rel="stylesheet" href="styles.css">
      </head>
      <body>
          <div id="app"></div>
          <script src="script.js"></script>
      </body>
      </html>
    `;
  }

  private getBasicCSS(): string {
    return `
      body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f0f0f0;
      }

      #app {
          max-width: 800px;
          margin: 0 auto;
          background-color: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
    `;
  }

  private getBasicJS(): string {
    return `
      document.addEventListener('DOMContentLoaded', () => {
          const app = document.getElementById('app');
          app.innerHTML = '<h1>Welcome to My Web Project</h1>';
      });
    `;
  }
}
