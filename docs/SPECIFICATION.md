# @oxog/codeguardian — Package Specification

## 1. Overview

**Name:** `@oxog/codeguardian`
**Version:** 1.0.0
**License:** MIT
**Author:** Ersin Koç (ersinkoc)
**Repository:** https://github.com/ersinkoc/codeguardian
**Documentation:** https://codeguardian.oxog.dev

**One-line:** Zero-dependency TypeScript codebase guardian that enforces architecture, security, performance, and quality rules as a pre-commit hook.

**Description:** @oxog/codeguardian is a continuous architectural guardian for TypeScript projects. It builds a knowledge graph of your codebase and evaluates every change against that graph. Unlike traditional linters that check syntax, codeguardian understands your project's architectural patterns, enforces them as rules, detects security anti-patterns, catches performance pitfalls, and blocks or warns based on severity — all running as a git pre-commit hook with zero external dependencies.

---

## 2. Technical Requirements

| Requirement | Value |
|---|---|
| Runtime | Node.js >= 18 |
| Module Format | ESM + CJS (dual) |
| TypeScript | >= 5.0 (peer dependency) |
| Runtime Dependencies | **NONE** (zero) |
| Bundle Size (core) | < 5KB gzipped |
| Bundle Size (all plugins) | < 15KB gzipped |

### Dependency Rules

- `dependencies`: **MUST BE EMPTY** — no exceptions
- `peerDependencies`: `typescript >= 5.0.0` only
- `devDependencies`: typescript, vitest, @vitest/coverage-v8, tsup, @types/node, prettier, eslint

---

## 3. Architecture: Micro-Kernel

### Layer Diagram

```
┌───────────────────────────────────────────────┐
│                  User Code / CLI              │
├───────────────────────────────────────────────┤
│              Plugin Registry API              │
│       use() · register() · unregister()       │
├───────────┬───────────┬───────────┬───────────┤
│ Arch.     │ Security  │ Perf.     │ Quality   │
│ Plugin    │ Plugin    │ Plugin    │ Plugin    │
├───────────┴───────────┴───────────┴───────────┤
│               Micro Kernel                    │
│  Graph · Rule Engine · Reporter · Git Hooks   │
└───────────────────────────────────────────────┘
```

### Kernel Responsibilities (minimal)
1. Codebase knowledge graph construction & incremental updates
2. Plugin registration and lifecycle management
3. Rule engine (evaluate, collect, severity filter)
4. Reporter (format findings to terminal/JSON/SARIF)
5. Git hook integration (pre-commit install/uninstall)
6. Configuration management (.codeguardian.json)

---

## 4. Codebase Knowledge Graph

The knowledge graph is the heart of codeguardian. It models the entire codebase as a queryable data structure.

### Core Types

```typescript
interface CodebaseGraph {
  files: Map<string, FileNode>;
  symbols: Map<string, SymbolNode>;
  edges: ImportEdge[];
  layers: LayerDefinition[];
  patterns: DetectedPattern[];
  dependencies: DependencyGraph;
}

interface FileNode {
  path: string;
  role: FileRole;            // controller, service, repository, util, type, config, test
  layer: string;
  exports: string[];
  imports: ImportInfo[];
  complexity: number;
  loc: number;
  functions: FunctionNode[];
}

interface SymbolNode {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'enum';
  file: string;
  usedBy: string[];
  dependsOn: string[];
  isPublicAPI: boolean;
}

interface FunctionNode {
  name: string;
  file: string;
  startLine: number;
  endLine: number;
  params: ParamInfo[];
  returnType: string;
  complexity: number;
  isAsync: boolean;
  hasSideEffects: boolean;
  issues: Issue[];
}
```

### Graph Cache

```
.codeguardian/
├── graph.json     # Serialized knowledge graph
├── config.json    # Detected project conventions
└── history.json   # Severity trend over time
```

- First run: full scan, serialize to `.codeguardian/graph.json`
- Subsequent runs: load cache, parse only changed files (from `git diff --cached`), incrementally update

### Incremental Analysis Flow

```
git diff --cached → Changed files → Parse changed (TS AST) → Update graph →
Run rules (changed + dependents) → Collect findings → Filter by severity →
Report → Exit code (0 or 1)
```

---

## 5. Plugin System

### Plugin Interface

```typescript
interface GuardianPlugin<TConfig = unknown> {
  name: string;
  version: string;
  dependencies?: string[];
  install: (kernel: GuardianKernel<TConfig>) => void;
  onInit?: (graph: CodebaseGraph) => void | Promise<void>;
  onDestroy?: () => void | Promise<void>;
  onError?: (error: Error) => void;
}
```

### Rule Interface

```typescript
interface Rule {
  name: string;                    // 'plugin/rule-name'
  severity: Severity;
  description: string;
  category: 'architecture' | 'security' | 'performance' | 'quality';
  check: (context: RuleContext) => Finding[] | Promise<Finding[]>;
}

interface RuleContext {
  file: FileNode;
  ast: ts.SourceFile;
  graph: CodebaseGraph;
  program: ts.Program;
  checker: ts.TypeChecker;
  walk: (node: ts.Node, visitors: ASTVisitors) => void;
  isCallTo: (node: ts.CallExpression, name: string) => boolean;
  isConsoleCall: (node: ts.CallExpression, method?: string) => boolean;
  getTypeString: (node: ts.Node) => string;
  hasStringConcat: (node: ts.Node) => boolean;
  getImports: () => ImportInfo[];
  isExternallyUsed: (symbolName: string) => boolean;
  config: Record<string, unknown>;
}

interface Finding {
  message: string;
  file: string;
  line: number;
  column: number;
  rule?: string;
  severity?: Severity;
  fix?: { suggestion: string; replacement?: string; };
}

type Severity = 'critical' | 'error' | 'warning' | 'info';
```

### Core Plugins (always loaded)

| Plugin | Rules |
|---|---|
| `architecture` | layer-violation, circular-dependency, file-role-mismatch, god-file, god-function, barrel-explosion |
| `security` | sql-injection, hardcoded-secret, eval-usage, prototype-pollution, xss-risk, missing-auth-check, insecure-random, path-traversal |
| `performance` | n1-query, sync-in-async, memory-leak-risk, unbounded-query, missing-index-hint, heavy-import, blocking-operation |
| `quality` | cyclomatic-complexity, dead-code, any-type, no-error-handling, inconsistent-naming, magic-number, empty-catch, nested-callbacks |

### Optional Plugins (shipped, disabled by default)

| Plugin | Description |
|---|---|
| `naming-convention` | Enforces strict file naming patterns |
| `api-consistency` | Checks REST endpoint naming consistency |
| `test-coverage-guard` | Ensures changed files have corresponding tests |
| `dependency-audit` | Checks import depth, heavy transitive deps |

---

## 6. Severity-Based Commit Control

| Severity | Blocks Commit? | When to Show |
|---|---|---|
| `critical` | YES | Always |
| `error` | YES | Always |
| `warning` | NO | Always |
| `info` | NO | Only with `--verbose` |

---

## 7. CLI Interface

```bash
codeguardian init                           # Setup: config + hook + first scan
codeguardian run                            # Analyze all files
codeguardian run --staged                   # Analyze staged files only
codeguardian run --plugin architecture      # Run specific plugin
codeguardian run --verbose                  # Include info findings
codeguardian run --format json              # JSON output
codeguardian run --format sarif             # SARIF output (GitHub)
codeguardian stats                          # Graph statistics
codeguardian rules                          # List all rules
codeguardian conventions                    # List detected conventions
codeguardian scan --full                    # Force full re-scan
codeguardian uninstall                      # Remove hook
```

CLI built with custom arg parser (zero dependencies).

---

## 8. Configuration

### .codeguardian.json

```json
{
  "rootDir": ".",
  "tsconfig": "./tsconfig.json",
  "include": ["src/**/*.ts"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"],
  "severity": {
    "blockOn": ["critical", "error"],
    "warnOn": ["warning"]
  },
  "plugins": {
    "architecture": { "enabled": true, "layers": [...], ... },
    "security": { "enabled": true, ... },
    "performance": { "enabled": true, ... },
    "quality": { "enabled": true, ... }
  },
  "ignore": { "rules": [], "files": [], "lines": {} }
}
```

### Inline Suppression

```typescript
// codeguardian-disable-next-line security/sql-injection
// codeguardian-disable rule-name -- reason
// codeguardian-enable rule-name
```

---

## 9. Public API

```typescript
// Main exports
export { createGuardian } from './index';
export { defineRule, definePlugin } from './index';

// Plugin exports (from '@oxog/codeguardian/plugins')
export { architecturePlugin, securityPlugin, performancePlugin, qualityPlugin };

// Guardian instance methods
guardian.scan(): Promise<CodebaseGraph>
guardian.scanIncremental(): Promise<IncrementalResult>
guardian.run(options?: RunOptions): Promise<RunResult>
guardian.use(plugin: GuardianPlugin): void
guardian.graph: CodebaseGraph

// Graph query methods
graph.getFile(path: string): FileNode | undefined
graph.getSymbol(name: string): SymbolNode | undefined
graph.getDependencies(path: string): string[]
graph.findCircularDeps(): string[][]
```

---

## 10. Performance Targets

| Metric | Target |
|---|---|
| Full scan (500 files) | < 10 seconds |
| Incremental scan (5 files) | < 2 seconds |
| Graph serialize/deserialize | < 500ms |
| Memory (1000 files) | < 200MB |

---

## 11. LLM-Native Requirements

- `llms.txt` file in root (< 2000 tokens)
- Predictable API naming: `create`, `get`, `set`, `use`, `remove`, `define`
- Rich JSDoc with `@example` on every public API
- 15+ examples organized by category
- README optimized for LLM consumption

---

## 12. Deliverables

1. NPM package (`@oxog/codeguardian`)
2. CLI tool (`codeguardian`)
3. Documentation website (codeguardian.oxog.dev)
4. 15+ examples
5. 100% test coverage
6. llms.txt
