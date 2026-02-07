import ts from 'typescript';
import type { SuppressionDirective } from '../types.js';

/**
 * Parse inline suppression comments from a source file.
 *
 * Supports:
 * - `// codeguardian-disable-next-line rule1 rule2`
 * - `// codeguardian-disable rule1 -- reason`
 * - `// codeguardian-enable rule1`
 *
 * @param sourceFile - TypeScript SourceFile
 * @returns Array of suppression directives
 *
 * @example
 * ```typescript
 * const suppressions = parseSuppressions(sourceFile);
 * // [{ type: 'disable-next-line', rules: ['security/sql-injection'], line: 10 }]
 * ```
 */
export function parseSuppressions(sourceFile: ts.SourceFile): SuppressionDirective[] {
  const directives: SuppressionDirective[] = [];
  const text = sourceFile.getFullText();
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();

    // Match codeguardian comments
    const match = line.match(
      /\/\/\s*codeguardian-(disable-next-line|disable|enable)\s+(.*)/,
    );

    if (!match) continue;

    const type = match[1] as SuppressionDirective['type'];
    const rest = match[2]!.trim();

    // Parse rules and optional reason (separated by --)
    const reasonSplit = rest.split('--');
    const rulesPart = reasonSplit[0]!.trim();
    const reason = reasonSplit[1]?.trim();

    const rules = rulesPart
      .split(/\s+/)
      .filter((r) => r.length > 0);

    if (rules.length > 0) {
      directives.push({
        type,
        rules,
        reason,
        line: i + 1,
      });
    }
  }

  return directives;
}

/**
 * Check if a specific rule is suppressed at a given line.
 *
 * @param directives - Parsed suppression directives
 * @param ruleName - Rule name to check (e.g., 'security/sql-injection')
 * @param line - Line number (1-based)
 * @returns true if the rule is suppressed at that line
 *
 * @example
 * ```typescript
 * const suppressed = isRuleSuppressed(directives, 'security/sql-injection', 42);
 * ```
 */
export function isRuleSuppressed(
  directives: SuppressionDirective[],
  ruleName: string,
  line: number,
): boolean {
  // Track active disable regions
  let disabled = false;

  for (const directive of directives) {
    if (!directive.rules.includes(ruleName)) continue;

    if (directive.type === 'disable-next-line') {
      // Suppresses the next line only
      if (directive.line + 1 === line) {
        return true;
      }
    } else if (directive.type === 'disable') {
      // Start suppression region
      if (directive.line <= line) {
        disabled = true;
      }
    } else if (directive.type === 'enable') {
      // End suppression region
      if (directive.line <= line) {
        disabled = false;
      }
    }
  }

  return disabled;
}
