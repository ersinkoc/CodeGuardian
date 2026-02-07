import { createHash } from 'node:crypto';

/**
 * Create a SHA-256 hash of a string.
 *
 * @param content - String content to hash
 * @returns Hex-encoded SHA-256 hash
 *
 * @example
 * ```typescript
 * const hash = sha256('file contents...');
 * ```
 */
export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Create a short hash (first 8 characters of SHA-256).
 *
 * @param content - String content to hash
 * @returns First 8 hex characters
 *
 * @example
 * ```typescript
 * const hash = shortHash('file contents...');
 * // e.g., 'a1b2c3d4'
 * ```
 */
export function shortHash(content: string): string {
  return sha256(content).slice(0, 8);
}
