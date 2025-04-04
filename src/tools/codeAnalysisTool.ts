import * as vscode from 'vscode';
import * as path from 'path';
import { BaseTool } from './baseTool';

/**
 * Tool for analyzing code and providing insights
 */
export class CodeAnalysisTool extends BaseTool {
  private context: vscode.ExtensionContext;
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor(context: vscode.ExtensionContext) {
    super();
    this.context = context;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('codeAgent');
  }

  /**
   * Get the name of the tool
   */
  get name(): string {
    return 'code-analysis';
  }

  /**
   * Get the description of the tool
   */
  get description(): string {
    return 'Analyze code quality, find issues, and provide insights';
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
          enum: ['analyze', 'search', 'findReferences', 'findDefinition', 'getSymbols'],
          description: 'The code analysis action to perform'
        },
        file: {
          type: 'string',
          description: 'Path to the file to analyze'
        },
        query: {
          type: 'string',
          description: 'Search query or symbol name'
        },
        position: {
          type: 'object',
          description: 'Position in the document',
          properties: {
            line: { type: 'integer' },
            character: { type: 'integer' }
          }
        },
        filters: {
          type: 'object',
          description: 'Optional filters for analysis',
          properties: {
            maxResults: { type: 'integer' },
            includePattern: { type: 'string' },
            excludePattern: { type: 'string' }
          }
        }
      }
    };
  }

  /**
   * Execute the code analysis tool with the given input
   */
  public async execute(input: any): Promise<any> {
    switch (input.action) {
      case 'analyze':
        return this.analyzeFile(input.file);
      case 'search':
        return this.searchCode(input.query, input.filters);
      case 'findReferences':
        return this.findReferences(input.file, input.position);
      case 'findDefinition':
        return this.findDefinition(input.file, input.position);
      case 'getSymbols':
        return this.getSymbols(input.file);
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  }

  /**
   * Analyze a file for code quality issues
   */
  private async analyzeFile(filePath: string): Promise<{
    issues: Array<{
      message: string;
      severity: string;
      line: number;
      character: number;
      source?: string;
    }>;
    metrics: {
      complexity: number;
      linesOfCode: number;
      comments: number;
      functions: number;
      classes: number;
    };
  }> {
    try {
      // Resolve the file path
      const uri = this.resolveFileUri(filePath);
      
      // Read the file content
      const document = await vscode.workspace.openTextDocument(uri);
      const text = document.getText();
      const languageId = document.languageId;
      
      // Perform basic analysis - In a complete implementation,
      // this would integrate with language-specific analysis tools
      const lines = text.split(/\r?\n/);
      const issues = this.findBasicIssues(lines, languageId);
      
      // Calculate basic metrics
      const metrics = this.calculateMetrics(lines, languageId);
      
      // Update diagnostics
      this.updateDiagnostics(uri, issues);
      
      return {
        issues,
        metrics
      };
    } catch (error: any) {
      throw new Error(`Failed to analyze file: ${error.message}`);
    }
  }

  /**
   * Search for code matching a query
   */
  private async searchCode(
    query: string,
    filters?: { maxResults?: number; includePattern?: string; excludePattern?: string }
  ): Promise<Array<{ uri: string; range: { line: number; character: number }; text: string }>> {
    try {
      // Determine search scope
      const searchScope = await this.getSearchScope(filters);
      const maxResults = filters?.maxResults || 100;
      
      const results: Array<{
        uri: string;
        range: { line: number; character: number };
        text: string;
      }> = [];
      
      // Perform the search
      const searchPattern = new RegExp(query, 'gi');
      
      // Use the workspace.findFiles API to get file URIs
      const files = await vscode.workspace.findFiles(
        filters?.includePattern || '**/*.{js,ts,jsx,tsx,html,css,json,md}',
        filters?.excludePattern || '**/node_modules/**'
      );
      
      for (const fileUri of files) {
        if (results.length >= maxResults) {
          break;
        }
        
        try {
          const document = await vscode.workspace.openTextDocument(fileUri);
          const text = document.getText();
          
          // Find all matches in the document
          let match;
          while ((match = searchPattern.exec(text)) !== null && results.length < maxResults) {
            const position = document.positionAt(match.index);
            const lineText = document.lineAt(position.line).text;
            
            results.push({
              uri: fileUri.toString(),
              range: {
                line: position.line,
                character: position.character
              },
              text: lineText.trim()
            });
          }
        } catch (error) {
          // Skip files that can't be opened
          console.error(`Error searching file ${fileUri.toString()}:`, error);
        }
      }
      
      return results;
    } catch (error: any) {
      throw new Error(`Failed to search code: ${error.message}`);
    }
  }

  /**
   * Find references to a symbol at a position
   */
  private async findReferences(
    filePath: string,
    position: { line: number; character: number }
  ): Promise<Array<{ uri: string; range: { line: number; character: number }; text: string }>> {
    try {
      const uri = this.resolveFileUri(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const pos = new vscode.Position(position.line, position.character);
      
      // Use the VS Code reference provider
      const locations = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeReferenceProvider',
        uri,
        pos
      );
      
      const results = await Promise.all(
        locations.map(async (location) => {
          try {
            const doc = await vscode.workspace.openTextDocument(location.uri);
            const range = location.range;
            const text = doc.lineAt(range.start.line).text.trim();
            
            return {
              uri: location.uri.toString(),
              range: {
                line: range.start.line,
                character: range.start.character
              },
              text
            };
          } catch (error) {
            console.error(`Error processing reference at ${location.uri.toString()}:`, error);
            return null;
          }
        })
      );
      
      return results.filter((result): result is { uri: string; range: { line: number; character: number }; text: string } => 
        result !== null
      );
    } catch (error: any) {
      throw new Error(`Failed to find references: ${error.message}`);
    }
  }

  /**
   * Find the definition of a symbol at a position
   */
  private async findDefinition(
    filePath: string,
    position: { line: number; character: number }
  ): Promise<{
    uri: string;
    range: { line: number; character: number };
    text: string;
  } | null> {
    try {
      const uri = this.resolveFileUri(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const pos = new vscode.Position(position.line, position.character);
      
      // Use the VS Code definition provider
      const locations = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeDefinitionProvider',
        uri,
        pos
      );
      
      if (locations.length === 0) {
        return null;
      }
      
      // Get the first definition location
      const location = locations[0];
      const definitionDocument = await vscode.workspace.openTextDocument(location.uri);
      const range = location.range;
      const text = definitionDocument.lineAt(range.start.line).text.trim();
      
      return {
        uri: location.uri.toString(),
        range: {
          line: range.start.line,
          character: range.start.character
        },
        text
      };
    } catch (error: any) {
      throw new Error(`Failed to find definition: ${error.message}`);
    }
  }

  /**
   * Get all symbols in a file
   */
  private async getSymbols(filePath: string): Promise<Array<{
    name: string;
    kind: string;
    range: { startLine: number; startCharacter: number; endLine: number; endCharacter: number };
    containerName?: string;
  }>> {
    try {
      const uri = this.resolveFileUri(filePath);
      
      // Use the VS Code document symbol provider
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        uri
      );
      
      if (!symbols || symbols.length === 0) {
        return [];
      }
      
      // Convert symbols to a flattened list
      return this.flattenSymbols(symbols);
    } catch (error: any) {
      throw new Error(`Failed to get symbols: ${error.message}`);
    }
  }

  /**
   * Find basic code issues (simplified implementation)
   */
  private findBasicIssues(
    lines: string[],
    languageId: string
  ): Array<{
    message: string;
    severity: string;
    line: number;
    character: number;
    source?: string;
  }> {
    const issues: Array<{
      message: string;
      severity: string;
      line: number;
      character: number;
      source?: string;
    }> = [];
    
    // Simple pattern-based checks
    // In a full implementation, this would be much more sophisticated and language-specific
    const patterns = [
      {
        pattern: /console\.log/g,
        message: 'Avoid using console.log in production code',
        severity: 'warning',
        source: 'code-agent'
      },
      {
        pattern: /TODO|FIXME/g,
        message: 'Unresolved TODO or FIXME comment',
        severity: 'information',
        source: 'code-agent'
      },
      {
        pattern: /debugger;/g,
        message: 'Debugger statement should be removed',
        severity: 'warning',
        source: 'code-agent'
      }
    ];
    
    // Check each line for issues
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const { pattern, message, severity, source } of patterns) {
        let match;
        pattern.lastIndex = 0; // Reset regex state
        
        while ((match = pattern.exec(line)) !== null) {
          issues.push({
            message,
            severity,
            line: i,
            character: match.index,
            source
          });
        }
      }
    }
    
    return issues;
  }

  /**
   * Calculate basic code metrics
   */
  private calculateMetrics(
    lines: string[],
    languageId: string
  ): {
    complexity: number;
    linesOfCode: number;
    comments: number;
    functions: number;
    classes: number;
  } {
    // Initialize metrics
    let comments = 0;
    let functions = 0;
    let classes = 0;
    let complexity = 0;
    
    // Count non-empty lines
    const linesOfCode = lines.filter(line => line.trim().length > 0).length;
    
    // Simple pattern-based counting
    // In a full implementation, this would be much more sophisticated and language-specific
    const commentPattern = /\/\/|\/\*|\*\//;
    const functionPattern = /function\s+\w+\s*\(|const\s+\w+\s*=\s*\([^)]*\)\s*=>/;
    const classPattern = /class\s+\w+/;
    const complexityPattern = /if|else|for|while|switch|case|&&|\|\||\?/;
    
    for (const line of lines) {
      if (commentPattern.test(line)) {
        comments++;
      }
      
      if (functionPattern.test(line)) {
        functions++;
      }
      
      if (classPattern.test(line)) {
        classes++;
      }
      
      // Simple cyclomatic complexity approximation
      const complexityMatches = line.match(complexityPattern);
      if (complexityMatches) {
        complexity += complexityMatches.length;
      }
    }
    
    return {
      complexity,
      linesOfCode,
      comments,
      functions,
      classes
    };
  }

  /**
   * Update VS Code diagnostics for a file
   */
  private updateDiagnostics(
    uri: vscode.Uri,
    issues: Array<{
      message: string;
      severity: string;
      line: number;
      character: number;
      source?: string;
    }>
  ): void {
    const diagnostics: vscode.Diagnostic[] = issues.map(issue => {
      // Convert severity string to DiagnosticSeverity
      let severity: vscode.DiagnosticSeverity;
      switch (issue.severity) {
        case 'error':
          severity = vscode.DiagnosticSeverity.Error;
          break;
        case 'warning':
          severity = vscode.DiagnosticSeverity.Warning;
          break;
        case 'information':
          severity = vscode.DiagnosticSeverity.Information;
          break;
        case 'hint':
          severity = vscode.DiagnosticSeverity.Hint;
          break;
        default:
          severity = vscode.DiagnosticSeverity.Information;
      }
      
      // Create a range for the issue
      const range = new vscode.Range(
        new vscode.Position(issue.line, issue.character),
        new vscode.Position(issue.line, issue.character + 1)
      );
      
      // Create the diagnostic
      const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
      
      if (issue.source) {
        diagnostic.source = issue.source;
      }
      
      return diagnostic;
    });
    
    // Update the diagnostic collection
    this.diagnosticCollection.set(uri, diagnostics);
  }

  /**
   * Get search scope based on filters
   */
  private async getSearchScope(
    filters?: { includePattern?: string; excludePattern?: string }
  ): Promise<vscode.Uri[]> {
    // Use workspace.findFiles to get files matching the pattern
    return vscode.workspace.findFiles(
      filters?.includePattern || '**/*.{js,ts,jsx,tsx,html,css,json,md}',
      filters?.excludePattern || '**/node_modules/**'
    );
  }

  /**
   * Flatten document symbols tree into a list
   */
  private flattenSymbols(
    symbols: vscode.DocumentSymbol[],
    containerName?: string
  ): Array<{
    name: string;
    kind: string;
    range: { startLine: number; startCharacter: number; endLine: number; endCharacter: number };
    containerName?: string;
  }> {
    const result: Array<{
      name: string;
      kind: string;
      range: { startLine: number; startCharacter: number; endLine: number; endCharacter: number };
      containerName?: string;
    }> = [];
    
    for (const symbol of symbols) {
      // Convert symbol kind to string
      const kind = this.symbolKindToString(symbol.kind);
      
      // Add this symbol
      result.push({
        name: symbol.name,
        kind,
        range: {
          startLine: symbol.range.start.line,
          startCharacter: symbol.range.start.character,
          endLine: symbol.range.end.line,
          endCharacter: symbol.range.end.character
        },
        containerName
      });
      
      // Add children recursively
      if (symbol.children && symbol.children.length > 0) {
        const childSymbols = this.flattenSymbols(symbol.children, symbol.name);
        result.push(...childSymbols);
      }
    }
    
    return result;
  }

  /**
   * Convert SymbolKind enum to string
   */
  private symbolKindToString(kind: vscode.SymbolKind): string {
    const kindMap: Record<number, string> = {
      [vscode.SymbolKind.File]: 'file',
      [vscode.SymbolKind.Module]: 'module',
      [vscode.SymbolKind.Namespace]: 'namespace',
      [vscode.SymbolKind.Package]: 'package',
      [vscode.SymbolKind.Class]: 'class',
      [vscode.SymbolKind.Method]: 'method',
      [vscode.SymbolKind.Property]: 'property',
      [vscode.SymbolKind.Field]: 'field',
      [vscode.SymbolKind.Constructor]: 'constructor',
      [vscode.SymbolKind.Enum]: 'enum',
      [vscode.SymbolKind.Interface]: 'interface',
      [vscode.SymbolKind.Function]: 'function',
      [vscode.SymbolKind.Variable]: 'variable',
      [vscode.SymbolKind.Constant]: 'constant',
      [vscode.SymbolKind.String]: 'string',
      [vscode.SymbolKind.Number]: 'number',
      [vscode.SymbolKind.Boolean]: 'boolean',
      [vscode.SymbolKind.Array]: 'array',
      [vscode.SymbolKind.Object]: 'object',
      [vscode.SymbolKind.Key]: 'key',
      [vscode.SymbolKind.Null]: 'null',
      [vscode.SymbolKind.EnumMember]: 'enumMember',
      [vscode.SymbolKind.Struct]: 'struct',
      [vscode.SymbolKind.Event]: 'event',
      [vscode.SymbolKind.Operator]: 'operator',
      [vscode.SymbolKind.TypeParameter]: 'typeParameter'
    };
    
    return kindMap[kind] || 'unknown';
  }

  /**
   * Resolve a file path to a VS Code URI
   */
  private resolveFileUri(filePath: string): vscode.Uri {
    if (filePath.startsWith('file:')) {
      return vscode.Uri.parse(filePath);
    }
    
    if (path.isAbsolute(filePath)) {
      return vscode.Uri.file(filePath);
    }
    
    // Resolve relative to workspace root
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder is open');
    }
    
    return vscode.Uri.file(path.join(workspaceFolders[0].uri.fsPath, filePath));
  }

  /**
   * Clean up resources on disposal
   */
  dispose() {
    this.diagnosticCollection.clear();
    this.diagnosticCollection.dispose();
  }
}
