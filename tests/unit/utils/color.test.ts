import { describe, it, expect } from 'vitest';
import { color } from '../../../src/utils/color.js';

describe('color', () => {
  it('should have color functions', () => {
    expect(typeof color.red).toBe('function');
    expect(typeof color.green).toBe('function');
    expect(typeof color.yellow).toBe('function');
    expect(typeof color.blue).toBe('function');
    expect(typeof color.bold).toBe('function');
    expect(typeof color.dim).toBe('function');
  });

  it('should return string from color functions', () => {
    const result = color.red('error');
    expect(typeof result).toBe('string');
    expect(result).toContain('error');
  });

  it('should support composing colors', () => {
    const result = color.bold(color.red('error'));
    expect(typeof result).toBe('string');
    expect(result).toContain('error');
  });
});
