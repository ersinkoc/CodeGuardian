import ts from 'typescript';
import type { CodebaseGraph, FileNode, ImportInfo, RuleContext, ASTVisitors } from '../types.js';
import { walkAST } from '../ast/walker.js';
import {
  isCallTo as astIsCallTo,
  isConsoleCall as astIsConsoleCall,
  getTypeString as astGetTypeString,
  hasStringConcat as astHasStringConcat,
  extractImports,
} from '../ast/helpers.js';

/**
 * Create a RuleContext for a given file.
 *
 * @param file - FileNode from the graph
 * @param ast - TypeScript SourceFile AST
 * @param graph - Full codebase graph
 * @param program - TypeScript Program
 * @param checker - TypeScript TypeChecker
 * @param pluginConfig - Plugin-specific configuration
 * @returns RuleContext instance
 *
 * @example
 * ```typescript
 * const context = createRuleContext(fileNode, sourceFile, graph, program, checker, {});
 * const findings = rule.check(context);
 * ```
 */
export function createRuleContext(
  file: FileNode,
  ast: ts.SourceFile,
  graph: CodebaseGraph,
  program: ts.Program,
  checker: ts.TypeChecker,
  pluginConfig: Record<string, unknown> = {},
): RuleContext {
  return {
    file,
    ast,
    graph,
    program,
    checker,

    walk(node: ts.Node, visitors: ASTVisitors): void {
      walkAST(node, visitors);
    },

    isCallTo(node: ts.CallExpression, name: string): boolean {
      return astIsCallTo(node, name);
    },

    isConsoleCall(node: ts.CallExpression, method?: string): boolean {
      return astIsConsoleCall(node, method);
    },

    getTypeString(node: ts.Node): string {
      return astGetTypeString(node, checker);
    },

    hasStringConcat(node: ts.Node): boolean {
      return astHasStringConcat(node);
    },

    getImports(): ImportInfo[] {
      return extractImports(ast);
    },

    isExternallyUsed(symbolName: string): boolean {
      const symbolKey = `${file.path}:${symbolName}`;
      const symbol = graph.symbols.get(symbolKey);
      if (!symbol) return false;
      return symbol.usedBy.length > 0;
    },

    config: pluginConfig,
  };
}
