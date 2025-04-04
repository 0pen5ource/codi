import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BaseTool } from './baseTool';

/**
 * Tool for managing browser previews of web applications
 */
export class BrowserPreviewTool extends BaseTool {
  private context: vscode.ExtensionContext;
  private activePreviews: Map<string, vscode.WebviewPanel> = new Map();
  private screenshotCounter: number = 0;
  
  constructor(context: vscode.ExtensionContext) {
    super();
    this.context = context;
  }

  /**
   * Get the name of the tool
   */
  get name(): string {
    return 'browser-preview';
  }

  /**
   * Get the description of the tool
   */
  get description(): string {
    return 'View and interact with web applications in a browser preview';
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
          enum: ['open', 'refresh', 'takeScreenshot', 'close', 'inspectElement', 'executeScript'],
          description: 'The browser preview action to perform'
        },
        url: {
          type: 'string',
          description: 'The URL to open in the browser preview'
        },
        previewId: {
          type: 'string',
          description: 'ID of an existing preview to manipulate'
        },
        selector: {
          type: 'string',
          description: 'CSS selector for DOM element (for inspectElement action)'
        },
        script: {
          type: 'string',
          description: 'JavaScript code to execute in the preview (for executeScript action)'
        }
      }
    };
  }

  /**
   * Execute the browser preview tool with the given input
   */
  public async execute(input: any): Promise<any> {
    switch (input.action) {
      case 'open':
        return this.openPreview(input.url);
      case 'refresh':
        return this.refreshPreview(input.previewId);
      case 'takeScreenshot':
        return this.takeScreenshot(input.previewId);
      case 'close':
        return this.closePreview(input.previewId);
      case 'inspectElement':
        return this.inspectElement(input.previewId, input.selector);
      case 'executeScript':
        return this.executeScript(input.previewId, input.script);
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  }

  /**
   * Open a new browser preview with the given URL
   */
  private async openPreview(url: string): Promise<{ success: boolean; previewId: string }> {
    try {
      // Generate a unique ID for this preview
      const previewId = `preview-${Date.now()}`;
      
      // Create the webview panel
      const panel = vscode.window.createWebviewPanel(
        'browserPreview',
        `Preview: ${url}`,
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: []
        }
      );

      // Store the panel reference
      this.activePreviews.set(previewId, panel);

      // Set up the HTML content for the webview with an iframe
      panel.webview.html = this.getWebviewContent(url, previewId);

      // Handle panel disposal
      panel.onDidDispose(() => {
        this.activePreviews.delete(previewId);
      });

      // Set up message handling
      panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.type) {
          case 'error':
            vscode.window.showErrorMessage(`Browser preview error: ${message.message}`);
            break;
          case 'log':
            console.log('Browser preview log:', message.message);
            break;
          case 'inspectionResult':
            // Store inspection results for later retrieval
            this.context.workspaceState.update(
              `inspection-${previewId}-${message.selector}`,
              message.result
            );
            break;
          case 'screenshotTaken':
            // Save the screenshot data
            await this.saveScreenshot(message.data);
            break;
        }
      });

      return { success: true, previewId };
    } catch (error: any) {
      throw new Error(`Failed to open browser preview: ${error.message}`);
    }
  }

  /**
   * Refresh an existing browser preview
   */
  private async refreshPreview(previewId: string): Promise<{ success: boolean }> {
    const panel = this.getPreviewPanel(previewId);
    await panel.webview.postMessage({ command: 'refresh' });
    return { success: true };
  }

  /**
   * Take a screenshot of the current preview state
   */
  private async takeScreenshot(previewId: string): Promise<{ success: boolean; screenshotPath: string }> {
    const panel = this.getPreviewPanel(previewId);
    
    // Request screenshot from the webview
    await panel.webview.postMessage({ command: 'takeScreenshot' });
    
    // The path will be returned by the saveScreenshot method when the webview responds
    const screenshotNumber = ++this.screenshotCounter;
    const screenshotPath = path.join(this.getTempDir(), `screenshot-${screenshotNumber}.png`);
    
    return { success: true, screenshotPath };
  }

  /**
   * Close an existing browser preview
   */
  private closePreview(previewId: string): { success: boolean } {
    const panel = this.getPreviewPanel(previewId);
    panel.dispose();
    this.activePreviews.delete(previewId);
    return { success: true };
  }

  /**
   * Inspect a DOM element in the preview using a CSS selector
   */
  private async inspectElement(previewId: string, selector: string): Promise<any> {
    const panel = this.getPreviewPanel(previewId);
    
    // Clear any previous inspection results
    await this.context.workspaceState.update(
      `inspection-${previewId}-${selector}`,
      undefined
    );
    
    // Request element inspection
    await panel.webview.postMessage({
      command: 'inspectElement',
      selector
    });
    
    // Wait for the inspection result (simple polling approach)
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      const result = this.context.workspaceState.get(`inspection-${previewId}-${selector}`);
      if (result) {
        return result;
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    throw new Error(`Timed out waiting for element inspection result for selector: ${selector}`);
  }

  /**
   * Execute JavaScript code in the preview
   */
  private async executeScript(previewId: string, script: string): Promise<any> {
    const panel = this.getPreviewPanel(previewId);
    
    // Generate a unique ID for this script execution
    const scriptId = `script-${Date.now()}`;
    
    // Clear any previous script results
    await this.context.workspaceState.update(
      `script-result-${scriptId}`,
      undefined
    );
    
    // Execute the script
    await panel.webview.postMessage({
      command: 'executeScript',
      script,
      scriptId
    });
    
    // Wait for the script result (simple polling approach)
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      const result = this.context.workspaceState.get(`script-result-${scriptId}`);
      if (result !== undefined) {
        return result;
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    throw new Error('Timed out waiting for script execution result');
  }

  /**
   * Get the webview panel for a preview ID
   */
  private getPreviewPanel(previewId: string): vscode.WebviewPanel {
    const panel = this.activePreviews.get(previewId);
    if (!panel) {
      throw new Error(`Preview with ID ${previewId} not found`);
    }
    return panel;
  }

  /**
   * Generate the HTML content for the webview
   */
  private getWebviewContent(url: string, _previewId: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Browser Preview</title>
        <style>
          body, html {
            margin: 0;
            padding: 0;
            height: 100%;
            overflow: hidden;
          }
          
          #container {
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          
          #toolbar {
            padding: 8px;
            background-color: #f0f0f0;
            display: flex;
            align-items: center;
          }
          
          #url {
            flex: 1;
            margin-right: 8px;
            padding: 4px;
          }
          
          #iframe-container {
            flex: 1;
            position: relative;
          }
          
          iframe {
            width: 100%;
            height: 100%;
            border: none;
          }
          
          #console {
            height: 100px;
            overflow-y: auto;
            background-color: #1e1e1e;
            color: white;
            font-family: monospace;
            padding: 8px;
            border-top: 1px solid #555;
            display: none;
          }
          
          #console.active {
            display: block;
          }
          
          .log {
            margin: 2px 0;
          }
          
          .error {
            color: #ff5555;
          }
          
          .warn {
            color: #ffaa55;
          }
          
          .info {
            color: #55aaff;
          }
        </style>
      </head>
      <body>
        <div id="container">
          <div id="toolbar">
            <input id="url" type="text" value="${url}" />
            <button id="refresh">Refresh</button>
            <button id="toggle-console">Console</button>
            <button id="inspect">Inspect</button>
          </div>
          
          <div id="iframe-container">
            <iframe id="preview-frame" src="${url}" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
          </div>
          
          <div id="console">
            <div class="log info">Console initialized</div>
          </div>
        </div>
        
        <script>
          (function() {
            const vscode = acquireVsCodeApi();
            const iframe = document.getElementById('preview-frame');
            const urlInput = document.getElementById('url');
            const refreshButton = document.getElementById('refresh');
            const toggleConsoleButton = document.getElementById('toggle-console');
            const consoleOutput = document.getElementById('console');
            const inspectButton = document.getElementById('inspect');
            
            // Initialize console logging
            function log(message, type = 'log') {
              const logElement = document.createElement('div');
              logElement.className = \`log \${type}\`;
              logElement.textContent = message;
              consoleOutput.appendChild(logElement);
              consoleOutput.scrollTop = consoleOutput.scrollHeight;
              
              // Also send to VS Code
              vscode.postMessage({
                type: 'log',
                message: \`[\${type}] \${message}\`
              });
            }
            
            // Store original console methods
            const originalConsole = {
              log: console.log,
              error: console.error,
              warn: console.warn,
              info: console.info
            };
            
            // Override console methods
            console.log = function() {
              originalConsole.log.apply(console, arguments);
              log(Array.from(arguments).join(' '));
            };
            
            console.error = function() {
              originalConsole.error.apply(console, arguments);
              log(Array.from(arguments).join(' '), 'error');
            };
            
            console.warn = function() {
              originalConsole.warn.apply(console, arguments);
              log(Array.from(arguments).join(' '), 'warn');
            };
            
            console.info = function() {
              originalConsole.info.apply(console, arguments);
              log(Array.from(arguments).join(' '), 'info');
            };
            
            // Handle refresh button
            refreshButton.addEventListener('click', () => {
              const newUrl = urlInput.value;
              iframe.src = newUrl;
              log(\`Navigating to \${newUrl}\`, 'info');
            });
            
            // Toggle console
            toggleConsoleButton.addEventListener('click', () => {
              consoleOutput.classList.toggle('active');
            });
            
            // Handle inspect button
            inspectButton.addEventListener('click', () => {
              log('Inspect mode activated - select an element in the preview', 'info');
              // TODO: Implement element selection in iframe
            });
            
            // Handle messages from VS Code
            window.addEventListener('message', event => {
              const message = event.data;
              
              switch (message.command) {
                case 'refresh':
                  iframe.src = iframe.src;
                  log('Preview refreshed', 'info');
                  break;
                  
                case 'takeScreenshot':
                  try {
                    // Create a canvas to capture the iframe content
                    const canvas = document.createElement('canvas');
                    canvas.width = iframe.offsetWidth;
                    canvas.height = iframe.offsetHeight;
                    
                    // This is a simplified version - in a real extension, you would use
                    // a more robust method to capture the iframe content
                    canvas.getContext('2d').drawWindow(
                      iframe.contentWindow,
                      0, 0, iframe.offsetWidth, iframe.offsetHeight,
                      'rgb(255, 255, 255)'
                    );
                    
                    // Convert to PNG data URL
                    const dataUrl = canvas.toDataURL('image/png');
                    
                    // Send back to VS Code
                    vscode.postMessage({
                      type: 'screenshotTaken',
                      data: dataUrl
                    });
                    
                    log('Screenshot taken', 'info');
                  } catch (error) {
                    log(\`Screenshot failed: \${error.message}\`, 'error');
                    vscode.postMessage({
                      type: 'error',
                      message: \`Failed to take screenshot: \${error.message}\`
                    });
                  }
                  break;
                  
                case 'inspectElement':
                  try {
                    const selector = message.selector;
                    log(\`Inspecting element: \${selector}\`, 'info');
                    
                    // Execute querySelector in the iframe
                    const element = iframe.contentDocument.querySelector(selector);
                    
                    if (!element) {
                      throw new Error(\`Element not found: \${selector}\`);
                    }
                    
                    // Extract element properties
                    const styles = iframe.contentWindow.getComputedStyle(element);
                    const rect = element.getBoundingClientRect();
                    
                    // Create result object
                    const result = {
                      tagName: element.tagName.toLowerCase(),
                      id: element.id,
                      className: element.className,
                      text: element.textContent.trim(),
                      attributes: {},
                      rect: {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height
                      },
                      styles: {}
                    };
                    
                    // Extract attributes
                    for (const attr of element.attributes) {
                      result.attributes[attr.name] = attr.value;
                    }
                    
                    // Extract common styles
                    const styleProps = [
                      'color', 'backgroundColor', 'fontSize', 'fontFamily',
                      'display', 'position', 'visibility', 'opacity'
                    ];
                    
                    for (const prop of styleProps) {
                      result.styles[prop] = styles[prop];
                    }
                    
                    // Send result back to VS Code
                    vscode.postMessage({
                      type: 'inspectionResult',
                      selector,
                      result
                    });
                    
                    log(\`Inspection complete for \${selector}\`, 'info');
                  } catch (error) {
                    log(\`Inspection failed: \${error.message}\`, 'error');
                    vscode.postMessage({
                      type: 'error',
                      message: \`Failed to inspect element: \${error.message}\`
                    });
                  }
                  break;
                  
                case 'executeScript':
                  try {
                    const script = message.script;
                    const scriptId = message.scriptId;
                    log(\`Executing script (ID: \${scriptId})\`, 'info');
                    
                    // Create a function from the script and execute it in the iframe context
                    const scriptFunction = new iframe.contentWindow.Function(script);
                    const result = scriptFunction();
                    
                    // Send result back to VS Code
                    vscode.postMessage({
                      type: 'scriptResult',
                      scriptId,
                      result
                    });
                    
                    log(\`Script execution complete\`, 'info');
                  } catch (error) {
                    log(\`Script execution failed: \${error.message}\`, 'error');
                    vscode.postMessage({
                      type: 'error',
                      message: \`Failed to execute script: \${error.message}\`
                    });
                  }
                  break;
              }
            });
            
            // Report load events
            iframe.addEventListener('load', () => {
              log(\`Loaded: \${iframe.src}\`, 'info');
            });
            
            iframe.addEventListener('error', e => {
              log(\`Error loading iframe: \${e}\`, 'error');
            });
            
            // Initial log
            log(\`Preview initialized for \${url}\`, 'info');
          })();
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Save a screenshot data URL to a file
   */
  private async saveScreenshot(dataUrl: string): Promise<string> {
    // Extract the base64 data from the data URL
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    
    // Create a buffer from the base64 data
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Ensure temp directory exists
    const tempDir = this.getTempDir();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Save the file
    const fileName = `screenshot-${Date.now()}.png`;
    const filePath = path.join(tempDir, fileName);
    
    fs.writeFileSync(filePath, buffer);
    
    return filePath;
  }

  /**
   * Get the temporary directory for screenshots
   */
  private getTempDir(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return path.join(workspaceFolders[0].uri.fsPath, '.code-agent-temp');
    }
    
    // Fallback to system temp directory
    return path.join(require('os').tmpdir(), 'code-agent');
  }

  /**
   * Clean up resources on disposal
   */
  dispose() {
    // Close all active previews
    for (const panel of this.activePreviews.values()) {
      panel.dispose();
    }
    this.activePreviews.clear();
  }
}
