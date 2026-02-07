/**
 * @oxog/codeguardian — Zero-dependency TypeScript codebase guardian.
 *
 * @example
 * ```typescript
 * import { createGuardian, defineRule, definePlugin } from '@oxog/codeguardian';
 *
 * const guardian = createGuardian({ rootDir: process.cwd() });
 * const graph = await guardian.scan();
 * const result = await guardian.run({ staged: true });
 *
 * if (result.blocked) {
 *   console.error('Commit blocked!');
 *   process.exit(1);
 * }
 * ```
 */

import type {
  CodebaseGraph,
  GuardianConfig,
  GuardianPlugin,
  IncrementalResult,
  Rule,
  RunOptions,
  RunResult,
} from './types.js';
import { createKernel } from './kernel.js';
import { buildGraph } from './graph/builder.js';
import { loadGraphCache, saveGraphCache } from './graph/cache.js';
import { updateGraphIncremental } from './graph/incremental.js';
import { getFile, getSymbol, getDependencies, getDependents, findCircularDeps, getGraphStats } from './graph/query.js';
import { executeRules } from './rules/engine.js';
import { loadConfig } from './config/loader.js';
import { getStagedFiles } from './git/staged.js';
import { createTSProgram } from './ast/parser.js';
import { formatTerminal } from './reporter/terminal.js';
import { formatJSON } from './reporter/json.js';
import { formatSARIF } from './reporter/sarif.js';
import { discoverConventions } from './discovery/conventions.js';
import { architecturePlugin } from './plugins/core/architecture.js';
import { securityPlugin } from './plugins/core/security.js';
import { performancePlugin } from './plugins/core/performance.js';
import { qualityPlugin } from './plugins/core/quality.js';
import { namingPlugin } from './plugins/optional/naming.js';
import { apiPlugin } from './plugins/optional/api.js';
import { testGuardPlugin } from './plugins/optional/test-guard.js';
import { depAuditPlugin } from './plugins/optional/dep-audit.js';

/**
 * Create a Guardian instance for analyzing a TypeScript project.
 *
 * @param config - Guardian configuration
 * @returns Guardian instance with scan, run, use methods
 *
 * @example
 * ```typescript
 * const guardian = createGuardian({
 *   rootDir: process.cwd(),
 *   tsconfig: './tsconfig.json',
 * });
 *
 * const graph = await guardian.scan();
 * console.log(`Scanned ${graph.files.size} files`);
 * ```
 */
export function createGuardian(config: GuardianConfig) {
  const projectConfig = loadConfig(config.rootDir, config.config);
  const kernel = createKernel();

  let _graph: CodebaseGraph | null = null;
  let _program: ReturnType<typeof createTSProgram> | null = null;

  // Install default core plugins based on config
  const pluginCfg = projectConfig.plugins;

  if (pluginCfg.architecture?.enabled !== false) {
    kernel.installPlugin(architecturePlugin(pluginCfg.architecture));
  }
  if (pluginCfg.security?.enabled !== false) {
    kernel.installPlugin(securityPlugin(pluginCfg.security));
  }
  if (pluginCfg.performance?.enabled !== false) {
    kernel.installPlugin(performancePlugin(pluginCfg.performance));
  }
  if (pluginCfg.quality?.enabled !== false) {
    kernel.installPlugin(qualityPlugin(pluginCfg.quality));
  }

  // Install optional plugins if enabled
  if (pluginCfg.naming?.enabled) {
    kernel.installPlugin(namingPlugin(pluginCfg.naming));
  }
  if (pluginCfg.api?.enabled) {
    kernel.installPlugin(apiPlugin(pluginCfg.api));
  }
  if (pluginCfg.testGuard?.enabled) {
    kernel.installPlugin(testGuardPlugin(pluginCfg.testGuard));
  }
  if (pluginCfg.depAudit?.enabled) {
    kernel.installPlugin(depAuditPlugin(pluginCfg.depAudit));
  }

  function getProgram() {
    if (!_program) {
      _program = createTSProgram(config.rootDir, projectConfig.tsconfig);
    }
    return _program;
  }

  const guardian = {
    /** The project configuration. */
    config: projectConfig,

    /** The codebase knowledge graph (available after scan). */
    get graph(): CodebaseGraph {
      if (!_graph) {
        throw new Error('Graph not available. Call scan() first.');
      }
      return _graph;
    },

    /**
     * Perform a full codebase scan and build the knowledge graph.
     *
     * @returns The complete codebase graph
     *
     * @example
     * ```typescript
     * const graph = await guardian.scan();
     * console.log(`${graph.files.size} files, ${graph.symbols.size} symbols`);
     * ```
     */
    async scan(): Promise<CodebaseGraph> {
      _graph = buildGraph(
        config.rootDir,
        projectConfig.tsconfig,
        projectConfig.include,
        projectConfig.exclude,
        projectConfig.plugins.architecture?.layers,
      );

      // Init plugins with graph
      await kernel.initPlugins(_graph);

      // Save cache
      saveGraphCache(config.rootDir, _graph);

      return _graph;
    },

    /**
     * Perform an incremental scan based on git staged files.
     *
     * @returns Incremental result with changed and affected files
     *
     * @example
     * ```typescript
     * const result = await guardian.scanIncremental();
     * console.log(`Updated ${result.changedFiles.length} files`);
     * ```
     */
    async scanIncremental(): Promise<IncrementalResult> {
      // Try to load cached graph
      if (!_graph) {
        _graph = loadGraphCache(config.rootDir);
      }

      // If no cache, do full scan
      if (!_graph) {
        await guardian.scan();
      }

      const program = getProgram();
      const stagedFiles = getStagedFiles(config.rootDir);
      const tsFiles = stagedFiles.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

      const result = updateGraphIncremental(_graph!, tsFiles, config.rootDir, program);

      // Save updated cache
      saveGraphCache(config.rootDir, _graph!);

      return result;
    },

    /**
     * Run analysis rules on the codebase.
     *
     * @param options - Run options (staged, verbose, plugins, format)
     * @returns Run result with findings, stats, and blocked status
     *
     * @example
     * ```typescript
     * const result = await guardian.run({ staged: true });
     * if (result.blocked) {
     *   console.error('Commit blocked!');
     *   process.exit(1);
     * }
     * ```
     */
    async run(options: RunOptions = {}): Promise<RunResult> {
      // Ensure graph is built
      if (!_graph) {
        if (options.staged) {
          await guardian.scanIncremental();
        } else {
          await guardian.scan();
        }
      }

      const program = getProgram();

      // Determine target files
      let targetFiles: string[];
      if (options.staged) {
        const stagedFiles = getStagedFiles(config.rootDir);
        targetFiles = stagedFiles.filter(
          (f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && _graph!.files.has(f),
        );
      } else {
        targetFiles = Array.from(_graph!.files.keys());
      }

      // Filter rules by plugin
      let rules = kernel.getRules();
      if (options.plugins && options.plugins.length > 0) {
        rules = rules.filter((r) => {
          const pluginName = r.name.split('/')[0];
          return pluginName && options.plugins!.includes(pluginName);
        });
      }

      // Build plugin config map
      const pluginConfigMap: Record<string, Record<string, unknown>> = {};
      if (projectConfig.plugins.architecture) {
        pluginConfigMap['architecture'] = projectConfig.plugins.architecture as unknown as Record<string, unknown>;
      }
      if (projectConfig.plugins.security) {
        pluginConfigMap['security'] = projectConfig.plugins.security as unknown as Record<string, unknown>;
      }
      if (projectConfig.plugins.performance) {
        pluginConfigMap['performance'] = projectConfig.plugins.performance as unknown as Record<string, unknown>;
      }
      if (projectConfig.plugins.quality) {
        pluginConfigMap['quality'] = projectConfig.plugins.quality as unknown as Record<string, unknown>;
      }

      const result = await executeRules(
        _graph!,
        rules,
        targetFiles,
        program,
        pluginConfigMap,
        projectConfig.ignore.rules!,
        projectConfig.ignore.files!,
        projectConfig.severity.blockOn,
        config.rootDir,
      );

      return result;
    },

    /**
     * Register a plugin with the guardian.
     *
     * @param plugin - Plugin to register
     *
     * @example
     * ```typescript
     * import { definePlugin } from '@oxog/codeguardian';
     * guardian.use(myPlugin);
     * ```
     */
    use<TConfig>(plugin: GuardianPlugin<TConfig>): void {
      kernel.installPlugin(plugin);
    },

    /**
     * Auto-discover project conventions.
     *
     * @returns Detected patterns
     *
     * @example
     * ```typescript
     * const conventions = await guardian.discover();
     * ```
     */
    async discover() {
      if (!_graph) {
        await guardian.scan();
      }
      return discoverConventions(_graph!);
    },

    /**
     * Format run results for output.
     *
     * @param result - Run result
     * @param format - Output format
     * @param verbose - Include info-level findings
     * @returns Formatted string
     */
    format(result: RunResult, format: 'terminal' | 'json' | 'sarif' = 'terminal', verbose = false): string {
      switch (format) {
        case 'json':
          return formatJSON(result);
        case 'sarif':
          return formatSARIF(result);
        default:
          return formatTerminal(result, verbose);
      }
    },

    /**
     * Get graph query helpers.
     */
    query: {
      getFile: (path: string) => _graph ? getFile(_graph, path) : undefined,
      getSymbol: (name: string) => _graph ? getSymbol(_graph, name) : undefined,
      getDependencies: (path: string) => _graph ? getDependencies(_graph, path) : [],
      getDependents: (path: string) => _graph ? getDependents(_graph, path) : [],
      findCircularDeps: () => _graph ? findCircularDeps(_graph) : [],
      getStats: () => _graph ? getGraphStats(_graph) : null,
    },

    /**
     * Get all registered rules.
     */
    getRules(): Rule[] {
      return kernel.getRules();
    },

    /**
     * Get all installed plugin names.
     */
    getPlugins(): string[] {
      return kernel.getPluginNames();
    },
  };

  return guardian;
}

/**
 * Define a custom analysis rule.
 *
 * @param rule - Rule definition
 * @returns The same rule (for type-safe chaining)
 *
 * @example
 * ```typescript
 * const noConsole = defineRule({
 *   name: 'custom/no-console',
 *   severity: 'warning',
 *   description: 'Disallow console.log',
 *   category: 'quality',
 *   check: (ctx) => {
 *     const findings: Finding[] = [];
 *     // ... analysis
 *     return findings;
 *   },
 * });
 * ```
 */
export function defineRule(rule: Rule): Rule {
  return rule;
}

/**
 * Define a custom plugin.
 *
 * @param plugin - Plugin definition
 * @returns The same plugin (for type-safe chaining)
 *
 * @example
 * ```typescript
 * const myPlugin = definePlugin({
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   install: (kernel) => {
 *     kernel.registerRule(myRule);
 *   },
 * });
 * ```
 */
export function definePlugin<TConfig = unknown>(
  plugin: GuardianPlugin<TConfig>,
): GuardianPlugin<TConfig> {
  return plugin;
}

// Re-export types
export type {
  CodebaseGraph,
  FileNode,
  SymbolNode,
  FunctionNode,
  ImportEdge,
  ImportInfo,
  Finding,
  Rule,
  RuleContext,
  RuleCategory,
  Severity,
  GuardianPlugin,
  GuardianKernel,
  GuardianConfig,
  RunOptions,
  RunResult,
  RunStats,
  IncrementalResult,
  ProjectConfig,
  SeverityConfig,
  ASTVisitors,
} from './types.js';
