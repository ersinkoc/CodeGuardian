import * as path from 'node:path';
import type { InlineConfig, ProjectConfig } from '../types.js';
import { ConfigError } from '../errors.js';
import { fileExists, readJsonSync } from '../utils/fs.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { validateConfig } from './validator.js';

/**
 * Load project configuration from disk or inline config.
 *
 * Resolution order:
 * 1. Inline config object (if provided)
 * 2. .codeguardian.json
 * 3. codeguardian field in package.json
 * 4. Default config
 *
 * @param rootDir - Project root directory
 * @param configPathOrInline - Path to config file or inline config object
 * @returns Resolved project configuration
 *
 * @example
 * ```typescript
 * const config = loadConfig('/my-project');
 * const config2 = loadConfig('/my-project', '.codeguardian.json');
 * const config3 = loadConfig('/my-project', { plugins: { security: { enabled: false } } });
 * ```
 */
export function loadConfig(
  rootDir: string,
  configPathOrInline?: string | InlineConfig,
): ProjectConfig {
  let fileConfig: Partial<ProjectConfig> = {};

  if (typeof configPathOrInline === 'object') {
    // Inline config
    fileConfig = configPathOrInline as Partial<ProjectConfig>;
  } else if (typeof configPathOrInline === 'string') {
    // Explicit path
    const fullPath = path.resolve(rootDir, configPathOrInline);
    if (fileExists(fullPath)) {
      fileConfig = readJsonSync<Partial<ProjectConfig>>(fullPath);
    } else {
      throw new ConfigError(`Config file not found: ${configPathOrInline}`, {
        path: fullPath,
      });
    }
  } else {
    // Auto-detect
    const codeguardianPath = path.resolve(rootDir, '.codeguardian.json');
    const packageJsonPath = path.resolve(rootDir, 'package.json');

    if (fileExists(codeguardianPath)) {
      fileConfig = readJsonSync<Partial<ProjectConfig>>(codeguardianPath);
    } else if (fileExists(packageJsonPath)) {
      const pkg = readJsonSync<Record<string, unknown>>(packageJsonPath);
      if (pkg['codeguardian'] && typeof pkg['codeguardian'] === 'object') {
        fileConfig = pkg['codeguardian'] as Partial<ProjectConfig>;
      }
    }
  }

  // Merge with defaults
  const config = mergeConfig(DEFAULT_CONFIG, fileConfig, rootDir);

  // Validate
  validateConfig(config);

  return config;
}

/**
 * Deep merge config with defaults.
 */
function mergeConfig(
  defaults: ProjectConfig,
  overrides: Partial<ProjectConfig>,
  rootDir: string,
): ProjectConfig {
  return {
    rootDir,
    tsconfig: overrides.tsconfig ?? defaults.tsconfig,
    include: overrides.include ?? defaults.include,
    exclude: overrides.exclude ?? defaults.exclude,
    severity: {
      ...defaults.severity,
      ...overrides.severity,
    },
    plugins: {
      architecture: {
        ...defaults.plugins.architecture!,
        ...overrides.plugins?.architecture,
      },
      security: {
        ...defaults.plugins.security!,
        ...overrides.plugins?.security,
      },
      performance: {
        ...defaults.plugins.performance!,
        ...overrides.plugins?.performance,
      },
      quality: {
        ...defaults.plugins.quality!,
        ...overrides.plugins?.quality,
      },
      naming: overrides.plugins?.naming,
      api: overrides.plugins?.api,
      testGuard: overrides.plugins?.testGuard,
      depAudit: overrides.plugins?.depAudit,
    },
    ignore: {
      rules: overrides.ignore?.rules ?? defaults.ignore.rules,
      files: overrides.ignore?.files ?? defaults.ignore.files,
      lines: overrides.ignore?.lines ?? defaults.ignore.lines,
    },
  };
}
