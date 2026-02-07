import { describe, it, expect } from 'vitest';
import { sha256, shortHash } from '../../../src/utils/crypto.js';

describe('sha256', () => {
  it('should return a 64-character hex string', () => {
    const hash = sha256('hello');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it('should be deterministic', () => {
    expect(sha256('hello')).toBe(sha256('hello'));
  });

  it('should produce different hashes for different inputs', () => {
    expect(sha256('hello')).not.toBe(sha256('world'));
  });
});

describe('shortHash', () => {
  it('should return first 8 characters', () => {
    const hash = shortHash('hello');
    expect(hash).toHaveLength(8);
    expect(hash).toBe(sha256('hello').slice(0, 8));
  });
});
