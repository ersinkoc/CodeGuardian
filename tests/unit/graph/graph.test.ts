import { describe, it, expect } from 'vitest';
import { detectFileRole, detectLayer } from '../../../src/graph/builder.js';
import { serializeGraph, deserializeGraph } from '../../../src/graph/cache.js';
import { getFile, getSymbol, getDependencies, findCircularDeps, getGraphStats } from '../../../src/graph/query.js';
import type { CodebaseGraph } from '../../../src/types.js';

function createMockGraph(): CodebaseGraph {
  const graph: CodebaseGraph = {
    files: new Map(),
    symbols: new Map(),
    edges: [],
    layers: [],
    patterns: [],
    dependencies: { adjacency: new Map() },
  };

  graph.files.set('src/services/user.service.ts', {
    path: 'src/services/user.service.ts',
    role: 'service',
    layer: 'service',
    exports: ['UserService'],
    imports: [],
    complexity: 3,
    loc: 50,
    functions: [{ name: 'getUser', file: 'src/services/user.service.ts', startLine: 5, endLine: 15, params: [], returnType: 'Promise<User>', complexity: 2, isAsync: true, hasSideEffects: false, issues: [] }],
  });

  graph.files.set('src/controllers/user.controller.ts', {
    path: 'src/controllers/user.controller.ts',
    role: 'controller',
    layer: 'controller',
    exports: ['getUser'],
    imports: [{ source: '../services/user.service', specifiers: ['UserService'], isTypeOnly: false }],
    complexity: 1,
    loc: 20,
    functions: [],
  });

  graph.symbols.set('src/services/user.service.ts:UserService', {
    name: 'UserService',
    kind: 'class',
    file: 'src/services/user.service.ts',
    usedBy: ['src/controllers/user.controller.ts'],
    dependsOn: [],
    isPublicAPI: true,
  });

  graph.dependencies.adjacency.set('src/controllers/user.controller.ts', new Set(['src/services/user.service.ts']));
  graph.dependencies.adjacency.set('src/services/user.service.ts', new Set());

  return graph;
}

describe('detectFileRole', () => {
  it('should detect controller', () => {
    expect(detectFileRole('src/controllers/user.controller.ts')).toBe('controller');
  });

  it('should detect service', () => {
    expect(detectFileRole('src/services/user.service.ts')).toBe('service');
  });

  it('should detect test', () => {
    expect(detectFileRole('src/user.test.ts')).toBe('test');
    expect(detectFileRole('src/user.spec.ts')).toBe('test');
  });

  it('should detect util', () => {
    expect(detectFileRole('src/utils/helper.ts')).toBe('util');
  });

  it('should detect type', () => {
    expect(detectFileRole('src/types/user.types.ts')).toBe('type');
  });

  it('should return unknown for unrecognized paths', () => {
    expect(detectFileRole('src/index.ts')).toBe('unknown');
  });
});

describe('detectLayer', () => {
  it('should detect controller layer', () => {
    expect(detectLayer('src/controllers/user.ts')).toBe('controller');
  });

  it('should detect service layer', () => {
    expect(detectLayer('src/services/user.ts')).toBe('service');
  });

  it('should return unknown for unrecognized paths', () => {
    expect(detectLayer('src/index.ts')).toBe('unknown');
  });
});

describe('graph cache', () => {
  it('should serialize and deserialize a graph', () => {
    const graph = createMockGraph();
    const serialized = serializeGraph(graph);
    const deserialized = deserializeGraph(serialized);

    expect(deserialized.files.size).toBe(graph.files.size);
    expect(deserialized.symbols.size).toBe(graph.symbols.size);
    expect(deserialized.edges.length).toBe(graph.edges.length);
  });

  it('should throw on version mismatch', () => {
    const graph = createMockGraph();
    const serialized = serializeGraph(graph);
    serialized.version = '0.0.0';
    expect(() => deserializeGraph(serialized)).toThrow();
  });
});

describe('graph query', () => {
  it('getFile should return file node', () => {
    const graph = createMockGraph();
    const file = getFile(graph, 'src/services/user.service.ts');
    expect(file).toBeDefined();
    expect(file!.role).toBe('service');
  });

  it('getFile should return undefined for missing file', () => {
    const graph = createMockGraph();
    expect(getFile(graph, 'nonexistent.ts')).toBeUndefined();
  });

  it('getSymbol should return symbol node', () => {
    const graph = createMockGraph();
    const symbol = getSymbol(graph, 'UserService');
    expect(symbol).toBeDefined();
    expect(symbol!.kind).toBe('class');
  });

  it('getDependencies should return dependencies', () => {
    const graph = createMockGraph();
    const deps = getDependencies(graph, 'src/controllers/user.controller.ts');
    expect(deps).toContain('src/services/user.service.ts');
  });

  it('findCircularDeps should return empty for acyclic graph', () => {
    const graph = createMockGraph();
    const cycles = findCircularDeps(graph);
    expect(cycles).toHaveLength(0);
  });

  it('findCircularDeps should detect cycles', () => {
    const graph = createMockGraph();
    // Create a cycle: service → controller
    graph.dependencies.adjacency.get('src/services/user.service.ts')!.add('src/controllers/user.controller.ts');

    const cycles = findCircularDeps(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('getGraphStats should return statistics', () => {
    const graph = createMockGraph();
    const stats = getGraphStats(graph);
    expect(stats.totalFiles).toBe(2);
    expect(stats.totalSymbols).toBe(1);
    expect(stats.totalFunctions).toBe(1);
    expect(stats.totalLOC).toBe(70);
  });
});
