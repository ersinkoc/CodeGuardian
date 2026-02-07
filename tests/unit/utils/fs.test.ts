import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { readFileSync, writeFileSync, fileExists, normalizePath, relativePath } from '../../../src/utils/fs.js';

const TMP_DIR = path.join(__dirname, '../../../.tmp-test');

describe('fs utils', () => {
  it('readFileSync should read a file', () => {
    const content = readFileSync(path.resolve(__dirname, '../../../package.json'));
    expect(content).toContain('@oxog/codeguardian');
  });

  it('writeFileSync should write and create directories', () => {
    const filePath = path.join(TMP_DIR, 'sub/test.txt');
    writeFileSync(filePath, 'hello');
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('hello');
    // Cleanup
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('fileExists should return true for existing files', () => {
    expect(fileExists(path.resolve(__dirname, '../../../package.json'))).toBe(true);
    expect(fileExists('/nonexistent/file.txt')).toBe(false);
  });

  it('normalizePath should convert backslashes', () => {
    expect(normalizePath('src\\utils\\helper.ts')).toBe('src/utils/helper.ts');
    expect(normalizePath('src/utils/helper.ts')).toBe('src/utils/helper.ts');
  });

  it('relativePath should return relative path with forward slashes', () => {
    const result = relativePath('/project', '/project/src/index.ts');
    expect(result).toBe('src/index.ts');
  });
});
