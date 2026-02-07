# @oxog/codeguardian API Documentation

Complete API reference for the @oxog/codeguardian TypeScript codebase analysis tool.

## Table of Contents

- [Main API](#main-api)
- [Factory Functions](#factory-functions)
- [Configuration](#configuration)
- [Types Reference](#types-reference)
- [Plugins](#plugins)
- [Graph Query API](#graph-query-api)
- [Reporters](#reporters)
- [AST Utilities](#ast-utilities)
- [CLI Commands](#cli-commands)

---

## Main API

### `createGuardian(config)`

Create a Guardian instance for analyzing a TypeScript project.

**Parameters:**
- `config: GuardianConfig` - Guardian configuration object

**Returns:** Guardian instance with the following methods

**Example:**
```typescript
import { createGuardian } from '@oxog/codeguardian';

const guardian = createGuardian({
  rootDir: process.cwd(),
  tsconfig: './tsconfig.json',
});
```

#### Guardian Instance Methods

##### `scan()`

Perform a full codebase scan and build the knowledge graph.

**Returns:** `Promise<CodebaseGraph>` - The complete codebase graph

**Example:**
```typescript
const graph = await guardian.scan();
console.log(`${graph.files.size} files, ${graph.symbols.size} symbols`);
```

##### `scanIncremental()`

Perform an incremental scan based on git staged files. Uses cached graph if available, falls back to full scan otherwise.

**Returns:** `Promise<IncrementalResult>` - Incremental result with changed and affected files

**Example:**
```typescript
const result = await guardian.scanIncremental();
console.log(`Updated ${result.changedFiles.length} files`);
```

##### `run(options?)`

Run analysis rules on the codebase.

**Parameters:**
- `options?: RunOptions` - Optional run configuration
  - `staged?: boolean` - Analyze staged files only (pre-commit mode)
  - `verbose?: boolean` - Include info-level findings
  - `plugins?: string[]` - Run specific plugin(s) only
  - `format?: 'terminal' | 'json' | 'sarif'` - Output format

**Returns:** `Promise<RunResult>` - Run result with findings, stats, and blocked status

**Example:**
```typescript
const result = await guardian.run({ staged: true });
if (result.blocked) {
  console.error('Commit blocked!');
  process.exit(1);
}
```

##### `use(plugin)`

Register a plugin with the guardian.

**Parameters:**
- `plugin: GuardianPlugin` - Plugin to register

**Example:**
```typescript
import { definePlugin } from '@oxog/codeguardian';

const myPlugin = definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  install: (kernel) => {
    kernel.registerRule(myRule);
  },
});

guardian.use(myPlugin);
```

##### `discover()`

Auto-discover project conventions by analyzing the codebase graph.

**Returns:** `Promise<DetectedPattern[]>` - Array of detected patterns

**Example:**
```typescript
const conventions = await guardian.discover();
for (const p of conventions) {
  console.log(`${p.type}: ${p.description} (${p.confidence}%)`);
}
```

##### `format(result, format?, verbose?)`

Format run results for output.

**Parameters:**
- `result: RunResult` - Run result to format
- `format?: 'terminal' | 'json' | 'sarif'` - Output format (default: 'terminal')
- `verbose?: boolean` - Include info-level findings (default: false)

**Returns:** `string` - Formatted output string

**Example:**
```typescript
const output = guardian.format(result, 'terminal', false);
console.log(output);
```

##### `query`

Get graph query helpers.

**Properties:**
- `getFile(path: string): FileNode | undefined` - Get a file node from the graph
- `getSymbol(name: string): SymbolNode | undefined` - Get a symbol node from the graph
- `getDependencies(path: string): string[]` - Get files that the given file depends on
- `getDependents(path: string): string[]` - Get files that depend on the given file
- `findCircularDeps(): string[][]` - Find all circular dependency chains
- `getStats(): GraphStats | null` - Get graph statistics

**Example:**
```typescript
const file = guardian.query.getFile('src/services/user.service.ts');
const deps = guardian.query.getDependencies('src/services/user.service.ts');
```

##### `getRules()`

Get all registered rules.

**Returns:** `Rule[]` - Array of registered rules

**Example:**
```typescript
const rules = guardian.getRules();
console.log(`${rules.length} rules registered`);
```

##### `getPlugins()`

Get all installed plugin names.

**Returns:** `string[]` - Array of plugin names

**Example:**
```typescript
const plugins = guardian.getPlugins();
console.log(`Active plugins: ${plugins.join(', ')}`);
```

##### `config`

The resolved project configuration.

**Type:** `ProjectConfig`

##### `graph`

The codebase knowledge graph (available after scan).

**Type:** `CodebaseGraph`

**Example:**
```typescript
await guardian.scan();
console.log(`Graph has ${guardian.graph.files.size} files`);
```

---

## Factory Functions

### `defineRule(rule)`

Define a custom analysis rule with type safety.

**Parameters:**
- `rule: Rule` - Rule definition

**Returns:** `Rule` - The same rule (for type-safe chaining)

**Example:**
```typescript
import { defineRule } from '@oxog/codeguardian';

const noConsole = defineRule({
  name: 'custom/no-console',
  severity: 'warning',
  description: 'Disallow console.log in production code',
  category: 'quality',
  check: (ctx) => {
    const findings: Finding[] = [];
    ctx.walk(ctx.ast, {
      CallExpression(node) {
        if (ctx.isConsoleCall(node as ts.CallExpression)) {
          const pos = ctx.ast.getLineAndCharacterOfPosition(node.getStart());
          findings.push({
            message: 'console.log should not be in production code',
            file: ctx.file.path,
            line: pos.line + 1,
            column: pos.character + 1,
          });
        }
      },
    });
    return findings;
  },
});
```

### `definePlugin(plugin)`

Define a custom plugin with type safety.

**Parameters:**
- `plugin: GuardianPlugin` - Plugin definition

**Returns:** `GuardianPlugin` - The same plugin (for type-safe chaining)

**Example:**
```typescript
import { definePlugin, defineRule } from '@oxog/codeguardian';

const myPlugin = definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  install: (kernel) => {
    kernel.registerRule(defineRule({
      name: 'my-plugin/my-rule',
      severity: 'warning',
      description: 'My custom rule',
      category: 'quality',
      check: (ctx) => [],
    }));
  },
  onInit: async (graph) => {
    console.log(`Initialized with ${graph.files.size} files`);
  },
});
```

---

## Configuration

### `GuardianConfig`

Main configuration passed to `createGuardian()`.

**Properties:**
- `rootDir: string` - Project root directory (required)
- `tsconfig?: string` - Path to tsconfig.json (default: './tsconfig.json')
- `config?: string | InlineConfig` - Config file path or inline configuration
- `autoDiscover?: boolean` - Enable automatic convention discovery

**Example:**
```typescript
const config: GuardianConfig = {
  rootDir: process.cwd(),
  tsconfig: './tsconfig.json',
  config: '.codeguardian.json',
};
```

### `ProjectConfig`

Full project configuration (shape of .codeguardian.json file).

**Properties:**
- `rootDir: string` - Project root directory
- `tsconfig: string` - Path to tsconfig.json
- `include: string[]` - Glob patterns for files to include
- `exclude: string[]` - Glob patterns for files to exclude
- `severity: SeverityConfig` - Severity configuration
- `plugins: PluginConfigs` - Plugin-specific configurations
- `ignore: IgnoreConfig` - Ignore configuration

**Example:**
```json
{
  "rootDir": ".",
  "tsconfig": "./tsconfig.json",
  "include": ["src/**/*.ts"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts"],
  "severity": {
    "blockOn": ["critical", "error"],
    "warnOn": ["warning"]
  },
  "plugins": {
    "architecture": {
      "enabled": true,
      "layers": ["controller", "service", "repository"],
      "enforceDirection": true,
      "maxFileLines": 300,
      "maxFunctionLines": 50,
      "maxFunctionComplexity": 15
    },
    "security": {
      "enabled": true,
      "checkInjection": true,
      "checkAuth": true,
      "checkSecrets": true,
      "checkXSS": true,
      "checkCSRF": true
    },
    "performance": {
      "enabled": true,
      "checkN1Queries": true,
      "checkMemoryLeaks": true,
      "checkAsyncPatterns": true,
      "checkBundleSize": false
    },
    "quality": {
      "enabled": true,
      "checkDeadCode": true,
      "checkNaming": true,
      "checkComplexity": true,
      "maxCyclomaticComplexity": 15
    }
  },
  "ignore": {
    "rules": [],
    "files": [],
    "lines": {}
  }
}
```

### `InlineConfig`

Inline configuration object (subset of ProjectConfig).

**Properties:**
- `include?: string[]` - Glob patterns for files to include
- `exclude?: string[]` - Glob patterns for files to exclude
- `severity?: Partial<SeverityConfig>` - Severity configuration
- `plugins?: Partial<PluginConfigs>` - Plugin-specific configurations
- `ignore?: Partial<IgnoreConfig>` - Ignore configuration

### `SeverityConfig`

Severity configuration for commit blocking.

**Properties:**
- `blockOn: Severity[]` - Severities that block commits
- `warnOn: Severity[]` - Severities that warn but don't block
- `ignoreBelow?: Severity` - Ignore findings below this severity

---

## Types Reference

### Graph Types

#### `CodebaseGraph`

The codebase knowledge graph — core data structure.

**Properties:**
- `files: Map<string, FileNode>` - All files in the codebase
- `symbols: Map<string, SymbolNode>` - All exported symbols
- `edges: ImportEdge[]` - Import relationships
- `layers: LayerDefinition[]` - Architectural layers
- `patterns: DetectedPattern[]` - Detected patterns
- `dependencies: DependencyGraph` - Dependency adjacency graph

#### `FileNode`

A node representing a source file in the codebase graph.

**Properties:**
- `path: string` - Relative file path
- `role: FileRole` - Detected role ('controller' | 'service' | 'repository' | 'util' | 'type' | 'config' | 'test' | 'unknown')
- `layer: string` - Architectural layer
- `exports: string[]` - Exported symbol names
- `imports: ImportInfo[]` - Import information
- `complexity: number` - Cyclomatic complexity (sum of all functions)
- `loc: number` - Lines of code
- `functions: FunctionNode[]` - Functions defined in this file

#### `SymbolNode`

A node representing an exported symbol.

**Properties:**
- `name: string` - Symbol name
- `kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'enum'` - Symbol kind
- `file: string` - File path where symbol is defined
- `usedBy: string[]` - Files that import this symbol
- `dependsOn: string[]` - Files this symbol depends on
- `isPublicAPI: boolean` - Whether this is a public API export

#### `FunctionNode`

A node representing a function in the codebase graph.

**Properties:**
- `name: string` - Function name
- `file: string` - File path
- `startLine: number` - Start line number
- `endLine: number` - End line number
- `params: ParamInfo[]` - Function parameters
- `returnType: string` - Return type annotation
- `complexity: number` - Cyclomatic complexity
- `isAsync: boolean` - Whether the function is async
- `hasSideEffects: boolean` - Whether the function has side effects
- `issues: Issue[]` - Detected issues

#### `ImportEdge`

An edge in the import dependency graph.

**Properties:**
- `from: string` - Importing file path
- `to: string` - Imported file path
- `specifiers: string[]` - Imported symbol names
- `isTypeOnly: boolean` - Whether type-only import

#### `ImportInfo`

Information about a single import statement.

**Properties:**
- `source: string` - Module specifier (e.g., './user.service')
- `specifiers: string[]` - Imported names
- `isTypeOnly: boolean` - Whether this is a type-only import

### Finding Types

#### `Finding`

A single finding (issue) detected by a rule.

**Properties:**
- `message: string` - Issue description
- `file: string` - File path
- `line: number` - Line number
- `column: number` - Column number
- `rule?: string` - Rule name that generated the finding
- `severity?: Severity` - Severity level ('critical' | 'error' | 'warning' | 'info')
- `fix?: { suggestion: string; replacement?: string }` - Fix suggestion

#### `RunResult`

Result of running analysis.

**Properties:**
- `findings: Finding[]` - All findings
- `stats: RunStats` - Execution statistics
- `blocked: boolean` - Whether commit should be blocked
- `bySeverity: Record<Severity, Finding[]>` - Findings grouped by severity
- `byFile: Record<string, Finding[]>` - Findings grouped by file

#### `RunStats`

Statistics from a run.

**Properties:**
- `filesAnalyzed: number` - Number of files analyzed
- `rulesExecuted: number` - Number of rules executed
- `duration: number` - Total duration in milliseconds
- `parseTime: number` - AST parse time in milliseconds
- `analysisTime: number` - Analysis time in milliseconds

### Rule Types

#### `Rule`

A single analysis rule.

**Properties:**
- `name: string` - Rule identifier (e.g., 'architecture/layer-violation')
- `severity: Severity` - Default severity level
- `description: string` - Human-readable description
- `category: RuleCategory` - Category ('architecture' | 'security' | 'performance' | 'quality')
- `check: (context: RuleContext) => Finding[] | Promise<Finding[]>` - Rule implementation

#### `RuleContext`

Context provided to rules during analysis.

**Properties:**
- `file: FileNode` - Current file being analyzed
- `ast: ts.SourceFile` - TypeScript AST
- `graph: CodebaseGraph` - Full codebase graph
- `program: ts.Program` - TypeScript program
- `checker: ts.TypeChecker` - Type checker
- `config: Record<string, unknown>` - Plugin configuration
- `walk: (node: ts.Node, visitors: ASTVisitors) => void` - AST walker
- `isCallTo: (node: ts.CallExpression, name: string) => boolean` - Check if call expression calls a specific function
- `isConsoleCall: (node: ts.CallExpression, method?: string) => boolean` - Check if call is console.*
- `getTypeString: (node: ts.Node) => string` - Get type as string
- `hasStringConcat: (node: ts.Node) => boolean` - Check for string concatenation
- `getImports: () => ImportInfo[]` - Get all imports
- `isExternallyUsed: (symbolName: string) => boolean` - Check if symbol is used by other files

### Plugin Types

#### `GuardianPlugin`

Plugin interface for extending codeguardian.

**Properties:**
- `name: string` - Plugin name
- `version: string` - Plugin version
- `dependencies?: string[]` - Required plugin dependencies
- `install: (kernel: GuardianKernel) => void` - Installation function
- `onInit?: (graph: CodebaseGraph) => void | Promise<void>` - Called after graph is built
- `onDestroy?: () => void | Promise<void>` - Cleanup function
- `onError?: (error: Error) => void` - Error handler

#### `GuardianKernel`

The kernel interface exposed to plugins during installation.

**Methods:**
- `registerRule: (rule: Rule) => void` - Register a rule
- `unregisterRule: (name: string) => void` - Unregister a rule
- `getRules: () => Rule[]` - Get all rules
- `getConfig: () => TConfig` - Get plugin configuration

---

## Plugins

### Core Plugins

Core plugins are enabled by default and can be disabled by setting `enabled: false`.

#### Architecture Plugin

Enforces layer boundaries, detects circular dependencies, validates file structure conventions.

**Configuration:**
```typescript
{
  enabled: boolean;        // default: true
  layers?: string[];       // default: ['controller', 'service', 'repository', 'util']
  enforceDirection?: boolean;     // default: true
  maxFileLines?: number;          // default: 300
  maxFunctionLines?: number;      // default: 50
  maxFunctionComplexity?: number; // default: 15
}
```

**Rules:**
- `architecture/layer-violation` (error) - Detects when a lower layer imports from a higher layer
- `architecture/circular-dependency` (error) - Detects circular import chains
- `architecture/file-role-mismatch` (warning) - Detects when file content does not match directory role
- `architecture/god-file` (warning) - Detects files exceeding maximum line count
- `architecture/god-function` (warning) - Detects functions exceeding maximum line count
- `architecture/barrel-explosion` (info) - Detects barrel files (index.ts) that re-export everything

**Example:**
```typescript
import { architecturePlugin } from '@oxog/codeguardian/plugins';

guardian.use(architecturePlugin({
  enabled: true,
  layers: ['controller', 'service', 'repository'],
  enforceDirection: true,
  maxFileLines: 250,
}));
```

#### Security Plugin

Detects security anti-patterns and vulnerabilities.

**Configuration:**
```typescript
{
  enabled: boolean;        // default: true
  checkInjection?: boolean;  // default: true
  checkAuth?: boolean;       // default: true
  checkSecrets?: boolean;    // default: true
  checkXSS?: boolean;        // default: true
  checkCSRF?: boolean;       // default: true
}
```

**Rules:**
- `security/sql-injection` (critical) - Detects string concatenation in SQL queries
- `security/hardcoded-secret` (critical) - Detects hardcoded API keys, tokens, and passwords
- `security/eval-usage` (critical) - Detects eval(), Function(), and similar unsafe patterns
- `security/prototype-pollution` (error) - Detects potential prototype pollution
- `security/xss-risk` (error) - Detects innerHTML and similar XSS-prone patterns
- `security/missing-auth-check` (warning) - Detects route handlers without auth checks
- `security/insecure-random` (warning) - Detects Math.random() in security-sensitive contexts
- `security/path-traversal` (error) - Detects file operations with potential path traversal

**Example:**
```typescript
import { securityPlugin } from '@oxog/codeguardian/plugins';

guardian.use(securityPlugin({
  enabled: true,
  checkInjection: true,
  checkSecrets: true,
}));
```

#### Performance Plugin

Catches N+1 queries, memory leaks, sync operations in async contexts.

**Configuration:**
```typescript
{
  enabled: boolean;           // default: true
  checkN1Queries?: boolean;   // default: true
  checkMemoryLeaks?: boolean; // default: true
  checkAsyncPatterns?: boolean; // default: true
  checkBundleSize?: boolean;  // default: false
}
```

**Rules:**
- `performance/n1-query` (warning) - Detects database calls inside loops (potential N+1 query)
- `performance/sync-in-async` (warning) - Detects synchronous file operations in async functions
- `performance/memory-leak-risk` (warning) - Detects addEventListener without removeEventListener, setInterval without clearInterval
- `performance/unbounded-query` (warning) - Detects database queries without LIMIT or pagination
- `performance/missing-index-hint` (info) - Detects queries that may need database indexes
- `performance/heavy-import` (info) - Detects importing entire libraries when a smaller import is available
- `performance/blocking-operation` (warning) - Detects CPU-intensive operations in request handlers

**Example:**
```typescript
import { performancePlugin } from '@oxog/codeguardian/plugins';

guardian.use(performancePlugin({
  enabled: true,
  checkN1Queries: true,
  checkMemoryLeaks: true,
}));
```

#### Quality Plugin

Checks complexity, dead code, naming, and patterns.

**Configuration:**
```typescript
{
  enabled: boolean;                // default: true
  checkDeadCode?: boolean;         // default: true
  checkNaming?: boolean;           // default: true
  checkComplexity?: boolean;       // default: true
  maxCyclomaticComplexity?: number; // default: 15
}
```

**Rules:**
- `quality/cyclomatic-complexity` (warning) - Detects functions with high cyclomatic complexity
- `quality/dead-code` (warning) - Detects exported symbols never imported by other files
- `quality/any-type` (warning) - Detects usage of `any` type annotation
- `quality/no-error-handling` (warning) - Detects async functions without error handling
- `quality/inconsistent-naming` (info) - Detects naming that does not follow project conventions
- `quality/magic-number` (info) - Detects numeric literals used directly in logic
- `quality/empty-catch` (warning) - Detects empty catch blocks
- `quality/nested-callbacks` (warning) - Detects deeply nested callbacks (> 3 levels)

**Example:**
```typescript
import { qualityPlugin } from '@oxog/codeguardian/plugins';

guardian.use(qualityPlugin({
  enabled: true,
  maxCyclomaticComplexity: 10,
}));
```

### Optional Plugins

Optional plugins must be explicitly enabled in configuration.

#### Naming Convention Plugin

Enforces strict file naming patterns.

**Configuration:**
```typescript
{
  enabled: boolean; // default: false
}
```

**Rules:**
- `naming-convention/file-naming` (warning) - Enforces consistent file naming patterns based on directory

**Example:**
```typescript
import { namingPlugin } from '@oxog/codeguardian/plugins';

guardian.use(namingPlugin({ enabled: true }));
```

#### API Consistency Plugin

Checks REST endpoint naming and response format consistency.

**Configuration:**
```typescript
{
  enabled: boolean; // default: false
}
```

**Rules:**
- `api-consistency/endpoint-naming` (info) - Checks REST API endpoint naming conventions

**Example:**
```typescript
import { apiPlugin } from '@oxog/codeguardian/plugins';

guardian.use(apiPlugin({ enabled: true }));
```

#### Test Coverage Guard Plugin

Ensures changed files have corresponding test files.

**Configuration:**
```typescript
{
  enabled: boolean; // default: false
}
```

**Rules:**
- `test-coverage-guard/missing-tests` (warning) - Ensures source files have corresponding test files

**Example:**
```typescript
import { testGuardPlugin } from '@oxog/codeguardian/plugins';

guardian.use(testGuardPlugin({ enabled: true }));
```

#### Dependency Audit Plugin

Checks import depth and heavy transitive dependencies.

**Configuration:**
```typescript
{
  enabled: boolean; // default: false
  maxDepth?: number; // default: 5
}
```

**Rules:**
- `dependency-audit/deep-imports` (info) - Detects deeply nested import chains

**Example:**
```typescript
import { depAuditPlugin } from '@oxog/codeguardian/plugins';

guardian.use(depAuditPlugin({
  enabled: true,
  maxDepth: 4,
}));
```

---

## Graph Query API

### `getFile(graph, path)`

Get a file node from the graph.

**Parameters:**
- `graph: CodebaseGraph` - The codebase graph
- `path: string` - File path

**Returns:** `FileNode | undefined`

**Example:**
```typescript
import { getFile } from '@oxog/codeguardian';

const file = getFile(graph, 'src/services/user.service.ts');
if (file) {
  console.log(`File has ${file.functions.length} functions`);
}
```

### `getSymbol(graph, name)`

Get a symbol node from the graph.

**Parameters:**
- `graph: CodebaseGraph` - The codebase graph
- `name: string` - Symbol name

**Returns:** `SymbolNode | undefined`

**Example:**
```typescript
import { getSymbol } from '@oxog/codeguardian';

const symbol = getSymbol(graph, 'UserService');
if (symbol) {
  console.log(`Used by ${symbol.usedBy.length} files`);
}
```

### `getDependencies(graph, path)`

Get all files that the given file depends on (imports from).

**Parameters:**
- `graph: CodebaseGraph` - The codebase graph
- `path: string` - File path

**Returns:** `string[]` - Array of dependency file paths

**Example:**
```typescript
import { getDependencies } from '@oxog/codeguardian';

const deps = getDependencies(graph, 'src/controllers/user.controller.ts');
// Returns: ['src/services/user.service.ts', 'src/types.ts']
```

### `getDependents(graph, path)`

Get all files that depend on (import from) the given file.

**Parameters:**
- `graph: CodebaseGraph` - The codebase graph
- `path: string` - File path

**Returns:** `string[]` - Array of dependent file paths

**Example:**
```typescript
import { getDependents } from '@oxog/codeguardian';

const dependents = getDependents(graph, 'src/services/user.service.ts');
// Returns: ['src/controllers/user.controller.ts']
```

### `findCircularDeps(graph)`

Find all circular dependency chains in the graph.

**Parameters:**
- `graph: CodebaseGraph` - The codebase graph

**Returns:** `string[][]` - Array of circular dependency chains (each chain is an array of file paths)

**Example:**
```typescript
import { findCircularDeps } from '@oxog/codeguardian';

const cycles = findCircularDeps(graph);
for (const cycle of cycles) {
  console.log(`Circular dependency: ${cycle.join(' → ')}`);
}
// Output: Circular dependency: a.ts → b.ts → c.ts → a.ts
```

### `getGraphStats(graph)`

Get graph statistics.

**Parameters:**
- `graph: CodebaseGraph` - The codebase graph

**Returns:** Object with statistics:
- `totalFiles: number` - Total number of files
- `totalSymbols: number` - Total number of symbols
- `totalEdges: number` - Total number of import edges
- `totalFunctions: number` - Total number of functions
- `totalLOC: number` - Total lines of code
- `avgComplexity: number` - Average cyclomatic complexity
- `filesByRole: Record<string, number>` - File count by role
- `filesByLayer: Record<string, number>` - File count by layer

**Example:**
```typescript
import { getGraphStats } from '@oxog/codeguardian';

const stats = getGraphStats(graph);
console.log(`${stats.totalFiles} files, ${stats.totalSymbols} symbols`);
console.log(`Average complexity: ${stats.avgComplexity.toFixed(1)}`);
```

---

## Reporters

### `formatTerminal(result, verbose?)`

Format run results as colored terminal output.

**Parameters:**
- `result: RunResult` - Run result to format
- `verbose?: boolean` - Whether to include info-level findings (default: false)

**Returns:** `string` - Formatted string for terminal output

**Example:**
```typescript
import { formatTerminal } from '@oxog/codeguardian';

const output = formatTerminal(result, false);
console.log(output);
```

### `formatJSON(result)`

Format run results as JSON string.

**Parameters:**
- `result: RunResult` - Run result to format

**Returns:** `string` - Pretty-printed JSON string

**Example:**
```typescript
import { formatJSON } from '@oxog/codeguardian';

const json = formatJSON(result);
console.log(json);
```

### `formatSARIF(result)`

Format run results as SARIF (Static Analysis Results Interchange Format). Compatible with GitHub Code Scanning.

**Parameters:**
- `result: RunResult` - Run result to format

**Returns:** `string` - SARIF JSON string

**Example:**
```typescript
import { formatSARIF } from '@oxog/codeguardian';
import { writeFileSync } from 'fs';

const sarif = formatSARIF(result);
writeFileSync('results.sarif', sarif);
```

---

## AST Utilities

### Parser

#### `createTSProgram(rootDir, tsconfigPath)`

Create a TypeScript program from a tsconfig path.

**Parameters:**
- `rootDir: string` - Project root directory
- `tsconfigPath: string` - Path to tsconfig.json (relative to rootDir)

**Returns:** `ts.Program` - TypeScript Program instance

**Example:**
```typescript
import { createTSProgram } from '@oxog/codeguardian';

const program = createTSProgram('/my-project', './tsconfig.json');
const checker = program.getTypeChecker();
```

#### `parseFile(filePath, content?)`

Parse a single TypeScript file into a SourceFile AST.

**Parameters:**
- `filePath: string` - Absolute path to the .ts file
- `content?: string` - Optional file content (reads from disk if not provided)

**Returns:** `ts.SourceFile` - TypeScript SourceFile

**Example:**
```typescript
import { parseFile } from '@oxog/codeguardian';

const ast = parseFile('/project/src/index.ts');
```

#### `getSourceFiles(program)`

Get all source file paths from a TypeScript program (excluding .d.ts and node_modules).

**Parameters:**
- `program: ts.Program` - TypeScript Program

**Returns:** `string[]` - Array of source file paths

**Example:**
```typescript
import { getSourceFiles } from '@oxog/codeguardian';

const files = getSourceFiles(program);
console.log(`Found ${files.length} source files`);
```

### Walker

#### `walkAST(node, visitors)`

Walk a TypeScript AST tree, calling visitor functions for matching node kinds.

**Parameters:**
- `node: ts.Node` - Root node to walk
- `visitors: ASTVisitors` - Map of node kind name to visitor function

**Example:**
```typescript
import { walkAST } from '@oxog/codeguardian';

walkAST(sourceFile, {
  CallExpression(node) {
    console.log('Found call at', node.getStart());
  },
  IfStatement(node) {
    console.log('Found if at', node.getStart());
  },
});
```

#### `calculateComplexity(node)`

Calculate cyclomatic complexity of an AST node.

**Parameters:**
- `node: ts.Node` - AST node (typically a function body)

**Returns:** `number` - Cyclomatic complexity score (base: 1)

**Example:**
```typescript
import { calculateComplexity } from '@oxog/codeguardian';

const complexity = calculateComplexity(functionDeclaration);
console.log(`Complexity: ${complexity}`);
```

#### `countLOC(sourceFile)`

Count lines of code in a source file (excluding blank lines and comment-only lines).

**Parameters:**
- `sourceFile: ts.SourceFile` - TypeScript SourceFile

**Returns:** `number` - Number of lines of code

**Example:**
```typescript
import { countLOC } from '@oxog/codeguardian';

const loc = countLOC(sourceFile);
console.log(`${loc} lines of code`);
```

### Helpers

#### `isCallTo(node, name)`

Check if a CallExpression calls a specific function name.

**Parameters:**
- `node: ts.CallExpression` - Call expression node
- `name: string` - Function name to check

**Returns:** `boolean`

**Example:**
```typescript
import { isCallTo } from '@oxog/codeguardian';

if (isCallTo(node, 'someFunction')) {
  console.log('Found call to someFunction()');
}
```

#### `isConsoleCall(node, method?)`

Check if a CallExpression is a console.* call.

**Parameters:**
- `node: ts.CallExpression` - Call expression node
- `method?: string` - Optional specific method (e.g., 'log', 'error')

**Returns:** `boolean`

**Example:**
```typescript
import { isConsoleCall } from '@oxog/codeguardian';

if (isConsoleCall(node)) {
  console.log('Found console call');
}

if (isConsoleCall(node, 'log')) {
  console.log('Found console.log');
}
```

#### `getTypeString(node, checker)`

Get the type of a node as a string using the TypeChecker.

**Parameters:**
- `node: ts.Node` - AST node
- `checker: ts.TypeChecker` - Type checker

**Returns:** `string` - Type as string (e.g., 'string', 'Promise<User>', 'number[]')

**Example:**
```typescript
import { getTypeString } from '@oxog/codeguardian';

const typeStr = getTypeString(node, checker);
console.log(`Type: ${typeStr}`);
```

#### `hasStringConcat(node)`

Check if a node contains string concatenation or template literals.

**Parameters:**
- `node: ts.Node` - AST node

**Returns:** `boolean`

**Example:**
```typescript
import { hasStringConcat } from '@oxog/codeguardian';

if (hasStringConcat(node)) {
  console.log('Found string concatenation');
}
```

#### `extractImports(sourceFile)`

Extract all imports from a source file.

**Parameters:**
- `sourceFile: ts.SourceFile` - TypeScript SourceFile

**Returns:** `ImportInfo[]` - Array of import information

**Example:**
```typescript
import { extractImports } from '@oxog/codeguardian';

const imports = extractImports(sourceFile);
for (const imp of imports) {
  console.log(`Import from ${imp.source}: ${imp.specifiers.join(', ')}`);
}
```

#### `extractExports(sourceFile)`

Extract all exports from a source file (named exports and declarations).

**Parameters:**
- `sourceFile: ts.SourceFile` - TypeScript SourceFile

**Returns:** `string[]` - Array of exported symbol names

**Example:**
```typescript
import { extractExports } from '@oxog/codeguardian';

const exports = extractExports(sourceFile);
console.log(`Exports: ${exports.join(', ')}`);
```

#### `extractFunctions(sourceFile, filePath)`

Extract function declarations and methods from a source file.

**Parameters:**
- `sourceFile: ts.SourceFile` - TypeScript SourceFile
- `filePath: string` - File path

**Returns:** Array of function information objects

**Example:**
```typescript
import { extractFunctions } from '@oxog/codeguardian';

const fns = extractFunctions(sourceFile, 'src/service.ts');
for (const fn of fns) {
  console.log(`Function ${fn.name}: ${fn.startLine}-${fn.endLine}`);
}
```

### Discovery

#### `discoverConventions(graph)`

Auto-discover project conventions by analyzing the codebase graph.

**Parameters:**
- `graph: CodebaseGraph` - Codebase knowledge graph

**Returns:** `DetectedPattern[]` - Array of detected patterns

**Example:**
```typescript
import { discoverConventions } from '@oxog/codeguardian';

const patterns = discoverConventions(graph);
for (const p of patterns) {
  console.log(`${p.type}: ${p.description} (${p.confidence}%)`);
}
```

---

## CLI Commands

The `codeguardian` CLI provides several commands for project analysis and management.

### Global Installation

```bash
npm install -g @oxog/codeguardian
```

### Command Reference

#### `codeguardian init`

Initialize codeguardian in a project. This command:
- Installs pre-commit hook (if git repo)
- Creates `.codeguardian.json` configuration file
- Performs initial full scan
- Caches graph to `.codeguardian/graph.json`

**Usage:**
```bash
codeguardian init
```

#### `codeguardian run`

Run analysis on all or staged files.

**Usage:**
```bash
codeguardian run [options]
```

**Options:**
- `--staged` - Analyze staged files only (pre-commit mode)
- `--verbose` - Include info-level findings
- `--format <terminal|json|sarif>` - Output format (default: terminal)
- `--plugin <name>` - Run specific plugin(s) only

**Examples:**
```bash
# Run on all files
codeguardian run

# Run on staged files (pre-commit)
codeguardian run --staged

# Run with verbose output
codeguardian run --verbose

# Run specific plugin only
codeguardian run --plugin security

# Output JSON format
codeguardian run --format json > results.json

# Output SARIF format for GitHub Code Scanning
codeguardian run --format sarif > results.sarif
```

#### `codeguardian stats`

Show codebase graph statistics.

**Usage:**
```bash
codeguardian stats
```

**Example Output:**
```
  @oxog/codeguardian — Stats

  Files:      39
  Symbols:    156
  Edges:      312
  Functions:  287
  Total LOC:  4521
  Avg Complexity: 3.2

  By Role:
    service: 12
    util: 8
    controller: 6

  By Layer:
    service: 12
    controller: 6
    repository: 4
```

#### `codeguardian rules`

List all registered rules with descriptions.

**Usage:**
```bash
codeguardian rules
```

**Example Output:**
```
  @oxog/codeguardian — Rules (29 total)

  ARCHITECTURE
    error    architecture/layer-violation
    Detects when a lower layer imports from a higher layer

    error    architecture/circular-dependency
    Detects circular import chains

  SECURITY
    critical security/sql-injection
    Detects string concatenation in SQL queries

    critical security/hardcoded-secret
    Detects hardcoded API keys, tokens, and passwords
```

#### `codeguardian conventions`

List detected project conventions.

**Usage:**
```bash
codeguardian conventions
```

**Example Output:**
```
  @oxog/codeguardian — Conventions (5 detected)

  file-naming (85% confidence)
    Files in src/services/ follow *.service.ts naming pattern
    Files: src/services/user.service.ts, src/services/auth.service.ts +3 more

  export-pattern (92% confidence)
    service files primarily export classes
    Files: src/services/user.service.ts, src/services/auth.service.ts +3 more
```

#### `codeguardian scan`

Rebuild the full codebase graph.

**Usage:**
```bash
codeguardian scan [options]
```

**Options:**
- `--full` - Force full scan (ignore cache)

**Examples:**
```bash
# Incremental scan
codeguardian scan

# Full scan
codeguardian scan --full
```

#### `codeguardian uninstall`

Remove pre-commit hook.

**Usage:**
```bash
codeguardian uninstall
```

#### Global Options

Available for all commands:
- `--version, -v` - Show version number
- `--help, -h` - Show help message

**Examples:**
```bash
codeguardian --version
codeguardian --help
codeguardian run --help
```

### Pre-commit Hook Integration

When you run `codeguardian init` in a git repository, it automatically installs a pre-commit hook that runs:

```bash
codeguardian run --staged
```

This ensures that only staged files are analyzed before each commit. If any blocking issues are found (critical or error severity by default), the commit will be blocked.

**Bypassing the hook (not recommended):**
```bash
git commit --no-verify
```

---

## Complete Example

Here's a complete example showing how to use the API programmatically:

```typescript
import {
  createGuardian,
  defineRule,
  definePlugin,
  type Finding,
  type RuleContext,
} from '@oxog/codeguardian';

// Define a custom rule
const noTodoComments = defineRule({
  name: 'custom/no-todo',
  severity: 'warning',
  description: 'Disallow TODO comments in production code',
  category: 'quality',
  check: (ctx: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const fileText = ctx.ast.getFullText();
    const lines = fileText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('TODO') || line.includes('FIXME')) {
        findings.push({
          message: 'TODO comment found',
          file: ctx.file.path,
          line: i + 1,
          column: line.indexOf('TODO') + 1,
          fix: {
            suggestion: 'Create a ticket and remove the TODO comment',
          },
        });
      }
    }

    return findings;
  },
});

// Define a custom plugin
const myPlugin = definePlugin({
  name: 'my-custom-plugin',
  version: '1.0.0',
  install: (kernel) => {
    kernel.registerRule(noTodoComments);
  },
  onInit: async (graph) => {
    console.log(`Plugin initialized with ${graph.files.size} files`);
  },
});

// Create guardian instance
const guardian = createGuardian({
  rootDir: process.cwd(),
  tsconfig: './tsconfig.json',
});

// Register custom plugin
guardian.use(myPlugin);

// Scan the codebase
async function analyze() {
  // Build graph
  const graph = await guardian.scan();
  console.log(`Scanned ${graph.files.size} files`);

  // Query the graph
  const userService = guardian.query.getFile('src/services/user.service.ts');
  if (userService) {
    console.log(`User service has ${userService.functions.length} functions`);

    const deps = guardian.query.getDependencies('src/services/user.service.ts');
    console.log(`Dependencies: ${deps.join(', ')}`);
  }

  // Find circular dependencies
  const cycles = guardian.query.findCircularDeps();
  if (cycles.length > 0) {
    console.log('Found circular dependencies:');
    for (const cycle of cycles) {
      console.log(`  ${cycle.join(' → ')}`);
    }
  }

  // Run analysis
  const result = await guardian.run({
    staged: false,
    verbose: true,
  });

  // Format and display results
  const output = guardian.format(result, 'terminal', true);
  console.log(output);

  // Check if blocked
  if (result.blocked) {
    console.error('Analysis failed - commit blocked');
    process.exit(1);
  }

  // Export results to SARIF for CI/CD
  const sarif = guardian.format(result, 'sarif');
  require('fs').writeFileSync('results.sarif', sarif);

  console.log('Analysis complete!');
}

analyze().catch(console.error);
```

---

## License

MIT License - Copyright (c) 2024 Ersin Koç

## Support

- GitHub Issues: https://github.com/ersinkoc/codeguardian/issues
- Documentation: https://codeguardian.oxog.dev
