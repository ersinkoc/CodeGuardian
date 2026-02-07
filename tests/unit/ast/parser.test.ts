import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { parseFile } from '../../../src/ast/parser.js';

describe('parseFile', () => {
  it('should parse a TypeScript file from content', () => {
    const sourceFile = parseFile('test.ts', 'const x: number = 1;');
    expect(sourceFile).toBeDefined();
    expect(sourceFile.fileName).toBe('test.ts');
    expect(sourceFile.statements.length).toBeGreaterThan(0);
  });

  it('should parse a real fixture file', () => {
    const fixturePath = path.resolve(__dirname, '../../fixtures/clean/clean-service.ts');
    const sourceFile = parseFile(fixturePath);
    expect(sourceFile).toBeDefined();
    expect(sourceFile.statements.length).toBeGreaterThan(0);
  });
});
