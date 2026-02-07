import { describe, it, expect } from 'vitest';
import { formatTerminal } from '../../../src/reporter/terminal.js';
import { formatJSON } from '../../../src/reporter/json.js';
import { formatSARIF } from '../../../src/reporter/sarif.js';
import type { RunResult } from '../../../src/types.js';

function createMockResult(findings: RunResult['findings'] = []): RunResult {
  return {
    findings,
    stats: { filesAnalyzed: 5, rulesExecuted: 20, duration: 100, parseTime: 50, analysisTime: 50 },
    blocked: findings.some((f) => f.severity === 'critical' || f.severity === 'error'),
    bySeverity: {
      critical: findings.filter((f) => f.severity === 'critical'),
      error: findings.filter((f) => f.severity === 'error'),
      warning: findings.filter((f) => f.severity === 'warning'),
      info: findings.filter((f) => f.severity === 'info'),
    },
    byFile: {},
  };
}

describe('formatTerminal', () => {
  it('should show no issues for clean results', () => {
    const result = createMockResult();
    const output = formatTerminal(result);
    expect(output).toContain('No issues found');
  });

  it('should show findings', () => {
    const result = createMockResult([
      { message: 'SQL injection detected', file: 'src/index.ts', line: 10, column: 5, rule: 'security/sql-injection', severity: 'critical' },
    ]);
    const output = formatTerminal(result);
    expect(output).toContain('SQL injection detected');
    expect(output).toContain('CRITICAL');
  });

  it('should hide info findings when not verbose', () => {
    const result = createMockResult([
      { message: 'Info message', file: 'src/index.ts', line: 1, column: 1, rule: 'quality/info', severity: 'info' },
    ]);
    const output = formatTerminal(result, false);
    expect(output).toContain('No issues found');
  });

  it('should show info findings when verbose', () => {
    const result = createMockResult([
      { message: 'Info message', file: 'src/index.ts', line: 1, column: 1, rule: 'quality/info', severity: 'info' },
    ]);
    const output = formatTerminal(result, true);
    expect(output).toContain('Info message');
  });
});

describe('formatJSON', () => {
  it('should return valid JSON', () => {
    const result = createMockResult();
    const json = formatJSON(result);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('should include summary', () => {
    const result = createMockResult([
      { message: 'Test', file: 'a.ts', line: 1, column: 1, rule: 'test', severity: 'warning' },
    ]);
    const json = JSON.parse(formatJSON(result));
    expect(json.summary.warning).toBe(1);
    expect(json.summary.total).toBe(1);
  });
});

describe('formatSARIF', () => {
  it('should return valid SARIF', () => {
    const result = createMockResult();
    const sarif = JSON.parse(formatSARIF(result));
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs).toHaveLength(1);
  });

  it('should include findings as results', () => {
    const result = createMockResult([
      { message: 'Test finding', file: 'a.ts', line: 5, column: 1, rule: 'test/rule', severity: 'error' },
    ]);
    const sarif = JSON.parse(formatSARIF(result));
    expect(sarif.runs[0].results).toHaveLength(1);
    expect(sarif.runs[0].results[0].message.text).toBe('Test finding');
  });
});
