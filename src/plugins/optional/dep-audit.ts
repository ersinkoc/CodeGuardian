import type { Finding, GuardianPlugin, DepAuditPluginConfig, RuleContext } from '../../types.js';

/**
 * Dependency audit plugin — checks import depth and heavy transitive dependencies.
 *
 * @example
 * ```typescript
 * guardian.use(depAuditPlugin({ enabled: true, maxDepth: 5 }));
 * ```
 */
export function depAuditPlugin(
  config: Partial<DepAuditPluginConfig> = {},
): GuardianPlugin<DepAuditPluginConfig> {
  const fullConfig: DepAuditPluginConfig = {
    enabled: true,
    maxDepth: 5,
    ...config,
  };

  return {
    name: 'dependency-audit',
    version: '1.0.0',
    install(kernel) {
      kernel.registerRule({
        name: 'dependency-audit/deep-imports',
        severity: 'info',
        description: 'Detects deeply nested import chains',
        category: 'architecture',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];
          const maxDepth = fullConfig.maxDepth ?? 5;

          // Calculate import depth for this file
          const depth = calculateImportDepth(
            context.file.path,
            context.graph.dependencies.adjacency,
            new Set(),
          );

          if (depth > maxDepth) {
            findings.push({
              message: `File has import depth of ${depth} (max: ${maxDepth})`,
              file: context.file.path,
              line: 1,
              column: 1,
              fix: {
                suggestion: 'Consider restructuring imports to reduce dependency depth.',
              },
            });
          }

          return findings;
        },
      });
    },
  };
}

function calculateImportDepth(
  file: string,
  adjacency: Map<string, Set<string>>,
  visited: Set<string>,
): number {
  if (visited.has(file)) return 0;
  visited.add(file);

  const deps = adjacency.get(file);
  if (!deps || deps.size === 0) return 0;

  let maxDepth = 0;
  for (const dep of deps) {
    const depth = calculateImportDepth(dep, adjacency, visited);
    maxDepth = Math.max(maxDepth, depth);
  }

  return maxDepth + 1;
}
