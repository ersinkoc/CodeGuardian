import ts from 'typescript';
import type { Finding, GuardianPlugin, PerformancePluginConfig, RuleContext } from '../../types.js';

const DB_CALL_PATTERNS = ['find', 'findOne', 'findAll', 'findById', 'query', 'execute', 'fetch', 'select'];
const SYNC_FS_METHODS = ['readFileSync', 'writeFileSync', 'appendFileSync', 'mkdirSync', 'readdirSync', 'statSync', 'existsSync', 'unlinkSync', 'copyFileSync'];

/**
 * Performance plugin — catches N+1 queries, memory leaks, sync operations.
 *
 * Rules:
 * - performance/n1-query
 * - performance/sync-in-async
 * - performance/memory-leak-risk
 * - performance/unbounded-query
 * - performance/missing-index-hint
 * - performance/heavy-import
 * - performance/blocking-operation
 *
 * @param config - Performance plugin configuration
 * @returns GuardianPlugin instance
 *
 * @example
 * ```typescript
 * guardian.use(performancePlugin({ checkN1Queries: true }));
 * ```
 */
export function performancePlugin(
  config: Partial<PerformancePluginConfig> = {},
): GuardianPlugin<PerformancePluginConfig> {
  const fullConfig: PerformancePluginConfig = {
    enabled: true,
    checkN1Queries: true,
    checkMemoryLeaks: true,
    checkAsyncPatterns: true,
    checkBundleSize: false,
    ...config,
  };

  return {
    name: 'performance',
    version: '1.0.0',
    install(kernel) {
      // performance/n1-query
      kernel.registerRule({
        name: 'performance/n1-query',
        severity: 'warning',
        description: 'Detects database calls inside loops (potential N+1 query)',
        category: 'performance',
        check(context: RuleContext): Finding[] {
          if (!fullConfig.checkN1Queries) return [];
          const findings: Finding[] = [];

          const checkForDbCallsInLoop = (loopNode: ts.Node): void => {
            ts.forEachChild(loopNode, function visitChild(child) {
              if (ts.isCallExpression(child)) {
                let methodName = '';
                if (ts.isPropertyAccessExpression(child.expression)) {
                  methodName = child.expression.name.text;
                }
                if (DB_CALL_PATTERNS.includes(methodName)) {
                  const pos = context.ast.getLineAndCharacterOfPosition(child.getStart(context.ast));
                  findings.push({
                    message: `Potential N+1 query: "${methodName}" called inside a loop`,
                    file: context.file.path,
                    line: pos.line + 1,
                    column: pos.character + 1,
                    fix: {
                      suggestion: 'Batch queries using Promise.all() or a single query with IN clause.',
                    },
                  });
                }
              }
              ts.forEachChild(child, visitChild);
            });
          };

          context.walk(context.ast, {
            ForStatement(node: ts.Node) { checkForDbCallsInLoop(node); },
            ForInStatement(node: ts.Node) { checkForDbCallsInLoop(node); },
            ForOfStatement(node: ts.Node) { checkForDbCallsInLoop(node); },
            WhileStatement(node: ts.Node) { checkForDbCallsInLoop(node); },
            DoStatement(node: ts.Node) { checkForDbCallsInLoop(node); },
          });

          // Also check .forEach() and .map()
          context.walk(context.ast, {
            CallExpression(node: ts.Node) {
              const call = node as ts.CallExpression;

              if (ts.isPropertyAccessExpression(call.expression)) {
                const name = call.expression.name.text;
                if (name === 'forEach' || name === 'map') {
                  if (call.arguments.length > 0) {
                    checkForDbCallsInLoop(call.arguments[0]!);
                  }
                }
              }
            },
          });

          return findings;
        },
      });

      // performance/sync-in-async
      kernel.registerRule({
        name: 'performance/sync-in-async',
        severity: 'warning',
        description: 'Detects synchronous file operations in async functions',
        category: 'performance',
        check(context: RuleContext): Finding[] {
          if (!fullConfig.checkAsyncPatterns) return [];
          const findings: Finding[] = [];

          for (const fn of context.file.functions) {
            if (!fn.isAsync) continue;

            // Walk the function's AST to find sync calls
            context.walk(context.ast, {
              CallExpression(node: ts.Node) {
                const call = node as ts.CallExpression;

                const pos = context.ast.getLineAndCharacterOfPosition(call.getStart(context.ast));
                const callLine = pos.line + 1;

                // Check if this call is within the async function's range
                if (callLine < fn.startLine || callLine > fn.endLine) return;

                let methodName = '';
                if (ts.isPropertyAccessExpression(call.expression)) {
                  methodName = call.expression.name.text;
                } else if (ts.isIdentifier(call.expression)) {
                  methodName = call.expression.text;
                }

                if (SYNC_FS_METHODS.includes(methodName)) {
                  findings.push({
                    message: `Synchronous "${methodName}" in async function "${fn.name}"`,
                    file: context.file.path,
                    line: callLine,
                    column: pos.character + 1,
                    fix: {
                      suggestion: `Use the async version instead (e.g., fs.promises.${methodName.replace('Sync', '')}).`,
                    },
                  });
                }
              },
            });
          }

          return findings;
        },
      });

      // performance/memory-leak-risk
      kernel.registerRule({
        name: 'performance/memory-leak-risk',
        severity: 'warning',
        description: 'Detects addEventListener without removeEventListener, setInterval without clearInterval',
        category: 'performance',
        check(context: RuleContext): Finding[] {
          if (!fullConfig.checkMemoryLeaks) return [];
          const findings: Finding[] = [];
          const fileText = context.ast.getFullText();

          // Check for addEventListener without removeEventListener
          if (fileText.includes('addEventListener') && !fileText.includes('removeEventListener')) {
            context.walk(context.ast, {
              CallExpression(node: ts.Node) {
                const call = node as ts.CallExpression;

                if (ts.isPropertyAccessExpression(call.expression) &&
                    call.expression.name.text === 'addEventListener') {
                  const pos = context.ast.getLineAndCharacterOfPosition(call.getStart(context.ast));
                  findings.push({
                    message: 'addEventListener without corresponding removeEventListener — potential memory leak',
                    file: context.file.path,
                    line: pos.line + 1,
                    column: pos.character + 1,
                    fix: {
                      suggestion: 'Add a cleanup function that calls removeEventListener.',
                    },
                  });
                }
              },
            });
          }

          // Check for setInterval without clearInterval
          if (fileText.includes('setInterval') && !fileText.includes('clearInterval')) {
            context.walk(context.ast, {
              CallExpression(node: ts.Node) {
                const call = node as ts.CallExpression;

                if (ts.isIdentifier(call.expression) && call.expression.text === 'setInterval') {
                  const pos = context.ast.getLineAndCharacterOfPosition(call.getStart(context.ast));
                  findings.push({
                    message: 'setInterval without clearInterval — potential memory leak',
                    file: context.file.path,
                    line: pos.line + 1,
                    column: pos.character + 1,
                    fix: {
                      suggestion: 'Store the interval ID and clear it when no longer needed.',
                    },
                  });
                }
              },
            });
          }

          return findings;
        },
      });

      // performance/unbounded-query
      kernel.registerRule({
        name: 'performance/unbounded-query',
        severity: 'warning',
        description: 'Detects database queries without LIMIT or pagination',
        category: 'performance',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];

          context.walk(context.ast, {
            CallExpression(node: ts.Node) {
              const call = node as ts.CallExpression;

              let methodName = '';
              if (ts.isPropertyAccessExpression(call.expression)) {
                methodName = call.expression.name.text;
              }

              if (methodName === 'findAll' || methodName === 'find') {
                // Check if there's a limit/take in the arguments
                const argText = call.arguments.map((a) => a.getText(context.ast)).join(' ');
                if (!argText.includes('limit') && !argText.includes('take') && !argText.includes('LIMIT')) {
                  const pos = context.ast.getLineAndCharacterOfPosition(call.getStart(context.ast));
                  findings.push({
                    message: `"${methodName}" without limit — could return unbounded results`,
                    file: context.file.path,
                    line: pos.line + 1,
                    column: pos.character + 1,
                    fix: {
                      suggestion: 'Add a LIMIT clause or pagination to prevent loading too many records.',
                    },
                  });
                }
              }
            },
          });

          return findings;
        },
      });

      // performance/missing-index-hint
      kernel.registerRule({
        name: 'performance/missing-index-hint',
        severity: 'info',
        description: 'Detects queries that may need database indexes',
        category: 'performance',
        check(_context: RuleContext): Finding[] {
          // This rule requires schema knowledge which we don't have
          // Return empty for now — can be extended with schema plugin
          return [];
        },
      });

      // performance/heavy-import
      kernel.registerRule({
        name: 'performance/heavy-import',
        severity: 'info',
        description: 'Detects importing entire libraries when a smaller import is available',
        category: 'performance',
        check(context: RuleContext): Finding[] {
          if (!fullConfig.checkBundleSize) return [];
          const findings: Finding[] = [];
          const heavyLibs = ['lodash', 'moment', 'rxjs'];

          for (const imp of context.file.imports) {
            for (const lib of heavyLibs) {
              if (imp.source === lib && imp.specifiers.length <= 2) {
                findings.push({
                  /* v8 ignore next */
                  message: `Importing from "${lib}" — consider using "${lib}/${imp.specifiers[0] ?? ''}" for smaller bundle`,
                  file: context.file.path,
                  line: 1,
                  column: 1,
                  fix: {
                    suggestion: `Use deep imports (e.g., "${lib}/functionName") for tree-shaking.`,
                  },
                });
              }
            }
          }

          return findings;
        },
      });

      // performance/blocking-operation
      kernel.registerRule({
        name: 'performance/blocking-operation',
        severity: 'warning',
        description: 'Detects CPU-intensive operations in request handlers',
        category: 'performance',
        check(context: RuleContext): Finding[] {
          if (context.file.role !== 'controller') return [];
          const findings: Finding[] = [];

          context.walk(context.ast, {
            CallExpression(node: ts.Node) {
              const call = node as ts.CallExpression;

              let methodName = '';
              if (ts.isPropertyAccessExpression(call.expression)) {
                methodName = call.expression.name.text;
              } else if (ts.isIdentifier(call.expression)) {
                methodName = call.expression.text;
              }

              // Large JSON.parse
              if (methodName === 'parse' && ts.isPropertyAccessExpression(call.expression)) {
                if (ts.isIdentifier(call.expression.expression) && call.expression.expression.text === 'JSON') {
                  const pos = context.ast.getLineAndCharacterOfPosition(call.getStart(context.ast));
                  findings.push({
                    message: 'JSON.parse() in request handler may block event loop for large payloads',
                    file: context.file.path,
                    line: pos.line + 1,
                    column: pos.character + 1,
                    fix: {
                      suggestion: 'Consider streaming JSON parsing or limiting request body size.',
                    },
                  });
                }
              }
            },
          });

          return findings;
        },
      });
    },
  };
}
