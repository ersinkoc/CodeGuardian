import { describe, it, expect } from 'vitest';
import { parseSuppressions, isRuleSuppressed } from '../../../src/rules/suppression.js';
import { parseFile } from '../../../src/ast/parser.js';

describe('parseSuppressions', () => {
  it('should parse disable-next-line', () => {
    const code = `
// codeguardian-disable-next-line security/sql-injection
const query = \`SELECT * FROM users WHERE id = \${id}\`;
`;
    const sf = parseFile('test.ts', code);
    const directives = parseSuppressions(sf);
    expect(directives).toHaveLength(1);
    expect(directives[0]!.type).toBe('disable-next-line');
    expect(directives[0]!.rules).toContain('security/sql-injection');
  });

  it('should parse disable with reason', () => {
    const code = '// codeguardian-disable security/sql-injection -- legacy code';
    const sf = parseFile('test.ts', code);
    const directives = parseSuppressions(sf);
    expect(directives).toHaveLength(1);
    expect(directives[0]!.type).toBe('disable');
    expect(directives[0]!.reason).toBe('legacy code');
  });

  it('should parse enable', () => {
    const code = '// codeguardian-enable security/sql-injection';
    const sf = parseFile('test.ts', code);
    const directives = parseSuppressions(sf);
    expect(directives).toHaveLength(1);
    expect(directives[0]!.type).toBe('enable');
  });

  it('should parse multiple rules', () => {
    const code = '// codeguardian-disable-next-line security/sql-injection quality/any-type';
    const sf = parseFile('test.ts', code);
    const directives = parseSuppressions(sf);
    expect(directives[0]!.rules).toHaveLength(2);
  });
});

describe('isRuleSuppressed', () => {
  it('should suppress next line', () => {
    const directives = [
      { type: 'disable-next-line' as const, rules: ['security/sql-injection'], line: 5 },
    ];
    expect(isRuleSuppressed(directives, 'security/sql-injection', 6)).toBe(true);
    expect(isRuleSuppressed(directives, 'security/sql-injection', 7)).toBe(false);
  });

  it('should suppress disable/enable regions', () => {
    const directives = [
      { type: 'disable' as const, rules: ['security/sql-injection'], line: 5 },
      { type: 'enable' as const, rules: ['security/sql-injection'], line: 10 },
    ];
    expect(isRuleSuppressed(directives, 'security/sql-injection', 7)).toBe(true);
    expect(isRuleSuppressed(directives, 'security/sql-injection', 12)).toBe(false);
  });

  it('should not suppress unrelated rules', () => {
    const directives = [
      { type: 'disable-next-line' as const, rules: ['security/sql-injection'], line: 5 },
    ];
    expect(isRuleSuppressed(directives, 'quality/any-type', 6)).toBe(false);
  });
});
