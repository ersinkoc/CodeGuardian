import ts from 'typescript';
import type { Finding, GuardianPlugin, SecurityPluginConfig, RuleContext } from '../../types.js';

const DB_METHODS = ['query', 'execute', 'raw', 'prepare', 'exec'];
const SECRET_PATTERNS = [
  /^(sk_|pk_|api_|token_|secret_|password|auth_)/i,
  /^(AKIA[0-9A-Z]{16})/, // AWS access key
  /^eyJ[A-Za-z0-9-_]+\.eyJ/, // JWT token
  /^(ghp_|gho_|ghu_|ghs_|ghr_)/, // GitHub tokens
  /(mongodb(\+srv)?:\/\/|postgres(ql)?:\/\/|mysql:\/\/|redis:\/\/)/i, // Connection strings
];

/**
 * Security plugin — detects security anti-patterns and vulnerabilities.
 *
 * Rules:
 * - security/sql-injection
 * - security/hardcoded-secret
 * - security/eval-usage
 * - security/prototype-pollution
 * - security/xss-risk
 * - security/missing-auth-check
 * - security/insecure-random
 * - security/path-traversal
 *
 * @param config - Security plugin configuration
 * @returns GuardianPlugin instance
 *
 * @example
 * ```typescript
 * guardian.use(securityPlugin({ checkInjection: true, checkSecrets: true }));
 * ```
 */
export function securityPlugin(
  config: Partial<SecurityPluginConfig> = {},
): GuardianPlugin<SecurityPluginConfig> {
  const fullConfig: SecurityPluginConfig = {
    enabled: true,
    checkInjection: true,
    checkAuth: true,
    checkSecrets: true,
    checkXSS: true,
    checkCSRF: true,
    ...config,
  };

  return {
    name: 'security',
    version: '1.0.0',
    install(kernel) {
      // security/sql-injection
      kernel.registerRule({
        name: 'security/sql-injection',
        severity: 'critical',
        description: 'Detects string concatenation in SQL queries',
        category: 'security',
        check(context: RuleContext): Finding[] {
          if (!fullConfig.checkInjection) return [];
          const findings: Finding[] = [];

          context.walk(context.ast, {
            CallExpression(node: ts.Node) {
              const call = node as ts.CallExpression;

              const expr = call.expression;
              let methodName = '';

              if (ts.isPropertyAccessExpression(expr)) {
                methodName = expr.name.text;
              } else if (ts.isIdentifier(expr)) {
                methodName = expr.text;
              }

              if (DB_METHODS.includes(methodName)) {
                for (const arg of call.arguments) {
                  if (ts.isTemplateExpression(arg) || context.hasStringConcat(arg)) {
                    const pos = context.ast.getLineAndCharacterOfPosition(call.getStart(context.ast));
                    findings.push({
                      message: 'Raw string concatenation in SQL query — potential SQL injection',
                      file: context.file.path,
                      line: pos.line + 1,
                      column: pos.character + 1,
                      fix: {
                        suggestion: 'Use parameterized queries instead of string templates.',
                      },
                    });
                  }
                }
              }
            },
          });

          return findings;
        },
      });

      // security/hardcoded-secret
      kernel.registerRule({
        name: 'security/hardcoded-secret',
        severity: 'critical',
        description: 'Detects hardcoded API keys, tokens, and passwords',
        category: 'security',
        check(context: RuleContext): Finding[] {
          if (!fullConfig.checkSecrets) return [];
          if (context.file.role === 'test') return [];
          const findings: Finding[] = [];

          context.walk(context.ast, {
            StringLiteral(node: ts.Node) {
              const str = node as ts.StringLiteral;
              const value = str.text;

              if (value.length < 8) return;

              for (const pattern of SECRET_PATTERNS) {
                if (pattern.test(value)) {
                  const pos = context.ast.getLineAndCharacterOfPosition(str.getStart(context.ast));
                  findings.push({
                    message: 'Possible hardcoded secret detected',
                    file: context.file.path,
                    line: pos.line + 1,
                    column: pos.character + 1,
                    fix: {
                      suggestion: 'Move secrets to environment variables or a secure vault.',
                    },
                  });
                  break;
                }
              }
            },
            NoSubstitutionTemplateLiteral(node: ts.Node) {
              const tmpl = node as ts.NoSubstitutionTemplateLiteral;
              const value = tmpl.text;
              if (value.length < 8) return;

              for (const pattern of SECRET_PATTERNS) {
                if (pattern.test(value)) {
                  const pos = context.ast.getLineAndCharacterOfPosition(tmpl.getStart(context.ast));
                  findings.push({
                    message: 'Possible hardcoded secret detected',
                    file: context.file.path,
                    line: pos.line + 1,
                    column: pos.character + 1,
                    fix: {
                      suggestion: 'Move secrets to environment variables or a secure vault.',
                    },
                  });
                  break;
                }
              }
            },
          });

          return findings;
        },
      });

      // security/eval-usage
      kernel.registerRule({
        name: 'security/eval-usage',
        severity: 'critical',
        description: 'Detects eval(), Function(), and similar unsafe patterns',
        category: 'security',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];

          context.walk(context.ast, {
            CallExpression(node: ts.Node) {
              const call = node as ts.CallExpression;

              let name = '';
              if (ts.isIdentifier(call.expression)) {
                name = call.expression.text;
              }

              if (name === 'eval' || name === 'Function') {
                const pos = context.ast.getLineAndCharacterOfPosition(call.getStart(context.ast));
                findings.push({
                  message: `Unsafe ${name}() call — potential code injection`,
                  file: context.file.path,
                  line: pos.line + 1,
                  column: pos.character + 1,
                  fix: {
                    suggestion: `Avoid ${name}(). Use safe alternatives like JSON.parse() or structured data.`,
                  },
                });
              }

              // setTimeout/setInterval with string argument
              if ((name === 'setTimeout' || name === 'setInterval') && call.arguments.length > 0) {
                const firstArg = call.arguments[0]!;
                if (ts.isStringLiteral(firstArg)) {
                  const pos = context.ast.getLineAndCharacterOfPosition(call.getStart(context.ast));
                  findings.push({
                    message: `${name}() with string argument is equivalent to eval()`,
                    file: context.file.path,
                    line: pos.line + 1,
                    column: pos.character + 1,
                    fix: {
                      suggestion: 'Pass a function reference instead of a string.',
                    },
                  });
                }
              }
            },
            NewExpression(node: ts.Node) {
              const newExpr = node as ts.NewExpression;
              if (ts.isIdentifier(newExpr.expression) && newExpr.expression.text === 'Function') {
                const pos = context.ast.getLineAndCharacterOfPosition(newExpr.getStart(context.ast));
                findings.push({
                  message: 'new Function() is equivalent to eval() — potential code injection',
                  file: context.file.path,
                  line: pos.line + 1,
                  column: pos.character + 1,
                  fix: {
                    suggestion: 'Avoid new Function(). Use safe alternatives.',
                  },
                });
              }
            },
          });

          return findings;
        },
      });

      // security/prototype-pollution
      kernel.registerRule({
        name: 'security/prototype-pollution',
        severity: 'error',
        description: 'Detects potential prototype pollution',
        category: 'security',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];

          context.walk(context.ast, {
            PropertyAccessExpression(node: ts.Node) {
              const propAccess = node as ts.PropertyAccessExpression;

              if (propAccess.name.text === '__proto__' || propAccess.name.text === 'prototype') {
                // Check if it's Object.prototype assignment
                const parent = propAccess.parent;
                if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                  const pos = context.ast.getLineAndCharacterOfPosition(propAccess.getStart(context.ast));
                  findings.push({
                    message: 'Direct prototype assignment — potential prototype pollution',
                    file: context.file.path,
                    line: pos.line + 1,
                    column: pos.character + 1,
                    fix: {
                      suggestion: 'Use Object.create(null) or Map for dynamic key-value stores.',
                    },
                  });
                }
              }
            },
          });

          return findings;
        },
      });

      // security/xss-risk
      kernel.registerRule({
        name: 'security/xss-risk',
        severity: 'error',
        description: 'Detects innerHTML and similar XSS-prone patterns',
        category: 'security',
        check(context: RuleContext): Finding[] {
          if (!fullConfig.checkXSS) return [];
          const findings: Finding[] = [];
          const xssProps = ['innerHTML', 'outerHTML', 'dangerouslySetInnerHTML'];

          context.walk(context.ast, {
            PropertyAccessExpression(node: ts.Node) {
              const propAccess = node as ts.PropertyAccessExpression;

              if (xssProps.includes(propAccess.name.text)) {
                const pos = context.ast.getLineAndCharacterOfPosition(propAccess.getStart(context.ast));
                findings.push({
                  message: `Use of ${propAccess.name.text} — potential XSS vulnerability`,
                  file: context.file.path,
                  line: pos.line + 1,
                  column: pos.character + 1,
                  fix: {
                    suggestion: 'Sanitize HTML content before insertion or use safe alternatives.',
                  },
                });
              }
            },
            CallExpression(node: ts.Node) {
              const call = node as ts.CallExpression;

              if (ts.isPropertyAccessExpression(call.expression)) {
                const name = call.expression.name.text;
                if (name === 'write' || name === 'writeln') {
                  if (ts.isIdentifier(call.expression.expression) && call.expression.expression.text === 'document') {
                    const pos = context.ast.getLineAndCharacterOfPosition(call.getStart(context.ast));
                    findings.push({
                      message: 'document.write() is an XSS risk',
                      file: context.file.path,
                      line: pos.line + 1,
                      column: pos.character + 1,
                      fix: {
                        suggestion: 'Use DOM manipulation methods instead of document.write().',
                      },
                    });
                  }
                }
              }
            },
          });

          return findings;
        },
      });

      // security/missing-auth-check
      kernel.registerRule({
        name: 'security/missing-auth-check',
        severity: 'warning',
        description: 'Detects route handlers without auth checks',
        category: 'security',
        check(context: RuleContext): Finding[] {
          if (!fullConfig.checkAuth) return [];
          if (context.file.role !== 'controller') return [];
          const findings: Finding[] = [];

          const fileText = context.ast.getFullText();
          const hasAuthReference =
            fileText.includes('auth') ||
            fileText.includes('Auth') ||
            fileText.includes('authenticate') ||
            fileText.includes('authorize') ||
            fileText.includes('guard') ||
            fileText.includes('middleware') ||
            fileText.includes('jwt') ||
            fileText.includes('token');

          if (!hasAuthReference && context.file.functions.length > 0) {
            findings.push({
              message: 'Controller has no authentication/authorization references',
              file: context.file.path,
              line: 1,
              column: 1,
              fix: {
                suggestion: 'Add authentication middleware or auth checks to route handlers.',
              },
            });
          }

          return findings;
        },
      });

      // security/insecure-random
      kernel.registerRule({
        name: 'security/insecure-random',
        severity: 'warning',
        description: 'Detects Math.random() in security-sensitive contexts',
        category: 'security',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];

          context.walk(context.ast, {
            CallExpression(node: ts.Node) {
              const call = node as ts.CallExpression;

              if (ts.isPropertyAccessExpression(call.expression)) {
                if (
                  ts.isIdentifier(call.expression.expression) &&
                  call.expression.expression.text === 'Math' &&
                  call.expression.name.text === 'random'
                ) {
                  // Check if used in security context
                  const fileText = context.ast.getFullText();
                  const isSecurityContext =
                    fileText.includes('token') ||
                    fileText.includes('secret') ||
                    fileText.includes('password') ||
                    fileText.includes('hash') ||
                    fileText.includes('crypto') ||
                    fileText.includes('session');

                  if (isSecurityContext) {
                    const pos = context.ast.getLineAndCharacterOfPosition(call.getStart(context.ast));
                    findings.push({
                      message: 'Math.random() is not cryptographically secure',
                      file: context.file.path,
                      line: pos.line + 1,
                      column: pos.character + 1,
                      fix: {
                        suggestion: 'Use crypto.randomBytes() or crypto.randomUUID() for security-sensitive values.',
                      },
                    });
                  }
                }
              }
            },
          });

          return findings;
        },
      });

      // security/path-traversal
      kernel.registerRule({
        name: 'security/path-traversal',
        severity: 'error',
        description: 'Detects file operations with potential path traversal',
        category: 'security',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];
          const fsOps = ['readFile', 'readFileSync', 'writeFile', 'writeFileSync', 'createReadStream', 'createWriteStream', 'access', 'open'];

          context.walk(context.ast, {
            CallExpression(node: ts.Node) {
              const call = node as ts.CallExpression;

              let methodName = '';
              if (ts.isPropertyAccessExpression(call.expression)) {
                methodName = call.expression.name.text;
              } else if (ts.isIdentifier(call.expression)) {
                methodName = call.expression.text;
              }

              if (fsOps.includes(methodName) && call.arguments.length > 0) {
                const firstArg = call.arguments[0]!;
                if (ts.isTemplateExpression(firstArg) || context.hasStringConcat(firstArg)) {
                  const pos = context.ast.getLineAndCharacterOfPosition(call.getStart(context.ast));
                  findings.push({
                    message: `File operation "${methodName}" with dynamic path — potential path traversal`,
                    file: context.file.path,
                    line: pos.line + 1,
                    column: pos.character + 1,
                    fix: {
                      suggestion: 'Validate and sanitize file paths. Use path.resolve() and check against a whitelist.',
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
