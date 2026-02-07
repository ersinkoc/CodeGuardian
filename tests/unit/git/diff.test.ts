import { describe, it, expect } from 'vitest';
import { parseDiffNameStatus, parseDiffNumstat } from '../../../src/git/diff.js';

describe('parseDiffNameStatus', () => {
  it('should parse added files', () => {
    const output = 'A\tsrc/new-file.ts\n';
    const entries = parseDiffNameStatus(output);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.path).toBe('src/new-file.ts');
    expect(entries[0]!.status).toBe('added');
  });

  it('should parse modified files', () => {
    const output = 'M\tsrc/index.ts\n';
    const entries = parseDiffNameStatus(output);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.status).toBe('modified');
  });

  it('should parse deleted files', () => {
    const output = 'D\tsrc/old-file.ts\n';
    const entries = parseDiffNameStatus(output);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.status).toBe('deleted');
  });

  it('should parse renamed files', () => {
    const output = 'R100\tsrc/old.ts\tsrc/new.ts\n';
    const entries = parseDiffNameStatus(output);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.status).toBe('renamed');
    expect(entries[0]!.path).toBe('src/new.ts');
    expect(entries[0]!.oldPath).toBe('src/old.ts');
  });

  it('should parse multiple entries', () => {
    const output = 'A\tsrc/a.ts\nM\tsrc/b.ts\nD\tsrc/c.ts\n';
    const entries = parseDiffNameStatus(output);
    expect(entries).toHaveLength(3);
  });

  it('should handle empty output', () => {
    const entries = parseDiffNameStatus('');
    expect(entries).toHaveLength(0);
  });
});

describe('parseDiffNumstat', () => {
  it('should parse addition/deletion counts', () => {
    const output = '10\t5\tsrc/index.ts\n';
    const stats = parseDiffNumstat(output);
    expect(stats.get('src/index.ts')).toEqual({ additions: 10, deletions: 5 });
  });

  it('should handle binary files', () => {
    const output = '-\t-\timage.png\n';
    const stats = parseDiffNumstat(output);
    expect(stats.get('image.png')).toEqual({ additions: 0, deletions: 0 });
  });

  it('should handle empty output', () => {
    const stats = parseDiffNumstat('');
    expect(stats.size).toBe(0);
  });
});
