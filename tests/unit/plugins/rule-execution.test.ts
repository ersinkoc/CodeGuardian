import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { parseFile } from '../../../src/ast/parser.js';
import { walkAST } from '../../../src/ast/walker.js';
import { hasStringConcat, extractImports } from '../../../src/ast/helpers.js';
import { createKernel } from '../../../src/kernel.js';
import { architecturePlugin } from '../../../src/plugins/core/architecture.js';
import { securityPlugin } from '../../../src/plugins/core/security.js';
import { performancePlugin } from '../../../src/plugins/core/performance.js';
import { qualityPlugin } from '../../../src/plugins/core/quality.js';
import { namingPlugin } from '../../../src/plugins/optional/naming.js';
import { apiPlugin } from '../../../src/plugins/optional/api.js';
import { testGuardPlugin } from '../../../src/plugins/optional/test-guard.js';
import { depAuditPlugin } from '../../../src/plugins/optional/dep-audit.js';
import type { CodebaseGraph, FileNode, FileRole, FunctionNode, RuleContext, Rule } from '../../../src/types.js';

// Also import from plugins/index.ts to cover re-exports
import {
  architecturePlugin as archFromIndex,
  securityPlugin as secFromIndex,
  performancePlugin as perfFromIndex,
  qualityPlugin as qualFromIndex,
  namingPlugin as namFromIndex,
  apiPlugin as apiFromIndex,
  testGuardPlugin as tgFromIndex,
  depAuditPlugin as daFromIndex,
} from '../../../src/plugins/index.js';

function createMockFile(overrides: Partial<FileNode> = {}): FileNode {
  return {
    path: overrides.path ?? 'test.ts',
    role: (overrides.role ?? 'unknown') as FileRole,
    layer: overrides.layer ?? 'unknown',
    exports: overrides.exports ?? [],
    imports: overrides.imports ?? [],
    complexity: overrides.complexity ?? 1,
    loc: overrides.loc ?? 10,
    functions: overrides.functions ?? [],
  };
}

function createMockGraph(file: FileNode, extras?: Partial<CodebaseGraph>): CodebaseGraph {
  const files = new Map<string, FileNode>([[file.path, file]]);
  if (extras?.files) {
    for (const [k, v] of extras.files) {
      files.set(k, v);
    }
  }
  return {
    files,
    symbols: extras?.symbols ?? new Map(),
    edges: extras?.edges ?? [],
    layers: extras?.layers ?? [],
    patterns: extras?.patterns ?? [],
    dependencies: extras?.dependencies ?? { adjacency: new Map([[file.path, new Set<string>()]]) },
  };
}

function createContext(code: string, fileOverrides: Partial<FileNode> = {}, graphOverrides?: Partial<CodebaseGraph>): RuleContext {
  const filePath = fileOverrides.path ?? 'test.ts';
  const ast = parseFile(filePath, code);

  const file = createMockFile({ ...fileOverrides, path: filePath });
  const graph = createMockGraph(file, graphOverrides);

  return {
    file,
    ast,
    graph,
    program: {} as ts.Program,
    checker: {} as ts.TypeChecker,
    walk: (node: ts.Node, visitors: Record<string, (node: ts.Node) => void>) => walkAST(node, visitors),
    isCallTo: () => false,
    isConsoleCall: () => false,
    getTypeString: () => 'unknown',
    hasStringConcat: (node: ts.Node) => hasStringConcat(node),
    getImports: () => extractImports(ast),
    isExternallyUsed: (name: string) => {
      const key = `${file.path}:${name}`;
      const sym = graph.symbols.get(key);
      return sym ? sym.usedBy.length > 0 : false;
    },
    config: {},
  };
}

function getPluginRules(installPlugin: () => void): Rule[] {
  const kernel = createKernel();
  installPlugin.call(null);
  return (kernel as any).__test_rules ?? [];
}

function installAndGetRules(pluginFn: Function, config?: any): Rule[] {
  const kernel = createKernel();
  const plugin = pluginFn(config);
  kernel.installPlugin(plugin);
  return kernel.getRules();
}

function findRule(rules: Rule[], name: string): Rule {
  const rule = rules.find((r) => r.name === name);
  if (!rule) throw new Error(`Rule "${name}" not found in [${rules.map(r => r.name).join(', ')}]`);
  return rule;
}

// ============================================================
// Plugins/index.ts re-export coverage
// ============================================================
describe('plugins/index.ts re-exports', () => {
  it('should re-export all core plugins', () => {
    expect(archFromIndex).toBe(architecturePlugin);
    expect(secFromIndex).toBe(securityPlugin);
    expect(perfFromIndex).toBe(performancePlugin);
    expect(qualFromIndex).toBe(qualityPlugin);
  });
  it('should re-export all optional plugins', () => {
    expect(namFromIndex).toBe(namingPlugin);
    expect(apiFromIndex).toBe(apiPlugin);
    expect(tgFromIndex).toBe(testGuardPlugin);
    expect(daFromIndex).toBe(depAuditPlugin);
  });
});

// ============================================================
// Architecture Plugin Rules
// ============================================================
describe('architecture plugin rule checks', () => {
  const rules = installAndGetRules(architecturePlugin, {
    enabled: true,
    layers: ['controller', 'service', 'repository', 'util'],
    enforceDirection: true,
    maxFileLines: 100,
    maxFunctionLines: 20,
    maxFunctionComplexity: 10,
  });

  describe('architecture/god-file', () => {
    it('should detect files exceeding max lines', () => {
      const rule = findRule(rules, 'architecture/god-file');
      const ctx = createContext('const x = 1;', { loc: 200 });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.message).toContain('200 lines');
    });

    it('should pass files within limit', () => {
      const rule = findRule(rules, 'architecture/god-file');
      const ctx = createContext('const x = 1;', { loc: 50 });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('architecture/god-function', () => {
    it('should detect functions exceeding max lines', () => {
      const rule = findRule(rules, 'architecture/god-function');
      const fn: FunctionNode = {
        name: 'bigFn', file: 'test.ts', startLine: 1, endLine: 50,
        params: [], returnType: 'void', complexity: 1, isAsync: false, hasSideEffects: false, issues: [],
      };
      const ctx = createContext('function bigFn() {}', { functions: [fn] });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.message).toContain('bigFn');
    });

    it('should pass functions within limit', () => {
      const rule = findRule(rules, 'architecture/god-function');
      const fn: FunctionNode = {
        name: 'smallFn', file: 'test.ts', startLine: 1, endLine: 10,
        params: [], returnType: 'void', complexity: 1, isAsync: false, hasSideEffects: false, issues: [],
      };
      const ctx = createContext('function smallFn() {}', { functions: [fn] });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('architecture/barrel-explosion', () => {
    it('should detect barrel files with too many exports', () => {
      const rule = findRule(rules, 'architecture/barrel-explosion');
      const exports = Array.from({ length: 15 }, (_, i) => `export${i}`);
      const ctx = createContext('export const a = 1;', { path: 'src/index.ts', exports });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.message).toContain('15 symbols');
    });

    it('should pass non-barrel files', () => {
      const rule = findRule(rules, 'architecture/barrel-explosion');
      const ctx = createContext('export const a = 1;', { path: 'src/service.ts', exports: Array(15).fill('x') });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });

    it('should pass barrel files with few exports', () => {
      const rule = findRule(rules, 'architecture/barrel-explosion');
      const ctx = createContext('export const a = 1;', { path: 'src/index.ts', exports: ['a', 'b'] });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('architecture/circular-dependency', () => {
    it('should detect circular dependencies', () => {
      const rule = findRule(rules, 'architecture/circular-dependency');
      const file = createMockFile({ path: 'a.ts' });
      const fileB = createMockFile({ path: 'b.ts' });
      const adj = new Map<string, Set<string>>();
      adj.set('a.ts', new Set(['b.ts']));
      adj.set('b.ts', new Set(['a.ts']));
      const graph = createMockGraph(file, {
        files: new Map([['a.ts', file], ['b.ts', fileB]]),
        dependencies: { adjacency: adj },
      });
      const ctx = createContext('const x = 1;', { path: 'a.ts' }, { ...graph });
      ctx.graph = graph;
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('Circular dependency');
    });

    it('should pass acyclic graph', () => {
      const rule = findRule(rules, 'architecture/circular-dependency');
      const ctx = createContext('const x = 1;');
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('architecture/layer-violation', () => {
    it('should return empty when enforceDirection is disabled', () => {
      const localRules = installAndGetRules(architecturePlugin, { enforceDirection: false });
      const rule = findRule(localRules, 'architecture/layer-violation');
      const ctx = createContext('import { x } from "./service"', {
        path: 'src/services/a.ts',
        layer: 'service',
        imports: [{ source: './repo', specifiers: ['x'], isTypeOnly: false }],
      });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });

    it('should return empty when file layer is not in layers list', () => {
      const rule = findRule(rules, 'architecture/layer-violation');
      const ctx = createContext('const x = 1;', { layer: 'unknown', imports: [] });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('architecture/file-role-mismatch', () => {
    it('should detect service directory with non-service role', () => {
      const rule = findRule(rules, 'architecture/file-role-mismatch');
      const ctx = createContext('const x = 1;', {
        path: 'src/service/helper.ts',
        role: 'util' as FileRole,
      });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.message).toContain('services directory');
    });

    it('should detect controller directory with non-controller role', () => {
      const rule = findRule(rules, 'architecture/file-role-mismatch');
      const ctx = createContext('const x = 1;', {
        path: 'src/controller/helper.ts',
        role: 'util' as FileRole,
      });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.message).toContain('controllers directory');
    });

    it('should pass when role matches directory', () => {
      const rule = findRule(rules, 'architecture/file-role-mismatch');
      const ctx = createContext('const x = 1;', {
        path: 'src/service/user.ts',
        role: 'service' as FileRole,
      });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });
});

// ============================================================
// Security Plugin Rules
// ============================================================
describe('security plugin rule checks', () => {
  const rules = installAndGetRules(securityPlugin, {
    enabled: true,
    checkInjection: true,
    checkAuth: true,
    checkSecrets: true,
    checkXSS: true,
    checkCSRF: true,
  });

  describe('security/sql-injection', () => {
    it('should detect template literal in db.query', () => {
      const rule = findRule(rules, 'security/sql-injection');
      const code = 'const result = db.query(`SELECT * FROM users WHERE id = ${userId}`);';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('SQL injection');
    });

    it('should pass parameterized queries', () => {
      const rule = findRule(rules, 'security/sql-injection');
      const code = 'const result = db.query("SELECT * FROM users WHERE id = ?", [userId]);';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });

    it('should return empty when checkInjection is disabled', () => {
      const localRules = installAndGetRules(securityPlugin, { checkInjection: false });
      const rule = findRule(localRules, 'security/sql-injection');
      const code = 'db.query(`SELECT * FROM ${table}`);';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('security/hardcoded-secret', () => {
    it('should detect hardcoded API keys', () => {
      const rule = findRule(rules, 'security/hardcoded-secret');
      const code = 'const apiKey = "secret_test_abcdefghijklmnop";';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('hardcoded secret');
    });

    it('should detect JWT tokens', () => {
      const rule = findRule(rules, 'security/hardcoded-secret');
      const code = 'const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0";';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
    });

    it('should detect connection strings', () => {
      const rule = findRule(rules, 'security/hardcoded-secret');
      const code = 'const url = "mongodb://user:pass@host:27017/db";';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
    });

    it('should skip test files', () => {
      const rule = findRule(rules, 'security/hardcoded-secret');
      const code = 'const key = "secret_test_abcdefghijklmnop";';
      const ctx = createContext(code, { role: 'test' as FileRole });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });

    it('should skip short strings', () => {
      const rule = findRule(rules, 'security/hardcoded-secret');
      const code = 'const x = "short";';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });

    it('should return empty when checkSecrets is disabled', () => {
      const localRules = installAndGetRules(securityPlugin, { checkSecrets: false });
      const rule = findRule(localRules, 'security/hardcoded-secret');
      const code = 'const key = "secret_test_abcdefghijklmnop";';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('security/eval-usage', () => {
    it('should detect eval()', () => {
      const rule = findRule(rules, 'security/eval-usage');
      const code = 'const result = eval("1 + 2");';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('eval()');
    });

    it('should detect Function()', () => {
      const rule = findRule(rules, 'security/eval-usage');
      const code = 'const fn = Function("return 1");';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
    });

    it('should detect new Function()', () => {
      const rule = findRule(rules, 'security/eval-usage');
      const code = 'const fn = new Function("return 1");';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('new Function()');
    });

    it('should detect setTimeout with string', () => {
      const rule = findRule(rules, 'security/eval-usage');
      const code = 'setTimeout("alert(1)", 100);';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('setTimeout()');
    });

    it('should pass setTimeout with function', () => {
      const rule = findRule(rules, 'security/eval-usage');
      const code = 'setTimeout(() => console.log(1), 100);';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('security/prototype-pollution', () => {
    it('should detect __proto__ assignment', () => {
      const rule = findRule(rules, 'security/prototype-pollution');
      const code = 'obj.__proto__ = malicious;';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('prototype pollution');
    });

    it('should pass property access without assignment', () => {
      const rule = findRule(rules, 'security/prototype-pollution');
      const code = 'const proto = obj.__proto__;';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('security/xss-risk', () => {
    it('should detect innerHTML', () => {
      const rule = findRule(rules, 'security/xss-risk');
      const code = 'element.innerHTML = userInput;';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('innerHTML');
    });

    it('should detect document.write', () => {
      const rule = findRule(rules, 'security/xss-risk');
      const code = 'document.write(content);';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('document.write()');
    });

    it('should return empty when checkXSS is disabled', () => {
      const localRules = installAndGetRules(securityPlugin, { checkXSS: false });
      const rule = findRule(localRules, 'security/xss-risk');
      const code = 'element.innerHTML = userInput;';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('security/missing-auth-check', () => {
    it('should detect controller without auth references', () => {
      const rule = findRule(rules, 'security/missing-auth-check');
      const code = 'export function getUsers(req: any, res: any) { res.json([]); }';
      const fn: FunctionNode = {
        name: 'getUsers', file: 'controller.ts', startLine: 1, endLine: 1,
        params: [], returnType: 'void', complexity: 1, isAsync: false, hasSideEffects: false, issues: [],
      };
      const ctx = createContext(code, { path: 'src/controllers/user.controller.ts', role: 'controller' as FileRole, functions: [fn] });
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('authentication');
    });

    it('should pass controller with auth references', () => {
      const rule = findRule(rules, 'security/missing-auth-check');
      const code = 'import { authenticate } from "./auth";\nexport function getUsers(req: any, res: any) { authenticate(req); }';
      const fn: FunctionNode = {
        name: 'getUsers', file: 'controller.ts', startLine: 2, endLine: 2,
        params: [], returnType: 'void', complexity: 1, isAsync: false, hasSideEffects: false, issues: [],
      };
      const ctx = createContext(code, { path: 'src/controllers/user.controller.ts', role: 'controller' as FileRole, functions: [fn] });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });

    it('should skip non-controller files', () => {
      const rule = findRule(rules, 'security/missing-auth-check');
      const ctx = createContext('export function foo() {}', { role: 'service' as FileRole });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });

    it('should return empty when checkAuth is disabled', () => {
      const localRules = installAndGetRules(securityPlugin, { checkAuth: false });
      const rule = findRule(localRules, 'security/missing-auth-check');
      const ctx = createContext('export function foo() {}', { role: 'controller' as FileRole });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('security/insecure-random', () => {
    it('should detect Math.random in security context', () => {
      const rule = findRule(rules, 'security/insecure-random');
      const code = 'const token = "token_" + Math.random().toString(36);';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('Math.random()');
    });

    it('should pass Math.random in non-security context', () => {
      const rule = findRule(rules, 'security/insecure-random');
      const code = 'const color = Math.random() * 255;';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('security/path-traversal', () => {
    it('should detect template literal in readFile', () => {
      const rule = findRule(rules, 'security/path-traversal');
      const code = 'const data = readFileSync(`uploads/${userPath}`);';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('path traversal');
    });

    it('should detect template in fs.writeFile', () => {
      const rule = findRule(rules, 'security/path-traversal');
      const code = 'fs.writeFileSync(`path/${name}`, data);';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
    });

    it('should pass static file paths', () => {
      const rule = findRule(rules, 'security/path-traversal');
      const code = 'const data = readFileSync("config.json");';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });
});

// ============================================================
// Performance Plugin Rules
// ============================================================
describe('performance plugin rule checks', () => {
  const rules = installAndGetRules(performancePlugin, {
    enabled: true,
    checkN1Queries: true,
    checkMemoryLeaks: true,
    checkAsyncPatterns: true,
    checkBundleSize: true,
  });

  describe('performance/n1-query', () => {
    it('should detect db call inside for loop', () => {
      const rule = findRule(rules, 'performance/n1-query');
      const code = `
for (const item of items) {
  const result = db.find(item.id);
}`;
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('N+1');
    });

    it('should detect db call inside forEach', () => {
      const rule = findRule(rules, 'performance/n1-query');
      const code = `items.forEach((item) => { db.findOne(item.id); });`;
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
    });

    it('should detect db call inside map', () => {
      const rule = findRule(rules, 'performance/n1-query');
      const code = `items.map((item) => { return db.query(item.id); });`;
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
    });

    it('should pass batched queries', () => {
      const rule = findRule(rules, 'performance/n1-query');
      const code = `const results = db.find({ id: { $in: ids } });`;
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });

    it('should return empty when checkN1Queries is disabled', () => {
      const localRules = installAndGetRules(performancePlugin, { checkN1Queries: false });
      const rule = findRule(localRules, 'performance/n1-query');
      const code = 'for (const item of items) { db.find(item); }';
      const ctx = createContext(code);
      expect(rule.check(ctx).length).toBe(0);
    });
  });

  describe('performance/sync-in-async', () => {
    it('should detect readFileSync in async function', () => {
      const rule = findRule(rules, 'performance/sync-in-async');
      const code = `async function loadData() {
  const data = readFileSync("file.txt");
  return data;
}`;
      const fn: FunctionNode = {
        name: 'loadData', file: 'test.ts', startLine: 1, endLine: 4,
        params: [], returnType: 'string', complexity: 1, isAsync: true, hasSideEffects: false, issues: [],
      };
      const ctx = createContext(code, { functions: [fn] });
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('readFileSync');
    });

    it('should skip non-async functions', () => {
      const rule = findRule(rules, 'performance/sync-in-async');
      const fn: FunctionNode = {
        name: 'loadData', file: 'test.ts', startLine: 1, endLine: 3,
        params: [], returnType: 'string', complexity: 1, isAsync: false, hasSideEffects: false, issues: [],
      };
      const ctx = createContext('function loadData() { readFileSync("f"); }', { functions: [fn] });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });

    it('should return empty when checkAsyncPatterns is disabled', () => {
      const localRules = installAndGetRules(performancePlugin, { checkAsyncPatterns: false });
      const rule = findRule(localRules, 'performance/sync-in-async');
      const fn: FunctionNode = {
        name: 'f', file: 'test.ts', startLine: 1, endLine: 3,
        params: [], returnType: 'void', complexity: 1, isAsync: true, hasSideEffects: false, issues: [],
      };
      const ctx = createContext('async function f() { readFileSync("x"); }', { functions: [fn] });
      expect(rule.check(ctx).length).toBe(0);
    });
  });

  describe('performance/memory-leak-risk', () => {
    it('should detect addEventListener without removeEventListener', () => {
      const rule = findRule(rules, 'performance/memory-leak-risk');
      const code = 'window.addEventListener("click", handler);';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('addEventListener');
    });

    it('should detect setInterval without clearInterval', () => {
      const rule = findRule(rules, 'performance/memory-leak-risk');
      const code = 'const id = setInterval(() => tick(), 1000);';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('setInterval');
    });

    it('should pass when cleanup functions exist', () => {
      const rule = findRule(rules, 'performance/memory-leak-risk');
      const code = 'el.addEventListener("click", h);\nel.removeEventListener("click", h);';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });

    it('should return empty when checkMemoryLeaks is disabled', () => {
      const localRules = installAndGetRules(performancePlugin, { checkMemoryLeaks: false });
      const rule = findRule(localRules, 'performance/memory-leak-risk');
      const ctx = createContext('window.addEventListener("click", h);');
      expect(rule.check(ctx).length).toBe(0);
    });
  });

  describe('performance/unbounded-query', () => {
    it('should detect findAll without limit', () => {
      const rule = findRule(rules, 'performance/unbounded-query');
      const code = 'const users = db.findAll({});';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('without limit');
    });

    it('should pass findAll with limit', () => {
      const rule = findRule(rules, 'performance/unbounded-query');
      const code = 'const users = db.findAll({ limit: 100 });';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('performance/missing-index-hint', () => {
    it('should always return empty', () => {
      const rule = findRule(rules, 'performance/missing-index-hint');
      const ctx = createContext('const x = 1;');
      expect(rule.check(ctx)).toHaveLength(0);
    });
  });

  describe('performance/heavy-import', () => {
    it('should detect lodash import when checkBundleSize is true', () => {
      const rule = findRule(rules, 'performance/heavy-import');
      const ctx = createContext('import { get } from "lodash";', {
        imports: [{ source: 'lodash', specifiers: ['get'], isTypeOnly: false }],
      });
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('lodash');
    });

    it('should return empty when checkBundleSize is false', () => {
      const localRules = installAndGetRules(performancePlugin, { checkBundleSize: false });
      const rule = findRule(localRules, 'performance/heavy-import');
      const ctx = createContext('import { get } from "lodash";', {
        imports: [{ source: 'lodash', specifiers: ['get'], isTypeOnly: false }],
      });
      expect(rule.check(ctx).length).toBe(0);
    });
  });

  describe('performance/blocking-operation', () => {
    it('should detect JSON.parse in controller', () => {
      const rule = findRule(rules, 'performance/blocking-operation');
      const code = 'const data = JSON.parse(body);';
      const ctx = createContext(code, {
        path: 'src/controllers/user.controller.ts',
        role: 'controller' as FileRole,
      });
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('JSON.parse()');
    });

    it('should skip non-controller files', () => {
      const rule = findRule(rules, 'performance/blocking-operation');
      const code = 'const data = JSON.parse(body);';
      const ctx = createContext(code, { role: 'service' as FileRole });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });
});

// ============================================================
// Quality Plugin Rules
// ============================================================
describe('quality plugin rule checks', () => {
  const rules = installAndGetRules(qualityPlugin, {
    enabled: true,
    checkDeadCode: true,
    checkNaming: true,
    checkComplexity: true,
    maxCyclomaticComplexity: 5,
  });

  describe('quality/cyclomatic-complexity', () => {
    it('should detect high complexity', () => {
      const rule = findRule(rules, 'quality/cyclomatic-complexity');
      const fn: FunctionNode = {
        name: 'complexFn', file: 'test.ts', startLine: 1, endLine: 50,
        params: [], returnType: 'void', complexity: 20, isAsync: false, hasSideEffects: false, issues: [],
      };
      const ctx = createContext('function complexFn() {}', { functions: [fn] });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.message).toContain('complexFn');
      expect(findings[0]!.message).toContain('20');
    });

    it('should pass simple functions', () => {
      const rule = findRule(rules, 'quality/cyclomatic-complexity');
      const fn: FunctionNode = {
        name: 'simple', file: 'test.ts', startLine: 1, endLine: 5,
        params: [], returnType: 'void', complexity: 2, isAsync: false, hasSideEffects: false, issues: [],
      };
      const ctx = createContext('function simple() {}', { functions: [fn] });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });

    it('should return empty when checkComplexity disabled', () => {
      const localRules = installAndGetRules(qualityPlugin, { checkComplexity: false });
      const rule = findRule(localRules, 'quality/cyclomatic-complexity');
      const fn: FunctionNode = {
        name: 'fn', file: 'test.ts', startLine: 1, endLine: 5,
        params: [], returnType: 'void', complexity: 999, isAsync: false, hasSideEffects: false, issues: [],
      };
      const ctx = createContext('function fn() {}', { functions: [fn] });
      expect(rule.check(ctx).length).toBe(0);
    });
  });

  describe('quality/dead-code', () => {
    it('should detect unused exports', () => {
      const rule = findRule(rules, 'quality/dead-code');
      const file = createMockFile({
        path: 'src/utils.ts',
        role: 'util' as FileRole,
        exports: ['unusedFn'],
      });
      const graph = createMockGraph(file, {
        symbols: new Map([
          ['src/utils.ts:unusedFn', { name: 'unusedFn', kind: 'function', file: 'src/utils.ts', usedBy: [], dependsOn: [], isPublicAPI: false }],
        ]),
      });
      const ctx = createContext('export function unusedFn() {}', { ...file }, { ...graph });
      ctx.graph = graph;
      const findings = rule.check(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.message).toContain('unusedFn');
    });

    it('should skip default exports', () => {
      const rule = findRule(rules, 'quality/dead-code');
      const ctx = createContext('export default function() {}', { exports: ['default'] });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });

    it('should skip test files', () => {
      const rule = findRule(rules, 'quality/dead-code');
      const ctx = createContext('export const x = 1;', { role: 'test' as FileRole, exports: ['x'] });
      expect(rule.check(ctx).length).toBe(0);
    });

    it('should skip index.ts files', () => {
      const rule = findRule(rules, 'quality/dead-code');
      const ctx = createContext('export const x = 1;', { path: 'src/index.ts', exports: ['x'] });
      expect(rule.check(ctx).length).toBe(0);
    });

    it('should return empty when checkDeadCode disabled', () => {
      const localRules = installAndGetRules(qualityPlugin, { checkDeadCode: false });
      const rule = findRule(localRules, 'quality/dead-code');
      const ctx = createContext('export const x = 1;', { exports: ['x'] });
      expect(rule.check(ctx).length).toBe(0);
    });
  });

  describe('quality/any-type', () => {
    it('should detect any type annotation', () => {
      const rule = findRule(rules, 'quality/any-type');
      const code = 'let x: any = 1;';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('any');
    });

    it('should pass specific types', () => {
      const rule = findRule(rules, 'quality/any-type');
      const code = 'let x: string = "hello";';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('quality/no-error-handling', () => {
    it('should detect async function without error handling', () => {
      const rule = findRule(rules, 'quality/no-error-handling');
      const code = `async function fetchData() {
  const res = await fetch("/api");
  return res.json();
}`;
      const fn: FunctionNode = {
        name: 'fetchData', file: 'test.ts', startLine: 1, endLine: 4,
        params: [], returnType: 'Promise', complexity: 1, isAsync: true, hasSideEffects: false, issues: [],
      };
      const ctx = createContext(code, { functions: [fn] });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.message).toContain('fetchData');
    });

    it('should pass async function with try-catch', () => {
      const rule = findRule(rules, 'quality/no-error-handling');
      const code = `async function fetchData() {
  try { const res = await fetch("/api"); return res.json(); }
  catch (e) { throw e; }
}`;
      const fn: FunctionNode = {
        name: 'fetchData', file: 'test.ts', startLine: 1, endLine: 4,
        params: [], returnType: 'Promise', complexity: 1, isAsync: true, hasSideEffects: false, issues: [],
      };
      const ctx = createContext(code, { functions: [fn] });
      expect(rule.check(ctx).length).toBe(0);
    });

    it('should pass non-async functions', () => {
      const rule = findRule(rules, 'quality/no-error-handling');
      const fn: FunctionNode = {
        name: 'sync', file: 'test.ts', startLine: 1, endLine: 3,
        params: [], returnType: 'void', complexity: 1, isAsync: false, hasSideEffects: false, issues: [],
      };
      const ctx = createContext('function sync() { return 1; }', { functions: [fn] });
      expect(rule.check(ctx).length).toBe(0);
    });
  });

  describe('quality/inconsistent-naming', () => {
    it('should detect PascalCase function names in non-unknown role', () => {
      const rule = findRule(rules, 'quality/inconsistent-naming');
      const fn: FunctionNode = {
        name: 'GetUser', file: 'test.ts', startLine: 1, endLine: 3,
        params: [], returnType: 'void', complexity: 1, isAsync: false, hasSideEffects: false, issues: [],
      };
      const ctx = createContext('function GetUser() {}', { role: 'service' as FileRole, functions: [fn] });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.message).toContain('GetUser');
    });

    it('should pass camelCase function names', () => {
      const rule = findRule(rules, 'quality/inconsistent-naming');
      const fn: FunctionNode = {
        name: 'getUser', file: 'test.ts', startLine: 1, endLine: 3,
        params: [], returnType: 'void', complexity: 1, isAsync: false, hasSideEffects: false, issues: [],
      };
      const ctx = createContext('function getUser() {}', { role: 'service' as FileRole, functions: [fn] });
      expect(rule.check(ctx).length).toBe(0);
    });

    it('should return empty when checkNaming disabled', () => {
      const localRules = installAndGetRules(qualityPlugin, { checkNaming: false });
      const rule = findRule(localRules, 'quality/inconsistent-naming');
      const fn: FunctionNode = {
        name: 'GetUser', file: 'test.ts', startLine: 1, endLine: 3,
        params: [], returnType: 'void', complexity: 1, isAsync: false, hasSideEffects: false, issues: [],
      };
      const ctx = createContext('function GetUser() {}', { role: 'service' as FileRole, functions: [fn] });
      expect(rule.check(ctx).length).toBe(0);
    });
  });

  describe('quality/magic-number', () => {
    it('should detect magic numbers in conditions', () => {
      const rule = findRule(rules, 'quality/magic-number');
      const code = 'if (x > 42) { doSomething(); }';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('42');
    });

    it('should pass allowed numbers', () => {
      const rule = findRule(rules, 'quality/magic-number');
      const code = 'if (x > 0) { doSomething(); }';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });

    it('should skip numbers in const declarations', () => {
      const rule = findRule(rules, 'quality/magic-number');
      const code = 'const MAX_SIZE = 42;';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('quality/empty-catch', () => {
    it('should detect empty catch blocks', () => {
      const rule = findRule(rules, 'quality/empty-catch');
      const code = 'try { doSomething(); } catch (e) {}';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.message).toContain('Empty catch');
    });

    it('should pass catch blocks with handling', () => {
      const rule = findRule(rules, 'quality/empty-catch');
      const code = 'try { doSomething(); } catch (e) { console.error(e); }';
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('quality/nested-callbacks', () => {
    it('should detect deeply nested callbacks', () => {
      const rule = findRule(rules, 'quality/nested-callbacks');
      const code = `
a(() => {
  b(() => {
    c(() => {
      d(() => {
        e(() => {
          f();
        });
      });
    });
  });
});`;
      const ctx = createContext(code);
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('nested');
    });

    it('should pass shallow callbacks', () => {
      const rule = findRule(rules, 'quality/nested-callbacks');
      const code = 'a(() => { b(); });';
      const ctx = createContext(code);
      expect(rule.check(ctx).length).toBe(0);
    });
  });
});

// ============================================================
// Optional Plugin Rules
// ============================================================
describe('optional plugin rule checks', () => {
  describe('naming-convention/file-naming', () => {
    it('should detect misnamed service files', () => {
      const localRules = installAndGetRules(namingPlugin);
      const rule = findRule(localRules, 'naming-convention/file-naming');
      const ctx = createContext('export class UserHelper {}', {
        path: 'src/services/helper.ts',
      });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.message).toContain('*.service.ts');
    });

    it('should detect misnamed controller files', () => {
      const localRules = installAndGetRules(namingPlugin);
      const rule = findRule(localRules, 'naming-convention/file-naming');
      const ctx = createContext('export class UserHelper {}', {
        path: 'src/controllers/helper.ts',
      });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.message).toContain('*.controller.ts');
    });

    it('should detect misnamed repository files', () => {
      const localRules = installAndGetRules(namingPlugin);
      const rule = findRule(localRules, 'naming-convention/file-naming');
      const ctx = createContext('export class UserHelper {}', {
        path: 'src/repositories/helper.ts',
      });
      const findings = rule.check(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.message).toContain('*.repository.ts');
    });

    it('should pass correctly named service files', () => {
      const localRules = installAndGetRules(namingPlugin);
      const rule = findRule(localRules, 'naming-convention/file-naming');
      const ctx = createContext('export class User {}', {
        path: 'src/services/user.service.ts',
      });
      expect(rule.check(ctx).length).toBe(0);
    });

    it('should pass test files in service directories', () => {
      const localRules = installAndGetRules(namingPlugin);
      const rule = findRule(localRules, 'naming-convention/file-naming');
      const ctx = createContext('describe("test", () => {});', {
        path: 'src/services/user.test.ts',
      });
      expect(rule.check(ctx).length).toBe(0);
    });
  });

  describe('api-consistency/endpoint-naming', () => {
    it('should detect camelCase in API endpoints', () => {
      const localRules = installAndGetRules(apiPlugin);
      const rule = findRule(localRules, 'api-consistency/endpoint-naming');
      const code = 'const route = "/userProfiles";';
      const ctx = createContext(code, {
        path: 'src/controllers/user.controller.ts',
        role: 'controller' as FileRole,
      });
      const findings = rule.check(ctx);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.message).toContain('camelCase');
    });

    it('should pass kebab-case endpoints', () => {
      const localRules = installAndGetRules(apiPlugin);
      const rule = findRule(localRules, 'api-consistency/endpoint-naming');
      const code = 'const route = "/user-profiles";';
      const ctx = createContext(code, {
        path: 'src/controllers/user.controller.ts',
        role: 'controller' as FileRole,
      });
      expect(rule.check(ctx).length).toBe(0);
    });

    it('should skip non-controller files', () => {
      const localRules = installAndGetRules(apiPlugin);
      const rule = findRule(localRules, 'api-consistency/endpoint-naming');
      const code = 'const route = "/userProfiles";';
      const ctx = createContext(code, { role: 'service' as FileRole });
      expect(rule.check(ctx).length).toBe(0);
    });
  });

  describe('test-coverage-guard/missing-tests', () => {
    it('should detect files without test files', () => {
      const localRules = installAndGetRules(testGuardPlugin);
      const rule = findRule(localRules, 'test-coverage-guard/missing-tests');
      const file = createMockFile({
        path: 'src/services/user.ts',
        role: 'service' as FileRole,
      });
      const graph = createMockGraph(file);
      const ctx = createContext('export class UserService {}', { ...file }, { ...graph });
      ctx.graph = graph;
      const findings = rule.check(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.message).toContain('No test file');
    });

    it('should pass files with test files', () => {
      const localRules = installAndGetRules(testGuardPlugin);
      const rule = findRule(localRules, 'test-coverage-guard/missing-tests');
      const file = createMockFile({ path: 'src/services/user.ts', role: 'service' as FileRole });
      const testFile = createMockFile({ path: 'src/services/user.test.ts', role: 'test' as FileRole });
      const graph = createMockGraph(file, {
        files: new Map([['src/services/user.ts', file], ['src/services/user.test.ts', testFile]]),
      });
      const ctx = createContext('export class UserService {}', { ...file }, { ...graph });
      ctx.graph = graph;
      expect(rule.check(ctx).length).toBe(0);
    });

    it('should skip test files', () => {
      const localRules = installAndGetRules(testGuardPlugin);
      const rule = findRule(localRules, 'test-coverage-guard/missing-tests');
      const ctx = createContext('describe("test", () => {});', { role: 'test' as FileRole });
      expect(rule.check(ctx).length).toBe(0);
    });

    it('should skip type files', () => {
      const localRules = installAndGetRules(testGuardPlugin);
      const rule = findRule(localRules, 'test-coverage-guard/missing-tests');
      const ctx = createContext('export type User = {};', { role: 'type' as FileRole });
      expect(rule.check(ctx).length).toBe(0);
    });

    it('should skip config files', () => {
      const localRules = installAndGetRules(testGuardPlugin);
      const rule = findRule(localRules, 'test-coverage-guard/missing-tests');
      const ctx = createContext('export const config = {};', { role: 'config' as FileRole });
      expect(rule.check(ctx).length).toBe(0);
    });
  });

  describe('dependency-audit/deep-imports', () => {
    it('should detect deep import chains', () => {
      const localRules = installAndGetRules(depAuditPlugin, { maxDepth: 2 });
      const rule = findRule(localRules, 'dependency-audit/deep-imports');

      const adj = new Map<string, Set<string>>();
      adj.set('a.ts', new Set(['b.ts']));
      adj.set('b.ts', new Set(['c.ts']));
      adj.set('c.ts', new Set(['d.ts']));
      adj.set('d.ts', new Set());

      const file = createMockFile({ path: 'a.ts' });
      const graph = createMockGraph(file, {
        files: new Map([
          ['a.ts', file],
          ['b.ts', createMockFile({ path: 'b.ts' })],
          ['c.ts', createMockFile({ path: 'c.ts' })],
          ['d.ts', createMockFile({ path: 'd.ts' })],
        ]),
        dependencies: { adjacency: adj },
      });

      const ctx = createContext('import { b } from "./b";', { path: 'a.ts' }, { ...graph });
      ctx.graph = graph;
      const findings = rule.check(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.message).toContain('import depth');
    });

    it('should pass shallow imports', () => {
      const localRules = installAndGetRules(depAuditPlugin, { maxDepth: 5 });
      const rule = findRule(localRules, 'dependency-audit/deep-imports');

      const adj = new Map<string, Set<string>>();
      adj.set('a.ts', new Set(['b.ts']));
      adj.set('b.ts', new Set());

      const file = createMockFile({ path: 'a.ts' });
      const graph = createMockGraph(file, {
        files: new Map([
          ['a.ts', file],
          ['b.ts', createMockFile({ path: 'b.ts' })],
        ]),
        dependencies: { adjacency: adj },
      });

      const ctx = createContext('import { b } from "./b";', { path: 'a.ts' }, { ...graph });
      ctx.graph = graph;
      expect(rule.check(ctx).length).toBe(0);
    });
  });
});
