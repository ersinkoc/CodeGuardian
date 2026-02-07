import type { DiffEntry } from '../types.js';

/**
 * Parse git diff --name-status output into structured DiffEntry objects.
 *
 * @param output - Raw output from `git diff --cached --name-status`
 * @returns Array of DiffEntry objects
 *
 * @example
 * ```typescript
 * const entries = parseDiffNameStatus('M\tsrc/index.ts\nA\tsrc/new.ts\n');
 * // [{ path: 'src/index.ts', status: 'modified', ... }, { path: 'src/new.ts', status: 'added', ... }]
 * ```
 */
export function parseDiffNameStatus(output: string): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const lines = output.trim().split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.split('\t');
    const statusCode = parts[0]?.trim();
    const filePath = parts[1]?.trim();

    if (!statusCode || !filePath) continue;

    let status: DiffEntry['status'];
    let oldPath: string | undefined;

    if (statusCode.startsWith('R')) {
      status = 'renamed';
      oldPath = filePath;
      const newPath = parts[2]?.trim();
      if (newPath) {
        entries.push({
          path: newPath,
          status,
          oldPath,
          additions: 0,
          deletions: 0,
        });
      }
      continue;
    }

    switch (statusCode) {
      case 'A':
        status = 'added';
        break;
      case 'M':
        status = 'modified';
        break;
      case 'D':
        status = 'deleted';
        break;
      default:
        status = 'modified';
        break;
    }

    entries.push({
      path: filePath,
      status,
      oldPath,
      additions: 0,
      deletions: 0,
    });
  }

  return entries;
}

/**
 * Parse git diff --numstat output to get addition/deletion counts.
 *
 * @param output - Raw output from `git diff --cached --numstat`
 * @returns Map of file path to { additions, deletions }
 *
 * @example
 * ```typescript
 * const stats = parseDiffNumstat('10\t5\tsrc/index.ts\n');
 * // Map { 'src/index.ts' => { additions: 10, deletions: 5 } }
 * ```
 */
export function parseDiffNumstat(output: string): Map<string, { additions: number; deletions: number }> {
  const stats = new Map<string, { additions: number; deletions: number }>();
  const lines = output.trim().split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    /* v8 ignore next 2 */
    const additions = parseInt(parts[0] ?? '0', 10);
    const deletions = parseInt(parts[1] ?? '0', 10);
    const filePath = parts[2]?.trim();

    if (filePath) {
      stats.set(filePath, {
        additions: isNaN(additions) ? 0 : additions,
        deletions: isNaN(deletions) ? 0 : deletions,
      });
    }
  }

  return stats;
}
