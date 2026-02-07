import { ConfigError } from '../errors.js';
import type { ProjectConfig, Severity } from '../types.js';
import { SEVERITY_ORDER } from '../types.js';

const VALID_SEVERITIES = new Set<string>(SEVERITY_ORDER);

/**
 * Validate a project configuration object.
 * Throws ConfigError if invalid.
 *
 * @param config - Configuration to validate
 *
 * @example
 * ```typescript
 * validateConfig(config); // throws if invalid
 * ```
 */
export function validateConfig(config: Partial<ProjectConfig>): void {
  // Validate severity
  if (config.severity) {
    if (config.severity.blockOn) {
      for (const s of config.severity.blockOn) {
        if (!VALID_SEVERITIES.has(s)) {
          throw new ConfigError(`Invalid severity in blockOn: "${s}"`, {
            field: 'severity.blockOn',
            validValues: [...SEVERITY_ORDER],
          });
        }
      }
    }
    if (config.severity.warnOn) {
      for (const s of config.severity.warnOn) {
        if (!VALID_SEVERITIES.has(s)) {
          throw new ConfigError(`Invalid severity in warnOn: "${s}"`, {
            field: 'severity.warnOn',
            validValues: [...SEVERITY_ORDER],
          });
        }
      }
    }
    if (config.severity.ignoreBelow !== undefined) {
      if (!VALID_SEVERITIES.has(config.severity.ignoreBelow)) {
        throw new ConfigError(`Invalid severity in ignoreBelow: "${config.severity.ignoreBelow}"`, {
          field: 'severity.ignoreBelow',
          validValues: [...SEVERITY_ORDER],
        });
      }
    }
  }

  // Validate include/exclude patterns
  if (config.include) {
    if (!Array.isArray(config.include)) {
      throw new ConfigError('"include" must be an array of glob patterns', {
        field: 'include',
      });
    }
  }

  if (config.exclude) {
    if (!Array.isArray(config.exclude)) {
      throw new ConfigError('"exclude" must be an array of glob patterns', {
        field: 'exclude',
      });
    }
  }

  // Validate plugin configs
  if (config.plugins) {
    if (config.plugins.architecture) {
      const arch = config.plugins.architecture;
      if (arch.maxFileLines !== undefined && (typeof arch.maxFileLines !== 'number' || arch.maxFileLines < 1)) {
        throw new ConfigError('maxFileLines must be a positive number', {
          field: 'plugins.architecture.maxFileLines',
        });
      }
      if (arch.maxFunctionLines !== undefined && (typeof arch.maxFunctionLines !== 'number' || arch.maxFunctionLines < 1)) {
        throw new ConfigError('maxFunctionLines must be a positive number', {
          field: 'plugins.architecture.maxFunctionLines',
        });
      }
      if (arch.maxFunctionComplexity !== undefined && (typeof arch.maxFunctionComplexity !== 'number' || arch.maxFunctionComplexity < 1)) {
        throw new ConfigError('maxFunctionComplexity must be a positive number', {
          field: 'plugins.architecture.maxFunctionComplexity',
        });
      }
    }

    if (config.plugins.quality) {
      const q = config.plugins.quality;
      if (q.maxCyclomaticComplexity !== undefined && (typeof q.maxCyclomaticComplexity !== 'number' || q.maxCyclomaticComplexity < 1)) {
        throw new ConfigError('maxCyclomaticComplexity must be a positive number', {
          field: 'plugins.quality.maxCyclomaticComplexity',
        });
      }
    }
  }
}

/**
 * Check if a severity should block a commit.
 *
 * @example
 * ```typescript
 * shouldBlock('critical', ['critical', 'error']); // true
 * shouldBlock('warning', ['critical', 'error']);   // false
 * ```
 */
export function shouldBlock(severity: Severity, blockOn: Severity[]): boolean {
  return blockOn.includes(severity);
}

/**
 * Check if a severity should be shown as a warning.
 *
 * @example
 * ```typescript
 * shouldWarn('warning', ['warning']); // true
 * shouldWarn('info', ['warning']);     // false
 * ```
 */
export function shouldWarn(severity: Severity, warnOn: Severity[]): boolean {
  return warnOn.includes(severity);
}

/**
 * Check if a severity is below the ignore threshold.
 *
 * @example
 * ```typescript
 * isBelowThreshold('info', 'info');     // true
 * isBelowThreshold('warning', 'info');  // false
 * ```
 */
export function isBelowThreshold(severity: Severity, threshold?: Severity): boolean {
  if (!threshold) return false;
  const severityIndex = SEVERITY_ORDER.indexOf(severity);
  const thresholdIndex = SEVERITY_ORDER.indexOf(threshold);
  return severityIndex >= thresholdIndex;
}
