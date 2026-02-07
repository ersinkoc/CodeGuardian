import type { RunResult, Severity } from '../types.js';

/**
 * SARIF severity level mapping.
 */
function toSarifLevel(severity: Severity): string {
  switch (severity) {
    case 'critical':
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'note';
  }
}

/**
 * Format run results as SARIF (Static Analysis Results Interchange Format).
 * Compatible with GitHub Code Scanning.
 *
 * @param result - Run result to format
 * @returns SARIF JSON string
 *
 * @example
 * ```typescript
 * const sarif = formatSARIF(result);
 * writeFileSync('results.sarif', sarif);
 * ```
 */
export function formatSARIF(result: RunResult): string {
  const rules = new Map<string, { name: string; description: string; severity: Severity }>();

  for (const finding of result.findings) {
    if (finding.rule && !rules.has(finding.rule)) {
      rules.set(finding.rule, {
        name: finding.rule,
        description: finding.message,
        severity: finding.severity ?? 'info',
      });
    }
  }

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: '@oxog/codeguardian',
            version: '1.0.0',
            informationUri: 'https://codeguardian.oxog.dev',
            rules: Array.from(rules.values()).map((r) => ({
              id: r.name,
              shortDescription: { text: r.description },
              defaultConfiguration: {
                level: toSarifLevel(r.severity),
              },
            })),
          },
        },
        results: result.findings.map((f) => ({
          ruleId: f.rule ?? 'unknown',
          level: toSarifLevel(f.severity ?? 'info'),
          message: { text: f.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: f.file },
                region: {
                  startLine: f.line,
                  startColumn: f.column,
                },
              },
            },
          ],
          ...(f.fix
            ? {
                fixes: [
                  {
                    description: { text: f.fix.suggestion },
                  },
                ],
              }
            : {}),
        })),
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}
