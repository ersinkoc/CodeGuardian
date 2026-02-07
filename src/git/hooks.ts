import * as fs from 'node:fs';
import * as path from 'node:path';
import { GitError } from '../errors.js';

const HOOK_CONTENT = `#!/bin/sh
# codeguardian pre-commit hook
npx codeguardian run --staged
`;

/**
 * Install the codeguardian pre-commit hook.
 *
 * @param rootDir - Project root directory
 * @returns true if hook was installed successfully
 *
 * @example
 * ```typescript
 * installHook('/my-project');
 * // Creates .git/hooks/pre-commit
 * ```
 */
export function installHook(rootDir: string): boolean {
  const gitDir = path.join(rootDir, '.git');
  if (!fs.existsSync(gitDir)) {
    throw new GitError('Not a git repository. Run `git init` first.', { rootDir });
  }

  const hooksDir = path.join(gitDir, 'hooks');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hookPath = path.join(hooksDir, 'pre-commit');

  // Check if there's an existing hook that's NOT ours
  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, 'utf-8');
    if (!existing.includes('codeguardian')) {
      // Backup existing hook
      const backupPath = path.join(hooksDir, 'pre-commit.backup');
      fs.writeFileSync(backupPath, existing, 'utf-8');
    }
  }

  fs.writeFileSync(hookPath, HOOK_CONTENT, { mode: 0o755, encoding: 'utf-8' });
  return true;
}

/**
 * Uninstall the codeguardian pre-commit hook.
 *
 * @param rootDir - Project root directory
 * @returns true if hook was removed
 *
 * @example
 * ```typescript
 * uninstallHook('/my-project');
 * ```
 */
export function uninstallHook(rootDir: string): boolean {
  const hookPath = path.join(rootDir, '.git', 'hooks', 'pre-commit');

  if (!fs.existsSync(hookPath)) {
    return false;
  }

  const content = fs.readFileSync(hookPath, 'utf-8');
  if (!content.includes('codeguardian')) {
    return false; // Not our hook
  }

  // Check for backup
  const backupPath = path.join(rootDir, '.git', 'hooks', 'pre-commit.backup');
  if (fs.existsSync(backupPath)) {
    // Restore backup
    const backup = fs.readFileSync(backupPath, 'utf-8');
    fs.writeFileSync(hookPath, backup, { mode: 0o755, encoding: 'utf-8' });
    fs.unlinkSync(backupPath);
  } else {
    fs.unlinkSync(hookPath);
  }

  return true;
}

/**
 * Check if the codeguardian pre-commit hook is installed.
 *
 * @param rootDir - Project root directory
 * @returns true if our hook is installed
 *
 * @example
 * ```typescript
 * if (isHookInstalled('/my-project')) {
 *   console.log('Hook is active');
 * }
 * ```
 */
export function isHookInstalled(rootDir: string): boolean {
  const hookPath = path.join(rootDir, '.git', 'hooks', 'pre-commit');

  if (!fs.existsSync(hookPath)) {
    return false;
  }

  const content = fs.readFileSync(hookPath, 'utf-8');
  return content.includes('codeguardian');
}
