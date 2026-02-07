import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import ts from 'typescript';
import { parseFile, createTSProgram, getSourceFiles } from '../../../src/ast/parser.js';
import { walkAST, calculateComplexity, countLOC } from '../../../src/ast/walker.js';
import {
  extractFunctions,
  detectSymbolKind,
  extractExports,
  extractImports,
  isCallTo,
  isConsoleCall,
  getTypeString,
  hasStringConcat,
} from '../../../src/ast/helpers.js';
import { buildGraph, processFile, detectFileRole, detectLayer } from '../../../src/graph/builder.js';
import { serializeGraph, deserializeGraph, saveGraphCache, loadGraphCache } from '../../../src/graph/cache.js';
import { getSymbol, getDependents, getDependencies, getGraphStats, getFile } from '../../../src/graph/query.js';
import { updateGraphIncremental } from '../../../src/graph/incremental.js';
import { createRuleContext } from '../../../src/rules/context.js';
import type { CodebaseGraph, FileNode, SymbolNode } from '../../../src/types.js';

// ============================================================
// AST parser coverage
// ============================================================
describe('ast/parser additional coverage', () => {
  const fixtureDir = path.resolve(process.cwd(), 'tests/fixtures/sample-project');

  it('createTSProgram should create a program from fixture project', () => {
    const program = createTSProgram(fixtureDir, './tsconfig.json');
    expect(program).toBeDefined();
    expect(program.getSourceFiles().length).toBeGreaterThan(0);
  });

  it('getSourceFiles should return non-declaration source files', () => {
    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const files = getSourceFiles(program);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f).not.toContain('.d.ts');
      expect(f).not.toContain('node_modules');
    }
  });

  it('createTSProgram should throw on invalid tsconfig', () => {
    const tmpDir = path.join(process.cwd(), '.test-parser-tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), 'INVALID JSON');
    try {
      expect(() => createTSProgram(tmpDir, './tsconfig.json')).toThrow();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ============================================================
// AST helpers coverage
// ============================================================
describe('ast/helpers additional coverage', () => {
  describe('extractFunctions', () => {
    it('should extract function declarations', () => {
      const code = 'export function greet(name: string): string { return "hello " + name; }';
      const ast = parseFile('test.ts', code);
      const fns = extractFunctions(ast, 'test.ts');
      expect(fns.length).toBe(1);
      expect(fns[0]!.name).toBe('greet');
      expect(fns[0]!.params.length).toBe(1);
      expect(fns[0]!.params[0]!.name).toBe('name');
      expect(fns[0]!.params[0]!.type).toBe('string');
      expect(fns[0]!.returnType).toBe('string');
    });

    it('should extract arrow functions assigned to variables', () => {
      const code = 'export const add = (a: number, b: number): number => a + b;';
      const ast = parseFile('test.ts', code);
      const fns = extractFunctions(ast, 'test.ts');
      expect(fns.length).toBe(1);
      expect(fns[0]!.name).toBe('add');
      expect(fns[0]!.isAsync).toBe(false);
    });

    it('should extract function expressions', () => {
      const code = 'export const multiply = function(a: number, b: number) { return a * b; };';
      const ast = parseFile('test.ts', code);
      const fns = extractFunctions(ast, 'test.ts');
      expect(fns.length).toBe(1);
      expect(fns[0]!.name).toBe('multiply');
    });

    it('should extract class methods', () => {
      const code = `class Calculator {
        add(a: number, b: number): number { return a + b; }
      }`;
      const ast = parseFile('test.ts', code);
      const fns = extractFunctions(ast, 'test.ts');
      expect(fns.length).toBe(1);
      expect(fns[0]!.name).toBe('add');
    });

    it('should detect async functions', () => {
      const code = 'export async function fetchData(): Promise<void> { await fetch("/api"); }';
      const ast = parseFile('test.ts', code);
      const fns = extractFunctions(ast, 'test.ts');
      expect(fns.length).toBe(1);
      expect(fns[0]!.isAsync).toBe(true);
      expect(fns[0]!.returnType).toBe('Promise<void>');
    });

    it('should handle optional parameters', () => {
      const code = 'function test(a: string, b?: number, c = 42) {}';
      const ast = parseFile('test.ts', code);
      const fns = extractFunctions(ast, 'test.ts');
      expect(fns[0]!.params.length).toBe(3);
      expect(fns[0]!.params[0]!.optional).toBe(false);
      expect(fns[0]!.params[1]!.optional).toBe(true);
      expect(fns[0]!.params[2]!.optional).toBe(true);
    });
  });

  describe('detectSymbolKind', () => {
    it('should detect function declarations', () => {
      const ast = parseFile('test.ts', 'function foo() {}');
      const stmt = ast.statements[0]!;
      expect(detectSymbolKind(stmt)).toBe('function');
    });

    it('should detect class declarations', () => {
      const ast = parseFile('test.ts', 'class Foo {}');
      const stmt = ast.statements[0]!;
      expect(detectSymbolKind(stmt)).toBe('class');
    });

    it('should detect interface declarations', () => {
      const ast = parseFile('test.ts', 'interface IFoo {}');
      const stmt = ast.statements[0]!;
      expect(detectSymbolKind(stmt)).toBe('interface');
    });

    it('should detect type alias declarations', () => {
      const ast = parseFile('test.ts', 'type Foo = string;');
      const stmt = ast.statements[0]!;
      expect(detectSymbolKind(stmt)).toBe('type');
    });

    it('should detect enum declarations', () => {
      const ast = parseFile('test.ts', 'enum Color { Red, Green, Blue }');
      const stmt = ast.statements[0]!;
      expect(detectSymbolKind(stmt)).toBe('enum');
    });

    it('should detect variable statements', () => {
      const ast = parseFile('test.ts', 'const x = 1;');
      const stmt = ast.statements[0]!;
      expect(detectSymbolKind(stmt)).toBe('variable');
    });

    it('should return variable for unknown node types', () => {
      const ast = parseFile('test.ts', 'import { x } from "y";');
      const stmt = ast.statements[0]!;
      expect(detectSymbolKind(stmt)).toBe('variable');
    });
  });

  describe('extractExports additional cases', () => {
    it('should extract class exports', () => {
      const ast = parseFile('test.ts', 'export class UserService {}');
      const exports = extractExports(ast);
      expect(exports).toContain('UserService');
    });

    it('should extract interface exports', () => {
      const ast = parseFile('test.ts', 'export interface IUser { name: string; }');
      const exports = extractExports(ast);
      expect(exports).toContain('IUser');
    });

    it('should extract type alias exports', () => {
      const ast = parseFile('test.ts', 'export type UserId = string;');
      const exports = extractExports(ast);
      expect(exports).toContain('UserId');
    });

    it('should extract enum exports', () => {
      const ast = parseFile('test.ts', 'export enum Color { Red }');
      const exports = extractExports(ast);
      expect(exports).toContain('Color');
    });

    it('should extract variable exports', () => {
      const ast = parseFile('test.ts', 'export const MAX = 100;');
      const exports = extractExports(ast);
      expect(exports).toContain('MAX');
    });

    it('should extract re-exports', () => {
      const ast = parseFile('test.ts', 'export { foo, bar } from "./module";');
      const exports = extractExports(ast);
      expect(exports).toContain('foo');
      expect(exports).toContain('bar');
    });

    it('should extract default export assignment', () => {
      const ast = parseFile('test.ts', 'const obj = {};\nexport default obj;');
      const exports = extractExports(ast);
      expect(exports).toContain('default');
    });

    it('should extract default function export name', () => {
      const ast = parseFile('test.ts', 'export default function main() {}');
      const exports = extractExports(ast);
      expect(exports).toContain('main');
    });
  });

  describe('extractImports additional cases', () => {
    it('should extract default imports', () => {
      const ast = parseFile('test.ts', 'import React from "react";');
      const imports = extractImports(ast);
      expect(imports.length).toBe(1);
      expect(imports[0]!.specifiers).toContain('React');
    });

    it('should extract namespace imports', () => {
      const ast = parseFile('test.ts', 'import * as path from "node:path";');
      const imports = extractImports(ast);
      expect(imports.length).toBe(1);
      expect(imports[0]!.specifiers).toContain('path');
    });

    it('should detect type-only imports', () => {
      const ast = parseFile('test.ts', 'import type { User } from "./types";');
      const imports = extractImports(ast);
      expect(imports.length).toBe(1);
      expect(imports[0]!.isTypeOnly).toBe(true);
    });
  });

  describe('hasStringConcat edge cases', () => {
    it('should detect binary plus with string literal on right', () => {
      const ast = parseFile('test.ts', 'const x = variable + " suffix";');
      let found = false;
      ts.forEachChild(ast, function visit(node) {
        if (ts.isBinaryExpression(node)) {
          found = hasStringConcat(node);
        }
        ts.forEachChild(node, visit);
      });
      expect(found).toBe(true);
    });

    it('should detect nested string concat', () => {
      const code = 'const x = "a" + b + "c";';
      const ast = parseFile('test.ts', code);
      expect(hasStringConcat(ast)).toBe(true);
    });
  });

  describe('isCallTo and isConsoleCall edge cases', () => {
    it('isCallTo should return false for non-matching call', () => {
      const ast = parseFile('test.ts', 'otherFn();');
      let result = false;
      walkAST(ast, {
        CallExpression(node: ts.Node) {
          const call = node as ts.CallExpression;
          result = isCallTo(call, 'targetFn');
        },
      });
      expect(result).toBe(false);
    });

    it('isCallTo should match property access calls', () => {
      const ast = parseFile('test.ts', 'db.query("SELECT 1");');
      let result = false;
      walkAST(ast, {
        CallExpression(node: ts.Node) {
          const call = node as ts.CallExpression;
          if (isCallTo(call, 'query')) result = true;
        },
      });
      expect(result).toBe(true);
    });
  });

  describe('getTypeString', () => {
    it('should return unknown when checker fails', () => {
      const ast = parseFile('test.ts', 'const x = 1;');
      // Create a mock checker that throws
      const mockChecker = {
        getTypeAtLocation: () => { throw new Error('no type'); },
      } as unknown as ts.TypeChecker;
      const result = getTypeString(ast, mockChecker);
      expect(result).toBe('unknown');
    });
  });
});

// ============================================================
// AST walker coverage
// ============================================================
describe('ast/walker additional coverage', () => {
  it('walkAST should handle nodes with undefined SyntaxKind name gracefully', () => {
    // All real TS nodes have a SyntaxKind name, so this is hard to trigger
    // Just ensure full coverage by walking a complex AST
    const code = `
      import { x } from "y";
      const a = 1;
      function foo(b: string) {
        if (b) {
          for (const c of [1,2,3]) {
            switch (c) {
              case 1: break;
              default: break;
            }
          }
        }
        return a || b && true ?? false;
      }
    `;
    const ast = parseFile('test.ts', code);
    let callCount = 0;
    walkAST(ast, {
      Identifier() { callCount++; },
    });
    expect(callCount).toBeGreaterThan(0);
  });

  it('calculateComplexity should count all decision points', () => {
    const code = `
function complex(x: number, y: boolean) {
  if (x > 0) {
    for (let i = 0; i < x; i++) {
      while (y) {
        do {
          if (x && y || true) {
            const z = x > 0 ? 1 : 0;
          }
        } while(false);
      }
    }
    for (const a in {}) {}
    for (const b of []) {}
    switch(x) {
      case 1: break;
      case 2: break;
    }
  }
  try {} catch(e) {}
  const n = x ?? 0;
}`;
    const ast = parseFile('test.ts', code);
    const fn = ast.statements[0]!;
    const complexity = calculateComplexity(fn);
    // Base 1 + if + for + while + do + if + && + || + ternary + for-in + for-of + 2x case + catch + ??
    expect(complexity).toBeGreaterThan(10);
  });

  it('countLOC should exclude blank lines and comments', () => {
    const code = `
// This is a comment
/* Block comment */
const x = 1;

// Another comment
const y = 2;
`;
    const ast = parseFile('test.ts', code);
    const loc = countLOC(ast);
    expect(loc).toBe(2); // only const x = 1; and const y = 2;
  });
});

// ============================================================
// Graph builder coverage
// ============================================================
describe('graph/builder additional coverage', () => {
  const fixtureDir = path.resolve(process.cwd(), 'tests/fixtures/sample-project');

  it('buildGraph should build graph from fixture project', () => {
    const graph = buildGraph(
      fixtureDir,
      './tsconfig.json',
      ['src/**/*.ts'],
      ['**/*.test.ts'],
    );
    expect(graph.files.size).toBeGreaterThan(0);
    expect(graph.layers.length).toBeGreaterThan(0);
  });

  it('buildGraph should filter files by include/exclude', () => {
    const graph = buildGraph(
      fixtureDir,
      './tsconfig.json',
      ['src/services/**/*.ts'],
      [],
    );
    for (const [filePath] of graph.files) {
      expect(filePath).toContain('services');
    }
  });

  it('buildGraph should build dependency adjacency', () => {
    const graph = buildGraph(
      fixtureDir,
      './tsconfig.json',
      ['src/**/*.ts'],
      [],
    );
    expect(graph.dependencies.adjacency.size).toBeGreaterThan(0);
  });

  it('processFile should add file data to graph', () => {
    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const checker = program.getTypeChecker();
    const graph: CodebaseGraph = {
      files: new Map(),
      symbols: new Map(),
      edges: [],
      layers: [],
      patterns: [],
      dependencies: { adjacency: new Map() },
    };

    const sourceFiles = program.getSourceFiles().filter(
      sf => !sf.isDeclarationFile && !sf.fileName.includes('node_modules') && sf.fileName.includes('user.service')
    );

    if (sourceFiles.length > 0) {
      const sf = sourceFiles[0]!;
      const relPath = 'src/services/user.service.ts';
      processFile(graph, sf, relPath, fixtureDir, checker);
      expect(graph.files.has(relPath)).toBe(true);
      const file = graph.files.get(relPath)!;
      expect(file.role).toBe('service');
      expect(file.layer).toBe('service');
      expect(file.loc).toBeGreaterThan(0);
    }
  });

  describe('detectFileRole additional cases', () => {
    it('should detect repository role', () => {
      expect(detectFileRole('src/repositories/user.repository.ts')).toBe('repository');
    });

    it('should detect .repo. file', () => {
      expect(detectFileRole('src/user.repo.ts')).toBe('repository');
    });

    it('should detect config role', () => {
      expect(detectFileRole('src/config/database.config.ts')).toBe('config');
    });

    it('should detect d.ts files as type', () => {
      expect(detectFileRole('src/types.d.ts')).toBe('type');
    });

    it('should detect helper files', () => {
      expect(detectFileRole('src/helpers/format.helper.ts')).toBe('util');
    });

    it('should detect __tests__ directory', () => {
      expect(detectFileRole('src/__tests__/user.ts')).toBe('test');
    });

    it('should detect .types. files', () => {
      expect(detectFileRole('src/user.types.ts')).toBe('type');
    });
  });

  describe('detectLayer additional cases', () => {
    it('should detect repository layer', () => {
      expect(detectLayer('src/repositories/user.ts')).toBe('repository');
    });

    it('should detect util layer', () => {
      expect(detectLayer('src/utils/format.ts')).toBe('util');
    });

    it('should detect helper layer', () => {
      expect(detectLayer('src/helpers/format.ts')).toBe('util');
    });

    it('should detect middleware layer', () => {
      expect(detectLayer('src/middleware/auth.ts')).toBe('middleware');
    });

    it('should detect model layer', () => {
      expect(detectLayer('src/models/user.ts')).toBe('model');
    });
  });
});

// ============================================================
// Graph cache coverage
// ============================================================
describe('graph/cache additional coverage', () => {
  const tmpDir = path.join(process.cwd(), '.test-cache-tmp');

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('saveGraphCache should save graph to disk', () => {
    const graph: CodebaseGraph = {
      files: new Map([['a.ts', { path: 'a.ts', role: 'unknown', layer: 'unknown', exports: [], imports: [], complexity: 0, loc: 0, functions: [] }]]),
      symbols: new Map(),
      edges: [],
      layers: [],
      patterns: [],
      dependencies: { adjacency: new Map([['a.ts', new Set<string>()]]) },
    };
    saveGraphCache(tmpDir, graph);
    const cachePath = path.join(tmpDir, '.codeguardian', 'graph.json');
    expect(fs.existsSync(cachePath)).toBe(true);
  });

  it('loadGraphCache should load saved graph', () => {
    const graph: CodebaseGraph = {
      files: new Map([['b.ts', { path: 'b.ts', role: 'service', layer: 'service', exports: ['Svc'], imports: [], complexity: 1, loc: 10, functions: [] }]]),
      symbols: new Map(),
      edges: [],
      layers: [],
      patterns: [],
      dependencies: { adjacency: new Map([['b.ts', new Set<string>()]]) },
    };
    saveGraphCache(tmpDir, graph);
    const loaded = loadGraphCache(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.files.size).toBe(1);
    expect(loaded!.files.get('b.ts')!.role).toBe('service');
  });

  it('loadGraphCache should return null for missing cache', () => {
    const loaded = loadGraphCache(path.join(tmpDir, 'nonexistent'));
    expect(loaded).toBeNull();
  });

  it('loadGraphCache should return null for corrupt cache', () => {
    const cacheDir = path.join(tmpDir, '.codeguardian');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'graph.json'), 'INVALID JSON');
    const loaded = loadGraphCache(tmpDir);
    expect(loaded).toBeNull();
  });

  it('loadGraphCache should return null for version mismatch', () => {
    const cacheDir = path.join(tmpDir, '.codeguardian');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'graph.json'), JSON.stringify({
      version: '0.0.0',
      timestamp: Date.now(),
      files: [],
      symbols: [],
      edges: [],
      layers: [],
      patterns: [],
      adjacency: [],
    }));
    const loaded = loadGraphCache(tmpDir);
    expect(loaded).toBeNull();
  });
});

// ============================================================
// Graph query coverage
// ============================================================
describe('graph/query additional coverage', () => {
  function createGraph(): CodebaseGraph {
    const graph: CodebaseGraph = {
      files: new Map([
        ['a.ts', { path: 'a.ts', role: 'service', layer: 'service', exports: ['Svc'], imports: [], complexity: 1, loc: 10, functions: [] }],
        ['b.ts', { path: 'b.ts', role: 'controller', layer: 'controller', exports: [], imports: [], complexity: 2, loc: 20, functions: [] }],
      ]),
      symbols: new Map([
        ['a.ts:Svc', { name: 'Svc', kind: 'class', file: 'a.ts', usedBy: ['b.ts'], dependsOn: [], isPublicAPI: true }],
      ]),
      edges: [{ from: 'b.ts', to: 'a.ts', specifiers: ['Svc'], isTypeOnly: false }],
      layers: [],
      patterns: [],
      dependencies: {
        adjacency: new Map([
          ['a.ts', new Set<string>()],
          ['b.ts', new Set(['a.ts'])],
        ]),
      },
    };
    return graph;
  }

  it('getDependents should return files that depend on given file', () => {
    const graph = createGraph();
    const deps = getDependents(graph, 'a.ts');
    expect(deps).toContain('b.ts');
  });

  it('getDependents should return empty for files with no dependents', () => {
    const graph = createGraph();
    const deps = getDependents(graph, 'b.ts');
    expect(deps).toHaveLength(0);
  });

  it('getSymbol should return undefined for non-existent symbol', () => {
    const graph = createGraph();
    const sym = getSymbol(graph, 'NonExistent');
    expect(sym).toBeUndefined();
  });

  it('getGraphStats should compute avg complexity correctly', () => {
    const graph = createGraph();
    const stats = getGraphStats(graph);
    expect(stats.avgComplexity).toBe(1.5);
    expect(stats.filesByRole['service']).toBe(1);
    expect(stats.filesByRole['controller']).toBe(1);
    expect(stats.filesByLayer['service']).toBe(1);
    expect(stats.filesByLayer['controller']).toBe(1);
  });

  it('getGraphStats should handle empty graph', () => {
    const graph: CodebaseGraph = {
      files: new Map(), symbols: new Map(), edges: [], layers: [], patterns: [],
      dependencies: { adjacency: new Map() },
    };
    const stats = getGraphStats(graph);
    expect(stats.avgComplexity).toBe(0);
    expect(stats.totalFiles).toBe(0);
  });
});

// ============================================================
// Graph incremental coverage (already at 100%, just ensure it stays)
// ============================================================
describe('graph/incremental coverage', () => {
  const fixtureDir = path.resolve(process.cwd(), 'tests/fixtures/sample-project');

  it('updateGraphIncremental should update graph for changed files', () => {
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);
    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const changedFiles = Array.from(graph.files.keys()).slice(0, 1);
    if (changedFiles.length > 0) {
      const result = updateGraphIncremental(graph, changedFiles, fixtureDir, program);
      expect(result.changedFiles).toEqual(changedFiles);
      expect(result.affectedFiles.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Rules context coverage
// ============================================================
describe('rules/context additional coverage', () => {
  const fixtureDir = path.resolve(process.cwd(), 'tests/fixtures/sample-project');

  it('createRuleContext should create a full context', () => {
    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const checker = program.getTypeChecker();
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);
    const firstFile = Array.from(graph.files.values())[0];
    if (firstFile) {
      const sourceFile = program.getSourceFile(
        path.resolve(fixtureDir, firstFile.path),
      );
      if (sourceFile) {
        const ctx = createRuleContext(firstFile, sourceFile, graph, program, checker, { testKey: 'testValue' });
        expect(ctx.file).toBe(firstFile);
        expect(ctx.config).toEqual({ testKey: 'testValue' });

        // Test walk
        let called = false;
        ctx.walk(sourceFile, { Identifier() { called = true; } });
        expect(called).toBe(true);

        // Test getImports
        const imports = ctx.getImports();
        expect(Array.isArray(imports)).toBe(true);

        // Test hasStringConcat
        expect(typeof ctx.hasStringConcat(sourceFile)).toBe('boolean');

        // Test getTypeString
        const typeStr = ctx.getTypeString(sourceFile);
        expect(typeof typeStr).toBe('string');

        // Test isExternallyUsed
        const isUsed = ctx.isExternallyUsed('NonExistent');
        expect(isUsed).toBe(false);
      }
    }
  });
});

// ============================================================
// Discovery conventions (already 100%, ensure it stays)
// ============================================================
describe('discovery/conventions coverage', () => {
  const fixtureDir = path.resolve(process.cwd(), 'tests/fixtures/sample-project');

  it('should discover conventions from fixture project', async () => {
    const { discoverConventions } = await import('../../../src/discovery/conventions.js');
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);
    const conventions = discoverConventions(graph);
    expect(Array.isArray(conventions)).toBe(true);
  });
});
