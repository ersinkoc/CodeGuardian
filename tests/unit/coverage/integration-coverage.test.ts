import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import ts from 'typescript';
import { createGuardian, defineRule, definePlugin } from '../../../src/index.js';
import { executeRules } from '../../../src/rules/engine.js';
import { createRuleContext } from '../../../src/rules/context.js';
import { getStagedFiles, getStagedDiff, isGitRepo } from '../../../src/git/staged.js';
import { buildGraph } from '../../../src/graph/builder.js';
import { createTSProgram } from '../../../src/ast/parser.js';
import { discoverConventions } from '../../../src/discovery/conventions.js';
import { updateGraphIncremental } from '../../../src/graph/incremental.js';
import type { CodebaseGraph, FileNode, Rule, Finding, RuleContext, Severity } from '../../../src/types.js';

const fixtureDir = path.resolve(process.cwd(), 'tests/fixtures/sample-project');

// ============================================================
// git/staged.ts coverage
// ============================================================
describe('git/staged coverage', () => {
  it('isGitRepo should return false for non-git directory', () => {
    // Use os.tmpdir() which is outside any git repo
    const tmpDir = path.join(require('os').tmpdir(), '.codeguardian-test-git-tmp-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      expect(isGitRepo(tmpDir)).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('getStagedFiles should throw for non-git directory', () => {
    const tmpDir = path.join(require('os').tmpdir(), '.codeguardian-test-git-tmp2-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      expect(() => getStagedFiles(tmpDir)).toThrow();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('getStagedDiff should throw for non-git directory', () => {
    const tmpDir = path.join(require('os').tmpdir(), '.codeguardian-test-git-tmp3-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      expect(() => getStagedDiff(tmpDir)).toThrow();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ============================================================
// rules/engine.ts coverage
// ============================================================
describe('rules/engine coverage', () => {
  it('executeRules should execute rules against files', async () => {
    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);

    const testRule: Rule = {
      name: 'test/always-warn',
      severity: 'warning',
      description: 'Always produces a warning',
      category: 'quality',
      check(ctx: RuleContext): Finding[] {
        return [{
          message: 'Test warning',
          file: ctx.file.path,
          line: 1,
          column: 1,
        }];
      },
    };

    const targetFiles = Array.from(graph.files.keys());
    const result = await executeRules(
      graph,
      [testRule],
      targetFiles,
      program,
      {},
      [],
      [],
      ['critical', 'error'],
      fixtureDir,
    );

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.stats.filesAnalyzed).toBe(targetFiles.length);
    expect(result.stats.rulesExecuted).toBeGreaterThan(0);
    expect(result.blocked).toBe(false);
  });

  it('executeRules should skip ignored rules', async () => {
    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);

    const testRule: Rule = {
      name: 'test/ignored',
      severity: 'warning',
      description: 'Should be ignored',
      category: 'quality',
      check(): Finding[] {
        return [{ message: 'Should not appear', file: 'x', line: 1, column: 1 }];
      },
    };

    const targetFiles = Array.from(graph.files.keys());
    const result = await executeRules(
      graph, [testRule], targetFiles, program, {}, ['test/ignored'], [], [], fixtureDir,
    );
    expect(result.findings.length).toBe(0);
  });

  it('executeRules should skip ignored files', async () => {
    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);

    const testRule: Rule = {
      name: 'test/rule',
      severity: 'warning',
      description: 'Test',
      category: 'quality',
      check(ctx: RuleContext): Finding[] {
        return [{ message: 'Warning', file: ctx.file.path, line: 1, column: 1 }];
      },
    };

    const targetFiles = Array.from(graph.files.keys());
    const result = await executeRules(
      graph, [testRule], targetFiles, program, {}, [], targetFiles, [], fixtureDir,
    );
    expect(result.findings.length).toBe(0);
  });

  it('executeRules should handle rule execution errors', async () => {
    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);

    const testRule: Rule = {
      name: 'test/error',
      severity: 'error',
      description: 'Throws',
      category: 'quality',
      check(): Finding[] {
        throw new Error('Rule failed');
      },
    };

    const targetFiles = Array.from(graph.files.keys());
    const result = await executeRules(graph, [testRule], targetFiles, program, {}, [], [], [], fixtureDir);
    // Errors are caught and reported as warnings
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0]!.message).toContain('Rule test/error failed');
  });

  it('executeRules should block on matching severity', async () => {
    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);

    const testRule: Rule = {
      name: 'test/critical',
      severity: 'critical',
      description: 'Critical issue',
      category: 'security',
      check(ctx: RuleContext): Finding[] {
        return [{ message: 'Critical!', file: ctx.file.path, line: 1, column: 1 }];
      },
    };

    const targetFiles = Array.from(graph.files.keys());
    const result = await executeRules(
      graph, [testRule], targetFiles, program, {}, [], [], ['critical', 'error'], fixtureDir,
    );
    expect(result.blocked).toBe(true);
    expect(result.bySeverity.critical.length).toBeGreaterThan(0);
  });

  it('executeRules should group findings by file', async () => {
    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);

    const testRule: Rule = {
      name: 'test/group',
      severity: 'info',
      description: 'Grouping test',
      category: 'quality',
      check(ctx: RuleContext): Finding[] {
        return [{ message: 'Info', file: ctx.file.path, line: 1, column: 1 }];
      },
    };

    const targetFiles = Array.from(graph.files.keys());
    const result = await executeRules(graph, [testRule], targetFiles, program, {}, [], [], [], fixtureDir);
    expect(Object.keys(result.byFile).length).toBeGreaterThan(0);
  });
});

// ============================================================
// index.ts coverage (createGuardian, defineRule, definePlugin)
// ============================================================
describe('index.ts createGuardian coverage', () => {
  it('should create a guardian instance', () => {
    const guardian = createGuardian({ rootDir: fixtureDir });
    expect(guardian).toBeDefined();
    expect(guardian.config).toBeDefined();
    expect(guardian.config.rootDir).toBe(fixtureDir);
  });

  it('should list rules', () => {
    const guardian = createGuardian({ rootDir: fixtureDir });
    const rules = guardian.getRules();
    expect(rules.length).toBeGreaterThan(0);
  });

  it('should list plugins', () => {
    const guardian = createGuardian({ rootDir: fixtureDir });
    const plugins = guardian.getPlugins();
    expect(plugins).toContain('architecture');
    expect(plugins).toContain('security');
    expect(plugins).toContain('performance');
    expect(plugins).toContain('quality');
  });

  it('should scan and build graph', async () => {
    const guardian = createGuardian({ rootDir: fixtureDir });
    const graph = await guardian.scan();
    expect(graph.files.size).toBeGreaterThan(0);
    expect(graph.symbols.size).toBeGreaterThan(0);
  });

  it('should throw when accessing graph before scan', () => {
    const guardian = createGuardian({ rootDir: fixtureDir });
    expect(() => guardian.graph).toThrow('Graph not available');
  });

  it('should run analysis', async () => {
    const guardian = createGuardian({ rootDir: fixtureDir });
    const result = await guardian.run();
    expect(result).toBeDefined();
    expect(result.stats.filesAnalyzed).toBeGreaterThan(0);
    expect(result.findings).toBeDefined();
  });

  it('should format results as terminal', async () => {
    const guardian = createGuardian({ rootDir: fixtureDir });
    const result = await guardian.run();
    const output = guardian.format(result, 'terminal', false);
    expect(typeof output).toBe('string');
  });

  it('should format results as json', async () => {
    const guardian = createGuardian({ rootDir: fixtureDir });
    const result = await guardian.run();
    const output = guardian.format(result, 'json');
    const parsed = JSON.parse(output);
    expect(parsed.findings).toBeDefined();
  });

  it('should format results as sarif', async () => {
    const guardian = createGuardian({ rootDir: fixtureDir });
    const result = await guardian.run();
    const output = guardian.format(result, 'sarif');
    const parsed = JSON.parse(output);
    expect(parsed.version).toBe('2.1.0');
  });

  it('should use custom plugin', async () => {
    const guardian = createGuardian({ rootDir: fixtureDir });
    const customPlugin = definePlugin({
      name: 'custom-test',
      version: '1.0.0',
      install(kernel) {
        kernel.registerRule(defineRule({
          name: 'custom-test/always-pass',
          severity: 'info',
          description: 'Always passes',
          category: 'quality',
          check: () => [],
        }));
      },
    });
    guardian.use(customPlugin);
    const plugins = guardian.getPlugins();
    expect(plugins).toContain('custom-test');
  });

  it('should discover conventions', async () => {
    const guardian = createGuardian({ rootDir: fixtureDir });
    const conventions = await guardian.discover();
    expect(Array.isArray(conventions)).toBe(true);
  });

  it('query helpers should work after scan', async () => {
    const guardian = createGuardian({ rootDir: fixtureDir });
    await guardian.scan();

    const files = Array.from(guardian.graph.files.keys());
    const firstFile = files[0]!;

    const fileNode = guardian.query.getFile(firstFile);
    expect(fileNode).toBeDefined();

    const deps = guardian.query.getDependencies(firstFile);
    expect(Array.isArray(deps)).toBe(true);

    const dependents = guardian.query.getDependents(firstFile);
    expect(Array.isArray(dependents)).toBe(true);

    const cycles = guardian.query.findCircularDeps();
    expect(Array.isArray(cycles)).toBe(true);

    const stats = guardian.query.getStats();
    expect(stats).toBeDefined();
    expect(stats!.totalFiles).toBeGreaterThan(0);
  });

  it('query helpers should return defaults before scan', () => {
    const guardian = createGuardian({ rootDir: fixtureDir });
    expect(guardian.query.getFile('x')).toBeUndefined();
    expect(guardian.query.getSymbol('x')).toBeUndefined();
    expect(guardian.query.getDependencies('x')).toEqual([]);
    expect(guardian.query.getDependents('x')).toEqual([]);
    expect(guardian.query.findCircularDeps()).toEqual([]);
    expect(guardian.query.getStats()).toBeNull();
  });

  it('should run with plugin filter', async () => {
    const guardian = createGuardian({ rootDir: fixtureDir });
    const result = await guardian.run({ plugins: ['security'] });
    for (const finding of result.findings) {
      if (finding.rule) {
        expect(finding.rule.startsWith('security/')).toBe(true);
      }
    }
  });

  it('should create guardian with disabled plugins', () => {
    const guardian = createGuardian({
      rootDir: fixtureDir,
      config: {
        plugins: {
          architecture: { enabled: false },
          security: { enabled: false },
          performance: { enabled: false },
          quality: { enabled: false },
        },
      },
    });
    expect(guardian.getRules().length).toBe(0);
  });

  it('should create guardian with optional plugins enabled', () => {
    const guardian = createGuardian({
      rootDir: fixtureDir,
      config: {
        plugins: {
          naming: { enabled: true },
          api: { enabled: true },
          testGuard: { enabled: true },
          depAudit: { enabled: true },
        },
      },
    });
    const plugins = guardian.getPlugins();
    expect(plugins).toContain('naming-convention');
    expect(plugins).toContain('api-consistency');
    expect(plugins).toContain('test-coverage-guard');
    expect(plugins).toContain('dependency-audit');
  });
});

// ============================================================
// defineRule and definePlugin
// ============================================================
describe('defineRule and definePlugin', () => {
  it('defineRule should return the same rule', () => {
    const rule: Rule = {
      name: 'test/rule',
      severity: 'warning',
      description: 'Test',
      category: 'quality',
      check: () => [],
    };
    expect(defineRule(rule)).toBe(rule);
  });

  it('definePlugin should return the same plugin', () => {
    const plugin = definePlugin({
      name: 'test',
      version: '1.0.0',
      install() {},
    });
    expect(plugin.name).toBe('test');
  });
});

// ============================================================
// rules/context coverage - additional methods
// ============================================================
describe('rules/context additional method coverage', () => {
  it('isCallTo should delegate correctly', () => {
    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const checker = program.getTypeChecker();
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);
    const firstFile = Array.from(graph.files.values())[0];
    if (firstFile) {
      const sf = program.getSourceFile(path.resolve(fixtureDir, firstFile.path));
      if (sf) {
        const ctx = createRuleContext(firstFile, sf, graph, program, checker);
        // Test isCallTo - find a call expression in the AST
        let foundCall = false;
        ctx.walk(sf, {
          CallExpression(node: ts.Node) {
            const call = node as ts.CallExpression;
            ctx.isCallTo(call, 'anything');
            foundCall = true;
          },
        });
        // isConsoleCall
        ctx.walk(sf, {
          CallExpression(node: ts.Node) {
            const call = node as ts.CallExpression;
            ctx.isConsoleCall(call);
            ctx.isConsoleCall(call, 'log');
          },
        });
      }
    }
  });
});

// ============================================================
// graph/incremental - edge cases
// ============================================================
describe('graph/incremental additional coverage', () => {
  it('should handle deleted files gracefully', () => {
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);
    const program = createTSProgram(fixtureDir, './tsconfig.json');
    // Try to update with a non-existent file - should not crash
    const result = updateGraphIncremental(graph, ['nonexistent/file.ts'], fixtureDir, program);
    expect(result.changedFiles).toEqual(['nonexistent/file.ts']);
  });

  it('should update affected files (dependents)', () => {
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);
    const program = createTSProgram(fixtureDir, './tsconfig.json');

    // Find a file that has dependents
    const files = Array.from(graph.files.keys());
    const fileWithDeps = files.find(f => {
      for (const [, deps] of graph.dependencies.adjacency) {
        if (deps.has(f)) return true;
      }
      return false;
    });

    if (fileWithDeps) {
      const result = updateGraphIncremental(graph, [fileWithDeps], fixtureDir, program);
      expect(result.affectedFiles.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// discovery/conventions additional coverage
// ============================================================
describe('discovery/conventions additional coverage', () => {
  it('should detect naming conventions', () => {
    // Create a graph with many camelCase functions
    const graph: CodebaseGraph = {
      files: new Map(),
      symbols: new Map(),
      edges: [],
      layers: [],
      patterns: [],
      dependencies: { adjacency: new Map() },
    };

    // Add files with lots of camelCase functions
    const functions = Array.from({ length: 10 }, (_, i) => ({
      name: `getUser${i}`,
      file: 'src/services/user.service.ts',
      startLine: i * 5 + 1,
      endLine: (i + 1) * 5,
      params: [],
      returnType: 'void',
      complexity: 1,
      isAsync: false,
      hasSideEffects: false,
      issues: [],
    }));

    graph.files.set('src/services/user.service.ts', {
      path: 'src/services/user.service.ts',
      role: 'service',
      layer: 'service',
      exports: ['UserService'],
      imports: [{ source: '../repos/user.repo', specifiers: ['UserRepo'], isTypeOnly: false }],
      complexity: 5,
      loc: 50,
      functions,
    });

    graph.files.set('src/services/order.service.ts', {
      path: 'src/services/order.service.ts',
      role: 'service',
      layer: 'service',
      exports: ['OrderService'],
      imports: [],
      complexity: 3,
      loc: 30,
      functions: [
        { name: 'getOrder', file: 'src/services/order.service.ts', startLine: 1, endLine: 5, params: [], returnType: 'void', complexity: 1, isAsync: false, hasSideEffects: false, issues: [] },
      ],
    });

    graph.symbols.set('src/services/user.service.ts:UserService', {
      name: 'UserService', kind: 'class', file: 'src/services/user.service.ts',
      usedBy: [], dependsOn: [], isPublicAPI: true,
    });
    graph.symbols.set('src/services/order.service.ts:OrderService', {
      name: 'OrderService', kind: 'class', file: 'src/services/order.service.ts',
      usedBy: [], dependsOn: [], isPublicAPI: true,
    });

    graph.dependencies.adjacency.set('src/services/user.service.ts', new Set());
    graph.dependencies.adjacency.set('src/services/order.service.ts', new Set());

    const conventions = discoverConventions(graph);
    expect(Array.isArray(conventions)).toBe(true);
    // Should detect file naming pattern for .service.ts
    const namingPattern = conventions.find(c => c.type === 'file-naming');
    expect(namingPattern).toBeDefined();
  });

  it('should detect export patterns', () => {
    const graph: CodebaseGraph = {
      files: new Map(),
      symbols: new Map(),
      edges: [],
      layers: [],
      patterns: [],
      dependencies: { adjacency: new Map() },
    };

    // Add service files that export classes
    graph.files.set('src/services/a.service.ts', {
      path: 'src/services/a.service.ts', role: 'service', layer: 'service',
      exports: ['AService'], imports: [], complexity: 1, loc: 10, functions: [],
    });
    graph.files.set('src/services/b.service.ts', {
      path: 'src/services/b.service.ts', role: 'service', layer: 'service',
      exports: ['BService'], imports: [], complexity: 1, loc: 10, functions: [],
    });
    graph.symbols.set('src/services/a.service.ts:AService', {
      name: 'AService', kind: 'class', file: 'src/services/a.service.ts',
      usedBy: [], dependsOn: [], isPublicAPI: true,
    });
    graph.symbols.set('src/services/b.service.ts:BService', {
      name: 'BService', kind: 'class', file: 'src/services/b.service.ts',
      usedBy: [], dependsOn: [], isPublicAPI: true,
    });
    graph.dependencies.adjacency.set('src/services/a.service.ts', new Set());
    graph.dependencies.adjacency.set('src/services/b.service.ts', new Set());

    const conventions = discoverConventions(graph);
    const exportPattern = conventions.find(c => c.type === 'export-pattern');
    expect(exportPattern).toBeDefined();
    expect(exportPattern!.description).toContain('classes');
  });

  it('should detect function export patterns', () => {
    const graph: CodebaseGraph = {
      files: new Map(), symbols: new Map(), edges: [], layers: [], patterns: [],
      dependencies: { adjacency: new Map() },
    };

    graph.files.set('src/utils/a.util.ts', {
      path: 'src/utils/a.util.ts', role: 'util', layer: 'util',
      exports: ['helperA'], imports: [], complexity: 1, loc: 10, functions: [],
    });
    graph.files.set('src/utils/b.util.ts', {
      path: 'src/utils/b.util.ts', role: 'util', layer: 'util',
      exports: ['helperB'], imports: [], complexity: 1, loc: 10, functions: [],
    });
    graph.symbols.set('src/utils/a.util.ts:helperA', {
      name: 'helperA', kind: 'function', file: 'src/utils/a.util.ts',
      usedBy: [], dependsOn: [], isPublicAPI: true,
    });
    graph.symbols.set('src/utils/b.util.ts:helperB', {
      name: 'helperB', kind: 'function', file: 'src/utils/b.util.ts',
      usedBy: [], dependsOn: [], isPublicAPI: true,
    });
    graph.dependencies.adjacency.set('src/utils/a.util.ts', new Set());
    graph.dependencies.adjacency.set('src/utils/b.util.ts', new Set());

    const conventions = discoverConventions(graph);
    const exportPattern = conventions.find(c => c.type === 'export-pattern');
    expect(exportPattern).toBeDefined();
    expect(exportPattern!.description).toContain('functions');
  });

  it('should detect import direction patterns', () => {
    const graph: CodebaseGraph = {
      files: new Map(), symbols: new Map(), edges: [], layers: [], patterns: [],
      dependencies: { adjacency: new Map() },
    };

    const ctrlFile: FileNode = {
      path: 'src/controllers/user.ts', role: 'controller', layer: 'controller',
      exports: [], imports: [], complexity: 1, loc: 10, functions: [],
    };
    const svcFile: FileNode = {
      path: 'src/services/user.ts', role: 'service', layer: 'service',
      exports: [], imports: [], complexity: 1, loc: 10, functions: [],
    };
    graph.files.set(ctrlFile.path, ctrlFile);
    graph.files.set(svcFile.path, svcFile);
    graph.edges.push(
      { from: ctrlFile.path, to: svcFile.path, specifiers: ['UserService'], isTypeOnly: false },
      { from: ctrlFile.path, to: svcFile.path, specifiers: ['OrderService'], isTypeOnly: false },
    );
    graph.dependencies.adjacency.set(ctrlFile.path, new Set([svcFile.path]));
    graph.dependencies.adjacency.set(svcFile.path, new Set());

    const conventions = discoverConventions(graph);
    const importDir = conventions.find(c => c.type === 'import-direction');
    expect(importDir).toBeDefined();
    expect(importDir!.description).toContain('controller');
    expect(importDir!.description).toContain('service');
  });
});
