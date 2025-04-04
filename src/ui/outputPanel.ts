import * as vscode from 'vscode';

/**
 * UI panel for displaying agent output and tool execution results
 */
export class OutputPanel implements vscode.Disposable {
  private outputChannel: vscode.OutputChannel;
  private webviewPanel: vscode.WebviewPanel | undefined;
  private context: vscode.ExtensionContext;
  private disposables: vscode.Disposable[] = [];
  private useWebview: boolean;
  private content: string = '';

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.outputChannel = vscode.window.createOutputChannel('Code Agent');
    this.useWebview = vscode.workspace.getConfiguration('codeAgent').get('useWebviewOutput', false);
  }

  /**
   * Show the output panel
   */
  public show(): void {
    if (this.useWebview) {
      this.showWebview();
    } else {
      this.outputChannel.show(true);
    }
  }

  /**
   * Clear the output panel
   */
  public clear(): void {
    this.content = '';
    this.outputChannel.clear();
    
    if (this.webviewPanel) {
      this.webviewPanel.webview.html = this.getWebviewContent();
    }
  }

  /**
   * Append a line of text to the output panel
   * @param text The text to append
   * @param isError Whether this is an error message
   */
  public appendLine(text: string, isError: boolean = false): void {
    // Add the text to our internal content buffer
    this.content += `${isError ? '<div class="error">' : '<div>'} ${this.escapeHtml(text)} </div>\n`;
    
    // Update the output channel
    this.outputChannel.appendLine(text);
    
    // Update the webview if it exists
    if (this.webviewPanel) {
      this.webviewPanel.webview.html = this.getWebviewContent();
    }
  }

  /**
   * Append raw text to the output panel (without a newline)
   * @param text The text to append
   * @param isError Whether this is an error message
   */
  public append(text: string, isError: boolean = false): void {
    // Add the text to our internal content buffer
    this.content += `${isError ? '<span class="error">' : '<span>'} ${this.escapeHtml(text)} </span>`;
    
    // Update the output channel
    this.outputChannel.append(text);
    
    // Update the webview if it exists
    if (this.webviewPanel) {
      this.webviewPanel.webview.html = this.getWebviewContent();
    }
  }

  /**
   * Toggle between output channel and webview display
   */
  public toggleDisplayMode(): void {
    this.useWebview = !this.useWebview;
    vscode.workspace.getConfiguration('codeAgent').update('useWebviewOutput', this.useWebview, true);
    
    if (this.useWebview) {
      this.showWebview();
    } else {
      this.outputChannel.show(true);
      if (this.webviewPanel) {
        this.webviewPanel.dispose();
      }
    }
  }

  /**
   * Show the webview panel
   */
  private showWebview(): void {
    if (this.webviewPanel) {
      this.webviewPanel.reveal();
      return;
    }
    
    this.webviewPanel = vscode.window.createWebviewPanel(
      'codeAgentOutput',
      'Code Agent Output',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );
    
    // Set the initial content
    this.webviewPanel.webview.html = this.getWebviewContent();
    
    // Handle webview disposal
    this.webviewPanel.onDidDispose(() => {
      this.webviewPanel = undefined;
    }, null, this.disposables);
    
    // Handle messages from the webview
    this.webviewPanel.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'clear':
          this.clear();
          break;
        case 'toggle':
          this.toggleDisplayMode();
          break;
      }
    }, null, this.disposables);
  }

  /**
   * Generate the HTML content for the webview
   */
  private getWebviewContent(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Code Agent Output</title>
        <style>
          body {
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            padding: 10px;
            margin: 0;
            word-wrap: break-word;
            white-space: pre-wrap;
          }
          
          #content {
            padding-bottom: 40px;
          }
          
          .error {
            color: var(--vscode-errorForeground, #f14c4c);
          }
          
          .toolbar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background-color: var(--vscode-editor-background);
            padding: 8px;
            border-top: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: flex-end;
          }
          
          button {
            padding: 4px 12px;
            margin-left: 8px;
            cursor: pointer;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
          }
          
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          
          pre {
            margin: 0;
            font-family: inherit;
          }
          
          code {
            font-family: var(--vscode-editor-font-family);
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 3px;
          }
          
          .code-block {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
            overflow-x: auto;
          }
        </style>
      </head>
      <body>
        <div id="content">
          ${this.formatContent()}
        </div>
        
        <div class="toolbar">
          <button id="clearButton">Clear</button>
          <button id="toggleButton">Switch to Output Channel</button>
        </div>
        
        <script>
          (function() {
            const vscode = acquireVsCodeApi();
            
            // Scroll to bottom
            window.scrollTo(0, document.body.scrollHeight);
            
            // Set up button handlers
            document.getElementById('clearButton').addEventListener('click', () => {
              vscode.postMessage({ command: 'clear' });
            });
            
            document.getElementById('toggleButton').addEventListener('click', () => {
              vscode.postMessage({ command: 'toggle' });
            });
          })();
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Format the content with syntax highlighting
   */
  private formatContent(): string {
    if (!this.content) {
      return '<div class="placeholder">No output yet</div>';
    }
    
    // Replace code blocks with syntax highlighting
    // This is a simple implementation. A more advanced one would use a syntax highlighting library
    let formattedContent = this.content;
    
    // Format code blocks (text between triple backticks)
    formattedContent = formattedContent.replace(
      /```([a-z]*)\n([\s\S]*?)\n```/g,
      (_match, _language, code) => {
        return `<div class="code-block">${this.escapeHtml(code)}</div>`;
      }
    );
    
    // Format inline code (text between single backticks)
    formattedContent = formattedContent.replace(
      /`([^`]+)`/g,
      (_match, code) => {
        return `<code>${this.escapeHtml(code)}</code>`;
      }
    );
    
    return formattedContent;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Clean up resources on disposal
   */
  dispose() {
    this.outputChannel.dispose();
    if (this.webviewPanel) {
      this.webviewPanel.dispose();
    }
    this.disposables.forEach(d => d.dispose());
  }
}
