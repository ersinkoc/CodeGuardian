import { describe, it, expect } from 'vitest';
import { createKernel } from '../../../src/kernel.js';
import type { GuardianPlugin, Rule } from '../../../src/types.js';

function createTestRule(name: string): Rule {
  return {
    name,
    severity: 'warning',
    description: 'Test rule',
    category: 'quality',
    check: () => [],
  };
}

function createTestPlugin(name: string, rules: Rule[] = []): GuardianPlugin {
  return {
    name,
    version: '1.0.0',
    install(kernel) {
      for (const rule of rules) {
        kernel.registerRule(rule);
      }
    },
  };
}

describe('createKernel', () => {
  it('should create a kernel instance', () => {
    const kernel = createKernel();
    expect(kernel).toBeDefined();
    expect(kernel.getRules()).toHaveLength(0);
  });

  it('should install a plugin', () => {
    const kernel = createKernel();
    const plugin = createTestPlugin('test', [createTestRule('test/rule1')]);
    kernel.installPlugin(plugin);
    expect(kernel.hasPlugin('test')).toBe(true);
    expect(kernel.getRules()).toHaveLength(1);
  });

  it('should not allow duplicate plugins', () => {
    const kernel = createKernel();
    const plugin = createTestPlugin('test');
    kernel.installPlugin(plugin);
    expect(() => kernel.installPlugin(plugin)).toThrow();
  });

  it('should not allow duplicate rules', () => {
    const kernel = createKernel();
    const rule = createTestRule('test/rule1');
    const plugin1 = createTestPlugin('test1', [rule]);
    const plugin2: GuardianPlugin = {
      name: 'test2',
      version: '1.0.0',
      install(k) { k.registerRule(rule); },
    };
    kernel.installPlugin(plugin1);
    expect(() => kernel.installPlugin(plugin2)).toThrow();
  });

  it('should uninstall a plugin', async () => {
    const kernel = createKernel();
    const plugin = createTestPlugin('test', [createTestRule('test/rule1')]);
    kernel.installPlugin(plugin);
    await kernel.uninstallPlugin('test');
    expect(kernel.hasPlugin('test')).toBe(false);
    expect(kernel.getRules()).toHaveLength(0);
  });

  it('should check dependencies', () => {
    const kernel = createKernel();
    const plugin: GuardianPlugin = {
      name: 'child',
      version: '1.0.0',
      dependencies: ['parent'],
      install() {},
    };
    expect(() => kernel.installPlugin(plugin)).toThrow(/depends on/);
  });

  it('should get plugin names', () => {
    const kernel = createKernel();
    kernel.installPlugin(createTestPlugin('a'));
    kernel.installPlugin(createTestPlugin('b'));
    expect(kernel.getPluginNames()).toEqual(['a', 'b']);
  });

  it('should get rule count', () => {
    const kernel = createKernel();
    kernel.installPlugin(createTestPlugin('test', [
      createTestRule('test/r1'),
      createTestRule('test/r2'),
    ]));
    expect(kernel.getRuleCount()).toBe(2);
  });
});
