/**
 * Simple glob pattern matching (zero dependencies).
 * Supports `*`, `**`, and `?` wildcards.
 *
 * @example
 * ```typescript
 * import { globMatch } from './glob';
 * globMatch('src/services/user.service.ts', 'src/**\/*.service.ts'); // true
 * globMatch('test.js', '*.ts'); // false
 * ```
 */

/**
 * Convert a glob pattern to a regular expression.
 *
 * @param pattern - Glob pattern
 * @returns RegExp equivalent
 *
 * @example
 * ```typescript
 * const re = globToRegex('src/**\/*.ts');
 * re.test('src/utils/helper.ts'); // true
 * ```
 */
export function globToRegex(pattern: string): RegExp {
  let result = '';
  let i = 0;
  const len = pattern.length;

  while (i < len) {
    const c = pattern[i]!;

    if (c === '*') {
      if (pattern[i + 1] === '*') {
        // ** matches any path segment(s)
        if (pattern[i + 2] === '/') {
          result += '(?:.+/)?';
          i += 3;
        } else {
          result += '.*';
          i += 2;
        }
      } else {
        // * matches anything except /
        result += '[^/]*';
        i++;
      }
    } else if (c === '?') {
      result += '[^/]';
      i++;
    } else if (c === '.' || c === '(' || c === ')' || c === '{' || c === '}' || c === '[' || c === ']' || c === '+' || c === '^' || c === '$' || c === '|' || c === '\\') {
      result += '\\' + c;
      i++;
    } else {
      result += c;
      i++;
    }
  }

  return new RegExp(`^${result}$`);
}

/**
 * Test if a file path matches a glob pattern.
 *
 * @param filePath - File path to test (uses forward slashes)
 * @param pattern - Glob pattern
 * @returns true if the path matches
 *
 * @example
 * ```typescript
 * globMatch('src/index.ts', 'src/**\/*.ts'); // true
 * globMatch('lib/index.js', 'src/**\/*.ts'); // false
 * ```
 */
export function globMatch(filePath: string, pattern: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');
  const regex = globToRegex(normalizedPattern);
  return regex.test(normalized);
}

/**
 * Test if a file path matches any of the given glob patterns.
 *
 * @param filePath - File path to test
 * @param patterns - Array of glob patterns
 * @returns true if the path matches at least one pattern
 *
 * @example
 * ```typescript
 * globMatchAny('test.spec.ts', ['**\/*.test.ts', '**\/*.spec.ts']); // true
 * ```
 */
export function globMatchAny(filePath: string, patterns: string[]): boolean {
  return patterns.some((p) => globMatch(filePath, p));
}
