import type { Finding, RunResult, Severity } from '../types.js';
import { color } from '../utils/color.js';

/**
 * Format run results as colored terminal output.
 *
 * @param result - Run result to format
 * @param verbose - Whether to include info-level findings
 * @returns Formatted string for terminal output
 *
 * @example
 * ```typescript
 * const output = formatTerminal(result, false);
 * console.log(output);
 * ```
 */
export function formatTerminal(result: RunResult, verbose: boolean = false): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(color.bold('  @oxog/codeguardian'));
  lines.push(color.dim(`  Analyzed ${result.stats.filesAnalyzed} files in ${result.stats.duration}ms`));
  lines.push('');

  // Filter findings based on verbosity
  const findings = verbose
    ? result.findings
    : result.findings.filter((f) => f.severity !== 'info');

  if (findings.length === 0) {
    lines.push(color.green('  ✓ No issues found'));
    lines.push('');
    return lines.join('\n');
  }

  // Sort findings: critical first, then error, warning, info
  const sorted = [...findings].sort((a, b) => {
    const order: Record<Severity, number> = { critical: 0, error: 1, warning: 2, info: 3 };
    /* v8 ignore next */
    return (order[a.severity ?? 'info'] ?? 3) - (order[b.severity ?? 'info'] ?? 3);
  });

  // Print each finding
  for (const finding of sorted) {
    lines.push(formatFinding(finding));
  }

  // Summary
  lines.push('');
  lines.push(formatSummaryLine(result));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format a single finding for terminal display.
 */
function formatFinding(finding: Finding): string {
  const lines: string[] = [];
  const sev = finding.severity ?? 'info';

  const icon = getIcon(sev);
  const label = getSeverityLabel(sev);
  const location = `${finding.file}:${finding.line}`;

  lines.push(`${icon} ${label}  ${color.white(location)}`);
  lines.push(`  ${color.dim(`[${finding.rule ?? 'unknown'}]`)} ${finding.message}`);

  if (finding.fix?.suggestion) {
    lines.push(`  ${color.dim('→')} ${color.dim(finding.fix.suggestion)}`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Get icon for severity level.
 */
function getIcon(severity: Severity): string {
  switch (severity) {
    case 'critical':
    case 'error':
      return color.red('✗');
    case 'warning':
      return color.yellow('⚠');
    case 'info':
      return color.blue('ℹ');
  }
}

/**
 * Get colored label for severity level.
 */
function getSeverityLabel(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return color.red(color.bold('CRITICAL'));
    case 'error':
      return color.red(color.bold('ERROR   '));
    case 'warning':
      return color.yellow('WARNING ');
    case 'info':
      return color.blue('INFO    ');
  }
}

/**
 * Format the summary line.
 */
function formatSummaryLine(result: RunResult): string {
  const criticalCount = result.bySeverity.critical.length;
  const errorCount = result.bySeverity.error.length;
  const warningCount = result.bySeverity.warning.length;
  const infoCount = result.bySeverity.info.length;

  const blockCount = criticalCount + errorCount;
  const parts: string[] = [];

  if (blockCount > 0) {
    parts.push(color.red(`  ${blockCount} critical/error (commit blocked)`));
  }
  if (warningCount > 0) {
    parts.push(color.yellow(`${warningCount} warnings`));
  }
  if (infoCount > 0) {
    parts.push(color.dim(`${infoCount} info`));
  }

  const line = '─'.repeat(50);

  if (result.blocked) {
    return `${color.dim(line)}\n${parts.join('  │  ')}\n${color.dim(line)}`;
  }

  if (parts.length === 0) {
    return `${color.dim(line)}\n${color.green('  ✓ All clear')}\n${color.dim(line)}`;
  }

  return `${color.dim(line)}\n${parts.join('  │  ')}\n${color.dim(line)}`;
}
