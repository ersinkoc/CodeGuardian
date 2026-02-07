import type ts from 'typescript';

// ─── Severity ───────────────────────────────────────────────

/** Severity level for findings. */
export type Severity = 'critical' | 'error' | 'warning' | 'info';

/** Ordered severity levels from most to least severe. */
export const SEVERITY_ORDER: readonly Severity[] = [
  'critical',
  'error',
  'warning',
  'info',
] as const;

// ─── File Roles ─────────────────────────────────────────────

/** Detected role of a source file based on path and content. */
export type FileRole =
  | 'controller'
  | 'service'
  | 'repository'
  | 'util'
  | 'type'
  | 'config'
  | 'test'
  | 'unknown';

// ─── Graph Types ────────────────────────────────────────────

/**
 * Information about a single import statement.
 *
 * @example
 * ```typescript
 * const info: ImportInfo = {
 *   source: './user.service',
 *   specifiers: ['UserService'],
 *   isTypeOnly: false,
 * };
 * ```
 */
export interface ImportInfo {
  /** Module specifier (e.g., './user.service') */
  source: string;
  /** Imported names */
  specifiers: string[];
  /** Whether this is a type-only import */
  isTypeOnly: boolean;
}

/**
 * An edge in the import dependency graph.
 *
 * @example
 * ```typescript
 * const edge: ImportEdge = {
 *   from: 'src/controllers/user.controller.ts',
 *   to: 'src/services/user.service.ts',
 *   specifiers: ['UserService'],
 *   isTypeOnly: false,
 * };
 * ```
 */
export interface ImportEdge {
  /** Importing file path */
  from: string;
  /** Imported file path */
  to: string;
  /** Imported symbol names */
  specifiers: string[];
  /** Whether type-only import */
  isTypeOnly: boolean;
}

/** Parameter information for a function. */
export interface ParamInfo {
  name: string;
  type: string;
  optional: boolean;
}

/** An issue detected in a function during graph building. */
export interface Issue {
  message: string;
  line: number;
  column: number;
}

/**
 * A node representing a source file in the codebase graph.
 *
 * @example
 * ```typescript
 * const file: FileNode = {
 *   path: 'src/services/user.service.ts',
 *   role: 'service',
 *   layer: 'service',
 *   exports: ['UserService'],
 *   imports: [],
 *   complexity: 5,
 *   loc: 120,
 *   functions: [],
 * };
 * ```
 */
export interface FileNode {
  /** Relative file path */
  path: string;
  /** Detected role */
  role: FileRole;
  /** Architectural layer */
  layer: string;
  /** Exported symbol names */
  exports: string[];
  /** Import information */
  imports: ImportInfo[];
  /** Cyclomatic complexity (sum of all functions) */
  complexity: number;
  /** Lines of code */
  loc: number;
  /** Functions defined in this file */
  functions: FunctionNode[];
}

/**
 * A node representing a function in the codebase graph.
 *
 * @example
 * ```typescript
 * const fn: FunctionNode = {
 *   name: 'getUser',
 *   file: 'src/services/user.service.ts',
 *   startLine: 10,
 *   endLine: 25,
 *   params: [{ name: 'id', type: 'string', optional: false }],
 *   returnType: 'Promise<User>',
 *   complexity: 3,
 *   isAsync: true,
 *   hasSideEffects: true,
 *   issues: [],
 * };
 * ```
 */
export interface FunctionNode {
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

/**
 * A node representing an exported symbol.
 *
 * @example
 * ```typescript
 * const sym: SymbolNode = {
 *   name: 'UserService',
 *   kind: 'class',
 *   file: 'src/services/user.service.ts',
 *   usedBy: ['src/controllers/user.controller.ts'],
 *   dependsOn: ['src/repositories/user.repository.ts'],
 *   isPublicAPI: true,
 * };
 * ```
 */
export interface SymbolNode {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'enum';
  file: string;
  usedBy: string[];
  dependsOn: string[];
  isPublicAPI: boolean;
}

/** Architectural layer definition. */
export interface LayerDefinition {
  name: string;
  order: number;
  patterns: string[];
}

/** A detected pattern in the codebase. */
export interface DetectedPattern {
  type: string;
  description: string;
  files: string[];
  confidence: number;
}

/** Module dependency graph (adjacency list). */
export interface DependencyGraph {
  /** Map of file path → set of file paths it depends on */
  adjacency: Map<string, Set<string>>;
}

/**
 * The codebase knowledge graph — core data structure.
 *
 * @example
 * ```typescript
 * const graph: CodebaseGraph = {
 *   files: new Map(),
 *   symbols: new Map(),
 *   edges: [],
 *   layers: [],
 *   patterns: [],
 *   dependencies: { adjacency: new Map() },
 * };
 * ```
 */
export interface CodebaseGraph {
  files: Map<string, FileNode>;
  symbols: Map<string, SymbolNode>;
  edges: ImportEdge[];
  layers: LayerDefinition[];
  patterns: DetectedPattern[];
  dependencies: DependencyGraph;
}

// ─── Finding ────────────────────────────────────────────────

/**
 * A single finding (issue) detected by a rule.
 *
 * @example
 * ```typescript
 * const finding: Finding = {
 *   message: 'console.log should not be in production code',
 *   file: 'src/services/user.service.ts',
 *   line: 42,
 *   column: 5,
 *   rule: 'quality/no-console',
 *   severity: 'warning',
 *   fix: { suggestion: 'Use a logger instead' },
 * };
 * ```
 */
export interface Finding {
  message: string;
  file: string;
  line: number;
  column: number;
  rule?: string;
  severity?: Severity;
  fix?: {
    suggestion: string;
    replacement?: string;
  };
}

// ─── Rule ───────────────────────────────────────────────────

/** Category for grouping rules. */
export type RuleCategory = 'architecture' | 'security' | 'performance' | 'quality';

/** AST visitor function map. */
export type ASTVisitors = {
  [K in string]?: (node: ts.Node) => void;
};

/**
 * Context provided to rules during analysis.
 *
 * @example
 * ```typescript
 * const check = (context: RuleContext) => {
 *   const findings: Finding[] = [];
 *   context.walk(context.ast, {
 *     CallExpression(node) {
 *       if (context.isConsoleCall(node as ts.CallExpression)) {
 *         findings.push({ message: 'No console', file: context.file.path, line: 1, column: 1 });
 *       }
 *     },
 *   });
 *   return findings;
 * };
 * ```
 */
export interface RuleContext {
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

/**
 * A single analysis rule.
 *
 * @example
 * ```typescript
 * const rule: Rule = {
 *   name: 'quality/no-any',
 *   severity: 'warning',
 *   description: 'Disallow any type',
 *   category: 'quality',
 *   check: (ctx) => [],
 * };
 * ```
 */
export interface Rule {
  name: string;
  severity: Severity;
  description: string;
  category: RuleCategory;
  check: (context: RuleContext) => Finding[] | Promise<Finding[]>;
}

// ─── Plugin ─────────────────────────────────────────────────

/**
 * The kernel interface exposed to plugins during installation.
 *
 * @example
 * ```typescript
 * const install = (kernel: GuardianKernel) => {
 *   kernel.registerRule(myRule);
 * };
 * ```
 */
export interface GuardianKernel<TConfig = unknown> {
  registerRule: (rule: Rule) => void;
  unregisterRule: (name: string) => void;
  getRules: () => Rule[];
  getConfig: () => TConfig;
}

/**
 * Plugin interface for extending codeguardian.
 *
 * @typeParam TConfig - Plugin-specific configuration type
 *
 * @example
 * ```typescript
 * const myPlugin: GuardianPlugin = {
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   install: (kernel) => {
 *     kernel.registerRule(myRule);
 *   },
 * };
 * ```
 */
export interface GuardianPlugin<TConfig = unknown> {
  name: string;
  version: string;
  dependencies?: string[];
  install: (kernel: GuardianKernel<TConfig>) => void;
  onInit?: (graph: CodebaseGraph) => void | Promise<void>;
  onDestroy?: () => void | Promise<void>;
  onError?: (error: Error) => void;
}

// ─── Configuration ──────────────────────────────────────────

/** Severity configuration for commit blocking. */
export interface SeverityConfig {
  blockOn: Severity[];
  warnOn: Severity[];
  ignoreBelow?: Severity;
}

/** Architecture plugin config. */
export interface ArchitecturePluginConfig {
  enabled: boolean;
  layers?: string[];
  enforceDirection?: boolean;
  maxFileLines?: number;
  maxFunctionLines?: number;
  maxFunctionComplexity?: number;
}

/** Security plugin config. */
export interface SecurityPluginConfig {
  enabled: boolean;
  checkInjection?: boolean;
  checkAuth?: boolean;
  checkSecrets?: boolean;
  checkXSS?: boolean;
  checkCSRF?: boolean;
}

/** Performance plugin config. */
export interface PerformancePluginConfig {
  enabled: boolean;
  checkN1Queries?: boolean;
  checkMemoryLeaks?: boolean;
  checkAsyncPatterns?: boolean;
  checkBundleSize?: boolean;
}

/** Quality plugin config. */
export interface QualityPluginConfig {
  enabled: boolean;
  checkDeadCode?: boolean;
  checkNaming?: boolean;
  checkComplexity?: boolean;
  maxCyclomaticComplexity?: number;
}

/** Optional plugin configs. */
export interface NamingPluginConfig {
  enabled: boolean;
}

export interface ApiPluginConfig {
  enabled: boolean;
}

export interface TestGuardPluginConfig {
  enabled: boolean;
}

export interface DepAuditPluginConfig {
  enabled: boolean;
  maxDepth?: number;
}

/** All plugin configurations. */
export interface PluginConfigs {
  architecture?: ArchitecturePluginConfig;
  security?: SecurityPluginConfig;
  performance?: PerformancePluginConfig;
  quality?: QualityPluginConfig;
  naming?: NamingPluginConfig;
  api?: ApiPluginConfig;
  testGuard?: TestGuardPluginConfig;
  depAudit?: DepAuditPluginConfig;
}

/** Ignore configuration. */
export interface IgnoreConfig {
  rules?: string[];
  files?: string[];
  lines?: Record<string, number[]>;
}

/**
 * Full project configuration (shape of .codeguardian.json).
 *
 * @example
 * ```typescript
 * const config: ProjectConfig = {
 *   rootDir: '.',
 *   tsconfig: './tsconfig.json',
 *   include: ['src/**\/*.ts'],
 *   exclude: ['**\/*.test.ts'],
 *   severity: { blockOn: ['critical', 'error'], warnOn: ['warning'] },
 *   plugins: { architecture: { enabled: true } },
 *   ignore: { rules: [], files: [] },
 * };
 * ```
 */
export interface ProjectConfig {
  rootDir: string;
  tsconfig: string;
  include: string[];
  exclude: string[];
  severity: SeverityConfig;
  plugins: PluginConfigs;
  ignore: IgnoreConfig;
}

/**
 * Inline configuration (same shape minus rootDir/tsconfig which come from GuardianConfig).
 */
export interface InlineConfig {
  include?: string[];
  exclude?: string[];
  severity?: Partial<SeverityConfig>;
  plugins?: Partial<PluginConfigs>;
  ignore?: Partial<IgnoreConfig>;
}

/**
 * Options passed to createGuardian().
 *
 * @example
 * ```typescript
 * const config: GuardianConfig = {
 *   rootDir: process.cwd(),
 *   tsconfig: './tsconfig.json',
 * };
 * ```
 */
export interface GuardianConfig {
  rootDir: string;
  tsconfig?: string;
  config?: string | InlineConfig;
  autoDiscover?: boolean;
}

/** Options for running analysis. */
export interface RunOptions {
  staged?: boolean;
  verbose?: boolean;
  plugins?: string[];
  format?: 'terminal' | 'json' | 'sarif';
}

/** Statistics from a run. */
export interface RunStats {
  filesAnalyzed: number;
  rulesExecuted: number;
  duration: number;
  parseTime: number;
  analysisTime: number;
}

/**
 * Result of running analysis.
 *
 * @example
 * ```typescript
 * const result: RunResult = {
 *   findings: [],
 *   stats: { filesAnalyzed: 10, rulesExecuted: 29, duration: 150, parseTime: 80, analysisTime: 70 },
 *   blocked: false,
 *   bySeverity: { critical: [], error: [], warning: [], info: [] },
 *   byFile: {},
 * };
 * ```
 */
export interface RunResult {
  findings: Finding[];
  stats: RunStats;
  blocked: boolean;
  bySeverity: Record<Severity, Finding[]>;
  byFile: Record<string, Finding[]>;
}

/** Result of incremental scan. */
export interface IncrementalResult {
  changedFiles: string[];
  affectedFiles: string[];
  graph: CodebaseGraph;
}

/** Serialized graph format for cache. */
export interface SerializedGraph {
  version: string;
  timestamp: number;
  files: Array<[string, FileNode]>;
  symbols: Array<[string, SymbolNode]>;
  edges: ImportEdge[];
  layers: LayerDefinition[];
  patterns: DetectedPattern[];
  adjacency: Array<[string, string[]]>;
}

/** Parsed CLI arguments. */
export interface ParsedArgs {
  command: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

/** Suppression directive parsed from a comment. */
export interface SuppressionDirective {
  type: 'disable-next-line' | 'disable' | 'enable';
  rules: string[];
  reason?: string;
  line: number;
}

/** Git diff entry for a changed file. */
export interface DiffEntry {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;
  additions: number;
  deletions: number;
}
