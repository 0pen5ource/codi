import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from './baseTool';

/**
 * Tool for generating and manipulating SVG graphics
 */
export class SvgGeneratorTool extends BaseTool {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    super();
    this.context = context;
  }

  /**
   * Get the name of the tool
   */
  get name(): string {
    return 'svg-generator';
  }

  /**
   * Get the description of the tool
   */
  get description(): string {
    return 'Generate SVG graphics and add them to HTML pages';
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
          enum: ['createSvgCircle', 'createSvgRectangle', 'createSvgPath', 'createHtmlWithSvg'],
          description: 'The SVG generation action to perform'
        },
        filePath: {
          type: 'string',
          description: 'The path to save the generated HTML or SVG file'
        },
        radius: {
          type: 'number',
          description: 'Radius for circle element'
        },
        cx: {
          type: 'number',
          description: 'X coordinate of circle center'
        },
        cy: {
          type: 'number',
          description: 'Y coordinate of circle center'
        },
        width: {
          type: 'number',
          description: 'Width for rectangle or SVG viewport'
        },
        height: {
          type: 'number',
          description: 'Height for rectangle or SVG viewport'
        },
        x: {
          type: 'number',
          description: 'X coordinate for rectangle'
        },
        y: {
          type: 'number',
          description: 'Y coordinate for rectangle'
        },
        fill: {
          type: 'string',
          description: 'Fill color for the shape'
        },
        stroke: {
          type: 'string',
          description: 'Stroke color for the shape'
        },
        strokeWidth: {
          type: 'number',
          description: 'Width of the stroke'
        },
        path: {
          type: 'string',
          description: 'SVG path data'
        },
        title: {
          type: 'string',
          description: 'Title for the HTML page'
        }
      }
    };
  }

  /**
   * Execute the SVG generator tool with the given input
   */
  public async execute(input: any): Promise<any> {
    // Normalize the path if provided
    if (input.filePath) {
      if (!path.isAbsolute(input.filePath)) {
        // If path is relative, resolve it against the workspace root
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          throw new Error('No workspace folder is open');
        }
        input.filePath = path.join(workspaceFolders[0].uri.fsPath, input.filePath);
      }
    }

    switch (input.action) {
      case 'createSvgCircle':
        return this.createSvgCircle(input);
      case 'createSvgRectangle':
        return this.createSvgRectangle(input);
      case 'createSvgPath':
        return this.createSvgPath(input);
      case 'createHtmlWithSvg':
        return this.createHtmlWithSvg(input);
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  }

  /**
   * Create an SVG circle element
   */
  private createSvgCircle(input: any): string {
    const { cx = 50, cy = 50, radius = 40, fill = 'red', stroke = 'black', strokeWidth = 3 } = input;
    
    return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
  }

  /**
   * Create an SVG rectangle element
   */
  private createSvgRectangle(input: any): string {
    const { x = 10, y = 10, width = 80, height = 80, fill = 'blue', stroke = 'black', strokeWidth = 3 } = input;
    
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
  }

  /**
   * Create an SVG path element
   */
  private createSvgPath(input: any): string {
    const { path, fill = 'none', stroke = 'black', strokeWidth = 2 } = input;
    
    return `<path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
  }

  /**
   * Create an HTML file with an SVG element
   */
  private async createHtmlWithSvg(input: any): Promise<{ success: boolean; path: string }> {
    try {
      const { filePath, title = 'SVG Example', width = 100, height = 100 } = input;
      
      // Generate SVG content based on shape type
      let svgContent = '';
      if (input.radius) {
        svgContent = this.createSvgCircle(input);
      } else if (input.width && input.height && (input.x !== undefined || input.y !== undefined)) {
        svgContent = this.createSvgRectangle(input);
      } else if (input.path) {
        svgContent = this.createSvgPath(input);
      }
      
      // Create HTML with SVG
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body>
    <h1>${title}</h1>
    <svg width="${width}" height="${height}">
        ${svgContent}
    </svg>
</body>
</html>`;
      
      // Ensure the directory exists
      const dirPath = path.dirname(filePath);
      await this.ensureDirectoryExists(dirPath);
      
      // Write the file
      const uri = vscode.Uri.file(filePath);
      const uint8Array = Buffer.from(htmlContent, 'utf-8');
      await vscode.workspace.fs.writeFile(uri, uint8Array);
      
      return { success: true, path: filePath };
    } catch (error: any) {
      throw new Error(`Failed to create HTML with SVG: ${error.message}`);
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
