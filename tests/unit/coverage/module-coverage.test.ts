import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import ts from 'typescript';
import { createKernel } from '../../../src/kernel.js';
import { validateConfig, shouldBlock, shouldWarn, isBelowThreshold } from '../../../src/config/validator.js';
import { loadConfig } from '../../../src/config/loader.js';
import { formatTerminal } from '../../../src/reporter/terminal.js';
import { formatSARIF } from '../../../src/reporter/sarif.js';
import { formatJSON } from '../../../src/reporter/json.js';
import { parseArgs } from '../../../src/utils/args.js';
import { writeFileSync as fsUtilWrite, writeJsonSync, findFiles, normalizePath, relativePath, fileExists } from '../../../src/utils/fs.js';
import { globToRegex } from '../../../src/utils/glob.js';
import type { GuardianPlugin, CodebaseGraph, Finding, RunResult, Severity } from '../../../src/types.js';

// ============================================================
// Kernel coverage (initPlugins, onDestroy, onError)
// ============================================================
describe('kernel additional coverage', () => {
  it('should call onDestroy when uninstalling a plugin', async () => {
    const kernel = createKernel();
    const onDestroy = vi.fn();
    const plugin: GuardianPlugin = {
      name: 'destroyable',
      version: '1.0.0',
      install(k) { k.registerRule({ name: 'destroyable/rule1', severity: 'info', description: 'test', category: 'quality', check: () => [] }); },
      onDestroy,
    };
    kernel.installPlugin(plugin);
    await kernel.uninstallPlugin('destroyable');
    expect(onDestroy).toHaveBeenCalledOnce();
  });

  it('should handle uninstalling non-existent plugin', async () => {
    const kernel = createKernel();
    await kernel.uninstallPlugin('nonexistent');
    // Should not throw
  });

  it('should call onInit for plugins during initPlugins', async () => {
    const kernel = createKernel();
    const onInit = vi.fn();
    const plugin: GuardianPlugin = {
      name: 'initable',
      version: '1.0.0',
      install() {},
      onInit,
    };
    kernel.installPlugin(plugin);
    const graph: CodebaseGraph = {
      files: new Map(),
      symbols: new Map(),
      edges: [],
      layers: [],
      patterns: [],
      dependencies: { adjacency: new Map() },
    };
    await kernel.initPlugins(graph);
    expect(onInit).toHaveBeenCalledWith(graph);
  });

  it('should call onError when onInit throws', async () => {
    const kernel = createKernel();
    const onError = vi.fn();
    const plugin: GuardianPlugin = {
      name: 'failing-init',
      version: '1.0.0',
      install() {},
      onInit() { throw new Error('init failed'); },
      onError,
    };
    kernel.installPlugin(plugin);
    const graph: CodebaseGraph = {
      files: new Map(), symbols: new Map(), edges: [], layers: [], patterns: [],
      dependencies: { adjacency: new Map() },
    };
    await kernel.initPlugins(graph);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('should call onError when install throws and re-throw', () => {
    const kernel = createKernel();
    const onError = vi.fn();
    const plugin: GuardianPlugin = {
      name: 'failing-install',
      version: '1.0.0',
      install() { throw new Error('install failed'); },
      onError,
    };
    expect(() => kernel.installPlugin(plugin)).toThrow('Failed to install');
    expect(onError).toHaveBeenCalledOnce();
  });

  it('should skip plugins without onInit in initPlugins', async () => {
    const kernel = createKernel();
    const plugin: GuardianPlugin = { name: 'no-init', version: '1.0.0', install() {} };
    kernel.installPlugin(plugin);
    const graph: CodebaseGraph = {
      files: new Map(), symbols: new Map(), edges: [], layers: [], patterns: [],
      dependencies: { adjacency: new Map() },
    };
    await kernel.initPlugins(graph);
    // Should not throw
  });

  it('should handle initPlugins error without onError handler', async () => {
    const kernel = createKernel();
    const plugin: GuardianPlugin = {
      name: 'fail-no-handler',
      version: '1.0.0',
      install() {},
      onInit() { throw new Error('fail'); },
    };
    kernel.installPlugin(plugin);
    const graph: CodebaseGraph = {
      files: new Map(), symbols: new Map(), edges: [], layers: [], patterns: [],
      dependencies: { adjacency: new Map() },
    };
    // Should not throw - error is silently caught
    await kernel.initPlugins(graph);
  });

  it('kernel adapter unregisterRule removes rule', () => {
    const kernel = createKernel();
    const plugin: GuardianPlugin = {
      name: 'unreg-test',
      version: '1.0.0',
      install(k) {
        k.registerRule({ name: 'unreg-test/rule', severity: 'info', description: 'test', category: 'quality', check: () => [] });
        expect(k.getRules().length).toBe(1);
        k.unregisterRule('unreg-test/rule');
        expect(k.getRules().length).toBe(0);
      },
    };
    kernel.installPlugin(plugin);
  });

  it('kernel adapter getConfig returns provided config', () => {
    const kernel = createKernel();
    const testConfig = { foo: 'bar' };
    const plugin: GuardianPlugin = {
      name: 'config-test',
      version: '1.0.0',
      install(k) {
        expect(k.getConfig()).toEqual(testConfig);
      },
    };
    kernel.installPlugin(plugin, testConfig);
  });
});

// ============================================================
// Config validator coverage
// ============================================================
describe('config validator additional coverage', () => {
  it('should validate warnOn severity values', () => {
    expect(() => validateConfig({
      severity: { blockOn: [], warnOn: ['invalid' as Severity] },
    })).toThrow('Invalid severity in warnOn');
  });

  it('should validate ignoreBelow severity value', () => {
    expect(() => validateConfig({
      severity: { blockOn: [], warnOn: [], ignoreBelow: 'invalid' as Severity },
    })).toThrow('Invalid severity in ignoreBelow');
  });

  it('should validate include is array', () => {
    expect(() => validateConfig({
      include: 'not-array' as any,
    })).toThrow('"include" must be an array');
  });

  it('should validate exclude is array', () => {
    expect(() => validateConfig({
      exclude: 'not-array' as any,
    })).toThrow('"exclude" must be an array');
  });

  it('should validate architecture maxFileLines', () => {
    expect(() => validateConfig({
      plugins: { architecture: { enabled: true, maxFileLines: -1 } },
    } as any)).toThrow('maxFileLines must be a positive number');
  });

  it('should validate architecture maxFunctionLines', () => {
    expect(() => validateConfig({
      plugins: { architecture: { enabled: true, maxFunctionLines: 0 } },
    } as any)).toThrow('maxFunctionLines must be a positive number');
  });

  it('should validate architecture maxFunctionComplexity', () => {
    expect(() => validateConfig({
      plugins: { architecture: { enabled: true, maxFunctionComplexity: -5 } },
    } as any)).toThrow('maxFunctionComplexity must be a positive number');
  });

  it('should validate quality maxCyclomaticComplexity', () => {
    expect(() => validateConfig({
      plugins: { quality: { enabled: true, maxCyclomaticComplexity: 0 } },
    } as any)).toThrow('maxCyclomaticComplexity must be a positive number');
  });

  it('should pass valid config', () => {
    expect(() => validateConfig({
      severity: { blockOn: ['critical', 'error'], warnOn: ['warning'], ignoreBelow: 'info' },
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts'],
      plugins: {
        architecture: { enabled: true, maxFileLines: 300, maxFunctionLines: 50, maxFunctionComplexity: 15 },
        quality: { enabled: true, maxCyclomaticComplexity: 10 },
      },
    } as any)).not.toThrow();
  });

  it('shouldBlock returns true for matching severity', () => {
    expect(shouldBlock('critical', ['critical', 'error'])).toBe(true);
    expect(shouldBlock('info', ['critical', 'error'])).toBe(false);
  });

  it('shouldWarn returns true for matching severity', () => {
    expect(shouldWarn('warning', ['warning'])).toBe(true);
    expect(shouldWarn('info', ['warning'])).toBe(false);
  });

  it('isBelowThreshold returns correctly', () => {
    expect(isBelowThreshold('info', 'info')).toBe(true);
    expect(isBelowThreshold('warning', undefined)).toBe(false);
  });
});

// ============================================================
// Config loader coverage
// ============================================================
describe('config loader additional coverage', () => {
  const tmpDir = path.join(process.cwd(), '.test-config-tmp');

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should throw for missing explicit config path', () => {
    expect(() => loadConfig(tmpDir, 'nonexistent.json')).toThrow('Config file not found');
  });

  it('should load config from package.json codeguardian field', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test',
      codeguardian: { include: ['lib/**/*.ts'] },
    }));
    const config = loadConfig(tmpDir);
    expect(config.include).toEqual(['lib/**/*.ts']);
  });

  it('should use defaults when package.json has no codeguardian field', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    const config = loadConfig(tmpDir);
    expect(config.include).toBeDefined();
  });

  it('should load from .codeguardian.json over package.json', () => {
    fs.writeFileSync(path.join(tmpDir, '.codeguardian.json'), JSON.stringify({ include: ['custom/**/*.ts'] }));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test',
      codeguardian: { include: ['pkg/**/*.ts'] },
    }));
    const config = loadConfig(tmpDir);
    expect(config.include).toEqual(['custom/**/*.ts']);
  });

  it('should load explicit config path', () => {
    fs.writeFileSync(path.join(tmpDir, 'custom.json'), JSON.stringify({ include: ['explicit/**/*.ts'] }));
    const config = loadConfig(tmpDir, 'custom.json');
    expect(config.include).toEqual(['explicit/**/*.ts']);
  });
});

// ============================================================
// Reporter coverage
// ============================================================
describe('reporter terminal additional coverage', () => {
  function makeResult(findings: Finding[], blocked = false): RunResult {
    const bySeverity: Record<Severity, Finding[]> = { critical: [], error: [], warning: [], info: [] };
    for (const f of findings) {
      bySeverity[f.severity ?? 'info'].push(f);
    }
    return {
      findings,
      stats: { filesAnalyzed: 1, rulesExecuted: 1, duration: 100, parseTime: 10, analysisTime: 90 },
      blocked,
      bySeverity,
      byFile: {},
    };
  }

  it('should format empty results', () => {
    const result = makeResult([]);
    const output = formatTerminal(result);
    expect(output).toContain('No issues found');
  });

  it('should format critical findings', () => {
    const result = makeResult([
      { message: 'Critical issue', file: 'a.ts', line: 1, column: 1, severity: 'critical', rule: 'test/crit' },
    ], true);
    result.bySeverity.critical = result.findings;
    const output = formatTerminal(result);
    expect(output).toContain('CRITICAL');
    expect(output).toContain('Critical issue');
    expect(output).toContain('commit blocked');
  });

  it('should format error findings', () => {
    const result = makeResult([
      { message: 'Error issue', file: 'a.ts', line: 1, column: 1, severity: 'error', rule: 'test/err' },
    ], true);
    result.bySeverity.error = result.findings;
    const output = formatTerminal(result);
    expect(output).toContain('ERROR');
  });

  it('should format warning findings', () => {
    const result = makeResult([
      { message: 'Warning issue', file: 'a.ts', line: 1, column: 1, severity: 'warning', rule: 'test/warn' },
    ]);
    result.bySeverity.warning = result.findings;
    const output = formatTerminal(result);
    expect(output).toContain('WARNING');
    expect(output).toContain('warnings');
  });

  it('should format info findings in verbose mode', () => {
    const result = makeResult([
      { message: 'Info issue', file: 'a.ts', line: 1, column: 1, severity: 'info', rule: 'test/info' },
    ]);
    result.bySeverity.info = result.findings;
    const output = formatTerminal(result, true);
    expect(output).toContain('INFO');
    expect(output).toContain('info');
  });

  it('should filter info findings in non-verbose mode', () => {
    const result = makeResult([
      { message: 'Info issue', file: 'a.ts', line: 1, column: 1, severity: 'info', rule: 'test/info' },
    ]);
    result.bySeverity.info = result.findings;
    const output = formatTerminal(result, false);
    expect(output).toContain('No issues found');
  });

  it('should format findings with fix suggestions', () => {
    const result = makeResult([
      { message: 'Fix me', file: 'a.ts', line: 1, column: 1, severity: 'warning', rule: 'test/fix', fix: { suggestion: 'Do this instead' } },
    ]);
    result.bySeverity.warning = result.findings;
    const output = formatTerminal(result);
    expect(output).toContain('Do this instead');
  });

  it('should format summary without block (all clear)', () => {
    const result = makeResult([]);
    const output = formatTerminal(result);
    expect(output).toContain('No issues found');
  });
});

describe('reporter SARIF additional coverage', () => {
  it('should format findings with all severity levels', () => {
    const result: RunResult = {
      findings: [
        { message: 'Critical', file: 'a.ts', line: 1, column: 1, severity: 'critical', rule: 'sec/crit' },
        { message: 'Error', file: 'a.ts', line: 2, column: 1, severity: 'error', rule: 'sec/err' },
        { message: 'Warning', file: 'a.ts', line: 3, column: 1, severity: 'warning', rule: 'sec/warn' },
        { message: 'Info', file: 'a.ts', line: 4, column: 1, severity: 'info', rule: 'sec/info' },
      ],
      stats: { filesAnalyzed: 1, rulesExecuted: 4, duration: 50, parseTime: 5, analysisTime: 45 },
      blocked: true,
      bySeverity: { critical: [], error: [], warning: [], info: [] },
      byFile: {},
    };
    const sarif = formatSARIF(result);
    const parsed = JSON.parse(sarif);
    expect(parsed.runs[0].results).toHaveLength(4);
    expect(parsed.runs[0].results[0].level).toBe('error');
    expect(parsed.runs[0].results[2].level).toBe('warning');
    expect(parsed.runs[0].results[3].level).toBe('note');
  });

  it('should format findings with fix suggestions', () => {
    const result: RunResult = {
      findings: [
        { message: 'Fix me', file: 'a.ts', line: 1, column: 1, severity: 'warning', rule: 'test/fix', fix: { suggestion: 'Do X' } },
      ],
      stats: { filesAnalyzed: 1, rulesExecuted: 1, duration: 10, parseTime: 1, analysisTime: 9 },
      blocked: false,
      bySeverity: { critical: [], error: [], warning: [], info: [] },
      byFile: {},
    };
    const sarif = formatSARIF(result);
    const parsed = JSON.parse(sarif);
    expect(parsed.runs[0].results[0].fixes).toBeDefined();
    expect(parsed.runs[0].results[0].fixes[0].description.text).toBe('Do X');
  });

  it('should format findings without fixes', () => {
    const result: RunResult = {
      findings: [
        { message: 'No fix', file: 'a.ts', line: 1, column: 1, severity: 'info', rule: 'test/nofix' },
      ],
      stats: { filesAnalyzed: 1, rulesExecuted: 1, duration: 10, parseTime: 1, analysisTime: 9 },
      blocked: false,
      bySeverity: { critical: [], error: [], warning: [], info: [] },
      byFile: {},
    };
    const sarif = formatSARIF(result);
    const parsed = JSON.parse(sarif);
    expect(parsed.runs[0].results[0].fixes).toBeUndefined();
  });

  it('should handle findings without rule name', () => {
    const result: RunResult = {
      findings: [
        { message: 'No rule', file: 'a.ts', line: 1, column: 1, severity: 'info' },
      ],
      stats: { filesAnalyzed: 1, rulesExecuted: 1, duration: 10, parseTime: 1, analysisTime: 9 },
      blocked: false,
      bySeverity: { critical: [], error: [], warning: [], info: [] },
      byFile: {},
    };
    const sarif = formatSARIF(result);
    const parsed = JSON.parse(sarif);
    expect(parsed.runs[0].results[0].ruleId).toBe('unknown');
  });
});

// ============================================================
// Utils coverage gaps
// ============================================================
describe('utils additional coverage', () => {
  describe('args', () => {
    it('should parse short flag with value', () => {
      const result = parseArgs(['run', '-f', 'json']);
      expect(result.flags['f']).toBe('json');
    });

    it('should parse short boolean flag', () => {
      const result = parseArgs(['run', '-v']);
      expect(result.flags['v']).toBe(true);
    });

    it('should parse flag before command (skip to command)', () => {
      const result = parseArgs(['-v', 'run']);
      // -v is consumed before command, command should be empty, -v is consumed
      // Actually, looking at the code: the first loop skips flags before command.
      // Wait, lines 25-33: "while (i < argv.length) { if (!arg.startsWith('-')) { command = arg; break; } i++; }"
      // So -v is skipped (i++) and 'run' becomes the command. But -v flag is NOT added to flags because it's in the first loop
      // which only looks for the command.
      // Lines 31-33 just increment i, so these flags are lost.
      expect(result.command).toBe('run');
    });
  });

  describe('fs', () => {
    const tmpDir = path.join(process.cwd(), '.test-fs-tmp');

    beforeEach(() => {
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('writeFileSync should create parent directories', () => {
      const filePath = path.join(tmpDir, 'deep', 'nested', 'file.txt');
      fsUtilWrite(filePath, 'hello');
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('hello');
    });

    it('writeJsonSync should write JSON', () => {
      const filePath = path.join(tmpDir, 'data.json');
      writeJsonSync(filePath, { key: 'value' });
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content.key).toBe('value');
    });

    it('findFiles should find TypeScript files', () => {
      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export const x = 1;');
      fs.writeFileSync(path.join(srcDir, 'readme.md'), '# readme');
      const files = findFiles(srcDir, ['.ts']);
      expect(files.length).toBe(1);
      expect(files[0]).toContain('index.ts');
    });

    it('findFiles should exclude directories', () => {
      const srcDir = path.join(tmpDir, 'src2');
      const nmDir = path.join(srcDir, 'node_modules');
      fs.mkdirSync(nmDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'index.ts'), 'x');
      fs.writeFileSync(path.join(nmDir, 'dep.ts'), 'x');
      const files = findFiles(srcDir, ['.ts'], ['node_modules']);
      expect(files.length).toBe(1);
    });

    it('findFiles should return empty for non-existent dir', () => {
      const files = findFiles(path.join(tmpDir, 'nonexistent'), ['.ts']);
      expect(files).toHaveLength(0);
    });

    it('normalizePath should convert backslashes', () => {
      expect(normalizePath('src\\utils\\helper.ts')).toBe('src/utils/helper.ts');
    });

    it('relativePath should return normalized relative path', () => {
      const root = path.resolve('/project');
      const file = path.resolve('/project/src/index.ts');
      const result = relativePath(root, file);
      expect(result).toContain('src');
      expect(result).toContain('index.ts');
      expect(result).not.toContain('\\');
    });
  });

  describe('glob', () => {
    it('should handle ** at end of pattern', () => {
      const regex = globToRegex('src/**');
      expect(regex.test('src/anything/deep/file.ts')).toBe(true);
    });

    it('should handle ? wildcard', () => {
      const regex = globToRegex('file?.ts');
      expect(regex.test('fileA.ts')).toBe(true);
      expect(regex.test('file.ts')).toBe(false);
    });

    it('should escape special regex characters', () => {
      const regex = globToRegex('file[1].ts');
      expect(regex.test('file[1].ts')).toBe(true);
    });
  });
});
