# Code Agent - VS Code Extension

Code Agent is a VS Code extension that provides agentic code generation and manipulation capabilities. Similar to tools like Codium and Windsurf, it allows you to generate, modify, validate, and run code through natural language prompts.

## Features

- **Agentic Code Generation**: Use natural language prompts to generate code that meets your needs
- **Code Analysis**: Detect issues and get insights about your code structure
- **Code Execution**: Run and validate your code directly from the extension
- **Web Preview**: Preview and inspect web applications with an integrated browser view
- **Automation Tools**: Tools for reading, writing, validating, compiling, fixing, and inspecting code

## Usage

### Code Generation

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to open the command palette
2. Select "Code Agent: Generate Code"
3. Enter a prompt describing the code you want to generate
4. The agent will generate the code and either show it to you for review or apply it directly

### Code Fixing

1. Select the code you want to fix
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to open the command palette
3. Select "Code Agent: Fix Code"
4. The agent will analyze and fix issues in your code

### Code Validation

1. Open the file you want to validate
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to open the command palette
3. Select "Code Agent: Validate Code"
4. The agent will analyze your code and report any issues

### Code Execution

1. Open the file you want to run
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to open the command palette
3. Select "Code Agent: Run Code"
4. The agent will execute your code and display the results

## Tool Capabilities

Code Agent includes a variety of tools that enable it to:

- **Read and Write Files**: Access and modify files in your workspace
- **Execute Terminal Commands**: Run shell commands to compile, test, or execute code
- **Analyze Code**: Detect issues, find references, and get insights about code structure
- **Web Preview**: View and interact with web applications, inspect elements, and execute JavaScript
- **Language-Specific Operations**: Validate and run code for specific programming languages

## Requirements

- VS Code 1.85.0 or higher
- Internet connection for AI-powered features
- OpenAI API key for language model capabilities

## Extension Settings

* `codeAgent.openaiApiKey`: Your OpenAI API key (required for AI features)
* `codeAgent.useWebviewOutput`: Whether to use a webview for displaying output (default: false)
* `codeAgent.autoRunCommands`: Whether to automatically run terminal commands (default: false)

## Privacy & Security

Code Agent requires access to your code to provide its functionality. When you use the AI-powered features:

- Code snippets are sent to the OpenAI API for processing
- Your API key is stored in the VS Code settings but never shared
- The extension only accesses files in your workspace
- You can review all changes before they are applied

## Development

### Building the Extension

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to compile the TypeScript code
4. Press F5 to launch the extension in a new VS Code window for testing

### Project Structure

```
code-agent/
├── .vscode/            # VS Code settings
├── src/                # Source code
│   ├── extension.ts    # Main extension entry point
│   ├── agents/         # Agent implementation
│   ├── tools/          # Tool implementations
│   └── ui/             # UI components
├── package.json        # Extension manifest
├── tsconfig.json       # TypeScript configuration
└── README.md           # Documentation
```

## License

MIT
