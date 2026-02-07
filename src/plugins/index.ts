/**
 * @oxog/codeguardian plugin exports.
 *
 * Core plugins (always loaded by default):
 * - architecturePlugin
 * - securityPlugin
 * - performancePlugin
 * - qualityPlugin
 *
 * Optional plugins (opt-in):
 * - namingPlugin
 * - apiPlugin
 * - testGuardPlugin
 * - depAuditPlugin
 *
 * @example
 * ```typescript
 * import { architecturePlugin, securityPlugin } from '@oxog/codeguardian/plugins';
 * guardian.use(architecturePlugin({ layers: ['controller', 'service'] }));
 * ```
 */

// Core plugins
export { architecturePlugin } from './core/architecture.js';
export { securityPlugin } from './core/security.js';
export { performancePlugin } from './core/performance.js';
export { qualityPlugin } from './core/quality.js';

// Optional plugins
export { namingPlugin } from './optional/naming.js';
export { apiPlugin } from './optional/api.js';
export { testGuardPlugin } from './optional/test-guard.js';
export { depAuditPlugin } from './optional/dep-audit.js';
