import type { RunResult } from '../types.js';

/**
 * Format run results as JSON string.
 *
 * @param result - Run result to format
 * @returns Pretty-printed JSON string
 *
 * @example
 * ```typescript
 * const json = formatJSON(result);
 * console.log(json);
 * ```
 */
export function formatJSON(result: RunResult): string {
  return JSON.stringify(
    {
      blocked: result.blocked,
      stats: result.stats,
      findings: result.findings.map((f) => ({
        rule: f.rule,
        severity: f.severity,
        message: f.message,
        file: f.file,
        line: f.line,
        column: f.column,
        fix: f.fix,
      })),
      summary: {
        critical: result.bySeverity.critical.length,
        error: result.bySeverity.error.length,
        warning: result.bySeverity.warning.length,
        info: result.bySeverity.info.length,
        total: result.findings.length,
      },
    },
    null,
    2,
  );
}
