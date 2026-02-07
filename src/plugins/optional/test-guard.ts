import type { Finding, GuardianPlugin, TestGuardPluginConfig, RuleContext } from '../../types.js';

/**
 * Test coverage guard plugin — ensures changed files have corresponding test files.
 *
 * @example
 * ```typescript
 * guardian.use(testGuardPlugin({ enabled: true }));
 * ```
 */
export function testGuardPlugin(
  _config: Partial<TestGuardPluginConfig> = {},
): GuardianPlugin<TestGuardPluginConfig> {
  return {
    name: 'test-coverage-guard',
    version: '1.0.0',
    install(kernel) {
      kernel.registerRule({
        name: 'test-coverage-guard/missing-tests',
        severity: 'warning',
        description: 'Ensures source files have corresponding test files',
        category: 'quality',
        check(context: RuleContext): Finding[] {
          if (context.file.role === 'test' || context.file.role === 'type' || context.file.role === 'config') {
            return [];
          }

          const findings: Finding[] = [];
          const filePath = context.file.path;

          // Generate expected test file paths
          const testPaths = getExpectedTestPaths(filePath);

          // Check if any test file exists in the graph
          const hasTest = testPaths.some((tp) => context.graph.files.has(tp));

          if (!hasTest) {
            findings.push({
              message: `No test file found for "${filePath}"`,
              file: context.file.path,
              line: 1,
              column: 1,
              fix: {
                /* v8 ignore next */
                suggestion: `Create a test file (e.g., ${testPaths[0] ?? filePath.replace('.ts', '.test.ts')}).`,
              },
            });
          }

          return findings;
        },
      });
    },
  };
}

function getExpectedTestPaths(filePath: string): string[] {
  const base = filePath.replace(/\.ts$/, '');
  return [
    `${base}.test.ts`,
    `${base}.spec.ts`,
    filePath.replace('src/', 'tests/').replace('.ts', '.test.ts'),
    filePath.replace('src/', 'tests/unit/').replace('.ts', '.test.ts'),
  ];
}
