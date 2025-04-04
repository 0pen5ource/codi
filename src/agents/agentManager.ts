import * as vscode from 'vscode';
import { OpenAI } from 'openai';
import { BaseTool } from '../tools/baseTool';
import { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * Interface for tool execution results
 */
interface ToolExecutionResult {
  success: boolean;
  data: any;
  error?: string;
}

/**
 * Interface for agent execution steps
 */
interface AgentExecutionStep {
  thought: string;
  action: string;
  toolName?: string;
  toolInput?: any;
  result?: ToolExecutionResult;
}

/**
 * Manages the AI agent and its interactions with the VS Code environment
 */
export class AgentManager implements vscode.Disposable {
  private tools: Map<string, BaseTool> = new Map();
  private openai: OpenAI | null = null;
  private executionContext: vscode.ExtensionContext;
  private disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.executionContext = context;
    this.initializeAI();
  }

  /**
   * Initialize the AI client with API key
   */
  private async initializeAI() {
    // Get the API key from configuration or prompt the user
    const config = vscode.workspace.getConfiguration('codeAgent');
    let apiKey = config.get<string>('openaiApiKey');

    if (!apiKey) {
      apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your OpenAI API key',
        password: true,
        ignoreFocusOut: true
      });

      if (apiKey) {
        // Save the API key to configuration
        await config.update('openaiApiKey', apiKey, true);
      }
    }

    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      vscode.window.showErrorMessage('OpenAI API key is required to use this extension');
    }
  }

  /**
   * Register tools for the agent to use
   */
  public registerTools(tools: BaseTool[]) {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  /**
   * Run agent with a prompt to generate or modify code
   */
  public async runAgent(prompt: string, context?: string): Promise<string> {
    if (!this.openai) {
      await this.initializeAI();
      if (!this.openai) {
        throw new Error('OpenAI client is not initialized');
      }
    }

    // Prepare the tools definition for the model
    const toolDefinitions: ChatCompletionTool[] = Array.from(this.tools.values()).map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));

    let messages: any[] = [
      { role: 'system', content: this.buildSystemPrompt() },
      { role: 'user', content: this.buildUserPrompt(prompt, context) }
    ];

    const executionSteps: AgentExecutionStep[] = [];
    let finalResponse = '';
    let maxIterations = 10;
    let executionLog = '# Execution Log\n\n';
    
    try {
      // Agent execution loop
      while (maxIterations > 0) {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4-turbo',
          messages,
          tools: toolDefinitions,
          tool_choice: 'auto'
        });

        const responseMessage = response.choices[0].message;
        messages.push(responseMessage);

        // Check if the model wants to use a tool
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
          // Add thinking to execution log if available
          if (responseMessage.content) {
            executionLog += `## Thinking\n${responseMessage.content}\n\n`;
          }
          
          // Process all tool calls in this response
          const toolResults = [];
          
          for (const toolCall of responseMessage.tool_calls) {
            const toolName = toolCall.function.name;
            const toolInput = JSON.parse(toolCall.function.arguments);

            // Record the execution step
            const step: AgentExecutionStep = {
              thought: responseMessage.content || '',
              action: 'tool_call',
              toolName,
              toolInput
            };

            // Log the tool execution
            executionLog += `## Executing Tool: ${toolName}\n`;
            executionLog += `Input: \`\`\`json\n${JSON.stringify(toolInput, null, 2)}\n\`\`\`\n\n`;

            // Execute the tool
            const tool = this.tools.get(toolName);
            if (tool) {
              try {
                const result = await tool.execute(toolInput);
                step.result = { success: true, data: result };
                
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  content: JSON.stringify(result)
                });

                // Log the result
                executionLog += `Result: \`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n\n`;
              } catch (error: any) {
                step.result = { success: false, data: null, error: error.message };
                
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  content: JSON.stringify({ error: error.message })
                });

                // Log the error
                executionLog += `Error: ${error.message}\n\n`;
              }
            } else {
              step.result = { 
                success: false, 
                data: null, 
                error: `Tool '${toolName}' not found` 
              };
              
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: JSON.stringify({ error: `Tool '${toolName}' not found` })
              });

              // Log the error
              executionLog += `Error: Tool '${toolName}' not found\n\n`;
            }
            
            executionSteps.push(step);
          }
          
          // Add all tool results to messages
          messages.push(...toolResults);
        } else {
          // Model provided a final response
          finalResponse = responseMessage.content || '';
          executionLog += `## Summary\n${finalResponse}\n`;
          break;
        }
        
        maxIterations--;
      }
      
      if (maxIterations === 0) {
        const timeoutMessage = "Execution exceeded maximum number of steps.";
        finalResponse = timeoutMessage + " Here's the partial result: " + finalResponse;
        executionLog += `## Error\n${timeoutMessage}\n`;
      }
      
      // Return the final response and execution log
      return executionLog;
    } catch (error: any) {
      console.error('Error running agent:', error);
      throw new Error(`Failed to run agent: ${error.message}`);
    }
  }

  /**
   * Validate the code in the active document
   */
  public async validateCode(document: vscode.TextDocument): Promise<void> {
    try {
      const languageTool = this.findLanguageTool(document.languageId);
      if (!languageTool) {
        vscode.window.showWarningMessage(`No validator available for ${document.languageId} files`);
        return;
      }
      
      await languageTool.execute({ action: 'validate', document: document.uri.toString() });
    } catch (error: any) {
      vscode.window.showErrorMessage(`Validation failed: ${error.message}`);
    }
  }

  /**
   * Run the code in the active document
   */
  public async runCode(document: vscode.TextDocument): Promise<void> {
    try {
      const languageTool = this.findLanguageTool(document.languageId);
      if (!languageTool) {
        vscode.window.showWarningMessage(`No runner available for ${document.languageId} files`);
        return;
      }
      
      await languageTool.execute({ action: 'run', document: document.uri.toString() });
    } catch (error: any) {
      vscode.window.showErrorMessage(`Run failed: ${error.message}`);
    }
  }

  /**
   * Find the appropriate language tool for a given language ID
   */
  private findLanguageTool(languageId: string): BaseTool | undefined {
    const toolName = `language-${languageId}`;
    return this.tools.get(toolName);
  }

  /**
   * Build the system prompt for the agent
   */
  private buildSystemPrompt(): string {
    return `You are Code Agent, a VS Code extension that helps developers write, fix, and understand code. 
You have access to various tools to help you accomplish tasks.

IMPORTANT: You must use the provided tools to create and modify files directly rather than just returning code in your response. 
When a user asks you to create or modify code, use the appropriate file operation tools:
- Use 'code-generation' tool for creating files, modifying files, and managing projects
- Use 'file-system' tool for reading, writing, and manipulating files
- Use 'terminal' tool for running commands like git operations or build processes

Always think step by step and use the appropriate tools when needed.
Analyze the code context carefully and provide helpful, accurate responses.
When writing or modifying code, follow clean coding practices:
- Write readable code
- Don't repeat code
- Extract common code into functions
- Keep code testable
- Follow best practices for the language or framework being used

After using tools to make changes, summarize what you've done in a user-friendly way.`;
  }

  /**
   * Build the user prompt with context
   */
  private buildUserPrompt(prompt: string, context?: string): string {
    let userPrompt = prompt;
    
    if (context) {
      userPrompt = `${prompt}\n\nHere is the relevant code context:\n\`\`\`\n${context}\n\`\`\``;
    }
    
    return userPrompt;
  }

  /**
   * Clean up resources on disposal
   */
  public dispose() {
    this.disposables.forEach(d => d.dispose());
  }
}
