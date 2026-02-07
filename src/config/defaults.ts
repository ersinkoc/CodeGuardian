import type { ProjectConfig } from '../types.js';

/**
 * Default project configuration.
 *
 * @example
 * ```typescript
 * import { DEFAULT_CONFIG } from './defaults';
 * const config = { ...DEFAULT_CONFIG, rootDir: '/my-project' };
 * ```
 */
export const DEFAULT_CONFIG: ProjectConfig = {
  rootDir: '.',
  tsconfig: './tsconfig.json',
  include: ['src/**/*.ts'],
  exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/dist/**'],
  severity: {
    blockOn: ['critical', 'error'],
    warnOn: ['warning'],
    ignoreBelow: 'info',
  },
  plugins: {
    architecture: {
      enabled: true,
      layers: ['controller', 'service', 'repository', 'util'],
      enforceDirection: true,
      maxFileLines: 300,
      maxFunctionLines: 50,
      maxFunctionComplexity: 15,
    },
    security: {
      enabled: true,
      checkInjection: true,
      checkAuth: true,
      checkSecrets: true,
      checkXSS: true,
      checkCSRF: true,
    },
    performance: {
      enabled: true,
      checkN1Queries: true,
      checkMemoryLeaks: true,
      checkAsyncPatterns: true,
      checkBundleSize: false,
    },
    quality: {
      enabled: true,
      checkDeadCode: true,
      checkNaming: true,
      checkComplexity: true,
      maxCyclomaticComplexity: 15,
    },
  },
  ignore: {
    rules: [],
    files: [],
    lines: {},
  },
};

/**
 * Default configuration as JSON string (for writing .codeguardian.json).
 *
 * @example
 * ```typescript
 * writeFileSync('.codeguardian.json', getDefaultConfigJSON());
 * ```
 */
export function getDefaultConfigJSON(): string {
  const { rootDir: _r, tsconfig: _t, ...rest } = DEFAULT_CONFIG;
  return JSON.stringify(rest, null, 2);
}
