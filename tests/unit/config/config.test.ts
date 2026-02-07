import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { DEFAULT_CONFIG, getDefaultConfigJSON } from '../../../src/config/defaults.js';
import { validateConfig, shouldBlock, shouldWarn, isBelowThreshold } from '../../../src/config/validator.js';
import { loadConfig } from '../../../src/config/loader.js';

describe('DEFAULT_CONFIG', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_CONFIG.tsconfig).toBe('./tsconfig.json');
    expect(DEFAULT_CONFIG.severity.blockOn).toContain('critical');
    expect(DEFAULT_CONFIG.severity.blockOn).toContain('error');
    expect(DEFAULT_CONFIG.plugins.architecture?.enabled).toBe(true);
    expect(DEFAULT_CONFIG.plugins.security?.enabled).toBe(true);
  });
});

describe('getDefaultConfigJSON', () => {
  it('should return valid JSON', () => {
    const json = getDefaultConfigJSON();
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('should not include rootDir or tsconfig', () => {
    const json = getDefaultConfigJSON();
    const parsed = JSON.parse(json);
    expect(parsed.rootDir).toBeUndefined();
    expect(parsed.tsconfig).toBeUndefined();
  });
});

describe('validateConfig', () => {
  it('should accept valid config', () => {
    expect(() => validateConfig(DEFAULT_CONFIG)).not.toThrow();
  });

  it('should reject invalid severity', () => {
    expect(() => validateConfig({
      severity: { blockOn: ['invalid' as any], warnOn: [] },
    })).toThrow();
  });

  it('should reject invalid maxFileLines', () => {
    expect(() => validateConfig({
      plugins: { architecture: { enabled: true, maxFileLines: -1 } },
    })).toThrow();
  });

  it('should reject non-array include', () => {
    expect(() => validateConfig({
      include: 'src/**/*.ts' as any,
    })).toThrow();
  });
});

describe('shouldBlock', () => {
  it('should return true for blocking severities', () => {
    expect(shouldBlock('critical', ['critical', 'error'])).toBe(true);
    expect(shouldBlock('error', ['critical', 'error'])).toBe(true);
  });

  it('should return false for non-blocking severities', () => {
    expect(shouldBlock('warning', ['critical', 'error'])).toBe(false);
    expect(shouldBlock('info', ['critical', 'error'])).toBe(false);
  });
});

describe('shouldWarn', () => {
  it('should return true for warning severities', () => {
    expect(shouldWarn('warning', ['warning'])).toBe(true);
  });

  it('should return false for non-warning severities', () => {
    expect(shouldWarn('critical', ['warning'])).toBe(false);
  });
});

describe('isBelowThreshold', () => {
  it('should detect info below info threshold', () => {
    expect(isBelowThreshold('info', 'info')).toBe(true);
  });

  it('should not hide warnings when threshold is info', () => {
    expect(isBelowThreshold('warning', 'info')).toBe(false);
  });

  it('should return false if no threshold', () => {
    expect(isBelowThreshold('info', undefined)).toBe(false);
  });
});

describe('loadConfig', () => {
  it('should load default config when no file exists', () => {
    const tmpDir = path.join(__dirname, '../../../.tmp-config-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      const config = loadConfig(tmpDir);
      expect(config.severity.blockOn).toContain('critical');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should accept inline config', () => {
    const tmpDir = path.join(__dirname, '../../../.tmp-config-test2');
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      const config = loadConfig(tmpDir, {
        plugins: { security: { enabled: false } },
      });
      expect(config.plugins.security?.enabled).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should throw for missing explicit config path', () => {
    expect(() => loadConfig('/tmp', 'nonexistent.json')).toThrow();
  });
});
