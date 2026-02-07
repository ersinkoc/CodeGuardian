import { execSync } from 'node:child_process';
import { GitError } from '../errors.js';
import type { DiffEntry } from '../types.js';
import { parseDiffNameStatus, parseDiffNumstat } from './diff.js';

/**
 * Get list of staged files from git.
 *
 * @param rootDir - Project root directory (where .git is)
 * @returns Array of staged file paths (relative to rootDir)
 *
 * @example
 * ```typescript
 * const files = getStagedFiles('/my-project');
 * // ['src/index.ts', 'src/service.ts']
 * ```
 */
export function getStagedFiles(rootDir: string): string[] {
  try {
    const output = execSync('git diff --cached --name-only', {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output
      .trim()
      .split('\n')
      .filter((line) => line.trim().length > 0);
  } catch (err) {
    throw new GitError('Failed to get staged files. Is this a git repository?', {
      rootDir,
      error: String(err),
    });
  }
}

/**
 * Get detailed diff entries for staged files.
 *
 * @param rootDir - Project root directory
 * @returns Array of DiffEntry objects with status and stats
 *
 * @example
 * ```typescript
 * const entries = getStagedDiff('/my-project');
 * // [{ path: 'src/index.ts', status: 'modified', additions: 5, deletions: 2 }]
 * ```
 */
export function getStagedDiff(rootDir: string): DiffEntry[] {
  try {
    const nameStatusOutput = execSync('git diff --cached --name-status', {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const numstatOutput = execSync('git diff --cached --numstat', {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const entries = parseDiffNameStatus(nameStatusOutput);
    const stats = parseDiffNumstat(numstatOutput);

    // Merge stats into entries
    for (const entry of entries) {
      const stat = stats.get(entry.path);
      if (stat) {
        entry.additions = stat.additions;
        entry.deletions = stat.deletions;
      }
    }

    return entries;
  } catch (err) {
    throw new GitError('Failed to get staged diff', {
      rootDir,
      error: String(err),
    });
  }
}

/**
 * Check if the current directory is a git repository.
 *
 * @param rootDir - Directory to check
 * @returns true if it's a git repo
 *
 * @example
 * ```typescript
 * if (!isGitRepo('/my-project')) {
 *   console.error('Not a git repository');
 * }
 * ```
 */
export function isGitRepo(rootDir: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}
