\# @oxog/codeguardian - Zero-Dependency NPM Package



\## Package Identity



| Field | Value |

|-------|-------|

| \*\*NPM Package\*\* | `@oxog/codeguardian` |

| \*\*GitHub Repository\*\* | `https://github.com/ersinkoc/codeguardian` |

| \*\*Documentation Site\*\* | `https://codeguardian.oxog.dev` |

| \*\*License\*\* | MIT |

| \*\*Author\*\* | Ersin Koç (ersinkoc) |



> \*\*NO social media, Discord, email, or external links allowed.\*\*



---



\## Package Description



\*\*One-line:\*\* Zero-dependency TypeScript codebase guardian that enforces architecture, security, performance, and quality rules as a pre-commit hook.



@oxog/codeguardian is a continuous architectural guardian for TypeScript projects. Unlike traditional linters that check syntax, codeguardian understands your project's architectural patterns, enforces them as rules, detects security anti-patterns, catches performance pitfalls, and blocks or warns based on severity — all running as a git pre-commit hook with zero external dependencies. It builds a knowledge graph of your codebase and evaluates every change against that graph.



---



\## NON-NEGOTIABLE RULES



These rules are \*\*ABSOLUTE\*\* and must be followed without exception.



\### 1. ZERO RUNTIME DEPENDENCIES



```json

{

&nbsp; "dependencies": {}  // MUST BE EMPTY - NO EXCEPTIONS

}

```



\- Implement EVERYTHING from scratch

\- No lodash, no axios, no moment - nothing

\- Write your own TypeScript AST parser wrapper (using TypeScript's own compiler API which is a peerDependency)

\- Write your own git diff parser

\- Write your own reporter/formatter

\- If you think you need a dependency, you don't



\*\*Allowed devDependencies only:\*\*

```json

{

&nbsp; "devDependencies": {

&nbsp;   "typescript": "^5.0.0",

&nbsp;   "vitest": "^2.0.0",

&nbsp;   "@vitest/coverage-v8": "^2.0.0",

&nbsp;   "tsup": "^8.0.0",

&nbsp;   "@types/node": "^20.0.0",

&nbsp;   "prettier": "^3.0.0",

&nbsp;   "eslint": "^9.0.0"

&nbsp; }

}

```



\*\*Allowed peerDependencies:\*\*

```json

{

&nbsp; "peerDependencies": {

&nbsp;   "typescript": ">=5.0.0"

&nbsp; }

}

```



> TypeScript is a peerDependency because codeguardian needs `ts.createProgram` and the TypeScript compiler API for AST analysis. The user's project already has TypeScript installed. We do NOT bundle TypeScript — we use whatever version the project has.



\### 2. 100% TEST COVERAGE



\- Every line of code must be tested

\- Every branch must be tested

\- Every function must be tested

\- \*\*All tests must pass\*\* (100% success rate)

\- Use Vitest for testing

\- Coverage thresholds enforced in config



\### 3. MICRO-KERNEL ARCHITECTURE



All packages MUST use plugin-based architecture:



```

┌─────────────────────────────────────────────────────────┐

│                      User Code                           │

│            codeguardian init · codeguardian run           │

├─────────────────────────────────────────────────────────┤

│                  Plugin Registry API                     │

│         use() · register() · unregister() · list()       │

├─────────────┬──────────────┬──────────────┬─────────────┤

│ Architecture│   Security   │ Performance  │    Code     │

│   Plugin    │   Plugin     │   Plugin     │  Quality    │

│  (core)     │   (core)     │   (core)     │  Plugin     │

│             │              │              │  (core)     │

├─────────────┴──────────────┴──────────────┴─────────────┤

│                     Micro Kernel                         │

│  Codebase Graph · Rule Engine · Reporter · Git Hooks    │

└─────────────────────────────────────────────────────────┘

```



\*\*Kernel responsibilities (minimal):\*\*

\- Codebase knowledge graph construction and incremental updates

\- Plugin registration and lifecycle

\- Rule engine (evaluate, collect, severity filter)

\- Reporter (format findings to terminal)

\- Git hook integration (pre-commit)

\- Configuration management (.codeguardian.json)



\### 4. DEVELOPMENT WORKFLOW



Create these documents \*\*FIRST\*\*, before any code:



1\. \*\*SPECIFICATION.md\*\* - Complete package specification

2\. \*\*IMPLEMENTATION.md\*\* - Architecture and design decisions

3\. \*\*TASKS.md\*\* - Ordered task list with dependencies



Only after all three documents are complete, implement code following TASKS.md sequentially.



\### 5. TYPESCRIPT STRICT MODE



```json

{

&nbsp; "compilerOptions": {

&nbsp;   "strict": true,

&nbsp;   "noUncheckedIndexedAccess": true,

&nbsp;   "noImplicitOverride": true,

&nbsp;   "noEmit": true,

&nbsp;   "declaration": true,

&nbsp;   "declarationMap": true,

&nbsp;   "moduleResolution": "bundler",

&nbsp;   "target": "ES2022",

&nbsp;   "module": "ESNext"

&nbsp; }

}

```



\### 6. LLM-NATIVE DESIGN



Package must be designed for both humans AND AI assistants:



\- \*\*llms.txt\*\* file in root (< 2000 tokens)

\- \*\*Predictable API\*\* naming (`create`, `get`, `set`, `use`, `remove`)

\- \*\*Rich JSDoc\*\* with @example on every public API

\- \*\*15+ examples\*\* organized by category

\- \*\*README\*\* optimized for LLM consumption



\### 7. NO EXTERNAL LINKS



\- ✅ GitHub repository URL

\- ✅ Custom domain (codeguardian.oxog.dev)

\- ✅ npm package URL

\- ❌ Social media (Twitter, LinkedIn, etc.)

\- ❌ Discord/Slack links

\- ❌ Email addresses

\- ❌ Donation/sponsor links



---



\## CORE CONCEPTS



\### The Codebase Knowledge Graph



This is the heart of codeguardian and what makes it fundamentally different from ESLint, SonarQube, or any existing tool.



When codeguardian runs for the first time, it scans the entire TypeScript project and builds an in-memory knowledge graph:



```typescript

interface CodebaseGraph {

&nbsp; /\*\* All source files indexed by path \*/

&nbsp; files: Map<string, FileNode>;

&nbsp; /\*\* All exported symbols (functions, classes, types, variables) \*/

&nbsp; symbols: Map<string, SymbolNode>;

&nbsp; /\*\* All imports/exports relationships \*/

&nbsp; edges: ImportEdge\[];

&nbsp; /\*\* Detected architectural layers \*/

&nbsp; layers: LayerDefinition\[];

&nbsp; /\*\* Detected patterns (repository, service, controller, etc.) \*/

&nbsp; patterns: DetectedPattern\[];

&nbsp; /\*\* Module dependency graph (who imports whom) \*/

&nbsp; dependencies: DependencyGraph;

}



interface FileNode {

&nbsp; path: string;

&nbsp; /\*\* Detected role: controller, service, repository, util, type, config, test \*/

&nbsp; role: FileRole;

&nbsp; /\*\* Which architectural layer this file belongs to \*/

&nbsp; layer: string;

&nbsp; /\*\* Exported symbols from this file \*/

&nbsp; exports: string\[];

&nbsp; /\*\* Imported symbols (with source) \*/

&nbsp; imports: ImportInfo\[];

&nbsp; /\*\* Cyclomatic complexity of the file \*/

&nbsp; complexity: number;

&nbsp; /\*\* Lines of code \*/

&nbsp; loc: number;

&nbsp; /\*\* Functions defined in this file \*/

&nbsp; functions: FunctionNode\[];

}



interface SymbolNode {

&nbsp; name: string;

&nbsp; kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'enum';

&nbsp; file: string;

&nbsp; /\*\* Who uses this symbol \*/

&nbsp; usedBy: string\[];

&nbsp; /\*\* What this symbol depends on \*/

&nbsp; dependsOn: string\[];

&nbsp; /\*\* Is this symbol exported from the package entry point? \*/

&nbsp; isPublicAPI: boolean;

}



interface FunctionNode {

&nbsp; name: string;

&nbsp; file: string;

&nbsp; startLine: number;

&nbsp; endLine: number;

&nbsp; /\*\* Parameters with types \*/

&nbsp; params: ParamInfo\[];

&nbsp; /\*\* Return type \*/

&nbsp; returnType: string;

&nbsp; /\*\* Cyclomatic complexity \*/

&nbsp; complexity: number;

&nbsp; /\*\* Does it contain async operations? \*/

&nbsp; isAsync: boolean;

&nbsp; /\*\* Does it access database/external services? \*/

&nbsp; hasSideEffects: boolean;

&nbsp; /\*\* Detected issues in this function \*/

&nbsp; issues: Issue\[];

}

```



\### The Graph Cache



The graph is serialized to `.codeguardian/graph.json` after first scan. On subsequent runs (pre-commit), only changed files (from `git diff --cached`) are re-parsed and the graph is incrementally updated. This makes pre-commit hooks fast (< 2 seconds for typical changes).



```

.codeguardian/

├── graph.json        # Serialized knowledge graph

├── config.json       # Detected project conventions (auto-generated)

└── history.json      # Severity trend over time (optional)

```



\### Incremental Analysis Flow



```

git diff --cached

&nbsp;      │

&nbsp;      ▼

&nbsp; Changed files list

&nbsp;      │

&nbsp;      ▼

&nbsp; Parse only changed files (TypeScript AST)

&nbsp;      │

&nbsp;      ▼

&nbsp; Update graph nodes \& edges for changed files

&nbsp;      │

&nbsp;      ▼

&nbsp; Run rules only on changed files + their direct dependents

&nbsp;      │

&nbsp;      ▼

&nbsp; Collect findings, filter by severity

&nbsp;      │

&nbsp;      ▼

&nbsp; Report to terminal

&nbsp;      │

&nbsp;      ▼

&nbsp; critical found? → exit(1) block commit

&nbsp; only warnings?  → exit(0) allow commit, show warnings

&nbsp; clean?          → exit(0) ✓

```



---



\## CORE FEATURES



\### 1. Codebase Knowledge Graph Builder



Scans TypeScript project using the TypeScript Compiler API (`ts.createProgram`), builds a queryable in-memory graph of all files, symbols, imports, exports, and relationships. Supports incremental updates from git diff.



\*\*API Example:\*\*

```typescript

import { createGuardian } from '@oxog/codeguardian';



const guardian = createGuardian({

&nbsp; rootDir: process.cwd(),

&nbsp; tsconfig: './tsconfig.json',

});



// Full scan (first time or explicit)

const graph = await guardian.scan();

console.log(`Scanned ${graph.files.size} files, ${graph.symbols.size} symbols`);



// Incremental scan (from git diff)

const updated = await guardian.scanIncremental();

console.log(`Updated ${updated.changedFiles.length} files`);

```



\### 2. Plugin-Based Rule Engine



Rules are grouped into plugins. Each plugin contributes a set of rules. Rules receive the graph and changed files, return findings with severity.



\*\*API Example:\*\*

```typescript

import { createGuardian } from '@oxog/codeguardian';

import { architecturePlugin, securityPlugin } from '@oxog/codeguardian/plugins';



const guardian = createGuardian({

&nbsp; rootDir: process.cwd(),

});



// Plugins are loaded by default, but you can configure them

guardian.use(architecturePlugin({

&nbsp; layers: \['controller', 'service', 'repository'],

&nbsp; enforceDirection: true, // controller → service → repository (never reverse)

}));



guardian.use(securityPlugin({

&nbsp; checkInjection: true,

&nbsp; checkAuth: true,

&nbsp; checkSecrets: true,

}));

```



\### 3. Rule Definition Interface



Users and community can define custom rules using a simple interface.



\*\*API Example:\*\*

```typescript

import { defineRule } from '@oxog/codeguardian';



const noConsoleLog = defineRule({

&nbsp; name: 'no-console-in-production',

&nbsp; severity: 'warning',

&nbsp; description: 'Disallow console.log in non-test files',

&nbsp; check: (context) => {

&nbsp;   const { file, ast } = context;

&nbsp;   if (file.role === 'test') return \[];



&nbsp;   const findings: Finding\[] = \[];

&nbsp;   // Walk AST to find console.log calls

&nbsp;   context.walk(ast, {

&nbsp;     CallExpression(node) {

&nbsp;       if (context.isConsoleCall(node, 'log')) {

&nbsp;         findings.push({

&nbsp;           message: 'console.log should not be in production code. Use a logger instead.',

&nbsp;           file: file.path,

&nbsp;           line: node.pos.line,

&nbsp;           column: node.pos.column,

&nbsp;           fix: {

&nbsp;             suggestion: "Replace with your project's logger",

&nbsp;           },

&nbsp;         });

&nbsp;       }

&nbsp;     },

&nbsp;   });



&nbsp;   return findings;

&nbsp; },

});

```



\### 4. Severity-Based Commit Control



Findings are categorized into severity levels. Pre-commit hook behavior depends on severity.



\*\*Severity Levels:\*\*

\- `critical` — Blocks commit. Security vulnerabilities, data exposure, architectural violations that break system integrity.

\- `error` — Blocks commit. Serious issues that will cause bugs or maintenance nightmares.

\- `warning` — Allows commit but shows in terminal. Issues that should be addressed but aren't blocking.

\- `info` — Allows commit, shown only in verbose mode. Suggestions and best practices.



\*\*API Example:\*\*

```typescript

const guardian = createGuardian({

&nbsp; rootDir: process.cwd(),

&nbsp; severity: {

&nbsp;   blockOn: \['critical', 'error'],  // These block commit

&nbsp;   warnOn: \['warning'],              // These show but don't block

&nbsp;   ignoreBelow: 'info',              // These are hidden unless --verbose

&nbsp; },

});

```



\### 5. Git Pre-Commit Hook Integration



Installs itself as a git pre-commit hook. Runs incrementally on staged files only.



\*\*API Example:\*\*

```bash

\# Install hook

npx codeguardian init



\# This creates .git/hooks/pre-commit that runs:

\# npx codeguardian run --staged



\# Manual run on all files

npx codeguardian run



\# Run on staged files only (what pre-commit does)

npx codeguardian run --staged



\# Run with verbose output

npx codeguardian run --verbose



\# Run and output JSON (for CI integration)

npx codeguardian run --format json

```



\### 6. Configuration File



Project-level configuration via `.codeguardian.json` or `codeguardian` field in `package.json`.



\*\*API Example:\*\*

```json

{

&nbsp; "rootDir": ".",

&nbsp; "tsconfig": "./tsconfig.json",

&nbsp; "include": \["src/\*\*/\*.ts"],

&nbsp; "exclude": \["\*\*/\*.test.ts", "\*\*/\*.spec.ts", "\*\*/node\_modules/\*\*"],

&nbsp; "severity": {

&nbsp;   "blockOn": \["critical", "error"],

&nbsp;   "warnOn": \["warning"]

&nbsp; },

&nbsp; "plugins": {

&nbsp;   "architecture": {

&nbsp;     "enabled": true,

&nbsp;     "layers": \["controller", "service", "repository", "util"],

&nbsp;     "enforceDirection": true,

&nbsp;     "maxFileLines": 300,

&nbsp;     "maxFunctionLines": 50,

&nbsp;     "maxFunctionComplexity": 15

&nbsp;   },

&nbsp;   "security": {

&nbsp;     "enabled": true,

&nbsp;     "checkInjection": true,

&nbsp;     "checkAuth": true,

&nbsp;     "checkSecrets": true,

&nbsp;     "checkXSS": true,

&nbsp;     "checkCSRF": true

&nbsp;   },

&nbsp;   "performance": {

&nbsp;     "enabled": true,

&nbsp;     "checkN1Queries": true,

&nbsp;     "checkMemoryLeaks": true,

&nbsp;     "checkAsyncPatterns": true,

&nbsp;     "checkBundleSize": false

&nbsp;   },

&nbsp;   "quality": {

&nbsp;     "enabled": true,

&nbsp;     "checkDeadCode": true,

&nbsp;     "checkNaming": true,

&nbsp;     "checkComplexity": true,

&nbsp;     "maxCyclomaticComplexity": 15

&nbsp;   }

&nbsp; },

&nbsp; "ignore": {

&nbsp;   "rules": \[],

&nbsp;   "files": \[],

&nbsp;   "lines": {}

&nbsp; }

}

```



\### 7. Terminal Reporter



Beautiful, informative terminal output with colors, file locations, and fix suggestions.



\*\*Output Example:\*\*

```

┌─────────────────────────────────────────────────────┐

│  @oxog/codeguardian                                  │

│  Scanning 3 changed files...                         │

└─────────────────────────────────────────────────────┘



✗ CRITICAL  src/controllers/user.controller.ts:45

&nbsp; \[security/sql-injection] Raw string concatenation in SQL query

&nbsp; → Use parameterized queries instead of string templates

&nbsp; 

✗ ERROR     src/services/order.service.ts:112

&nbsp; \[architecture/layer-violation] Service layer importing from controller layer

&nbsp; → Services should not depend on controllers. Invert the dependency.



⚠ WARNING   src/services/order.service.ts:78

&nbsp; \[performance/n1-query] Potential N+1 query: database call inside loop

&nbsp; → Consider batching with Promise.all() or a single query with IN clause



⚠ WARNING   src/utils/helpers.ts:23

&nbsp; \[quality/dead-code] Function 'formatLegacyDate' is never imported

&nbsp; → Remove unused code or add an export if intentional



────────────────────────────────────────────────────────

&nbsp; 2 critical/error (commit blocked)  │  2 warnings

────────────────────────────────────────────────────────

```



\### 8. Inline Suppression



Allow developers to suppress specific rules on specific lines with comments.



\*\*API Example:\*\*

```typescript

// codeguardian-disable-next-line security/sql-injection

const query = `SELECT \* FROM users WHERE id = ${id}`;



// codeguardian-disable security/sql-injection -- legacy code, tracked in JIRA-1234

const query2 = `SELECT \* FROM users WHERE name = '${name}'`;

// codeguardian-enable security/sql-injection

```



\### 9. Auto-Discovery of Project Conventions



On first run, codeguardian analyzes the existing codebase and auto-generates convention rules. For example, if it sees that all files in `src/services/` follow a `\*.service.ts` naming pattern and all export a class, it creates a convention rule for that.



\*\*API Example:\*\*

```typescript

const guardian = createGuardian({

&nbsp; rootDir: process.cwd(),

&nbsp; autoDiscover: true, // Analyze and suggest conventions

});



const conventions = await guardian.discover();

// Returns detected patterns:

// - File naming: src/services/\*.service.ts

// - Export pattern: services export classes

// - Import pattern: controllers import services, never reverse

// - Naming: functions are camelCase, classes are PascalCase

// User can review and accept/modify these in .codeguardian.json

```



---



\## PLUGIN SYSTEM



\### Plugin Interface



```typescript

/\*\*

&nbsp;\* Plugin interface for extending codeguardian with custom analysis rules.

&nbsp;\*

&nbsp;\* @typeParam TConfig - Plugin-specific configuration type

&nbsp;\*

&nbsp;\* @example

&nbsp;\* ```typescript

&nbsp;\* const myPlugin: GuardianPlugin<MyConfig> = {

&nbsp;\*   name: 'my-custom-rules',

&nbsp;\*   version: '1.0.0',

&nbsp;\*   install: (kernel) => {

&nbsp;\*     kernel.registerRule(myRule1);

&nbsp;\*     kernel.registerRule(myRule2);

&nbsp;\*   },

&nbsp;\* };

&nbsp;\* ```

&nbsp;\*/

export interface GuardianPlugin<TConfig = unknown> {

&nbsp; /\*\* Unique plugin identifier (kebab-case) \*/

&nbsp; name: string;



&nbsp; /\*\* Semantic version \*/

&nbsp; version: string;



&nbsp; /\*\* Other plugins this plugin depends on \*/

&nbsp; dependencies?: string\[];



&nbsp; /\*\*

&nbsp;  \* Called when plugin is registered. Register rules here.

&nbsp;  \* @param kernel - The guardian kernel instance

&nbsp;  \*/

&nbsp; install: (kernel: GuardianKernel<TConfig>) => void;



&nbsp; /\*\*

&nbsp;  \* Called after all plugins are installed and graph is ready.

&nbsp;  \* Use for cross-plugin analysis setup.

&nbsp;  \*/

&nbsp; onInit?: (graph: CodebaseGraph) => void | Promise<void>;



&nbsp; /\*\*

&nbsp;  \* Called when plugin is unregistered.

&nbsp;  \*/

&nbsp; onDestroy?: () => void | Promise<void>;



&nbsp; /\*\*

&nbsp;  \* Called on error in this plugin's rules.

&nbsp;  \*/

&nbsp; onError?: (error: Error) => void;

}

```



\### Rule Interface



```typescript

/\*\*

&nbsp;\* A single analysis rule that checks code for issues.

&nbsp;\*

&nbsp;\* @example

&nbsp;\* ```typescript

&nbsp;\* const noAny = defineRule({

&nbsp;\*   name: 'no-any-type',

&nbsp;\*   severity: 'error',

&nbsp;\*   description: 'Disallow usage of `any` type',

&nbsp;\*   category: 'quality',

&nbsp;\*   check: (context) => {

&nbsp;\*     // ... analysis logic

&nbsp;\*     return findings;

&nbsp;\*   },

&nbsp;\* });

&nbsp;\* ```

&nbsp;\*/

export interface Rule {

&nbsp; /\*\* Unique rule identifier: 'plugin-name/rule-name' \*/

&nbsp; name: string;



&nbsp; /\*\* Default severity (can be overridden in config) \*/

&nbsp; severity: Severity;



&nbsp; /\*\* Human-readable description \*/

&nbsp; description: string;



&nbsp; /\*\* Category for grouping in reports \*/

&nbsp; category: 'architecture' | 'security' | 'performance' | 'quality';



&nbsp; /\*\*

&nbsp;  \* Check function that analyzes code and returns findings.

&nbsp;  \* @param context - Analysis context with graph, file, AST, and helpers

&nbsp;  \* @returns Array of findings (issues found)

&nbsp;  \*/

&nbsp; check: (context: RuleContext) => Finding\[] | Promise<Finding\[]>;

}



export interface RuleContext {

&nbsp; /\*\* The file being analyzed \*/

&nbsp; file: FileNode;



&nbsp; /\*\* TypeScript AST of the file \*/

&nbsp; ast: ts.SourceFile;



&nbsp; /\*\* The full codebase graph \*/

&nbsp; graph: CodebaseGraph;



&nbsp; /\*\* TypeScript program (for type checking) \*/

&nbsp; program: ts.Program;



&nbsp; /\*\* TypeScript type checker \*/

&nbsp; checker: ts.TypeChecker;



&nbsp; /\*\* Helper to walk AST nodes \*/

&nbsp; walk: (node: ts.Node, visitors: ASTVisitors) => void;



&nbsp; /\*\* Helper to check if a node is a specific call \*/

&nbsp; isCallTo: (node: ts.CallExpression, name: string) => boolean;



&nbsp; /\*\* Helper to check if a node is a console.\* call \*/

&nbsp; isConsoleCall: (node: ts.CallExpression, method?: string) => boolean;



&nbsp; /\*\* Helper to get the type of a node as string \*/

&nbsp; getTypeString: (node: ts.Node) => string;



&nbsp; /\*\* Helper to check if node contains string concatenation \*/

&nbsp; hasStringConcat: (node: ts.Node) => boolean;



&nbsp; /\*\* Helper to find all imports in a file \*/

&nbsp; getImports: () => ImportInfo\[];



&nbsp; /\*\* Helper to check if a symbol is used outside its file \*/

&nbsp; isExternallyUsed: (symbolName: string) => boolean;



&nbsp; /\*\* Plugin configuration \*/

&nbsp; config: Record<string, unknown>;

}



export interface Finding {

&nbsp; /\*\* Human-readable message describing the issue \*/

&nbsp; message: string;



&nbsp; /\*\* Absolute file path \*/

&nbsp; file: string;



&nbsp; /\*\* Line number (1-based) \*/

&nbsp; line: number;



&nbsp; /\*\* Column number (1-based) \*/

&nbsp; column: number;



&nbsp; /\*\* Rule that generated this finding \*/

&nbsp; rule?: string;



&nbsp; /\*\* Severity (inherited from rule if not set) \*/

&nbsp; severity?: Severity;



&nbsp; /\*\* Optional fix suggestion \*/

&nbsp; fix?: {

&nbsp;   /\*\* Text description of suggested fix \*/

&nbsp;   suggestion: string;

&nbsp;   /\*\* Optional: replacement text (for auto-fix in future) \*/

&nbsp;   replacement?: string;

&nbsp; };

}



export type Severity = 'critical' | 'error' | 'warning' | 'info';

```



\### Core Plugins (Always Loaded)



| Plugin | Description |

|--------|-------------|

| `architecture` | Enforces layer boundaries, detects circular dependencies, validates file/folder structure conventions, checks import direction rules |

| `security` | Detects SQL injection patterns, hardcoded secrets, missing auth checks, XSS vulnerabilities, unsafe eval usage, prototype pollution |

| `performance` | Catches N+1 query patterns, memory leaks (event listener accumulation), sync operations in async context, unnecessary re-renders, large bundle imports |

| `quality` | Checks cyclomatic complexity, dead code detection, naming conventions, function/file length limits, any type usage, missing error handling |



\### Optional Plugins (Opt-in, shipped but disabled by default)



| Plugin | Description | Enable |

|--------|-------------|--------|

| `naming-convention` | Enforces strict file naming (\*.service.ts, \*.controller.ts, etc.) | `plugins.naming.enabled: true` |

| `api-consistency` | Checks REST API endpoint naming, response format consistency | `plugins.api.enabled: true` |

| `test-coverage-guard` | Ensures changed files have corresponding test files | `plugins.testGuard.enabled: true` |

| `dependency-audit` | Checks import depth, warns on heavy transitive dependencies | `plugins.depAudit.enabled: true` |



---



\## DETAILED RULE SPECIFICATIONS



\### Architecture Plugin Rules



```typescript

// architecture/layer-violation

// Detects when a lower layer imports from a higher layer

// e.g., service importing from controller

// Uses the configured layer order: controller → service → repository → util

// Severity: error



// architecture/circular-dependency

// Detects circular import chains: A → B → C → A

// Uses the dependency graph from the knowledge graph

// Severity: error



// architecture/file-role-mismatch

// Detects when a file's content doesn't match its directory role

// e.g., a file in src/services/ that exports a React component

// Severity: warning



// architecture/god-file

// Detects files exceeding maxFileLines (default: 300)

// Severity: warning



// architecture/god-function

// Detects functions exceeding maxFunctionLines (default: 50)

// Severity: warning



// architecture/barrel-explosion

// Detects barrel files (index.ts) that re-export everything

// causing bundle size issues

// Severity: info

```



\### Security Plugin Rules



```typescript

// security/sql-injection

// Detects string concatenation or template literals used in

// database query methods (.query(), .execute(), .raw(), etc.)

// Looks for patterns like: db.query(`SELECT \* FROM ${table}`)

// Severity: critical



// security/hardcoded-secret

// Detects strings that look like API keys, tokens, passwords

// Patterns: /^(sk\_|pk\_|api\_|token\_|secret\_|password)/

// Also checks: JWT tokens, AWS keys, connection strings

// Severity: critical



// security/eval-usage

// Detects eval(), Function(), new Function(), setTimeout(string)

// Severity: critical



// security/prototype-pollution

// Detects direct assignment to Object.prototype or

// unchecked property access from user input

// Severity: error



// security/xss-risk

// Detects innerHTML, dangerouslySetInnerHTML, document.write

// with non-sanitized input

// Severity: error



// security/missing-auth-check

// Detects controller/route handler functions that don't

// reference any auth middleware or auth check

// Severity: warning



// security/insecure-random

// Detects Math.random() used in security-sensitive contexts

// (token generation, ID creation, etc.)

// Severity: warning



// security/path-traversal

// Detects file operations with user input that could

// allow path traversal (../../etc/passwd)

// Severity: error

```



\### Performance Plugin Rules



```typescript

// performance/n1-query

// Detects database calls inside loops (for, while, forEach, map)

// Looks for: .find(), .findOne(), .query(), .execute() inside loops

// Severity: warning



// performance/sync-in-async

// Detects synchronous file operations (readFileSync, writeFileSync)

// in async functions or route handlers

// Severity: warning



// performance/memory-leak-risk

// Detects addEventListener without corresponding removeEventListener

// Detects setInterval without clearInterval

// Detects growing arrays/maps in module scope

// Severity: warning



// performance/unbounded-query

// Detects database queries without LIMIT or pagination

// Severity: warning



// performance/missing-index-hint

// Detects queries filtering on fields that aren't in any

// known index (requires schema plugin or annotations)

// Severity: info



// performance/heavy-import

// Detects importing entire libraries when only one function is needed

// e.g., import \_ from 'lodash' vs import map from 'lodash/map'

// Severity: info



// performance/blocking-operation

// Detects CPU-intensive operations (large JSON.parse, crypto, regex)

// in request handlers without async delegation

// Severity: warning

```



\### Quality Plugin Rules



```typescript

// quality/cyclomatic-complexity

// Functions exceeding maxCyclomaticComplexity (default: 15)

// Severity: warning



// quality/dead-code

// Exported symbols never imported by any other file

// Non-exported functions never called within their file

// Severity: warning



// quality/any-type

// Usage of `any` type annotation

// Severity: warning



// quality/no-error-handling

// Async functions without try-catch or .catch()

// Promise chains without error handling

// Severity: warning



// quality/inconsistent-naming

// Functions/variables not following project's naming convention

// (detected via auto-discovery or configured)

// Severity: info



// quality/magic-number

// Numeric literals used directly in logic (not in constants)

// Excludes: 0, 1, -1, common HTTP status codes

// Severity: info



// quality/empty-catch

// catch blocks that don't handle or re-throw the error

// Severity: warning



// quality/nested-callbacks

// More than 3 levels of nested callbacks/promises

// Severity: warning

```



---



\## CLI INTERFACE



```bash

\# Initialize codeguardian in a project

codeguardian init

\# → Creates .codeguardian.json with auto-discovered conventions

\# → Installs git pre-commit hook

\# → Runs first full scan and builds graph



\# Run analysis on all files

codeguardian run



\# Run analysis on staged files only (pre-commit mode)

codeguardian run --staged



\# Run with specific plugins only

codeguardian run --plugin architecture --plugin security



\# Run with verbose output (show info-level findings too)

codeguardian run --verbose



\# Run and output JSON (for CI/CD integration)

codeguardian run --format json



\# Run and output SARIF (for GitHub Code Scanning)

codeguardian run --format sarif



\# Show the current codebase graph stats

codeguardian stats



\# List all registered rules

codeguardian rules



\# List all detected conventions

codeguardian conventions



\# Rebuild the full graph (force re-scan)

codeguardian scan --full



\# Uninstall hook

codeguardian uninstall

```



\### CLI Implementation



The CLI is built using the package's own simple arg parser (no commander.js, no yargs — zero dependencies). The bin entry in package.json points to `dist/cli.js`.



```json

{

&nbsp; "bin": {

&nbsp;   "codeguardian": "./dist/cli.js"

&nbsp; }

}

```



---



\## API DESIGN



\### Main Export



```typescript

import { createGuardian, defineRule, definePlugin } from '@oxog/codeguardian';



// Create guardian instance

const guardian = createGuardian({

&nbsp; rootDir: process.cwd(),

&nbsp; tsconfig: './tsconfig.json',

&nbsp; config: '.codeguardian.json', // or inline config object

});



// Scan the project

const graph = await guardian.scan();



// Run analysis

const result = await guardian.run({

&nbsp; staged: false,     // true = only git staged files

&nbsp; verbose: false,    // true = include info-level findings

&nbsp; plugins: \[],       // empty = all enabled plugins

});



// result.findings: Finding\[]

// result.stats: { files: number, rules: number, duration: number }

// result.blocked: boolean (true if any critical/error found)



// Access the graph programmatically

const fileNode = guardian.graph.getFile('src/services/user.service.ts');

const symbol = guardian.graph.getSymbol('UserService');

const deps = guardian.graph.getDependencies('src/controllers/user.controller.ts');

const circular = guardian.graph.findCircularDeps();

```



\### Type Definitions



```typescript

/\*\* Configuration for creating a guardian instance \*/

export interface GuardianConfig {

&nbsp; /\*\* Root directory of the project \*/

&nbsp; rootDir: string;

&nbsp; /\*\* Path to tsconfig.json (default: './tsconfig.json') \*/

&nbsp; tsconfig?: string;

&nbsp; /\*\* Path to .codeguardian.json or inline config \*/

&nbsp; config?: string | InlineConfig;

&nbsp; /\*\* Auto-discover project conventions on first run \*/

&nbsp; autoDiscover?: boolean;

}



/\*\* Inline configuration (same shape as .codeguardian.json) \*/

export interface InlineConfig {

&nbsp; include?: string\[];

&nbsp; exclude?: string\[];

&nbsp; severity?: SeverityConfig;

&nbsp; plugins?: PluginConfigs;

&nbsp; ignore?: IgnoreConfig;

}



/\*\* Severity configuration \*/

export interface SeverityConfig {

&nbsp; /\*\* Severity levels that block commit (default: \['critical', 'error']) \*/

&nbsp; blockOn: Severity\[];

&nbsp; /\*\* Severity levels that warn but don't block (default: \['warning']) \*/

&nbsp; warnOn: Severity\[];

&nbsp; /\*\* Hide findings below this severity (default: 'info') \*/

&nbsp; ignoreBelow?: Severity;

}



/\*\* Run options \*/

export interface RunOptions {

&nbsp; /\*\* Only analyze git staged files \*/

&nbsp; staged?: boolean;

&nbsp; /\*\* Include info-level findings \*/

&nbsp; verbose?: boolean;

&nbsp; /\*\* Only run specific plugins \*/

&nbsp; plugins?: string\[];

&nbsp; /\*\* Output format \*/

&nbsp; format?: 'terminal' | 'json' | 'sarif';

}



/\*\* Analysis result \*/

export interface RunResult {

&nbsp; /\*\* All findings from all plugins \*/

&nbsp; findings: Finding\[];

&nbsp; /\*\* Execution statistics \*/

&nbsp; stats: RunStats;

&nbsp; /\*\* Whether the commit should be blocked \*/

&nbsp; blocked: boolean;

&nbsp; /\*\* Grouped findings by severity \*/

&nbsp; bySeverity: Record<Severity, Finding\[]>;

&nbsp; /\*\* Grouped findings by file \*/

&nbsp; byFile: Record<string, Finding\[]>;

}



export interface RunStats {

&nbsp; /\*\* Number of files analyzed \*/

&nbsp; filesAnalyzed: number;

&nbsp; /\*\* Number of rules executed \*/

&nbsp; rulesExecuted: number;

&nbsp; /\*\* Total execution time in milliseconds \*/

&nbsp; duration: number;

&nbsp; /\*\* Time spent parsing ASTs \*/

&nbsp; parseTime: number;

&nbsp; /\*\* Time spent running rules \*/

&nbsp; analysisTime: number;

}

```



---



\## TECHNICAL REQUIREMENTS



| Requirement | Value |

|-------------|-------|

| Runtime | Node.js only |

| Module Format | ESM + CJS |

| Node.js Version | >= 18 |

| TypeScript Version | >= 5.0 (peer dependency) |

| Bundle Size (core) | < 5KB gzipped |

| Bundle Size (all plugins) | < 15KB gzipped |



---



\## PERFORMANCE TARGETS



\- \*\*Full scan\*\* of 500-file project: < 10 seconds

\- \*\*Incremental scan\*\* (pre-commit, 5 changed files): < 2 seconds

\- \*\*Graph serialization/deserialization\*\*: < 500ms

\- \*\*Memory usage\*\*: < 200MB for 1000-file project



These targets should be validated with benchmarks in tests.



---



\## LLM-NATIVE REQUIREMENTS



\### 1. llms.txt File



Create `/llms.txt` in project root (< 2000 tokens):



```markdown

\# @oxog/codeguardian



> Zero-dependency TypeScript codebase guardian. Pre-commit hook that enforces architecture, security, performance, and quality rules.



\## Install



npm install @oxog/codeguardian --save-dev

npx codeguardian init



\## Basic Usage



// In .codeguardian.json

{

&nbsp; "plugins": {

&nbsp;   "architecture": { "enabled": true },

&nbsp;   "security": { "enabled": true },

&nbsp;   "performance": { "enabled": true },

&nbsp;   "quality": { "enabled": true }

&nbsp; }

}



// Programmatic

import { createGuardian } from '@oxog/codeguardian';

const guardian = createGuardian({ rootDir: '.' });

const result = await guardian.run({ staged: true });



\## API Summary



\### Guardian

\- `createGuardian(config)` - Create instance

\- `guardian.scan()` - Full codebase scan

\- `guardian.scanIncremental()` - Scan changed files only

\- `guardian.run(options)` - Run analysis

\- `guardian.graph` - Access codebase knowledge graph



\### Rules

\- `defineRule({ name, severity, check })` - Create custom rule

\- `definePlugin({ name, install })` - Create custom plugin



\### CLI

\- `codeguardian init` - Setup project

\- `codeguardian run` - Analyze all files

\- `codeguardian run --staged` - Analyze staged files

\- `codeguardian stats` - Show graph statistics

\- `codeguardian rules` - List all rules



\## Core Plugins

\- `architecture` - Layer violations, circular deps, god files

\- `security` - SQL injection, hardcoded secrets, eval, XSS

\- `performance` - N+1 queries, memory leaks, sync operations

\- `quality` - Complexity, dead code, any type, naming



\## Common Patterns



\### Custom Rule

import { defineRule } from '@oxog/codeguardian';

const rule = defineRule({

&nbsp; name: 'no-console',

&nbsp; severity: 'warning',

&nbsp; check: (ctx) => { /\* return Finding\[] \*/ },

});



\### Severity Config

{ "severity": { "blockOn": \["critical", "error"], "warnOn": \["warning"] } }



\### Inline Suppression

// codeguardian-disable-next-line security/sql-injection



\## Links

\- Docs: https://codeguardian.oxog.dev

\- GitHub: https://github.com/ersinkoc/codeguardian

```



\### 2. API Naming Standards



Use predictable patterns LLMs can infer:



```typescript

// ✅ GOOD - Predictable

createGuardian()     // Factory function

guardian.scan()      // Scan codebase

guardian.run()       // Run analysis

guardian.use()       // Register plugin

defineRule()         // Create rule

definePlugin()       // Create plugin

graph.getFile()      // Read single file node

graph.getSymbol()    // Read single symbol

graph.findCircularDeps()  // Find circular deps



// ❌ BAD - Unpredictable

analyze()            // Too vague

exec()               // Too short

processCode()        // Unclear scope

```



---



\## PROJECT STRUCTURE



```

codeguardian/

├── .github/

│   └── workflows/

│       └── deploy.yml          # Website deploy only

├── src/

│   ├── index.ts                # Main entry: createGuardian, defineRule, definePlugin

│   ├── kernel.ts               # Micro kernel: plugin registry, rule engine, event bus

│   ├── types.ts                # All type definitions (CodebaseGraph, Rule, Finding, etc.)

│   ├── errors.ts               # Custom error classes

│   ├── graph/

│   │   ├── builder.ts          # Graph construction from TypeScript AST

│   │   ├── cache.ts            # Graph serialization/deserialization

│   │   ├── incremental.ts      # Incremental graph updates from git diff

│   │   └── query.ts            # Graph query helpers (getDeps, findCircular, etc.)

│   ├── git/

│   │   ├── diff.ts             # Parse git diff --cached output

│   │   ├── hooks.ts            # Install/uninstall pre-commit hook

│   │   └── staged.ts           # Get list of staged files

│   ├── ast/

│   │   ├── parser.ts           # TypeScript AST parsing wrapper

│   │   ├── walker.ts           # AST visitor/walker utility

│   │   └── helpers.ts          # AST query helpers (isCallTo, getType, etc.)

│   ├── rules/

│   │   ├── engine.ts           # Rule execution engine

│   │   ├── context.ts          # RuleContext factory

│   │   └── suppression.ts      # Inline comment suppression parser

│   ├── config/

│   │   ├── loader.ts           # Load .codeguardian.json or package.json

│   │   ├── defaults.ts         # Default configuration values

│   │   └── validator.ts        # Config schema validation

│   ├── reporter/

│   │   ├── terminal.ts         # Colored terminal output

│   │   ├── json.ts             # JSON output

│   │   └── sarif.ts            # SARIF output for GitHub

│   ├── discovery/

│   │   └── conventions.ts      # Auto-discover project conventions

│   ├── cli.ts                  # CLI entry point (bin)

│   ├── plugins/

│   │   ├── index.ts            # Plugin exports

│   │   ├── core/

│   │   │   ├── architecture.ts # Architecture rules plugin

│   │   │   ├── security.ts     # Security rules plugin

│   │   │   ├── performance.ts  # Performance rules plugin

│   │   │   └── quality.ts      # Quality rules plugin

│   │   └── optional/

│   │       ├── naming.ts       # Naming convention plugin

│   │       ├── api.ts          # API consistency plugin

│   │       ├── test-guard.ts   # Test coverage guard plugin

│   │       └── dep-audit.ts    # Dependency audit plugin

│   └── utils/

│       ├── glob.ts             # Simple glob matching (no minimatch)

│       ├── color.ts            # Terminal colors (no chalk)

│       ├── args.ts             # CLI argument parser (no commander)

│       ├── fs.ts               # File system helpers

│       └── crypto.ts           # Simple hash for cache invalidation

├── tests/

│   ├── unit/

│   │   ├── graph/

│   │   ├── git/

│   │   ├── ast/

│   │   ├── rules/

│   │   ├── config/

│   │   ├── reporter/

│   │   └── plugins/

│   ├── integration/

│   │   ├── full-scan.test.ts

│   │   ├── incremental.test.ts

│   │   ├── pre-commit.test.ts

│   │   └── cli.test.ts

│   └── fixtures/

│       ├── sample-project/     # A small TS project for testing

│       ├── violations/         # Files with known violations

│       └── clean/              # Files with no violations

├── examples/

│   ├── 01-basic/

│   │   ├── setup.ts            # Basic project setup

│   │   ├── first-scan.ts       # Running first scan

│   │   └── pre-commit.ts       # Pre-commit usage

│   ├── 02-plugins/

│   │   ├── custom-rule.ts      # Creating a custom rule

│   │   ├── custom-plugin.ts    # Creating a custom plugin

│   │   └── plugin-config.ts    # Configuring built-in plugins

│   ├── 03-error-handling/

│   │   ├── suppression.ts      # Inline suppression

│   │   └── severity-config.ts  # Severity configuration

│   ├── 04-typescript/

│   │   ├── type-aware-rules.ts # Rules using type checker

│   │   └── generic-analysis.ts # Analyzing generic types

│   ├── 05-integrations/

│   │   ├── ci-github.ts        # GitHub Actions integration

│   │   ├── ci-gitlab.ts        # GitLab CI integration

│   │   └── vscode.ts           # VS Code task integration

│   └── 06-real-world/

│       ├── express-api.ts      # Guardian for Express project

│       ├── nextjs-app.ts       # Guardian for Next.js project

│       └── monorepo.ts         # Guardian for monorepo

├── website/                    # React + Vite site → codeguardian.oxog.dev

│   ├── public/

│   │   ├── CNAME               # codeguardian.oxog.dev

│   │   └── llms.txt            # LLM reference (copied from root)

│   ├── src/

│   ├── package.json

│   └── vite.config.ts

├── llms.txt                    # LLM-optimized reference (< 2000 tokens)

├── SPECIFICATION.md            # Package spec

├── IMPLEMENTATION.md           # Architecture design

├── TASKS.md                    # Task breakdown

├── README.md

├── CHANGELOG.md

├── LICENSE

├── package.json

├── tsconfig.json

├── tsup.config.ts

├── vitest.config.ts

└── .gitignore

```



---



\## CONFIG FILES



\### tsup.config.ts



```typescript

import { defineConfig } from 'tsup';



export default defineConfig({

&nbsp; entry: \['src/index.ts', 'src/plugins/index.ts', 'src/cli.ts'],

&nbsp; format: \['cjs', 'esm'],

&nbsp; dts: true,

&nbsp; splitting: false,

&nbsp; sourcemap: true,

&nbsp; clean: true,

&nbsp; treeshake: true,

&nbsp; minify: false,

&nbsp; banner: {

&nbsp;   // Add shebang for CLI entry

&nbsp;   js: (ctx) => ctx.options.entry?.includes?.('src/cli.ts')

&nbsp;     ? '#!/usr/bin/env node'

&nbsp;     : '',

&nbsp; },

});

```



\### vitest.config.ts



```typescript

import { defineConfig } from 'vitest/config';



export default defineConfig({

&nbsp; test: {

&nbsp;   globals: true,

&nbsp;   environment: 'node',

&nbsp;   include: \['tests/\*\*/\*.test.ts'],

&nbsp;   coverage: {

&nbsp;     provider: 'v8',

&nbsp;     reporter: \['text', 'json', 'html'],

&nbsp;     exclude: \[

&nbsp;       'node\_modules/',

&nbsp;       'tests/',

&nbsp;       'website/',

&nbsp;       'examples/',

&nbsp;       '\*.config.\*',

&nbsp;     ],

&nbsp;     thresholds: {

&nbsp;       lines: 100,

&nbsp;       functions: 100,

&nbsp;       branches: 100,

&nbsp;       statements: 100,

&nbsp;     },

&nbsp;   },

&nbsp; },

});

```



\### package.json



```json

{

&nbsp; "name": "@oxog/codeguardian",

&nbsp; "version": "1.0.0",

&nbsp; "description": "Zero-dependency TypeScript codebase guardian - pre-commit hook enforcing architecture, security, performance, and quality rules",

&nbsp; "type": "module",

&nbsp; "main": "./dist/index.cjs",

&nbsp; "module": "./dist/index.js",

&nbsp; "types": "./dist/index.d.ts",

&nbsp; "bin": {

&nbsp;   "codeguardian": "./dist/cli.js"

&nbsp; },

&nbsp; "exports": {

&nbsp;   ".": {

&nbsp;     "import": {

&nbsp;       "types": "./dist/index.d.ts",

&nbsp;       "default": "./dist/index.js"

&nbsp;     },

&nbsp;     "require": {

&nbsp;       "types": "./dist/index.d.cts",

&nbsp;       "default": "./dist/index.cjs"

&nbsp;     }

&nbsp;   },

&nbsp;   "./plugins": {

&nbsp;     "import": {

&nbsp;       "types": "./dist/plugins/index.d.ts",

&nbsp;       "default": "./dist/plugins/index.js"

&nbsp;     },

&nbsp;     "require": {

&nbsp;       "types": "./dist/plugins/index.d.cts",

&nbsp;       "default": "./dist/plugins/index.cjs"

&nbsp;     }

&nbsp;   }

&nbsp; },

&nbsp; "files": \["dist"],

&nbsp; "sideEffects": false,

&nbsp; "scripts": {

&nbsp;   "build": "tsup",

&nbsp;   "test": "vitest run",

&nbsp;   "test:watch": "vitest",

&nbsp;   "test:coverage": "vitest run --coverage",

&nbsp;   "lint": "eslint src/",

&nbsp;   "format": "prettier --write .",

&nbsp;   "typecheck": "tsc --noEmit",

&nbsp;   "prepublishOnly": "npm run build \&\& npm run test:coverage"

&nbsp; },

&nbsp; "keywords": \[

&nbsp;   "typescript",

&nbsp;   "code-quality",

&nbsp;   "architecture",

&nbsp;   "security",

&nbsp;   "pre-commit",

&nbsp;   "guardian",

&nbsp;   "static-analysis",

&nbsp;   "linter",

&nbsp;   "code-review",

&nbsp;   "ast",

&nbsp;   "codebase",

&nbsp;   "oxog"

&nbsp; ],

&nbsp; "author": "Ersin Koç",

&nbsp; "license": "MIT",

&nbsp; "repository": {

&nbsp;   "type": "git",

&nbsp;   "url": "git+https://github.com/ersinkoc/codeguardian.git"

&nbsp; },

&nbsp; "bugs": {

&nbsp;   "url": "https://github.com/ersinkoc/codeguardian/issues"

&nbsp; },

&nbsp; "homepage": "https://codeguardian.oxog.dev",

&nbsp; "engines": {

&nbsp;   "node": ">=18"

&nbsp; },

&nbsp; "peerDependencies": {

&nbsp;   "typescript": ">=5.0.0"

&nbsp; },

&nbsp; "devDependencies": {

&nbsp;   "@types/node": "^20.0.0",

&nbsp;   "@vitest/coverage-v8": "^2.0.0",

&nbsp;   "eslint": "^9.0.0",

&nbsp;   "prettier": "^3.0.0",

&nbsp;   "tsup": "^8.0.0",

&nbsp;   "typescript": "^5.0.0",

&nbsp;   "vitest": "^2.0.0"

&nbsp; }

}

```



---



\## IMPLEMENTATION CHECKLIST



\### Before Starting

\- \[ ] Create SPECIFICATION.md with complete spec

\- \[ ] Create IMPLEMENTATION.md with architecture

\- \[ ] Create TASKS.md with ordered task list

\- \[ ] All three documents reviewed and complete



\### During Implementation

\- \[ ] Follow TASKS.md sequentially

\- \[ ] Write tests before or with each feature

\- \[ ] Maintain 100% coverage throughout

\- \[ ] JSDoc on every public API with @example

\- \[ ] Create examples as features are built



\### Package Completion

\- \[ ] All tests passing (100%)

\- \[ ] Coverage at 100% (lines, branches, functions)

\- \[ ] No TypeScript errors

\- \[ ] ESLint passes

\- \[ ] Package builds without errors

\- \[ ] CLI works: `codeguardian init`, `codeguardian run`, `codeguardian run --staged`



\### LLM-Native Completion

\- \[ ] llms.txt created (< 2000 tokens)

\- \[ ] llms.txt copied to website/public/

\- \[ ] README first 500 tokens optimized

\- \[ ] All public APIs have JSDoc + @example

\- \[ ] 15+ examples in organized folders

\- \[ ] package.json has 12 keywords

\- \[ ] API uses standard naming patterns



\### Website Completion

\- \[ ] All pages implemented

\- \[ ] IDE-style code blocks with line numbers

\- \[ ] Copy buttons working

\- \[ ] Dark/Light theme toggle

\- \[ ] CNAME file with codeguardian.oxog.dev

\- \[ ] Mobile responsive

\- \[ ] Footer with Ersin Koç, MIT, GitHub only



\### Final Verification

\- \[ ] `npm run build` succeeds

\- \[ ] `npm run test:coverage` shows 100%

\- \[ ] Website builds without errors

\- \[ ] All examples run successfully

\- \[ ] README is complete and accurate

\- \[ ] CLI integration test passes (init → scan → run on fixture project)



---



\## BEGIN IMPLEMENTATION



Start by creating \*\*SPECIFICATION.md\*\* with the complete package specification based on everything above.



Then create \*\*IMPLEMENTATION.md\*\* with architecture decisions.



Then create \*\*TASKS.md\*\* with ordered, numbered tasks.



Only after all three documents are complete, begin implementing code by following TASKS.md sequentially.



\*\*Remember:\*\*

\- This package will be published to npm

\- It must be production-ready

\- Zero runtime dependencies (TypeScript is peer dependency)

\- 100% test coverage

\- Professionally documented

\- LLM-native design

\- Beautiful documentation website

\- The CLI must work end-to-end: init → scan → pre-commit hook → run → report

