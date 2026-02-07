import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { walkAST, calculateComplexity, countLOC } from '../../../src/ast/walker.js';
import { parseFile } from '../../../src/ast/parser.js';

describe('walkAST', () => {
  it('should visit nodes of specified kinds', () => {
    const sourceFile = parseFile('test.ts', 'const x = 1; function foo() { return x; }');
    const visited: string[] = [];

    walkAST(sourceFile, {
      FunctionDeclaration() {
        visited.push('FunctionDeclaration');
      },
      FirstStatement() {
        visited.push('FirstStatement');
      },
    });

    expect(visited).toContain('FunctionDeclaration');
    expect(visited).toContain('FirstStatement');
  });
});

describe('calculateComplexity', () => {
  it('should return 1 for a simple function', () => {
    const sourceFile = parseFile('test.ts', 'function foo() { return 1; }');
    const fn = sourceFile.statements[0]!;
    expect(calculateComplexity(fn)).toBe(1);
  });

  it('should count if statements', () => {
    const code = 'function foo(x: number) { if (x > 0) { return 1; } else { return 0; } }';
    const sourceFile = parseFile('test.ts', code);
    const fn = sourceFile.statements[0]!;
    expect(calculateComplexity(fn)).toBeGreaterThan(1);
  });

  it('should count logical operators', () => {
    const code = 'function foo(a: boolean, b: boolean) { if (a && b) { return 1; } return 0; }';
    const sourceFile = parseFile('test.ts', code);
    const fn = sourceFile.statements[0]!;
    expect(calculateComplexity(fn)).toBeGreaterThanOrEqual(3); // base + if + &&
  });
});

describe('countLOC', () => {
  it('should count non-empty, non-comment lines', () => {
    const code = `
// This is a comment
const x = 1;

const y = 2;
/* block comment */
const z = 3;
`;
    const sourceFile = parseFile('test.ts', code);
    const loc = countLOC(sourceFile);
    expect(loc).toBeGreaterThanOrEqual(3);
  });
});
