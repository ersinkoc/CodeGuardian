import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { extractImports, extractExports, extractFunctions, isCallTo, isConsoleCall, hasStringConcat } from '../../../src/ast/helpers.js';
import { parseFile } from '../../../src/ast/parser.js';

describe('extractImports', () => {
  it('should extract named imports', () => {
    const code = "import { UserService } from './user.service';";
    const sf = parseFile('test.ts', code);
    const imports = extractImports(sf);
    expect(imports).toHaveLength(1);
    expect(imports[0]!.source).toBe('./user.service');
    expect(imports[0]!.specifiers).toContain('UserService');
  });

  it('should extract default imports', () => {
    const code = "import express from 'express';";
    const sf = parseFile('test.ts', code);
    const imports = extractImports(sf);
    expect(imports).toHaveLength(1);
    expect(imports[0]!.specifiers).toContain('express');
  });

  it('should detect type-only imports', () => {
    const code = "import type { User } from './types';";
    const sf = parseFile('test.ts', code);
    const imports = extractImports(sf);
    expect(imports[0]!.isTypeOnly).toBe(true);
  });
});

describe('extractExports', () => {
  it('should extract exported functions', () => {
    const code = 'export function getUser() { return null; }';
    const sf = parseFile('test.ts', code);
    const exports = extractExports(sf);
    expect(exports).toContain('getUser');
  });

  it('should extract exported classes', () => {
    const code = 'export class UserService {}';
    const sf = parseFile('test.ts', code);
    const exports = extractExports(sf);
    expect(exports).toContain('UserService');
  });

  it('should extract exported variables', () => {
    const code = 'export const API_KEY = "test";';
    const sf = parseFile('test.ts', code);
    const exports = extractExports(sf);
    expect(exports).toContain('API_KEY');
  });
});

describe('extractFunctions', () => {
  it('should extract function declarations', () => {
    const code = 'function getUser(id: string): string { return id; }';
    const sf = parseFile('test.ts', code);
    const fns = extractFunctions(sf, 'test.ts');
    expect(fns).toHaveLength(1);
    expect(fns[0]!.name).toBe('getUser');
    expect(fns[0]!.params).toHaveLength(1);
  });

  it('should extract arrow functions', () => {
    const code = 'const getUser = (id: string): string => id;';
    const sf = parseFile('test.ts', code);
    const fns = extractFunctions(sf, 'test.ts');
    expect(fns).toHaveLength(1);
    expect(fns[0]!.name).toBe('getUser');
  });

  it('should detect async functions', () => {
    const code = 'async function fetchData(): Promise<void> { }';
    const sf = parseFile('test.ts', code);
    const fns = extractFunctions(sf, 'test.ts');
    expect(fns[0]!.isAsync).toBe(true);
  });
});

describe('isCallTo', () => {
  it('should detect direct function calls', () => {
    const code = 'foo();';
    const sf = parseFile('test.ts', code);
    let found = false;
    ts.forEachChild(sf, function visit(node) {
      if (ts.isCallExpression(node)) {
        found = isCallTo(node, 'foo');
      }
      ts.forEachChild(node, visit);
    });
    expect(found).toBe(true);
  });

  it('should detect method calls', () => {
    const code = 'db.query("SELECT 1");';
    const sf = parseFile('test.ts', code);
    let found = false;
    ts.forEachChild(sf, function visit(node) {
      if (ts.isCallExpression(node)) {
        found = isCallTo(node, 'query');
      }
      ts.forEachChild(node, visit);
    });
    expect(found).toBe(true);
  });
});

describe('isConsoleCall', () => {
  it('should detect console.log', () => {
    const code = 'console.log("hello");';
    const sf = parseFile('test.ts', code);
    let found = false;
    ts.forEachChild(sf, function visit(node) {
      if (ts.isCallExpression(node)) {
        found = isConsoleCall(node, 'log');
      }
      ts.forEachChild(node, visit);
    });
    expect(found).toBe(true);
  });

  it('should detect any console method', () => {
    const code = 'console.error("error");';
    const sf = parseFile('test.ts', code);
    let found = false;
    ts.forEachChild(sf, function visit(node) {
      if (ts.isCallExpression(node)) {
        found = isConsoleCall(node);
      }
      ts.forEachChild(node, visit);
    });
    expect(found).toBe(true);
  });
});

describe('hasStringConcat', () => {
  it('should detect template expressions', () => {
    const code = 'const x = `hello ${name}`;';
    const sf = parseFile('test.ts', code);
    let found = false;
    ts.forEachChild(sf, function visit(node) {
      if (ts.isTemplateExpression(node)) {
        found = hasStringConcat(node);
      }
      ts.forEachChild(node, visit);
    });
    expect(found).toBe(true);
  });
});
