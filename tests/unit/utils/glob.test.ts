import { describe, it, expect } from 'vitest';
import { globMatch, globMatchAny, globToRegex } from '../../../src/utils/glob.js';

describe('globToRegex', () => {
  it('should convert simple patterns', () => {
    const re = globToRegex('*.ts');
    expect(re.test('index.ts')).toBe(true);
    expect(re.test('index.js')).toBe(false);
  });

  it('should handle ** for recursive matching', () => {
    const re = globToRegex('src/**/*.ts');
    expect(re.test('src/index.ts')).toBe(true);
    expect(re.test('src/utils/helper.ts')).toBe(true);
    expect(re.test('lib/index.ts')).toBe(false);
  });

  it('should handle ? for single character', () => {
    const re = globToRegex('?.ts');
    expect(re.test('a.ts')).toBe(true);
    expect(re.test('ab.ts')).toBe(false);
  });

  it('should escape special regex characters', () => {
    const re = globToRegex('file.test.ts');
    expect(re.test('file.test.ts')).toBe(true);
    expect(re.test('filextest.ts')).toBe(false);
  });
});

describe('globMatch', () => {
  it('should match simple patterns', () => {
    expect(globMatch('src/index.ts', 'src/**/*.ts')).toBe(true);
    expect(globMatch('lib/index.ts', 'src/**/*.ts')).toBe(false);
  });

  it('should normalize backslashes', () => {
    expect(globMatch('src\\utils\\helper.ts', 'src/**/*.ts')).toBe(true);
  });

  it('should match test files', () => {
    expect(globMatch('src/index.test.ts', '**/*.test.ts')).toBe(true);
    expect(globMatch('src/index.ts', '**/*.test.ts')).toBe(false);
  });
});

describe('globMatchAny', () => {
  it('should match if any pattern matches', () => {
    expect(globMatchAny('test.spec.ts', ['**/*.test.ts', '**/*.spec.ts'])).toBe(true);
    expect(globMatchAny('test.ts', ['**/*.test.ts', '**/*.spec.ts'])).toBe(false);
  });

  it('should return false for empty patterns', () => {
    expect(globMatchAny('test.ts', [])).toBe(false);
  });
});
