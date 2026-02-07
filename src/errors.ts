/**
 * Base error class for all codeguardian errors.
 *
 * @example
 * ```typescript
 * throw new CodeGuardianError('Something went wrong', 'GENERAL');
 * ```
 */
export class CodeGuardianError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'CodeGuardianError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Error thrown when configuration is invalid.
 *
 * @example
 * ```typescript
 * throw new ConfigError('Invalid severity level', { field: 'severity.blockOn' });
 * ```
 */
export class ConfigError extends CodeGuardianError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', context);
    this.name = 'ConfigError';
  }
}

/**
 * Error thrown when TypeScript parsing fails.
 *
 * @example
 * ```typescript
 * throw new ParseError('Failed to parse file', { file: 'src/index.ts' });
 * ```
 */
export class ParseError extends CodeGuardianError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PARSE_ERROR', context);
    this.name = 'ParseError';
  }
}

/**
 * Error thrown when a plugin encounters an error.
 *
 * @example
 * ```typescript
 * throw new PluginError('Plugin failed to install', { plugin: 'security' });
 * ```
 */
export class PluginError extends CodeGuardianError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PLUGIN_ERROR', context);
    this.name = 'PluginError';
  }
}

/**
 * Error thrown when graph construction fails.
 *
 * @example
 * ```typescript
 * throw new GraphError('Failed to build graph', { files: 42 });
 * ```
 */
export class GraphError extends CodeGuardianError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'GRAPH_ERROR', context);
    this.name = 'GraphError';
  }
}

/**
 * Error thrown when a git operation fails.
 *
 * @example
 * ```typescript
 * throw new GitError('Not a git repository');
 * ```
 */
export class GitError extends CodeGuardianError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'GIT_ERROR', context);
    this.name = 'GitError';
  }
}
