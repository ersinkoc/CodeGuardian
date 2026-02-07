import type { Finding, GuardianPlugin, ArchitecturePluginConfig, RuleContext } from '../../types.js';
import { findCircularDeps } from '../../graph/query.js';

/**
 * Architecture plugin — enforces layer boundaries, detects circular deps,
 * validates file structure conventions.
 *
 * Rules:
 * - architecture/layer-violation
 * - architecture/circular-dependency
 * - architecture/file-role-mismatch
 * - architecture/god-file
 * - architecture/god-function
 * - architecture/barrel-explosion
 *
 * @param config - Architecture plugin configuration
 * @returns GuardianPlugin instance
 *
 * @example
 * ```typescript
 * guardian.use(architecturePlugin({
 *   enabled: true,
 *   layers: ['controller', 'service', 'repository'],
 *   enforceDirection: true,
 * }));
 * ```
 */
export function architecturePlugin(
  config: Partial<ArchitecturePluginConfig> = {},
): GuardianPlugin<ArchitecturePluginConfig> {
  const fullConfig: ArchitecturePluginConfig = {
    enabled: true,
    layers: ['controller', 'service', 'repository', 'util'],
    enforceDirection: true,
    maxFileLines: 300,
    maxFunctionLines: 50,
    maxFunctionComplexity: 15,
    ...config,
  };

  return {
    name: 'architecture',
    version: '1.0.0',
    install(kernel) {
      // architecture/layer-violation
      kernel.registerRule({
        name: 'architecture/layer-violation',
        severity: 'error',
        description: 'Detects when a lower layer imports from a higher layer',
        category: 'architecture',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];
          const layers = fullConfig.layers!;
          if (!fullConfig.enforceDirection || layers.length === 0) return findings;

          const fileLayer = context.file.layer;
          const fileLayerIndex = layers.indexOf(fileLayer);
          if (fileLayerIndex === -1) return findings;

          for (const imp of context.file.imports) {
            const targetFile = context.graph.files.get(resolveImport(context.file.path, imp.source));
            if (!targetFile) continue;

            const targetLayerIndex = layers.indexOf(targetFile.layer);
            if (targetLayerIndex === -1) continue;

            // Layers: lower index = higher layer (e.g., controller=0, service=1, repo=2)
            // Fine: higher layer (lower index) importing from lower layer (higher index)
            if (fileLayerIndex <= targetLayerIndex) {
              // Normal dependency direction — ok
            } else {
              // Violation: lower layer importing from higher layer
              findings.push({
                message: `${fileLayer} layer importing from ${targetFile.layer} layer (violates layer direction)`,
                file: context.file.path,
                line: 1,
                column: 1,
                fix: {
                  suggestion: `${capitalize(fileLayer)}s should not depend on ${targetFile.layer}s. Invert the dependency.`,
                },
              });
            }
          }

          return findings;
        },
      });

      // architecture/circular-dependency
      kernel.registerRule({
        name: 'architecture/circular-dependency',
        severity: 'error',
        description: 'Detects circular import chains',
        category: 'architecture',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];
          const cycles = findCircularDeps(context.graph);

          for (const cycle of cycles) {
            if (cycle.includes(context.file.path)) {
              findings.push({
                message: `Circular dependency detected: ${cycle.join(' → ')}`,
                file: context.file.path,
                line: 1,
                column: 1,
                fix: {
                  suggestion: 'Break the cycle by extracting shared types or using dependency injection.',
                },
              });
            }
          }

          return findings;
        },
      });

      // architecture/file-role-mismatch
      kernel.registerRule({
        name: 'architecture/file-role-mismatch',
        severity: 'warning',
        description: 'Detects when file content does not match directory role',
        category: 'architecture',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];
          const path = context.file.path.toLowerCase();
          const role = context.file.role;

          // Check if path suggests a role but content doesn't match
          if (path.includes('/service') && role !== 'service' && role !== 'unknown') {
            findings.push({
              message: `File is in services directory but detected role is "${role}"`,
              file: context.file.path,
              line: 1,
              column: 1,
              fix: {
                suggestion: 'Move this file to the appropriate directory or rename it.',
              },
            });
          }

          if (path.includes('/controller') && role !== 'controller' && role !== 'unknown') {
            findings.push({
              message: `File is in controllers directory but detected role is "${role}"`,
              file: context.file.path,
              line: 1,
              column: 1,
              fix: {
                suggestion: 'Move this file to the appropriate directory or rename it.',
              },
            });
          }

          return findings;
        },
      });

      // architecture/god-file
      kernel.registerRule({
        name: 'architecture/god-file',
        severity: 'warning',
        description: 'Detects files exceeding maximum line count',
        category: 'architecture',
        check(context: RuleContext): Finding[] {
          const maxLines = fullConfig.maxFileLines ?? 300;
          if (context.file.loc > maxLines) {
            return [
              {
                message: `File has ${context.file.loc} lines (max: ${maxLines})`,
                file: context.file.path,
                line: 1,
                column: 1,
                fix: {
                  suggestion: 'Split this file into smaller, focused modules.',
                },
              },
            ];
          }
          return [];
        },
      });

      // architecture/god-function
      kernel.registerRule({
        name: 'architecture/god-function',
        severity: 'warning',
        description: 'Detects functions exceeding maximum line count',
        category: 'architecture',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];
          const maxLines = fullConfig.maxFunctionLines ?? 50;

          for (const fn of context.file.functions) {
            const fnLines = fn.endLine - fn.startLine + 1;
            if (fnLines > maxLines) {
              findings.push({
                message: `Function "${fn.name}" has ${fnLines} lines (max: ${maxLines})`,
                file: context.file.path,
                line: fn.startLine,
                column: 1,
                fix: {
                  suggestion: 'Extract logic into smaller helper functions.',
                },
              });
            }
          }

          return findings;
        },
      });

      // architecture/barrel-explosion
      kernel.registerRule({
        name: 'architecture/barrel-explosion',
        severity: 'info',
        description: 'Detects barrel files (index.ts) that re-export everything',
        category: 'architecture',
        check(context: RuleContext): Finding[] {
          const findings: Finding[] = [];
          /* v8 ignore next */
          const fileName = context.file.path.split('/').pop() ?? '';

          if (fileName === 'index.ts' || fileName === 'index.tsx') {
            const exportCount = context.file.exports.length;
            if (exportCount > 10) {
              findings.push({
                message: `Barrel file re-exports ${exportCount} symbols (may cause bundle size issues)`,
                file: context.file.path,
                line: 1,
                column: 1,
                fix: {
                  suggestion: 'Consider using direct imports instead of barrel files for tree-shaking.',
                },
              });
            }
          }

          return findings;
        },
      });
    },
  };
}

function resolveImport(fromFile: string, source: string): string {
  if (!source.startsWith('.')) return source;
  const fromDir = fromFile.split('/').slice(0, -1).join('/');
  const parts = [...fromDir.split('/'), ...source.split('/')];
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '..') resolved.pop();
    else if (part !== '.') resolved.push(part);
  }
  let result = resolved.join('/');
  if (result.endsWith('.js')) {
    result = result.slice(0, -3) + '.ts';
  /* v8 ignore next 2 */
  } else if (result.endsWith('.jsx')) {
    result = result.slice(0, -4) + '.tsx';
  } else if (!result.endsWith('.ts') && !result.endsWith('.tsx')) {
    result += '.ts';
  }
  return result;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
