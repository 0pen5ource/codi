import * as vscode from 'vscode';
import { AgentManager } from '../agents/agentManager';
import { OutputPanel } from './outputPanel';

/**
 * UI panel for getting user input and sending it to the agent
 */
export class InputPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private context: vscode.ExtensionContext;
  private agentManager: AgentManager;
  private outputPanel: OutputPanel;
  private disposables: vscode.Disposable[] = [];

  constructor(
    context: vscode.ExtensionContext,
    agentManager: AgentManager,
    outputPanel: OutputPanel
  ) {
    this.context = context;
    this.agentManager = agentManager;
    this.outputPanel = outputPanel;
  }

  /**
   * Show the input panel
   * @param mode The mode to use for the panel (e.g., "Generate Code", "Fix Code")
   * @param initialContent Optional initial content to pre-populate the editor
   */
  public show(mode: string = "Generate Code", initialContent: string = ""): void {
    // If panel already exists, show it
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      this.updateContent(mode, initialContent);
      return;
    }

    // Create a new panel
    this.panel = vscode.window.createWebviewPanel(
      'codeAgentInput',
      `Code Agent: ${mode}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'media')
        ]
      }
    );

    // Set initial content
    this.updateContent(mode, initialContent);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'submitPrompt':
            await this.handlePromptSubmission(message.prompt, message.context);
            break;
          case 'cancel':
            this.panel.dispose();
            break;
          case 'getCodeContext':
            const context = await this.getActiveEditorContext();
            this.panel.webview.postMessage({ command: 'updateContext', context });
            break;
        }
      },
      null,
      this.disposables
    );

    // Handle panel disposal
    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      null,
      this.disposables
    );
  }

  /**
   * Update the content of the panel
   */
  private updateContent(mode: string, initialContent: string): void {
    if (!this.panel) {
      return;
    }

    this.panel.title = `Code Agent: ${mode}`;
    this.panel.webview.html = this.getWebviewContent(mode, initialContent);
  }

  /**
   * Handle prompt submission from the webview
   */
  private async handlePromptSubmission(prompt: string, context: string | null): Promise<void> {
    try {
      // Show the output panel
      this.outputPanel.show();
      this.outputPanel.clear();
      this.outputPanel.appendLine(`Processing request: ${prompt}`);
      
      // Get code context if not provided
      if (!context) {
        context = await this.getActiveEditorContext();
      }
      
      // Run the agent
      this.outputPanel.appendLine('Running agent...');
      const result = await this.agentManager.runAgent(prompt, context);
      
      // Show the result
      this.outputPanel.appendLine('Agent response:');
      this.outputPanel.appendLine(result);
      
      // Close the input panel
      if (this.panel) {
        this.panel.dispose();
      }
    } catch (error: any) {
      this.outputPanel.appendLine(`Error: ${error.message}`, true);
      vscode.window.showErrorMessage(`Error processing request: ${error.message}`);
    }
  }

  /**
   * Get the context from the active editor
   */
  private async getActiveEditorContext(): Promise<string | null> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return null;
    }
    
    // Get the document text
    const document = editor.document;
    const text = document.getText();
    
    // Get the file path
    const filePath = document.uri.fsPath;
    const fileExtension = filePath.split('.').pop();
    
    // Construct context information
    return `File: ${filePath} (${fileExtension})\n\n${text}`;
  }

  /**
   * Generate the HTML content for the webview
   */
  private getWebviewContent(mode: string, initialContent: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Code Agent: ${mode}</title>
          <style>
              body {
                  font-family: var(--vscode-font-family);
                  padding: 20px;
                  color: var(--vscode-editor-foreground);
                  background-color: var(--vscode-editor-background);
              }
              
              h1 {
                  font-size: 1.5em;
                  margin-bottom: 20px;
                  color: var(--vscode-editor-foreground);
              }
              
              .container {
                  display: flex;
                  flex-direction: column;
                  height: calc(100vh - 100px);
              }
              
              .prompt-container, .context-container {
                  margin-bottom: 20px;
              }
              
              textarea, #editor {
                  width: 100%;
                  padding: 8px;
                  border: 1px solid var(--vscode-panel-border);
                  background-color: var(--vscode-input-background);
                  color: var(--vscode-input-foreground);
                  font-family: var(--vscode-editor-font-family);
                  font-size: var(--vscode-editor-font-size);
                  resize: vertical;
              }
              
              #prompt {
                  height: 100px;
              }
              
              #context {
                  height: 300px;
                  overflow: auto;
              }
              
              .button-container {
                  display: flex;
                  justify-content: flex-end;
                  margin-top: 10px;
              }
              
              button {
                  padding: 8px 16px;
                  margin-left: 10px;
                  border: none;
                  cursor: pointer;
                  background-color: var(--vscode-button-background);
                  color: var(--vscode-button-foreground);
              }
              
              button:hover {
                  background-color: var(--vscode-button-hoverBackground);
              }
              
              button.secondary {
                  background-color: var(--vscode-button-secondaryBackground);
                  color: var(--vscode-button-secondaryForeground);
              }
              
              button.secondary:hover {
                  background-color: var(--vscode-button-secondaryHoverBackground);
              }
              
              .tabs {
                  display: flex;
                  margin-bottom: 10px;
              }
              
              .tab {
                  padding: 8px 16px;
                  cursor: pointer;
                  border: 1px solid var(--vscode-panel-border);
                  margin-right: 5px;
                  background-color: var(--vscode-tab-inactiveBackground);
                  color: var(--vscode-tab-inactiveForeground);
              }
              
              .tab.active {
                  background-color: var(--vscode-tab-activeBackground);
                  color: var(--vscode-tab-activeForeground);
                  border-bottom: none;
              }
              
              .tab-content {
                  display: none;
                  height: 300px;
              }
              
              .tab-content.active {
                  display: block;
              }
          </style>
      </head>
      <body>
          <h1>Code Agent: ${mode}</h1>
          
          <div class="container">
              <div class="prompt-container">
                  <h3>Enter your prompt:</h3>
                  <textarea id="prompt" placeholder="Describe what you want the agent to do...">${mode === "Fix Code" ? "Fix the following code issues:" : ""}</textarea>
              </div>
              
              <div class="tabs">
                  <div class="tab active" data-tab="context">Code Context</div>
                  <div class="tab" data-tab="options">Options</div>
              </div>
              
              <div class="tab-content active" id="context-tab">
                  <textarea id="context" placeholder="Code context will be loaded from the active editor, or you can paste code here.">${initialContent}</textarea>
              </div>
              
              <div class="tab-content" id="options-tab">
                  <div>
                      <h3>Execution Options:</h3>
                      <label>
                          <input type="checkbox" id="auto-apply" checked>
                          Automatically apply changes when possible
                      </label>
                      <br>
                      <label>
                          <input type="checkbox" id="show-execution">
                          Show execution details
                      </label>
                      <br>
                      <label>
                          <input type="checkbox" id="use-browser">
                          Enable browser preview for web code
                      </label>
                  </div>
              </div>
              
              <div class="button-container">
                  <button id="refresh-context">Refresh Context</button>
                  <button id="cancel" class="secondary">Cancel</button>
                  <button id="submit">Run Agent</button>
              </div>
          </div>
          
          <script>
              (function() {
                  const vscode = acquireVsCodeApi();
                  
                  // Elements
                  const promptTextarea = document.getElementById('prompt');
                  const contextTextarea = document.getElementById('context');
                  const submitButton = document.getElementById('submit');
                  const cancelButton = document.getElementById('cancel');
                  const refreshButton = document.getElementById('refresh-context');
                  const tabs = document.querySelectorAll('.tab');
                  const tabContents = document.querySelectorAll('.tab-content');
                  
                  // Request code context from the extension
                  vscode.postMessage({ command: 'getCodeContext' });
                  
                  // Handle messages from the extension
                  window.addEventListener('message', event => {
                      const message = event.data;
                      switch (message.command) {
                          case 'updateContext':
                              if (message.context) {
                                  contextTextarea.value = message.context;
                              }
                              break;
                      }
                  });
                  
                  // Switch tabs
                  tabs.forEach(tab => {
                      tab.addEventListener('click', () => {
                          // Remove active class from all tabs and contents
                          tabs.forEach(t => t.classList.remove('active'));
                          tabContents.forEach(c => c.classList.remove('active'));
                          
                          // Add active class to clicked tab
                          tab.classList.add('active');
                          
                          // Show corresponding content
                          const tabId = tab.getAttribute('data-tab');
                          document.getElementById(tabId + '-tab').classList.add('active');
                      });
                  });
                  
                  // Handle submit button
                  submitButton.addEventListener('click', () => {
                      const prompt = promptTextarea.value.trim();
                      if (!prompt) {
                          vscode.postMessage({
                              command: 'showError',
                              message: 'Please enter a prompt'
                          });
                          return;
                      }
                      
                      vscode.postMessage({
                          command: 'submitPrompt',
                          prompt: prompt,
                          context: contextTextarea.value,
                          options: {
                              autoApply: document.getElementById('auto-apply').checked,
                              showExecution: document.getElementById('show-execution').checked,
                              useBrowser: document.getElementById('use-browser').checked
                          }
                      });
                  });
                  
                  // Handle cancel button
                  cancelButton.addEventListener('click', () => {
                      vscode.postMessage({ command: 'cancel' });
                  });
                  
                  // Handle refresh context button
                  refreshButton.addEventListener('click', () => {
                      vscode.postMessage({ command: 'getCodeContext' });
                  });
                  
                  // Focus the prompt textarea
                  promptTextarea.focus();
              })();
          </script>
      </body>
      </html>
    `;
  }

  /**
   * Clean up resources on disposal
   */
  dispose() {
    if (this.panel) {
      this.panel.dispose();
    }
    
    this.disposables.forEach(d => d.dispose());
  }
}
