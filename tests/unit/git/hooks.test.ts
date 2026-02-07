import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { installHook, uninstallHook, isHookInstalled } from '../../../src/git/hooks.js';

const TMP_DIR = path.join(__dirname, '../../../.tmp-hooks-test');
const GIT_DIR = path.join(TMP_DIR, '.git');
const HOOKS_DIR = path.join(GIT_DIR, 'hooks');

describe('git hooks', () => {
  beforeEach(() => {
    fs.mkdirSync(HOOKS_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  describe('installHook', () => {
    it('should create pre-commit hook', () => {
      installHook(TMP_DIR);
      const hookPath = path.join(HOOKS_DIR, 'pre-commit');
      expect(fs.existsSync(hookPath)).toBe(true);
      const content = fs.readFileSync(hookPath, 'utf-8');
      expect(content).toContain('codeguardian');
    });

    it('should backup existing non-codeguardian hook', () => {
      const hookPath = path.join(HOOKS_DIR, 'pre-commit');
      fs.writeFileSync(hookPath, '#!/bin/sh\necho "existing hook"');
      installHook(TMP_DIR);
      const backupPath = path.join(HOOKS_DIR, 'pre-commit.backup');
      expect(fs.existsSync(backupPath)).toBe(true);
    });

    it('should throw if not a git repo', () => {
      fs.rmSync(GIT_DIR, { recursive: true, force: true });
      expect(() => installHook(TMP_DIR)).toThrow();
    });
  });

  describe('uninstallHook', () => {
    it('should remove codeguardian hook', () => {
      installHook(TMP_DIR);
      const removed = uninstallHook(TMP_DIR);
      expect(removed).toBe(true);
    });

    it('should return false if no hook exists', () => {
      const removed = uninstallHook(TMP_DIR);
      expect(removed).toBe(false);
    });

    it('should restore backup', () => {
      const hookPath = path.join(HOOKS_DIR, 'pre-commit');
      fs.writeFileSync(hookPath, '#!/bin/sh\necho "original"');
      installHook(TMP_DIR);
      uninstallHook(TMP_DIR);
      const content = fs.readFileSync(hookPath, 'utf-8');
      expect(content).toContain('original');
    });
  });

  describe('isHookInstalled', () => {
    it('should return true when hook is installed', () => {
      installHook(TMP_DIR);
      expect(isHookInstalled(TMP_DIR)).toBe(true);
    });

    it('should return false when no hook', () => {
      expect(isHookInstalled(TMP_DIR)).toBe(false);
    });
  });
});
