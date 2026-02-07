import ts from 'typescript';
import * as path from 'node:path';
import type {
  CodebaseGraph,
  Finding,
  Rule,
  RunResult,
  RunStats,
  Severity,
} from '../types.js';
import { createRuleContext } from './context.js';
import { isRuleSuppressed, parseSuppressions } from './suppression.js';

/**
 * Execute all rules against the given files and return results.
 *
 * @param graph - Codebase knowledge graph
 * @param rules - Array of rules to execute
 * @param targetFiles - File paths to analyze (subset of graph)
 * @param program - TypeScript Program
 * @param config - Plugin configs
 * @param ignoredRules - Rules to skip globally
 * @param ignoredFiles - Files to skip
 * @returns RunResult with findings, stats, and block status
 *
 * @example
 * ```typescript
 * const result = await executeRules(graph, rules, ['src/index.ts'], program, {}, [], []);
 * console.log(`${result.findings.length} findings`);
 * ```
 */
export async function executeRules(
  graph: CodebaseGraph,
  rules: Rule[],
  targetFiles: string[],
  program: ts.Program,
  config: Record<string, Record<string, unknown>>,
  ignoredRules: string[],
  ignoredFiles: string[],
  blockOn: Severity[] = ['critical', 'error'],
  rootDir?: string,
): Promise<RunResult> {
  const startTime = Date.now();
  const parseStart = Date.now();
  const allFindings: Finding[] = [];
  let rulesExecuted = 0;

  const checker = program.getTypeChecker();
  const parseTime = Date.now() - parseStart;
  const analysisStart = Date.now();

  // Filter out ignored rules
  const activeRules = rules.filter((r) => !ignoredRules.includes(r.name));

  for (const filePath of targetFiles) {
    // Skip ignored files
    if (ignoredFiles.includes(filePath)) continue;

    const fileNode = graph.files.get(filePath);
    if (!fileNode) continue;

    // Get AST — resolve relative paths against rootDir
    const absPath = rootDir ? path.resolve(rootDir, filePath) : filePath;
    const sourceFile = program.getSourceFile(absPath);
    if (!sourceFile) continue;

    // Parse suppressions for this file
    const suppressions = parseSuppressions(sourceFile);

    for (const rule of activeRules) {
      // Get plugin config
      /* v8 ignore next */
      const pluginName = rule.name.split('/')[0] ?? '';
      const pluginConfig = config[pluginName] ?? {};

      // Create context
      const context = createRuleContext(
        fileNode,
        sourceFile,
        graph,
        program,
        checker,
        pluginConfig,
      );

      try {
        const findings = await rule.check(context);
        rulesExecuted++;

        for (const finding of findings) {
          // Check suppression
          if (isRuleSuppressed(suppressions, rule.name, finding.line)) {
            continue;
          }

          // Add rule metadata
          allFindings.push({
            ...finding,
            rule: finding.rule ?? rule.name,
            severity: finding.severity ?? rule.severity,
          });
        }
      } catch (err) {
        // Rule execution error — don't crash, just skip
        allFindings.push({
          message: `Rule ${rule.name} failed: ${err instanceof Error ? err.message : String(err)}`,
          file: filePath,
          line: 0,
          column: 0,
          rule: rule.name,
          severity: 'warning',
        });
      }
    }
  }

  const analysisTime = Date.now() - analysisStart;
  const duration = Date.now() - startTime;

  // Group findings
  const bySeverity: Record<Severity, Finding[]> = {
    critical: [],
    error: [],
    warning: [],
    info: [],
  };

  const byFile: Record<string, Finding[]> = {};

  for (const finding of allFindings) {
    /* v8 ignore next */
    const sev = finding.severity ?? 'info';
    bySeverity[sev].push(finding);

    if (!byFile[finding.file]) {
      byFile[finding.file] = [];
    }
    byFile[finding.file]!.push(finding);
  }

  // Determine if commit should be blocked
  const blocked = allFindings.some(
    (f) => f.severity && blockOn.includes(f.severity),
  );

  const stats: RunStats = {
    filesAnalyzed: targetFiles.length,
    rulesExecuted,
    duration,
    parseTime,
    analysisTime,
  };

  return {
    findings: allFindings,
    stats,
    blocked,
    bySeverity,
    byFile,
  };
}
