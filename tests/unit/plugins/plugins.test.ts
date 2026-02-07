import { describe, it, expect } from 'vitest';
import { architecturePlugin } from '../../../src/plugins/core/architecture.js';
import { securityPlugin } from '../../../src/plugins/core/security.js';
import { performancePlugin } from '../../../src/plugins/core/performance.js';
import { qualityPlugin } from '../../../src/plugins/core/quality.js';
import { namingPlugin } from '../../../src/plugins/optional/naming.js';
import { apiPlugin } from '../../../src/plugins/optional/api.js';
import { testGuardPlugin } from '../../../src/plugins/optional/test-guard.js';
import { depAuditPlugin } from '../../../src/plugins/optional/dep-audit.js';
import { createKernel } from '../../../src/kernel.js';

describe('core plugins', () => {
  it('architecture plugin should register 6 rules', () => {
    const kernel = createKernel();
    const plugin = architecturePlugin();
    kernel.installPlugin(plugin);
    const rules = kernel.getRules();
    expect(rules.length).toBe(6);
    expect(rules.map((r) => r.name)).toContain('architecture/layer-violation');
    expect(rules.map((r) => r.name)).toContain('architecture/circular-dependency');
    expect(rules.map((r) => r.name)).toContain('architecture/god-file');
    expect(rules.map((r) => r.name)).toContain('architecture/god-function');
    expect(rules.map((r) => r.name)).toContain('architecture/barrel-explosion');
  });

  it('security plugin should register 8 rules', () => {
    const kernel = createKernel();
    const plugin = securityPlugin();
    kernel.installPlugin(plugin);
    const rules = kernel.getRules();
    expect(rules.length).toBe(8);
    expect(rules.map((r) => r.name)).toContain('security/sql-injection');
    expect(rules.map((r) => r.name)).toContain('security/hardcoded-secret');
    expect(rules.map((r) => r.name)).toContain('security/eval-usage');
  });

  it('performance plugin should register 7 rules', () => {
    const kernel = createKernel();
    const plugin = performancePlugin();
    kernel.installPlugin(plugin);
    const rules = kernel.getRules();
    expect(rules.length).toBe(7);
    expect(rules.map((r) => r.name)).toContain('performance/n1-query');
    expect(rules.map((r) => r.name)).toContain('performance/sync-in-async');
  });

  it('quality plugin should register 8 rules', () => {
    const kernel = createKernel();
    const plugin = qualityPlugin();
    kernel.installPlugin(plugin);
    const rules = kernel.getRules();
    expect(rules.length).toBe(8);
    expect(rules.map((r) => r.name)).toContain('quality/cyclomatic-complexity');
    expect(rules.map((r) => r.name)).toContain('quality/dead-code');
    expect(rules.map((r) => r.name)).toContain('quality/any-type');
    expect(rules.map((r) => r.name)).toContain('quality/empty-catch');
  });
});

describe('optional plugins', () => {
  it('naming plugin should register 1 rule', () => {
    const kernel = createKernel();
    kernel.installPlugin(namingPlugin());
    expect(kernel.getRuleCount()).toBe(1);
  });

  it('api plugin should register 1 rule', () => {
    const kernel = createKernel();
    kernel.installPlugin(apiPlugin());
    expect(kernel.getRuleCount()).toBe(1);
  });

  it('test-guard plugin should register 1 rule', () => {
    const kernel = createKernel();
    kernel.installPlugin(testGuardPlugin());
    expect(kernel.getRuleCount()).toBe(1);
  });

  it('dep-audit plugin should register 1 rule', () => {
    const kernel = createKernel();
    kernel.installPlugin(depAuditPlugin());
    expect(kernel.getRuleCount()).toBe(1);
  });
});
