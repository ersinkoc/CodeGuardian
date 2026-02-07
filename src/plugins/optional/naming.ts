import type { Finding, GuardianPlugin, NamingPluginConfig, RuleContext } from '../../types.js';

/**
 * Naming convention plugin — enforces strict file naming patterns.
 *
 * @example
 * ```typescript
 * guardian.use(namingPlugin({ enabled: true }));
 * ```
 */
export function namingPlugin(
  _config: Partial<NamingPluginConfig> = {},
): GuardianPlugin<NamingPluginConfig> {
  return {
    name: 'naming-convention',
    version: '1.0.0',
    install(kernel) {
      kernel.registerRule({
        name: 'naming-convention/file-naming',
        severity: 'warning',
        description: 'Enforces consistent file naming patterns based on directory',
        category: 'quality',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];
          const path = context.file.path;
          /* v8 ignore next */
          const fileName = path.split('/').pop() ?? '';

          // Check service files
          if (path.includes('/services/') && !fileName.endsWith('.service.ts') && !fileName.endsWith('.test.ts')) {
            findings.push({
              message: `File in services/ should follow *.service.ts naming: "${fileName}"`,
              file: context.file.path,
              line: 1,
              column: 1,
              fix: { suggestion: 'Rename file to follow *.service.ts convention.' },
            });
          }

          // Check controller files
          if (path.includes('/controllers/') && !fileName.endsWith('.controller.ts') && !fileName.endsWith('.test.ts')) {
            findings.push({
              message: `File in controllers/ should follow *.controller.ts naming: "${fileName}"`,
              file: context.file.path,
              line: 1,
              column: 1,
              fix: { suggestion: 'Rename file to follow *.controller.ts convention.' },
            });
          }

          // Check repository files
          if (path.includes('/repositories/') && !fileName.endsWith('.repository.ts') && !fileName.endsWith('.test.ts')) {
            findings.push({
              message: `File in repositories/ should follow *.repository.ts naming: "${fileName}"`,
              file: context.file.path,
              line: 1,
              column: 1,
              fix: { suggestion: 'Rename file to follow *.repository.ts convention.' },
            });
          }

          return findings;
        },
      });
    },
  };
}
