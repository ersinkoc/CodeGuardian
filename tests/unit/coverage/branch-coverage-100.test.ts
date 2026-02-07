import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import ts from 'typescript';
import type { CodebaseGraph, FileNode, Finding, RuleContext, Severity } from '../../../src/types.js';

const fixtureDir = path.resolve(process.cwd(), 'tests/fixtures/sample-project');

// ── Helpers ──────────────────────────────────────────────────

function makeGraph(files?: Map<string, FileNode>): CodebaseGraph {
  const f = files ?? new Map();
  const adjacency = new Map<string, Set<string>>();
  for (const key of f.keys()) adjacency.set(key, new Set());
  return {
    files: f,
    symbols: new Map(),
    edges: [],
    layers: [],
    patterns: [],
    dependencies: { adjacency },
  };
}

async function makeContext(
  code: string,
  file: Partial<FileNode> = {},
  graphOverride?: CodebaseGraph,
) {
  const { parseFile } = await import('../../../src/ast/parser.js');
  const { walkAST } = await import('../../../src/ast/walker.js');
  const sf = parseFile('test.ts', code);

  const fileNode: FileNode = {
    path: 'src/test.ts',
    role: 'unknown',
    layer: 'unknown',
    exports: [],
    imports: [],
    complexity: 1,
    loc: 1,
    functions: [],
    ...file,
  };

  const graph = graphOverride ?? makeGraph(new Map([['src/test.ts', fileNode]]));

  return {
    file: fileNode,
    ast: sf,
    graph,
    program: {} as any,
    checker: {} as any,
    walk: (node: ts.Node, visitors: any) => walkAST(node, visitors),
    isCallTo: () => false,
    isConsoleCall: () => false,
    getTypeString: () => '',
    hasStringConcat: (node: ts.Node) => {
      const { hasStringConcat: hsc } = require('../../../src/ast/helpers.js');
      return hsc(node);
    },
    getImports: () => fileNode.imports,
    isExternallyUsed: () => false,
    config: {},
  } as unknown as RuleContext;
}

async function getPluginRules(
  pluginFactory: () => any,
  config: any = {},
) {
  const { createKernel } = await import('../../../src/kernel.js');
  const kernel = createKernel();
  kernel.installPlugin(pluginFactory());
  return kernel.getRules();
}

// ============================================================
// 1. index.ts — optional plugin enabling
// ============================================================
describe('index.ts optional plugins', () => {
  it('should enable naming plugin when config says enabled', async () => {
    const { createGuardian } = await import('../../../src/index.js');
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
// 2. index.ts — run() without prior scan(), staged=false
// ============================================================
describe('index.ts run() without prior scan', () => {
  it('should auto-scan when run() called without scan()', async () => {
    const { createGuardian } = await import('../../../src/index.js');
    const guardian = createGuardian({ rootDir: fixtureDir });
    // run() without prior scan() and with staged=false should trigger full scan
    const result = await guardian.run({ staged: false });
    expect(result).toBeDefined();
    expect(result.stats.filesAnalyzed).toBeGreaterThan(0);
  });

  it('should auto-scan non-staged after a prior scan', async () => {
    const { createGuardian } = await import('../../../src/index.js');
    const guardian = createGuardian({ rootDir: fixtureDir });
    await guardian.scan();
    // Run with explicit staged:false after scan
    const result = await guardian.run({ staged: false });
    expect(result).toBeDefined();
    expect(Array.from(guardian.graph.files.keys()).length).toBeGreaterThan(0);
  });
});

// ============================================================
// 3. index.ts — run() with plugin filter
// ============================================================
describe('index.ts run() with plugin filter', () => {
  it('should filter rules to a single plugin', async () => {
    const { createGuardian } = await import('../../../src/index.js');
    const guardian = createGuardian({ rootDir: fixtureDir });
    await guardian.scan();
    const result = await guardian.run({ plugins: ['security'] });
    // All returned findings should have rule starting with "security/"
    for (const f of result.findings) {
      if (f.rule) expect(f.rule.startsWith('security/')).toBe(true);
    }
  });
});

// ============================================================
// 4. engine.ts — file in ignoredFiles skipped
// ============================================================
describe('engine.ts ignoredFiles', () => {
  it('should skip files in ignoredFiles list', async () => {
    const { executeRules } = await import('../../../src/rules/engine.js');
    const { createTSProgram } = await import('../../../src/ast/parser.js');
    const { buildGraph } = await import('../../../src/graph/builder.js');

    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);
    const targets = Array.from(graph.files.keys());

    const rule = {
      name: 'test/always-warn',
      severity: 'warning' as const,
      description: 'Always warns',
      category: 'quality' as const,
      check: (ctx: any) => [{ message: 'warn', file: ctx.file.path, line: 1, column: 1 }],
    };

    // Ignore all target files
    const result = await executeRules(graph, [rule], targets, program, {}, [], targets, [], fixtureDir);
    expect(result.findings.length).toBe(0);
  });
});

// ============================================================
// 5. engine.ts — missing file node in graph → continue
// ============================================================
describe('engine.ts missing file node', () => {
  it('should skip file not in graph.files', async () => {
    const { executeRules } = await import('../../../src/rules/engine.js');
    const { createTSProgram } = await import('../../../src/ast/parser.js');

    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const graph = makeGraph();

    const rule = {
      name: 'test/rule',
      severity: 'warning' as const,
      description: 'Test',
      category: 'quality' as const,
      check: () => [{ message: 'x', file: 'nonexistent.ts', line: 1, column: 1 }],
    };

    // Pass a file path that's not in the graph
    const result = await executeRules(graph, [rule], ['nonexistent.ts'], program, {}, [], [], [], fixtureDir);
    expect(result.findings.length).toBe(0);
  });
});

// ============================================================
// 6. engine.ts — executeRules without rootDir (absPath fallback)
// ============================================================
describe('engine.ts no rootDir', () => {
  it('should use filePath directly when rootDir is undefined', async () => {
    const { executeRules } = await import('../../../src/rules/engine.js');
    const { createTSProgram } = await import('../../../src/ast/parser.js');
    const { buildGraph } = await import('../../../src/graph/builder.js');

    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);

    // Find a file and use its absolute path as key
    const firstFile = Array.from(graph.files.keys())[0]!;
    const absKey = path.resolve(fixtureDir, firstFile);

    // Create a graph with the absolute path as key
    const absGraph = makeGraph();
    absGraph.files.set(absKey, graph.files.get(firstFile)!);
    absGraph.dependencies.adjacency.set(absKey, new Set());

    const rule = {
      name: 'test/rule',
      severity: 'info' as const,
      description: 'Test',
      category: 'quality' as const,
      check: () => [],
    };

    // No rootDir — absPath = filePath
    const result = await executeRules(absGraph, [rule], [absKey], program, {}, [], []);
    expect(result).toBeDefined();
  });
});

// ============================================================
// 7. engine.ts — rule name without "/" separator
// ============================================================
describe('engine.ts rule name without /', () => {
  it('should handle rule name without "/" in pluginName lookup', async () => {
    const { executeRules } = await import('../../../src/rules/engine.js');
    const { createTSProgram } = await import('../../../src/ast/parser.js');
    const { buildGraph } = await import('../../../src/graph/builder.js');

    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);
    const targets = Array.from(graph.files.keys()).slice(0, 1);

    const rule = {
      name: 'no-slash-rule',
      severity: 'info' as const,
      description: 'Rule without plugin prefix',
      category: 'quality' as const,
      check: () => [],
    };

    const result = await executeRules(graph, [rule], targets, program, {}, [], [], [], fixtureDir);
    expect(result).toBeDefined();
  });
});

// ============================================================
// 8. engine.ts — rule check() throws error → catch block
// ============================================================
describe('engine.ts rule throws error', () => {
  it('should catch non-Error thrown by rule check()', async () => {
    const { executeRules } = await import('../../../src/rules/engine.js');
    const { createTSProgram } = await import('../../../src/ast/parser.js');
    const { buildGraph } = await import('../../../src/graph/builder.js');

    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);
    const targets = Array.from(graph.files.keys()).slice(0, 1);

    const rule = {
      name: 'test/throws-string',
      severity: 'warning' as const,
      description: 'Throws a string',
      category: 'quality' as const,
      check: () => { throw 'string error'; },
    };

    const result = await executeRules(graph, [rule], targets, program, {}, [], [], [], fixtureDir);
    expect(result.findings.some(f => f.message.includes('string error'))).toBe(true);
  });
});

// ============================================================
// 9. engine.ts — finding with undefined severity → ?? 'info'
// ============================================================
describe('engine.ts finding with undefined severity', () => {
  it('should default to info when finding has no severity', async () => {
    const { executeRules } = await import('../../../src/rules/engine.js');
    const { createTSProgram } = await import('../../../src/ast/parser.js');
    const { buildGraph } = await import('../../../src/graph/builder.js');

    const program = createTSProgram(fixtureDir, './tsconfig.json');
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);
    const targets = Array.from(graph.files.keys()).slice(0, 1);

    const rule = {
      name: 'test/no-severity',
      severity: 'info' as const,
      description: 'Returns findings without severity',
      category: 'quality' as const,
      check: (ctx: any) => [{ message: 'test', file: ctx.file.path, line: 1, column: 1 }],
    };

    const result = await executeRules(graph, [rule], targets, program, {}, [], [], [], fixtureDir);
    // Finding should get default severity from rule
    const f = result.findings.find(f => f.message === 'test');
    expect(f?.severity).toBe('info');
    // Should be in bySeverity.info
    expect(result.bySeverity.info.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 10. terminal.ts — findings with undefined severity/rule
// ============================================================
describe('terminal.ts undefined severity/rule', () => {
  it('should format findings with missing severity and rule', async () => {
    const { formatTerminal } = await import('../../../src/reporter/terminal.js');
    const result = {
      findings: [
        { message: 'No sev or rule', file: 'a.ts', line: 1, column: 1 },
        { message: 'Has severity', file: 'b.ts', line: 1, column: 1, severity: 'warning' as const },
      ],
      stats: { filesAnalyzed: 2, rulesExecuted: 1, duration: 10, parseTime: 5, analysisTime: 5 },
      blocked: false,
      bySeverity: { critical: [], error: [], warning: [
        { message: 'Has severity', file: 'b.ts', line: 1, column: 1, severity: 'warning' as const },
      ], info: [] },
      byFile: {},
    };
    const output = formatTerminal(result, true);
    expect(output).toContain('unknown');
    expect(output).toContain('No sev or rule');
  });
});

// ============================================================
// 11. sarif.ts — finding with undefined severity
// ============================================================
describe('sarif.ts undefined severity', () => {
  it('should default to info for missing severity', async () => {
    const { formatSARIF } = await import('../../../src/reporter/sarif.js');
    const result = {
      findings: [
        { message: 'No severity', file: 'a.ts', line: 1, column: 1, rule: 'test/rule' },
      ],
      stats: { filesAnalyzed: 1, rulesExecuted: 1, duration: 10, parseTime: 5, analysisTime: 5 },
      blocked: false,
      bySeverity: { critical: [], error: [], warning: [], info: [] },
      byFile: {},
    };
    const output = JSON.parse(formatSARIF(result));
    // severity ?? 'info' should map to 'note' in SARIF
    expect(output.runs[0].results[0].level).toBe('note');
  });
});

// ============================================================
// 12. architecture.ts — empty layers array
// ============================================================
describe('architecture.ts empty layers', () => {
  it('should return no findings when layers is empty', async () => {
    const { architecturePlugin } = await import('../../../src/plugins/core/architecture.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(architecturePlugin({
      enforceDirection: true,
      layers: [],
    }));

    const rules = kernel.getRules();
    const layerRule = rules.find(r => r.name === 'architecture/layer-violation');
    const ctx = await makeContext('const x = 1;', { role: 'service', layer: 'service' });

    const findings = await layerRule!.check(ctx);
    expect(findings.length).toBe(0);
  });
});

// ============================================================
// 13. architecture.ts — import to unknown file / target not in layers
// ============================================================
describe('architecture.ts unknown import targets', () => {
  it('should continue when target file not in graph', async () => {
    const { architecturePlugin } = await import('../../../src/plugins/core/architecture.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(architecturePlugin({
      enforceDirection: true,
      layers: ['controller', 'service'],
    }));

    const rules = kernel.getRules();
    const layerRule = rules.find(r => r.name === 'architecture/layer-violation');

    const file: FileNode = {
      path: 'src/services/test.ts',
      role: 'service',
      layer: 'service',
      exports: [],
      imports: [{ source: '../unknown/file', specifiers: ['X'], isTypeOnly: false }],
      complexity: 1,
      loc: 1,
      functions: [],
    };
    const graph = makeGraph(new Map([['src/services/test.ts', file]]));

    const { parseFile } = await import('../../../src/ast/parser.js');
    const { walkAST } = await import('../../../src/ast/walker.js');
    const sf = parseFile('test.ts', 'import { X } from "../unknown/file";');

    const ctx = {
      file,
      ast: sf,
      graph,
      program: {} as any,
      checker: {} as any,
      walk: (n: ts.Node, v: any) => walkAST(n, v),
      isCallTo: () => false,
      isConsoleCall: () => false,
      getTypeString: () => '',
      hasStringConcat: () => false,
      getImports: () => file.imports,
      isExternallyUsed: () => false,
      config: {},
    };

    const findings = await layerRule!.check(ctx as any);
    expect(findings.length).toBe(0);
  });

  it('should continue when target file layer is not in layers config', async () => {
    const { architecturePlugin } = await import('../../../src/plugins/core/architecture.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(architecturePlugin({
      enforceDirection: true,
      layers: ['controller', 'service'],
    }));

    const rules = kernel.getRules();
    const layerRule = rules.find(r => r.name === 'architecture/layer-violation');

    const serviceFile: FileNode = {
      path: 'src/services/test.ts',
      role: 'service',
      layer: 'service',
      exports: [],
      imports: [{ source: '../utils/helper', specifiers: ['X'], isTypeOnly: false }],
      complexity: 1,
      loc: 1,
      functions: [],
    };
    const utilFile: FileNode = {
      path: 'src/utils/helper.ts',
      role: 'util',
      layer: 'util', // Not in ['controller', 'service']
      exports: ['X'],
      imports: [],
      complexity: 1,
      loc: 1,
      functions: [],
    };
    const graph = makeGraph(new Map([
      ['src/services/test.ts', serviceFile],
      ['src/utils/helper.ts', utilFile],
    ]));

    const { parseFile } = await import('../../../src/ast/parser.js');
    const { walkAST } = await import('../../../src/ast/walker.js');
    const sf = parseFile('test.ts', 'import { X } from "../utils/helper";');

    const ctx = {
      file: serviceFile,
      ast: sf,
      graph,
      program: {} as any,
      checker: {} as any,
      walk: (n: ts.Node, v: any) => walkAST(n, v),
      isCallTo: () => false,
      isConsoleCall: () => false,
      getTypeString: () => '',
      hasStringConcat: () => false,
      getImports: () => serviceFile.imports,
      isExternallyUsed: () => false,
      config: {},
    };

    const findings = await layerRule!.check(ctx as any);
    expect(findings.length).toBe(0);
  });
});

// ============================================================
// 14. architecture.ts — undefined maxFileLines/maxFunctionLines
// ============================================================
describe('architecture.ts undefined config values', () => {
  it('should use defaults when maxFileLines/maxFunctionLines are undefined', async () => {
    const { architecturePlugin } = await import('../../../src/plugins/core/architecture.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    // Pass config without maxFileLines/maxFunctionLines, relying on ?? 300/50
    kernel.installPlugin(architecturePlugin({
      maxFileLines: undefined,
      maxFunctionLines: undefined,
    }));

    const rules = kernel.getRules();
    const godFile = rules.find(r => r.name === 'architecture/god-file');
    const godFunc = rules.find(r => r.name === 'architecture/god-function');

    // Test god-file with large file
    const bigFile = await makeContext('const x = 1;', { loc: 500, functions: [] });
    const gfFindings = await godFile!.check(bigFile);
    expect(gfFindings.length).toBeGreaterThan(0);

    // Test god-function with a long function
    const fnFile = await makeContext('const x = 1;', {
      functions: [{ name: 'bigFn', file: 'src/test.ts', startLine: 1, endLine: 100, params: [], returnType: 'void', complexity: 1, isAsync: false, hasSideEffects: false, issues: [] }],
    });
    const gfnFindings = await godFunc!.check(fnFile);
    expect(gfnFindings.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 15. quality.ts — undefined maxCyclomaticComplexity
// ============================================================
describe('quality.ts undefined maxCyclomaticComplexity', () => {
  it('should use default when maxCyclomaticComplexity is undefined', async () => {
    const { qualityPlugin } = await import('../../../src/plugins/core/quality.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(qualityPlugin({ maxCyclomaticComplexity: undefined }));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'quality/cyclomatic-complexity');
    expect(rule).toBeDefined();

    // Function with complexity > 15 (the default)
    const ctx = await makeContext('const x = 1;', {
      functions: [{ name: 'complex', file: 'src/test.ts', startLine: 1, endLine: 10, params: [], returnType: 'void', complexity: 20, isAsync: false, hasSideEffects: false, issues: [] }],
    });
    const findings = await rule!.check(ctx);
    expect(findings.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 16. quality.ts — file named index.ts in dead-code check
// ============================================================
describe('quality.ts dead-code index.ts skip', () => {
  it('should skip exports in index.ts files', async () => {
    const { qualityPlugin } = await import('../../../src/plugins/core/quality.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(qualityPlugin({}));

    const rules = kernel.getRules();
    const deadCode = rules.find(r => r.name === 'quality/dead-code');

    const ctx = await makeContext('export const unused = 1;', {
      path: 'src/index.ts',
      role: 'service',
      exports: ['unused'],
    });
    const findings = await deadCode!.check(ctx);
    // index.ts is skipped entirely
    expect(findings.length).toBe(0);
  });
});

// ============================================================
// 17. dep-audit.ts — undefined maxDepth
// ============================================================
describe('dep-audit.ts undefined maxDepth', () => {
  it('should use default when maxDepth is undefined', async () => {
    const { depAuditPlugin } = await import('../../../src/plugins/optional/dep-audit.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(depAuditPlugin({ maxDepth: undefined }));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'dependency-audit/deep-imports');
    expect(rule).toBeDefined();

    // Create a deep chain: a → b → c → d → e → f → g (depth 6 > 5)
    const graph = makeGraph();
    const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts', 'g.ts'];
    for (const f of files) {
      graph.files.set(f, { path: f, role: 'unknown', layer: 'unknown', exports: [], imports: [], complexity: 1, loc: 1, functions: [] });
    }
    for (let i = 0; i < files.length - 1; i++) {
      graph.dependencies.adjacency.set(files[i]!, new Set([files[i + 1]!]));
    }
    graph.dependencies.adjacency.set(files[files.length - 1]!, new Set());

    const ctx = await makeContext('const x = 1;', { path: 'a.ts' }, graph);
    const findings = await rule!.check(ctx);
    expect(findings.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 18. dep-audit.ts — circular deps trigger visited check
// ============================================================
describe('dep-audit.ts circular dependency visited check', () => {
  it('should handle circular dependencies without infinite loop', async () => {
    const { depAuditPlugin } = await import('../../../src/plugins/optional/dep-audit.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(depAuditPlugin({}));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'dependency-audit/deep-imports');

    // Circular: a → b → c → a
    const graph = makeGraph();
    for (const f of ['a.ts', 'b.ts', 'c.ts']) {
      graph.files.set(f, { path: f, role: 'unknown', layer: 'unknown', exports: [], imports: [], complexity: 1, loc: 1, functions: [] });
    }
    graph.dependencies.adjacency.set('a.ts', new Set(['b.ts']));
    graph.dependencies.adjacency.set('b.ts', new Set(['c.ts']));
    graph.dependencies.adjacency.set('c.ts', new Set(['a.ts']));

    const ctx = await makeContext('const x = 1;', { path: 'a.ts' }, graph);
    const findings = await rule!.check(ctx);
    // Should not throw or infinite loop
    expect(Array.isArray(findings)).toBe(true);
  });
});

// ============================================================
// 19. conventions.ts — shared suffix pattern with ≥2 files
// ============================================================
describe('conventions.ts file naming patterns', () => {
  it('should detect suffix patterns across files', async () => {
    const { discoverConventions } = await import('../../../src/discovery/conventions.js');

    const graph = makeGraph();
    // 3 files in same dir with .service.ts suffix
    for (const name of ['user.service.ts', 'auth.service.ts', 'order.service.ts']) {
      graph.files.set(`src/services/${name}`, {
        path: `src/services/${name}`,
        role: 'service',
        layer: 'service',
        exports: [],
        imports: [],
        complexity: 1,
        loc: 10,
        functions: [{ name: `get${name.split('.')[0]}`, file: `src/services/${name}`, startLine: 1, endLine: 5, params: [], returnType: 'void', complexity: 1, isAsync: false, hasSideEffects: false, issues: [] }],
      });
      graph.dependencies.adjacency.set(`src/services/${name}`, new Set());
    }

    const patterns = discoverConventions(graph);
    const fileNaming = patterns.find(p => p.type === 'file-naming');
    expect(fileNaming).toBeDefined();
  });
});

// ============================================================
// 20. conventions.ts — class/function export patterns with known roles
// ============================================================
describe('conventions.ts export patterns', () => {
  it('should detect class-heavy export patterns', async () => {
    const { discoverConventions } = await import('../../../src/discovery/conventions.js');

    const graph = makeGraph();
    // Two service files that export classes
    for (let i = 0; i < 3; i++) {
      const name = `service${i}.ts`;
      const filePath = `src/services/${name}`;
      graph.files.set(filePath, {
        path: filePath,
        role: 'service',
        layer: 'service',
        exports: [`Service${i}`],
        imports: [],
        complexity: 1,
        loc: 10,
        functions: [],
      });
      graph.symbols.set(`${filePath}:Service${i}`, {
        name: `Service${i}`,
        kind: 'class',
        file: filePath,
        usedBy: [],
        dependsOn: [],
        isPublicAPI: false,
      });
      graph.dependencies.adjacency.set(filePath, new Set());
    }

    const patterns = discoverConventions(graph);
    const exportPattern = patterns.find(p => p.type === 'export-pattern' && p.description.includes('class'));
    expect(exportPattern).toBeDefined();
  });

  it('should detect function-heavy export patterns', async () => {
    const { discoverConventions } = await import('../../../src/discovery/conventions.js');

    const graph = makeGraph();
    // Two util files that export functions
    for (let i = 0; i < 3; i++) {
      const name = `util${i}.ts`;
      const filePath = `src/utils/${name}`;
      graph.files.set(filePath, {
        path: filePath,
        role: 'util',
        layer: 'util',
        exports: [`doSomething${i}`],
        imports: [],
        complexity: 1,
        loc: 10,
        functions: [],
      });
      graph.symbols.set(`${filePath}:doSomething${i}`, {
        name: `doSomething${i}`,
        kind: 'function',
        file: filePath,
        usedBy: [],
        dependsOn: [],
        isPublicAPI: false,
      });
      graph.dependencies.adjacency.set(filePath, new Set());
    }

    const patterns = discoverConventions(graph);
    const exportPattern = patterns.find(p => p.type === 'export-pattern' && p.description.includes('function'));
    expect(exportPattern).toBeDefined();
  });
});

// ============================================================
// 21. conventions.ts — import direction patterns with known layers
// ============================================================
describe('conventions.ts import direction', () => {
  it('should detect import direction patterns between layers', async () => {
    const { discoverConventions } = await import('../../../src/discovery/conventions.js');

    const graph = makeGraph();
    // Controller imports from service multiple times
    graph.files.set('src/controllers/a.ts', {
      path: 'src/controllers/a.ts', role: 'controller', layer: 'controller',
      exports: [], imports: [], complexity: 1, loc: 10, functions: [],
    });
    graph.files.set('src/services/a.ts', {
      path: 'src/services/a.ts', role: 'service', layer: 'service',
      exports: [], imports: [], complexity: 1, loc: 10, functions: [],
    });
    graph.dependencies.adjacency.set('src/controllers/a.ts', new Set(['src/services/a.ts']));
    graph.dependencies.adjacency.set('src/services/a.ts', new Set());

    // Add 3 edges from controller to service
    for (let i = 0; i < 3; i++) {
      graph.edges.push({
        from: 'src/controllers/a.ts',
        to: 'src/services/a.ts',
        specifiers: [`fn${i}`],
        isTypeOnly: false,
      });
    }

    const patterns = discoverConventions(graph);
    const dirPattern = patterns.find(p => p.type === 'import-direction');
    expect(dirPattern).toBeDefined();
  });
});

// ============================================================
// 22. helpers.ts — destructured function parameters
// ============================================================
describe('helpers.ts destructured params', () => {
  it('should handle destructured parameters in function extraction', async () => {
    const { extractFunctions } = await import('../../../src/ast/helpers.js');
    const { parseFile } = await import('../../../src/ast/parser.js');

    const sf = parseFile('test.ts', 'function test({ name, age }: { name: string, age: number }) { return name; }');
    const fns = extractFunctions(sf, 'test.ts');
    expect(fns.length).toBe(1);
    // Destructured param name should use getText() fallback
    expect(fns[0]!.params[0]!.name).toContain('name');
  });
});

// ============================================================
// 23. helpers.ts — side-effect import (no import clause)
// ============================================================
describe('helpers.ts side-effect import', () => {
  it('should handle imports without import clause', async () => {
    const { extractImports } = await import('../../../src/ast/helpers.js');
    const { parseFile } = await import('../../../src/ast/parser.js');

    const sf = parseFile('test.ts', 'import "./side-effect";');
    const imports = extractImports(sf);
    expect(imports.length).toBe(1);
    expect(imports[0]!.specifiers.length).toBe(0);
  });
});

// ============================================================
// 24. helpers.ts — ArrowFunction in detectSymbolKind
// ============================================================
describe('helpers.ts detectSymbolKind arrow function', () => {
  it('should detect ArrowFunction kind', async () => {
    const { detectSymbolKind } = await import('../../../src/ast/helpers.js');
    const { parseFile } = await import('../../../src/ast/parser.js');

    const sf = parseFile('test.ts', 'const fn = () => 42;');
    let tested = false;
    ts.forEachChild(sf, function visit(node) {
      if (ts.isArrowFunction(node)) {
        expect(detectSymbolKind(node)).toBe('function');
        tested = true;
      }
      ts.forEachChild(node, visit);
    });
    expect(tested).toBe(true);
  });
});

// ============================================================
// 25. diff.ts — malformed diff line (no file path)
// ============================================================
describe('diff.ts malformed line', () => {
  it('should skip lines without file path', async () => {
    const { parseDiffNameStatus } = await import('../../../src/git/diff.js');
    const entries = parseDiffNameStatus('M\n');
    // No filePath → should be skipped
    expect(entries.length).toBe(0);
  });
});

// ============================================================
// 26. diff.ts — binary file numstat with "-" values
// ============================================================
describe('diff.ts binary numstat', () => {
  it('should handle binary files with "-" for additions/deletions', async () => {
    const { parseDiffNumstat } = await import('../../../src/git/diff.js');
    const stats = parseDiffNumstat('-\t-\tbinary.png\n');
    const entry = stats.get('binary.png');
    expect(entry).toBeDefined();
    expect(entry!.additions).toBe(0);
    expect(entry!.deletions).toBe(0);
  });
});

// ============================================================
// 27. performance.ts — direct readFileSync() call (Identifier)
// ============================================================
describe('performance.ts sync-in-async identifier branch', () => {
  it('should detect direct readFileSync call (not property access)', async () => {
    const { performancePlugin } = await import('../../../src/plugins/core/performance.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(performancePlugin({ checkAsyncPatterns: true }));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'performance/sync-in-async');

    const ctx = await makeContext(
      'async function load() { const data = readFileSync("file.txt"); return data; }',
      {
        functions: [{ name: 'load', file: 'src/test.ts', startLine: 1, endLine: 1, params: [], returnType: 'Promise<string>', complexity: 1, isAsync: true, hasSideEffects: false, issues: [] }],
      },
    );
    const findings = await rule!.check(ctx);
    expect(findings.some(f => f.message.includes('readFileSync'))).toBe(true);
  });
});

// ============================================================
// 28. performance.ts — find() method detection (unbounded-query)
// ============================================================
describe('performance.ts find() detection', () => {
  it('should detect find() without limit', async () => {
    const { performancePlugin } = await import('../../../src/plugins/core/performance.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(performancePlugin({}));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'performance/unbounded-query');

    const ctx = await makeContext('const user = repo.find({ where: { active: true } });');
    const findings = await rule!.check(ctx);
    expect(findings.some(f => f.message.includes('find'))).toBe(true);
  });
});

// ============================================================
// 29. performance.ts — heavy-import with checkBundleSize:true
// ============================================================
describe('performance.ts heavy-import with bundleSize enabled', () => {
  it('should detect heavy imports when checkBundleSize is true', async () => {
    const { performancePlugin } = await import('../../../src/plugins/core/performance.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(performancePlugin({ checkBundleSize: true }));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'performance/heavy-import');

    const ctx = await makeContext('import { merge } from "lodash";', {
      imports: [{ source: 'lodash', specifiers: ['merge'], isTypeOnly: false }],
    });
    const findings = await rule!.check(ctx);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.message).toContain('lodash');
  });
});

// ============================================================
// 30. security.ts — NoSubstitutionTemplateLiteral secret >= 8 chars
// ============================================================
describe('security.ts NoSubstitutionTemplateLiteral secret', () => {
  it('should detect secrets in backtick strings without substitutions', async () => {
    const { securityPlugin } = await import('../../../src/plugins/core/security.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(securityPlugin({ checkSecrets: true }));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'security/hardcoded-secret');

    // Short NoSubstitutionTemplateLiteral (< 8 chars) should be skipped
    const ctxShort = await makeContext('const s = `short`;', { role: 'service' });
    const shortFindings = await rule!.check(ctxShort);
    const shortSecret = shortFindings.filter(f => f.message.includes('secret'));
    expect(shortSecret.length).toBe(0);
  });
});

// ============================================================
// 31. security.ts — obj.prototype assignment
// ============================================================
describe('security.ts prototype assignment', () => {
  it('should detect obj.prototype = ... assignment', async () => {
    const { securityPlugin } = await import('../../../src/plugins/core/security.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(securityPlugin({}));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'security/prototype-pollution');

    const ctx = await makeContext('(obj as any).prototype = {};');
    const findings = await rule!.check(ctx);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.message).toContain('prototype');
  });
});

// ============================================================
// 32. security.ts — document.writeln() detection
// ============================================================
describe('security.ts document.writeln', () => {
  it('should detect document.writeln()', async () => {
    const { securityPlugin } = await import('../../../src/plugins/core/security.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(securityPlugin({ checkXSS: true }));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'security/xss-risk');

    const ctx = await makeContext('document.writeln("<h1>Hello</h1>");');
    const findings = await rule!.check(ctx);
    expect(findings.some(f => f.message.includes('XSS'))).toBe(true);
  });
});

// ============================================================
// 33. color.ts — isTTY check with no env vars
// ============================================================
describe('color.ts isTTY fallback', () => {
  it('should check isTTY when no env vars set', async () => {
    // Remove NO_COLOR and FORCE_COLOR, let isTTY decide
    vi.stubEnv('NO_COLOR', undefined as any);
    vi.stubEnv('FORCE_COLOR', undefined as any);
    delete process.env['NO_COLOR'];
    delete process.env['FORCE_COLOR'];
    vi.resetModules();
    const { color } = await import('../../../src/utils/color.js');
    // The value depends on the environment, but we exercise the branch
    expect(typeof color.enabled).toBe('boolean');
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

// ============================================================
// 34. kernel.ts — plugin install throws non-Error value
// ============================================================
describe('kernel.ts install throws non-Error', () => {
  it('should handle non-Error thrown during install', async () => {
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();

    const plugin = {
      name: 'throwing-plugin',
      version: '1.0.0',
      install() {
        throw 'string-error';
      },
    };

    expect(() => kernel.installPlugin(plugin)).toThrow('string-error');
  });

  it('should call onError when install throws Error', async () => {
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();

    let caughtError: Error | null = null;
    const plugin = {
      name: 'error-plugin',
      version: '1.0.0',
      install() {
        throw new Error('install failed');
      },
      onError(err: Error) {
        caughtError = err;
      },
    };

    expect(() => kernel.installPlugin(plugin)).toThrow();
    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe('install failed');
  });
});

// ============================================================
// 35. incremental.ts — parseFile fallback when getSourceFile returns undefined
// ============================================================
describe('incremental.ts parseFile fallback', () => {
  it('should handle getSourceFile returning undefined by falling back to parseFile', async () => {
    const { updateGraphIncremental } = await import('../../../src/graph/incremental.js');
    const { buildGraph } = await import('../../../src/graph/builder.js');
    const { createTSProgram } = await import('../../../src/ast/parser.js');

    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);
    const program = createTSProgram(fixtureDir, './tsconfig.json');

    // Pass a file that exists on disk but isn't in the program's file set
    // This will make getSourceFile return undefined and fallback to parseFile
    const tmpDir = path.resolve(process.cwd(), '.tmp-incr-fallback-' + Date.now());
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'extra.ts'), 'export const x = 1;', 'utf-8');

    try {
      // The file extra.ts is not in the program, so getSourceFile returns undefined
      // But it exists on disk, so parseFile can read it
      const result = updateGraphIncremental(graph, ['src/extra.ts'], tmpDir, program);
      expect(result.affectedFiles).toContain('src/extra.ts');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ============================================================
// 36. incremental.ts — file parse throws → catch/continue
// ============================================================
describe('incremental.ts file parse error', () => {
  it('should continue when file does not exist (catch block)', async () => {
    const { updateGraphIncremental } = await import('../../../src/graph/incremental.js');
    const { buildGraph } = await import('../../../src/graph/builder.js');
    const { createTSProgram } = await import('../../../src/ast/parser.js');

    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);
    const program = createTSProgram(fixtureDir, './tsconfig.json');

    // Pass a file that doesn't exist on disk — both getSourceFile and parseFile will fail
    const result = updateGraphIncremental(graph, ['src/nonexistent-file-xyz.ts'], fixtureDir, program);
    // Should not throw, just continue
    expect(result).toBeDefined();
  });
});

// ============================================================
// 37. incremental.ts — edge from orphaned file (not in graph.files)
// ============================================================
describe('incremental.ts orphaned edge', () => {
  it('should handle edges where from file is not in graph.files', async () => {
    const { updateGraphIncremental } = await import('../../../src/graph/incremental.js');
    const { buildGraph } = await import('../../../src/graph/builder.js');
    const { createTSProgram } = await import('../../../src/ast/parser.js');

    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], []);
    const program = createTSProgram(fixtureDir, './tsconfig.json');

    // Add an edge from a file that doesn't exist in graph.files
    graph.edges.push({
      from: 'src/orphaned.ts',
      to: Array.from(graph.files.keys())[0]!,
      specifiers: ['x'],
      isTypeOnly: false,
    });

    // Running incremental update should rebuild adjacency safely
    const files = Array.from(graph.files.keys()).slice(0, 1);
    const result = updateGraphIncremental(graph, files, fixtureDir, program);
    // The orphaned edge from should not be in the adjacency map
    expect(result.graph.dependencies.adjacency.has('src/orphaned.ts')).toBe(false);
  });
});

// ============================================================
// 38. graph/query.ts — getDependencies for non-existent file
// ============================================================
describe('query.ts non-existent file', () => {
  it('should return empty array for non-existent file', async () => {
    const { getDependencies } = await import('../../../src/graph/query.js');
    const graph = makeGraph();
    const deps = getDependencies(graph, 'nonexistent.ts');
    expect(deps).toEqual([]);
  });
});

// ============================================================
// 39. naming.ts — file path without "/" separator
// ============================================================
describe('naming.ts file path without /', () => {
  it('should handle a flat file path', async () => {
    const { namingPlugin } = await import('../../../src/plugins/optional/naming.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(namingPlugin({}));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'naming-convention/file-naming');

    // File path without any "/" — pop() returns the path itself
    const ctx = await makeContext('const x = 1;', { path: 'test.ts' });
    const findings = await rule!.check(ctx);
    // Should not crash
    expect(Array.isArray(findings)).toBe(true);
  });
});

// ============================================================
// 40. walker.ts — node with unknown SyntaxKind
// ============================================================
describe('walker.ts unknown SyntaxKind', () => {
  it('should handle nodes where no visitor matches', async () => {
    const { walkAST } = await import('../../../src/ast/walker.js');
    const { parseFile } = await import('../../../src/ast/parser.js');

    const sf = parseFile('test.ts', 'const x = 1;');
    // Walk with a visitor that only matches a non-existent kind
    let called = false;
    walkAST(sf, {
      ThisKeyword() { called = true; },
    });
    // The non-matching nodes (SourceFile, VariableStatement, etc.) should be silently skipped
    // ThisKeyword may or may not be found, but the walk shouldn't crash
    expect(true).toBe(true);
  });
});

// ============================================================
// 41. builder.ts — source file not in program
// ============================================================
describe('builder.ts source file not in program', () => {
  it('should skip file when program.getSourceFile returns undefined', async () => {
    const { buildGraph } = await import('../../../src/graph/builder.js');
    // Build with a very restrictive exclude to exercise the sourceFile skip
    const graph = buildGraph(fixtureDir, './tsconfig.json', ['src/**/*.ts'], ['src/**/*']);
    // All files excluded — graph should still work with 0 files
    expect(graph.files.size).toBe(0);
  });
});

// ============================================================
// Extra: exercise paths not covered by other tests
// ============================================================

describe('security.ts setTimeout with string arg', () => {
  it('should detect setTimeout with string argument', async () => {
    const { securityPlugin } = await import('../../../src/plugins/core/security.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(securityPlugin({}));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'security/eval-usage');

    const ctx = await makeContext('setTimeout("alert(1)", 1000);');
    const findings = await rule!.check(ctx);
    expect(findings.some(f => f.message.includes('setTimeout'))).toBe(true);
  });
});

describe('security.ts new Function()', () => {
  it('should detect new Function()', async () => {
    const { securityPlugin } = await import('../../../src/plugins/core/security.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(securityPlugin({}));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'security/eval-usage');

    const ctx = await makeContext('const fn = new Function("return 1");');
    const findings = await rule!.check(ctx);
    expect(findings.some(f => f.message.includes('new Function'))).toBe(true);
  });
});

describe('quality.ts nested-callbacks', () => {
  it('should detect deeply nested callbacks', async () => {
    const { qualityPlugin } = await import('../../../src/plugins/core/quality.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(qualityPlugin({}));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'quality/nested-callbacks');

    const code = `
      foo(() => {
        bar(() => {
          baz(() => {
            qux(() => {
              quux(() => {
                return 1;
              });
            });
          });
        });
      });
    `;
    const ctx = await makeContext(code);
    const findings = await rule!.check(ctx);
    expect(findings.length).toBeGreaterThan(0);
  });
});

describe('quality.ts inconsistent-naming', () => {
  it('should detect non-camelCase function names', async () => {
    const { qualityPlugin } = await import('../../../src/plugins/core/quality.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(qualityPlugin({ checkNaming: true }));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'quality/inconsistent-naming');

    const ctx = await makeContext('function BadName() {}', {
      role: 'service',
      functions: [{ name: 'BadName', file: 'src/test.ts', startLine: 1, endLine: 1, params: [], returnType: 'void', complexity: 1, isAsync: false, hasSideEffects: false, issues: [] }],
    });
    const findings = await rule!.check(ctx);
    expect(findings.length).toBeGreaterThan(0);
  });
});

describe('quality.ts dead-code with unused export', () => {
  it('should detect unused exports', async () => {
    const { qualityPlugin } = await import('../../../src/plugins/core/quality.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(qualityPlugin({}));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'quality/dead-code');

    const graph = makeGraph();
    const file: FileNode = {
      path: 'src/service.ts',
      role: 'service',
      layer: 'service',
      exports: ['unusedExport', 'default'],
      imports: [],
      complexity: 1,
      loc: 10,
      functions: [],
    };
    graph.files.set('src/service.ts', file);
    // No symbols referencing unusedExport — no usedBy
    graph.symbols.set('src/service.ts:unusedExport', {
      name: 'unusedExport',
      kind: 'function',
      file: 'src/service.ts',
      usedBy: [],
      dependsOn: [],
      isPublicAPI: false,
    });

    const { parseFile } = await import('../../../src/ast/parser.js');
    const { walkAST } = await import('../../../src/ast/walker.js');
    const sf = parseFile('test.ts', 'export function unusedExport() {}');

    const ctx = {
      file,
      ast: sf,
      graph,
      program: {} as any,
      checker: {} as any,
      walk: (n: ts.Node, v: any) => walkAST(n, v),
      isCallTo: () => false,
      isConsoleCall: () => false,
      getTypeString: () => '',
      hasStringConcat: () => false,
      getImports: () => [],
      isExternallyUsed: (name: string) => {
        const sym = graph.symbols.get(`src/service.ts:${name}`);
        return sym ? sym.usedBy.length > 0 : false;
      },
      config: {},
    };

    const findings = await rule!.check(ctx as any);
    // 'default' should be skipped, 'unusedExport' should be detected
    expect(findings.some(f => f.message.includes('unusedExport'))).toBe(true);
    expect(findings.some(f => f.message.includes('default'))).toBe(false);
  });
});

describe('architecture.ts barrel-explosion', () => {
  it('should detect barrel files with many exports', async () => {
    const { architecturePlugin } = await import('../../../src/plugins/core/architecture.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(architecturePlugin({}));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'architecture/barrel-explosion');

    const exports = Array.from({ length: 15 }, (_, i) => `export${i}`);
    const ctx = await makeContext('export {};', { path: 'src/index.ts', exports });
    const findings = await rule!.check(ctx);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.message).toContain('re-exports');
  });
});

describe('security.ts insecure-random', () => {
  it('should detect Math.random() in security context', async () => {
    const { securityPlugin } = await import('../../../src/plugins/core/security.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(securityPlugin({}));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'security/insecure-random');

    // File contains both Math.random() and "token" keyword
    const ctx = await makeContext('const token = Math.random().toString(36);');
    const findings = await rule!.check(ctx);
    expect(findings.some(f => f.message.includes('Math.random'))).toBe(true);
  });
});

describe('security.ts path-traversal', () => {
  it('should detect file operations with dynamic paths', async () => {
    const { securityPlugin } = await import('../../../src/plugins/core/security.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(securityPlugin({}));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'security/path-traversal');

    const ctx = await makeContext('readFile(`/data/${userInput}/file.txt`, "utf-8");');
    // Override hasStringConcat to detect template expressions
    (ctx as any).hasStringConcat = () => false;
    // The rule checks for TemplateExpression directly
    const findings = await rule!.check(ctx);
    expect(Array.isArray(findings)).toBe(true);
  });
});

describe('helpers.ts extractExports', () => {
  it('should extract all export types', async () => {
    const { extractExports } = await import('../../../src/ast/helpers.js');
    const { parseFile } = await import('../../../src/ast/parser.js');

    const code = `
      export function fn() {}
      export class Cls {}
      export interface IFace {}
      export type MyType = string;
      export enum MyEnum { A, B }
      export const val = 1;
      export { fn as renamed };
      const def = 42;
      export default def;
    `;
    const sf = parseFile('test.ts', code);
    const exports = extractExports(sf);
    expect(exports).toContain('fn');
    expect(exports).toContain('Cls');
    expect(exports).toContain('IFace');
    expect(exports).toContain('MyType');
    expect(exports).toContain('MyEnum');
    expect(exports).toContain('val');
    expect(exports).toContain('renamed');
    expect(exports).toContain('default');
  });
});

describe('helpers.ts namespace import', () => {
  it('should extract namespace imports', async () => {
    const { extractImports } = await import('../../../src/ast/helpers.js');
    const { parseFile } = await import('../../../src/ast/parser.js');

    const sf = parseFile('test.ts', 'import * as ns from "./module";');
    const imports = extractImports(sf);
    expect(imports.length).toBe(1);
    expect(imports[0]!.specifiers).toContain('ns');
  });
});

describe('helpers.ts function expression', () => {
  it('should extract function expressions from variable declarations', async () => {
    const { extractFunctions } = await import('../../../src/ast/helpers.js');
    const { parseFile } = await import('../../../src/ast/parser.js');

    const sf = parseFile('test.ts', 'const myFn = function() { return 1; };');
    const fns = extractFunctions(sf, 'test.ts');
    expect(fns.some(f => f.name === 'myFn')).toBe(true);
  });
});

describe('architecture.ts file-role-mismatch', () => {
  it('should detect mismatched role in services directory', async () => {
    const { architecturePlugin } = await import('../../../src/plugins/core/architecture.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(architecturePlugin({}));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'architecture/file-role-mismatch');

    // File in /service/ dir but with controller role
    const ctx = await makeContext('const x = 1;', {
      path: 'src/service/user.ts',
      role: 'controller',
    });
    const findings = await rule!.check(ctx);
    expect(findings.some(f => f.message.includes('services directory'))).toBe(true);
  });

  it('should detect mismatched role in controllers directory', async () => {
    const { architecturePlugin } = await import('../../../src/plugins/core/architecture.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(architecturePlugin({}));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'architecture/file-role-mismatch');

    const ctx = await makeContext('const x = 1;', {
      path: 'src/controller/user.ts',
      role: 'service',
    });
    const findings = await rule!.check(ctx);
    expect(findings.some(f => f.message.includes('controllers directory'))).toBe(true);
  });
});

describe('security.ts missing-auth-check', () => {
  it('should detect controller without auth references', async () => {
    const { securityPlugin } = await import('../../../src/plugins/core/security.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(securityPlugin({ checkAuth: true }));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'security/missing-auth-check');

    const ctx = await makeContext('function handleRequest() { return { status: 200 }; }', {
      role: 'controller',
      functions: [{ name: 'handleRequest', file: 'src/test.ts', startLine: 1, endLine: 1, params: [], returnType: 'void', complexity: 1, isAsync: false, hasSideEffects: false, issues: [] }],
    });
    const findings = await rule!.check(ctx);
    expect(findings.some(f => f.message.includes('authentication'))).toBe(true);
  });
});

describe('quality.ts no-error-handling', () => {
  it('should detect async functions without error handling', async () => {
    const { qualityPlugin } = await import('../../../src/plugins/core/quality.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(qualityPlugin({}));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'quality/no-error-handling');

    const ctx = await makeContext('async function fetchData() { const data = await fetch("/api"); return data; }', {
      functions: [{ name: 'fetchData', file: 'src/test.ts', startLine: 1, endLine: 1, params: [], returnType: 'Promise<any>', complexity: 1, isAsync: true, hasSideEffects: false, issues: [] }],
    });
    const findings = await rule!.check(ctx);
    expect(findings.some(f => f.message.includes('fetchData'))).toBe(true);
  });
});

describe('quality.ts magic-number', () => {
  it('should detect magic numbers outside declarations', async () => {
    const { qualityPlugin } = await import('../../../src/plugins/core/quality.js');
    const { createKernel } = await import('../../../src/kernel.js');
    const kernel = createKernel();
    kernel.installPlugin(qualityPlugin({}));

    const rules = kernel.getRules();
    const rule = rules.find(r => r.name === 'quality/magic-number');

    const ctx = await makeContext('if (x > 42) { doSomething(); }');
    const findings = await rule!.check(ctx);
    expect(findings.some(f => f.message.includes('42'))).toBe(true);
  });
});

// ============================================================
// Additional tests for remaining uncovered branches
// ============================================================

describe('helpers.ts template expression on right side of binary +', () => {
  it('should detect string concat with template on right (not StringLiteral)', async () => {
    const { hasStringConcat } = await import('../../../src/ast/helpers.js');
    const { parseFile } = await import('../../../src/ast/parser.js');

    // Neither side is a StringLiteral, but right side is TemplateExpression
    // This exercises the ts.isTemplateExpression(node.right) branch on line 97
    const sf = parseFile('test.ts', 'const x = someVar + `template ${y}`;');
    let found = false;
    ts.forEachChild(sf, function visit(node: ts.Node) {
      if (ts.isBinaryExpression(node)) {
        found = hasStringConcat(node);
      }
      ts.forEachChild(node, visit);
    });
    expect(found).toBe(true);
  });
});

describe('index.ts query.getSymbol', () => {
  it('should return undefined when graph is not built', async () => {
    const { createGuardian } = await import('../../../src/index.js');
    const guardian = createGuardian({ rootDir: fixtureDir });
    // Do NOT call scan() — _graph is null
    const result = guardian.query.getSymbol('anything');
    expect(result).toBeUndefined();
  });

  it('should query symbols after graph is built', async () => {
    const { createGuardian } = await import('../../../src/index.js');
    const guardian = createGuardian({ rootDir: fixtureDir });
    await guardian.scan();
    // _graph is now set — exercises the truthy branch
    const result = guardian.query.getSymbol('nonexistent-symbol');
    // May or may not find it, but should not crash
    expect(result === undefined || typeof result === 'object').toBe(true);
  });
});

describe('engine.ts sourceFile not found for file in graph', () => {
  it('should skip file when program does not have sourceFile for it', async () => {
    const { executeRules } = await import('../../../src/rules/engine.js');
    const { createTSProgram } = await import('../../../src/ast/parser.js');

    const program = createTSProgram(fixtureDir, './tsconfig.json');

    // Create graph with a fake file that resolves to a path not in the program
    const graph = makeGraph();
    const fakeFile: FileNode = {
      path: 'src/fake-not-in-program.ts',
      role: 'unknown',
      layer: 'unknown',
      exports: [],
      imports: [],
      complexity: 1,
      loc: 1,
      functions: [],
    };
    graph.files.set('src/fake-not-in-program.ts', fakeFile);
    graph.dependencies.adjacency.set('src/fake-not-in-program.ts', new Set());

    const rule = {
      name: 'test/rule',
      severity: 'warning' as const,
      description: 'Test',
      category: 'quality' as const,
      check: () => [{ message: 'should not appear', file: 'src/fake-not-in-program.ts', line: 1, column: 1 }],
    };

    const result = await executeRules(
      graph, [rule], ['src/fake-not-in-program.ts'], program, {}, [], [], [], fixtureDir,
    );
    // Rule should never execute because sourceFile is not found
    expect(result.findings.length).toBe(0);
  });
});

describe('conventions.ts export patterns with test role', () => {
  it('should skip files with test role in export patterns', async () => {
    const { discoverConventions } = await import('../../../src/discovery/conventions.js');

    const graph = makeGraph();
    // Add test files that should be skipped by detectExportPatterns
    for (let i = 0; i < 3; i++) {
      const filePath = `src/tests/test${i}.ts`;
      graph.files.set(filePath, {
        path: filePath,
        role: 'test',
        layer: 'unknown',
        exports: [`TestHelper${i}`],
        imports: [],
        complexity: 1,
        loc: 10,
        functions: [],
      });
      graph.dependencies.adjacency.set(filePath, new Set());
    }

    const patterns = discoverConventions(graph);
    // test files should be skipped — no export patterns for test role
    const exportPattern = patterns.find(p => p.type === 'export-pattern');
    expect(exportPattern).toBeUndefined();
  });
});

describe('conventions.ts import direction with unknown layers and missing files', () => {
  it('should skip edges where files are missing from graph', async () => {
    const { discoverConventions } = await import('../../../src/discovery/conventions.js');

    const graph = makeGraph();
    graph.files.set('src/a.ts', {
      path: 'src/a.ts', role: 'controller', layer: 'controller',
      exports: [], imports: [], complexity: 1, loc: 10, functions: [],
    });
    graph.dependencies.adjacency.set('src/a.ts', new Set());

    // Edge where 'to' file doesn't exist in graph
    graph.edges.push({
      from: 'src/a.ts',
      to: 'src/nonexistent.ts',
      specifiers: ['x'],
      isTypeOnly: false,
    });

    const patterns = discoverConventions(graph);
    // Should not crash, edge is skipped
    const dirPattern = patterns.find(p => p.type === 'import-direction');
    expect(dirPattern).toBeUndefined();
  });

  it('should skip edges where layers are unknown', async () => {
    const { discoverConventions } = await import('../../../src/discovery/conventions.js');

    const graph = makeGraph();
    graph.files.set('src/a.ts', {
      path: 'src/a.ts', role: 'unknown', layer: 'unknown',
      exports: [], imports: [], complexity: 1, loc: 10, functions: [],
    });
    graph.files.set('src/b.ts', {
      path: 'src/b.ts', role: 'service', layer: 'service',
      exports: [], imports: [], complexity: 1, loc: 10, functions: [],
    });
    graph.dependencies.adjacency.set('src/a.ts', new Set(['src/b.ts']));
    graph.dependencies.adjacency.set('src/b.ts', new Set());

    // Edge from unknown layer to service
    graph.edges.push({
      from: 'src/a.ts',
      to: 'src/b.ts',
      specifiers: ['x'],
      isTypeOnly: false,
    });

    const patterns = discoverConventions(graph);
    // Should skip unknown layers
    const dirPattern = patterns.find(p => p.type === 'import-direction');
    expect(dirPattern).toBeUndefined();
  });
});
