# @oxog/codeguardian — Implementation Guide

## Architecture Decisions

### AD-1: Zero Dependencies Strategy

Everything is implemented from scratch:

| Need | Our Implementation |
|---|---|
| Glob matching | `src/utils/glob.ts` — Simple minimatch-compatible glob |
| Terminal colors | `src/utils/color.ts` — ANSI escape codes |
| CLI arg parsing | `src/utils/args.ts` — Custom argv parser |
| Git diff parsing | `src/git/diff.ts` — Line-by-line unified diff parser |
| File hashing | `src/utils/crypto.ts` — Node.js built-in `crypto` |
| File system | `src/utils/fs.ts` — Thin wrappers around `node:fs` |
| TypeScript AST | TypeScript Compiler API (peer dep) |

### AD-2: TypeScript as Peer Dependency

We use `ts.createProgram()` from the user's installed TypeScript. This gives us:
- Full AST parsing
- Type checker access
- No bundled TypeScript (saves ~50MB)
- Compatible with user's TS version

### AD-3: Micro-Kernel Design

The kernel is deliberately minimal. It provides:
1. **Plugin registry** — install/uninstall plugins
2. **Rule registry** — register/unregister rules from plugins
3. **Execution engine** — run rules against files, collect findings
4. **Event bus** (simple) — lifecycle hooks for plugins

All actual analysis logic lives in plugins. The kernel doesn't know about SQL injection, layer violations, etc.

### AD-4: Graph-First Architecture

The codebase knowledge graph is built BEFORE rules run. Rules receive the fully-constructed graph as read-only context. This means:
- Rules can query relationships (who imports whom)
- Rules can check architectural boundaries
- Rules don't duplicate parsing work
- Incremental updates are efficient (only re-parse changed files)

### AD-5: Incremental by Default

Pre-commit hooks must be fast. Our strategy:
1. Cache the full graph to `.codeguardian/graph.json`
2. On pre-commit, get staged files from `git diff --cached --name-only`
3. Re-parse only those files
4. Update only their nodes/edges in the graph
5. Run rules only on changed files + their direct dependents (files that import them)
6. Persist updated graph

### AD-6: Severity as First-Class Concept

Every finding has a severity. The commit decision is based on severity config:
- `blockOn: ['critical', 'error']` → exit(1) if any of these found
- `warnOn: ['warning']` → show but exit(0)
- Below threshold → hidden unless `--verbose`

---

## Module Design

### Entry Points

| Entry | File | Exports |
|---|---|---|
| Main | `src/index.ts` | `createGuardian`, `defineRule`, `definePlugin`, types |
| Plugins | `src/plugins/index.ts` | All plugin factory functions |
| CLI | `src/cli.ts` | CLI entry point (bin) |

### Module Dependency Flow

```
cli.ts
  └─→ index.ts (createGuardian)
        ├─→ kernel.ts (GuardianKernel)
        │     ├─→ rules/engine.ts
        │     ├─→ rules/context.ts
        │     └─→ rules/suppression.ts
        ├─→ graph/builder.ts
        │     ├─→ ast/parser.ts
        │     ├─→ ast/walker.ts
        │     └─→ ast/helpers.ts
        ├─→ graph/cache.ts
        ├─→ graph/incremental.ts
        ├─→ graph/query.ts
        ├─→ git/diff.ts
        ├─→ git/hooks.ts
        ├─→ git/staged.ts
        ├─→ config/loader.ts
        │     ├─→ config/defaults.ts
        │     └─→ config/validator.ts
        ├─→ reporter/terminal.ts
        ├─→ reporter/json.ts
        ├─→ reporter/sarif.ts
        ├─→ discovery/conventions.ts
        └─→ plugins/
              ├─→ core/architecture.ts
              ├─→ core/security.ts
              ├─→ core/performance.ts
              ├─→ core/quality.ts
              └─→ optional/...
```

### Key Design Patterns

1. **Factory Pattern**: `createGuardian()`, `defineRule()`, `definePlugin()`
2. **Plugin Pattern**: All rules live in plugins; kernel just orchestrates
3. **Visitor Pattern**: AST walking via `context.walk(node, visitors)`
4. **Builder Pattern**: Graph is built incrementally by the GraphBuilder

---

## Graph Construction Algorithm

### Full Scan

```
1. Read tsconfig.json → get file list
2. Create ts.Program with all files
3. For each source file:
   a. Create FileNode (path, role, layer, loc)
   b. Walk AST:
      - Collect exports → SymbolNode entries
      - Collect imports → ImportEdge entries
      - Collect functions → FunctionNode entries (with complexity)
   c. Detect file role from path/content
   d. Detect layer from directory structure
4. Build dependency graph from import edges
5. Detect patterns (naming, structure)
6. Serialize to .codeguardian/graph.json
```

### Incremental Update

```
1. Load cached graph from .codeguardian/graph.json
2. Get changed files from git diff --cached
3. For each changed file:
   a. Remove old nodes/edges for this file
   b. Re-parse with ts.createSourceFile
   c. Re-create FileNode, SymbolNodes, edges
   d. Insert into graph
4. Recalculate affected dependencies
5. Return changed + dependent files for rule evaluation
6. Persist updated graph
```

---

## Rule Execution Pipeline

```
1. Determine target files (all or staged + dependents)
2. Get enabled rules from registered plugins
3. For each file:
   a. Parse inline suppressions (codeguardian-disable comments)
   b. Create RuleContext (file, ast, graph, program, checker, helpers)
   c. For each rule:
      - Skip if rule is suppressed for this file/line
      - Execute rule.check(context)
      - Collect findings
      - Tag each finding with rule name and severity
4. Aggregate all findings
5. Group by severity
6. Determine blocked status
7. Format output (terminal/json/sarif)
```

---

## File Role Detection

Roles are detected by path patterns and content analysis:

| Role | Path Pattern | Content Pattern |
|---|---|---|
| controller | `**/controllers/**`, `*.controller.ts` | exports route handlers |
| service | `**/services/**`, `*.service.ts` | exports service classes |
| repository | `**/repositories/**`, `*.repository.ts` | database operations |
| util | `**/utils/**`, `**/helpers/**` | pure functions |
| type | `**/types/**`, `*.types.ts`, `*.d.ts` | only type exports |
| config | `**/config/**`, `*.config.ts` | configuration objects |
| test | `*.test.ts`, `*.spec.ts`, `**/tests/**` | test functions |

---

## Complexity Calculation

Cyclomatic complexity is calculated by counting decision points:

- `if` → +1
- `else if` → +1
- `case` → +1
- `for` → +1
- `while` → +1
- `do...while` → +1
- `&&` → +1
- `||` → +1
- `??` → +1
- `?.` → +1
- `catch` → +1
- Ternary `?:` → +1

Base complexity = 1.

---

## Terminal Reporter Design

```
┌─────────────────────────────────────────────┐
│  @oxog/codeguardian                          │
│  Scanning N changed files...                 │
└─────────────────────────────────────────────┘

✗ CRITICAL  file:line
  [plugin/rule] Message
  → Suggestion

✗ ERROR     file:line
  [plugin/rule] Message
  → Suggestion

⚠ WARNING   file:line
  [plugin/rule] Message
  → Suggestion

ℹ INFO      file:line  (only with --verbose)
  [plugin/rule] Message
  → Suggestion

────────────────────────────────────────────────
  N critical/error (commit blocked)  │  N warnings
────────────────────────────────────────────────
```

Uses ANSI colors:
- Critical/Error: Red
- Warning: Yellow
- Info: Blue/Cyan
- File paths: White bold
- Suggestions: Dim

---

## Error Handling Strategy

Custom error classes in `src/errors.ts`:
- `CodeGuardianError` — base class
- `ConfigError` — invalid configuration
- `ParseError` — TypeScript parsing failure
- `PluginError` — plugin lifecycle error
- `GraphError` — graph construction error
- `GitError` — git operation failure

All errors include:
- Human-readable message
- Error code (for programmatic handling)
- Context (file path, plugin name, etc.)

---

## Testing Strategy

### Unit Tests
- Every module has a corresponding test file
- Mock TypeScript compiler API where needed
- Test each rule with fixture files containing known violations

### Integration Tests
- `full-scan.test.ts` — scan a fixture project, verify graph
- `incremental.test.ts` — modify files, verify incremental update
- `pre-commit.test.ts` — simulate git staged files, verify exit codes
- `cli.test.ts` — test CLI commands end-to-end

### Test Fixtures
- `tests/fixtures/sample-project/` — small TS project with known structure
- `tests/fixtures/violations/` — files with intentional violations
- `tests/fixtures/clean/` — files with no violations

### Coverage
- 100% line coverage
- 100% branch coverage
- 100% function coverage
- Enforced via vitest config thresholds
