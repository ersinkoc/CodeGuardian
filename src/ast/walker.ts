import ts from 'typescript';
import type { ASTVisitors } from '../types.js';

/**
 * Walk a TypeScript AST tree, calling visitor functions for matching node kinds.
 *
 * Visitors are keyed by SyntaxKind name (e.g., 'CallExpression', 'IfStatement').
 *
 * @param node - Root node to walk
 * @param visitors - Map of node kind name to visitor function
 *
 * @example
 * ```typescript
 * walkAST(sourceFile, {
 *   CallExpression(node) {
 *     console.log('Found call at', node.getStart());
 *   },
 *   IfStatement(node) {
 *     console.log('Found if at', node.getStart());
 *   },
 * });
 * ```
 */
export function walkAST(node: ts.Node, visitors: ASTVisitors): void {
  const kindName = ts.SyntaxKind[node.kind];

  /* v8 ignore next */
  let visitor = kindName !== undefined ? visitors[kindName] : undefined;

  // Handle SyntaxKind aliases (e.g., NumericLiteral vs FirstLiteralToken)
  if (!visitor) {
    for (const key of Object.keys(visitors)) {
      if ((ts.SyntaxKind as Record<string, unknown>)[key] === node.kind) {
        visitor = visitors[key];
        break;
      }
    }
  }

  if (visitor) {
    visitor(node);
  }

  ts.forEachChild(node, (child) => walkAST(child, visitors));
}

/**
 * Calculate cyclomatic complexity of an AST node.
 *
 * Counts decision points: if, else if, case, for, while, do, &&, ||, ??, ?., catch, ternary.
 * Base complexity is 1.
 *
 * @param node - AST node (typically a function body)
 * @returns Cyclomatic complexity score
 *
 * @example
 * ```typescript
 * const complexity = calculateComplexity(functionDeclaration);
 * // Returns >= 1
 * ```
 */
export function calculateComplexity(node: ts.Node): number {
  let complexity = 1;

  const visit = (child: ts.Node): void => {
    switch (child.kind) {
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.CatchClause:
      case ts.SyntaxKind.ConditionalExpression:
        complexity++;
        break;
      case ts.SyntaxKind.CaseClause:
        complexity++;
        break;
      case ts.SyntaxKind.BinaryExpression: {
        const binExpr = child as ts.BinaryExpression;
        if (
          binExpr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          binExpr.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          binExpr.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
        ) {
          complexity++;
        }
        break;
      }
    }

    ts.forEachChild(child, visit);
  };

  ts.forEachChild(node, visit);
  return complexity;
}

/**
 * Count lines of code in a source file (excluding blank lines and comment-only lines).
 *
 * @param sourceFile - TypeScript SourceFile
 * @returns Number of lines of code
 *
 * @example
 * ```typescript
 * const loc = countLOC(sourceFile);
 * ```
 */
export function countLOC(sourceFile: ts.SourceFile): number {
  const text = sourceFile.getFullText();
  const lines = text.split('\n');
  let count = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
      count++;
    }
  }

  return count;
}
