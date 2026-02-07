import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../../src/utils/args.js';

describe('parseArgs', () => {
  it('should parse a command', () => {
    const result = parseArgs(['run']);
    expect(result.command).toBe('run');
    expect(result.flags).toEqual({});
    expect(result.positional).toEqual([]);
  });

  it('should parse command with boolean flags', () => {
    const result = parseArgs(['run', '--staged', '--verbose']);
    expect(result.command).toBe('run');
    expect(result.flags['staged']).toBe(true);
    expect(result.flags['verbose']).toBe(true);
  });

  it('should parse command with value flags', () => {
    const result = parseArgs(['run', '--format', 'json']);
    expect(result.command).toBe('run');
    expect(result.flags['format']).toBe('json');
  });

  it('should parse --key=value format', () => {
    const result = parseArgs(['run', '--format=json']);
    expect(result.flags['format']).toBe('json');
  });

  it('should parse short flags', () => {
    const result = parseArgs(['run', '-v']);
    expect(result.flags['v']).toBe(true);
  });

  it('should parse short flags with values', () => {
    const result = parseArgs(['run', '-f', 'json']);
    expect(result.flags['f']).toBe('json');
  });

  it('should handle empty args', () => {
    const result = parseArgs([]);
    expect(result.command).toBe('');
    expect(result.flags).toEqual({});
    expect(result.positional).toEqual([]);
  });

  it('should handle positional args after command', () => {
    const result = parseArgs(['run', 'src/index.ts']);
    expect(result.command).toBe('run');
    expect(result.positional).toEqual(['src/index.ts']);
  });
});
