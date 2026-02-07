import { describe, it, expect } from 'vitest';
import {
  CodeGuardianError,
  ConfigError,
  ParseError,
  PluginError,
  GraphError,
  GitError,
} from '../../../src/errors.js';

describe('errors', () => {
  it('CodeGuardianError should have code and context', () => {
    const err = new CodeGuardianError('test', 'TEST_CODE', { key: 'value' });
    expect(err.message).toBe('test');
    expect(err.code).toBe('TEST_CODE');
    expect(err.context).toEqual({ key: 'value' });
    expect(err.name).toBe('CodeGuardianError');
    expect(err instanceof Error).toBe(true);
  });

  it('ConfigError should have CONFIG_ERROR code', () => {
    const err = new ConfigError('bad config');
    expect(err.code).toBe('CONFIG_ERROR');
    expect(err.name).toBe('ConfigError');
  });

  it('ParseError should have PARSE_ERROR code', () => {
    const err = new ParseError('parse failed');
    expect(err.code).toBe('PARSE_ERROR');
    expect(err.name).toBe('ParseError');
  });

  it('PluginError should have PLUGIN_ERROR code', () => {
    const err = new PluginError('plugin failed');
    expect(err.code).toBe('PLUGIN_ERROR');
    expect(err.name).toBe('PluginError');
  });

  it('GraphError should have GRAPH_ERROR code', () => {
    const err = new GraphError('graph failed');
    expect(err.code).toBe('GRAPH_ERROR');
    expect(err.name).toBe('GraphError');
  });

  it('GitError should have GIT_ERROR code', () => {
    const err = new GitError('git failed');
    expect(err.code).toBe('GIT_ERROR');
    expect(err.name).toBe('GitError');
  });

  it('all errors should be instances of CodeGuardianError', () => {
    expect(new ConfigError('test') instanceof CodeGuardianError).toBe(true);
    expect(new ParseError('test') instanceof CodeGuardianError).toBe(true);
    expect(new PluginError('test') instanceof CodeGuardianError).toBe(true);
    expect(new GraphError('test') instanceof CodeGuardianError).toBe(true);
    expect(new GitError('test') instanceof CodeGuardianError).toBe(true);
  });
});
