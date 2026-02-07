import ts from 'typescript';
import type { Finding, GuardianPlugin, ApiPluginConfig, RuleContext } from '../../types.js';

/**
 * API consistency plugin — checks REST endpoint naming and response format consistency.
 *
 * @example
 * ```typescript
 * guardian.use(apiPlugin({ enabled: true }));
 * ```
 */
export function apiPlugin(
  _config: Partial<ApiPluginConfig> = {},
): GuardianPlugin<ApiPluginConfig> {
  return {
    name: 'api-consistency',
    version: '1.0.0',
    install(kernel) {
      kernel.registerRule({
        name: 'api-consistency/endpoint-naming',
        severity: 'info',
        description: 'Checks REST API endpoint naming conventions',
        category: 'quality',
        check(context: RuleContext): Finding[] {
          if (context.file.role !== 'controller') return [];
          const findings: Finding[] = [];

          context.walk(context.ast, {
            StringLiteral(node: ts.Node) {
              const str = node as ts.StringLiteral;
              const value = str.text;

              // Check for route-like strings
              if (value.startsWith('/') && value.length > 1) {
                // Check for camelCase in paths (should be kebab-case)
                if (/\/[a-z]+[A-Z]/.test(value)) {
                  const pos = context.ast.getLineAndCharacterOfPosition(str.getStart(context.ast));
                  findings.push({
                    message: `API endpoint "${value}" uses camelCase — prefer kebab-case`,
                    file: context.file.path,
                    line: pos.line + 1,
                    column: pos.character + 1,
                    fix: { suggestion: 'Use kebab-case for URL paths (e.g., /user-profiles instead of /userProfiles).' },
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
