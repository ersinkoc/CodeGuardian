import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Read a file as UTF-8 string.
 *
 * @example
 * ```typescript
 * const content = readFileSync('src/index.ts');
 * ```
 */
export function readFileSync(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Write a string to a file (creates parent dirs).
 *
 * @example
 * ```typescript
 * writeFileSync('.codeguardian/graph.json', JSON.stringify(data));
 * ```
 */
export function writeFileSync(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Check if a file or directory exists.
 *
 * @example
 * ```typescript
 * if (fileExists('.codeguardian/graph.json')) { ... }
 * ```
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Read a JSON file and parse it.
 *
 * @example
 * ```typescript
 * const config = readJsonSync<ProjectConfig>('.codeguardian.json');
 * ```
 */
export function readJsonSync<T>(filePath: string): T {
  const content = readFileSync(filePath);
  return JSON.parse(content) as T;
}

/**
 * Write an object as JSON to a file.
 *
 * @example
 * ```typescript
 * writeJsonSync('.codeguardian/graph.json', serializedGraph);
 * ```
 */
export function writeJsonSync(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Recursively find files matching a simple pattern.
 * Uses node:fs only (no external glob library).
 *
 * @param dir - Directory to search
 * @param extensions - File extensions to match (e.g., ['.ts'])
 * @param exclude - Directory names to exclude
 * @returns Array of file paths (relative to dir)
 *
 * @example
 * ```typescript
 * const files = findFiles('src', ['.ts'], ['node_modules']);
 * ```
 */
export function findFiles(
  dir: string,
  extensions: string[] = ['.ts'],
  exclude: string[] = ['node_modules', '.git', 'dist'],
): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!exclude.includes(entry.name)) {
        results.push(...findFiles(fullPath, extensions, exclude));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Normalize a file path to use forward slashes.
 *
 * @example
 * ```typescript
 * normalizePath('src\\utils\\helper.ts'); // 'src/utils/helper.ts'
 * ```
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Get relative path from root, normalized with forward slashes.
 *
 * @example
 * ```typescript
 * relativePath('/project', '/project/src/index.ts'); // 'src/index.ts'
 * ```
 */
export function relativePath(rootDir: string, filePath: string): string {
  return normalizePath(path.relative(rootDir, filePath));
}
