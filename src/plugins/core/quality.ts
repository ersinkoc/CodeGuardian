import ts from 'typescript';
import type { Finding, GuardianPlugin, QualityPluginConfig, RuleContext } from '../../types.js';

/**
 * Quality plugin — checks complexity, dead code, naming, and patterns.
 *
 * Rules:
 * - quality/cyclomatic-complexity
 * - quality/dead-code
 * - quality/any-type
 * - quality/no-error-handling
 * - quality/inconsistent-naming
 * - quality/magic-number
 * - quality/empty-catch
 * - quality/nested-callbacks
 *
 * @param config - Quality plugin configuration
 * @returns GuardianPlugin instance
 *
 * @example
 * ```typescript
 * guardian.use(qualityPlugin({ maxCyclomaticComplexity: 10 }));
 * ```
 */
export function qualityPlugin(
  config: Partial<QualityPluginConfig> = {},
): GuardianPlugin<QualityPluginConfig> {
  const fullConfig: QualityPluginConfig = {
    enabled: true,
    checkDeadCode: true,
    checkNaming: true,
    checkComplexity: true,
    maxCyclomaticComplexity: 15,
    ...config,
  };

  return {
    name: 'quality',
    version: '1.0.0',
    install(kernel) {
      // quality/cyclomatic-complexity
      kernel.registerRule({
        name: 'quality/cyclomatic-complexity',
        severity: 'warning',
        description: 'Detects functions with high cyclomatic complexity',
        category: 'quality',
        check(context: RuleContext): Finding[] {
          if (!fullConfig.checkComplexity) return [];
          const findings: Finding[] = [];
          const maxComplexity = fullConfig.maxCyclomaticComplexity ?? 15;

          for (const fn of context.file.functions) {
            if (fn.complexity > maxComplexity) {
              findings.push({
                message: `Function "${fn.name}" has cyclomatic complexity ${fn.complexity} (max: ${maxComplexity})`,
                file: context.file.path,
                line: fn.startLine,
                column: 1,
                fix: {
                  suggestion: 'Simplify by extracting conditions into named functions or using early returns.',
                },
              });
            }
          }

          return findings;
        },
      });

      // quality/dead-code
      kernel.registerRule({
        name: 'quality/dead-code',
        severity: 'warning',
        description: 'Detects exported symbols never imported by other files',
        category: 'quality',
        check(context: RuleContext): Finding[] {
          if (!fullConfig.checkDeadCode) return [];
          if (context.file.role === 'test') return [];
          const findings: Finding[] = [];

          for (const exportName of context.file.exports) {
            // Skip default exports and index files
            if (exportName === 'default') continue;
            /* v8 ignore next */
            const fileName = context.file.path.split('/').pop() ?? '';
            if (fileName === 'index.ts' || fileName === 'index.tsx') continue;

            const isUsed = context.isExternallyUsed(exportName);
            if (!isUsed) {
              findings.push({
                message: `Exported symbol "${exportName}" is never imported by other files`,
                file: context.file.path,
                line: 1,
                column: 1,
                fix: {
                  suggestion: 'Remove unused export or add an import if intentional.',
                },
              });
            }
          }

          return findings;
        },
      });

      // quality/any-type
      kernel.registerRule({
        name: 'quality/any-type',
        severity: 'warning',
        description: 'Detects usage of `any` type annotation',
        category: 'quality',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];

          context.walk(context.ast, {
            // TypeReference for explicit 'any' annotations
            AnyKeyword(node: ts.Node) {
              const pos = context.ast.getLineAndCharacterOfPosition(node.getStart(context.ast));
              findings.push({
                message: 'Usage of `any` type — use a specific type instead',
                file: context.file.path,
                line: pos.line + 1,
                column: pos.character + 1,
                fix: {
                  suggestion: 'Replace `any` with a specific type or `unknown`.',
                },
              });
            },
          });

          return findings;
        },
      });

      // quality/no-error-handling
      kernel.registerRule({
        name: 'quality/no-error-handling',
        severity: 'warning',
        description: 'Detects async functions without error handling',
        category: 'quality',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];

          for (const fn of context.file.functions) {
            if (!fn.isAsync) continue;

            // Check if the function body has a try-catch or .catch()
            const fileText = context.ast.getFullText();
            const fnText = fileText.slice(
              getLineOffset(fileText, fn.startLine),
              getLineOffset(fileText, fn.endLine + 1),
            );

            const hasTryCatch = fnText.includes('try') && fnText.includes('catch');
            const hasDotCatch = fnText.includes('.catch(');
            const hasThrow = fnText.includes('throw ');

            if (!hasTryCatch && !hasDotCatch && !hasThrow) {
              findings.push({
                message: `Async function "${fn.name}" has no error handling (try-catch or .catch())`,
                file: context.file.path,
                line: fn.startLine,
                column: 1,
                fix: {
                  suggestion: 'Add try-catch around async operations or use .catch() on promises.',
                },
              });
            }
          }

          return findings;
        },
      });

      // quality/inconsistent-naming
      kernel.registerRule({
        name: 'quality/inconsistent-naming',
        severity: 'info',
        description: 'Detects naming that does not follow project conventions',
        category: 'quality',
        check(context: RuleContext): Finding[] {
          if (!fullConfig.checkNaming) return [];
          const findings: Finding[] = [];

          for (const fn of context.file.functions) {
            // Functions should be camelCase
            if (fn.name && !/^[a-z_$]/.test(fn.name) && !/^[A-Z][A-Z_]+$/.test(fn.name)) {
              // Allow PascalCase for component functions
              if (context.file.role !== 'unknown') {
                findings.push({
                  message: `Function "${fn.name}" does not follow camelCase naming convention`,
                  file: context.file.path,
                  line: fn.startLine,
                  column: 1,
                  fix: {
                    suggestion: 'Use camelCase for function names (e.g., getUser, handleRequest).',
                  },
                });
              }
            }
          }

          return findings;
        },
      });

      // quality/magic-number
      kernel.registerRule({
        name: 'quality/magic-number',
        severity: 'info',
        description: 'Detects numeric literals used directly in logic',
        category: 'quality',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];
          const allowedNumbers = new Set([0, 1, -1, 2, 100, 200, 201, 204, 301, 302, 400, 401, 403, 404, 500]);

          context.walk(context.ast, {
            NumericLiteral(node: ts.Node) {
              const num = node as ts.NumericLiteral;

              const value = parseFloat(num.text);
              if (allowedNumbers.has(value)) return;

              // Skip if it's in a const declaration or enum
              let parent: ts.Node = num.parent;
              while (parent) {
                if (ts.isVariableDeclaration(parent) || ts.isEnumMember(parent) || ts.isPropertyAssignment(parent)) {
                  return;
                }
                parent = parent.parent;
              }

              const pos = context.ast.getLineAndCharacterOfPosition(num.getStart(context.ast));
              findings.push({
                message: `Magic number ${num.text} — extract to a named constant`,
                file: context.file.path,
                line: pos.line + 1,
                column: pos.character + 1,
                fix: {
                  suggestion: 'Extract numeric literal to a named constant for clarity.',
                },
              });
            },
          });

          return findings;
        },
      });

      // quality/empty-catch
      kernel.registerRule({
        name: 'quality/empty-catch',
        severity: 'warning',
        description: 'Detects empty catch blocks',
        category: 'quality',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];

          context.walk(context.ast, {
            CatchClause(node: ts.Node) {
              const catchClause = node as ts.CatchClause;

              const block = catchClause.block;
              if (block.statements.length === 0) {
                const pos = context.ast.getLineAndCharacterOfPosition(catchClause.getStart(context.ast));
                findings.push({
                  message: 'Empty catch block — errors are silently swallowed',
                  file: context.file.path,
                  line: pos.line + 1,
                  column: pos.character + 1,
                  fix: {
                    suggestion: 'Handle the error, log it, or re-throw if appropriate.',
                  },
                });
              }
            },
          });

          return findings;
        },
      });

      // quality/nested-callbacks
      kernel.registerRule({
        name: 'quality/nested-callbacks',
        severity: 'warning',
        description: 'Detects deeply nested callbacks (> 3 levels)',
        category: 'quality',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];
          const maxNesting = 3;

          const checkNesting = (node: ts.Node, depth: number): void => {
            if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
              if (depth > maxNesting) {
                const pos = context.ast.getLineAndCharacterOfPosition(node.getStart(context.ast));
                findings.push({
                  message: `Callback nested ${depth} levels deep (max: ${maxNesting})`,
                  file: context.file.path,
                  line: pos.line + 1,
                  column: pos.character + 1,
                  fix: {
                    suggestion: 'Use async/await or extract nested callbacks into named functions.',
                  },
                });
                return; // Don't recurse further
              }
              ts.forEachChild(node, (child) => checkNesting(child, depth + 1));
            } else {
              ts.forEachChild(node, (child) => checkNesting(child, depth));
            }
          };

          ts.forEachChild(context.ast, (child) => checkNesting(child, 0));

          return findings;
        },
      });
    },
  };
}

function getLineOffset(text: string, line: number): number {
  let offset = 0;
  let currentLine = 1;
  for (let i = 0; i < text.length; i++) {
    if (currentLine === line) return offset;
    if (text[i] === '\n') {
      currentLine++;
    }
    offset++;
  }
  return offset;
}
