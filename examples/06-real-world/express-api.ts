/**
 * Example: Using codeguardian with an Express API project.
 */
import { createGuardian } from '@oxog/codeguardian';

async function main() {
  const guardian = createGuardian({
    rootDir: process.cwd(),
    config: {
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      plugins: {
        architecture: {
          enabled: true,
          layers: ['route', 'controller', 'service', 'repository', 'model'],
          enforceDirection: true,
        },
        security: {
          enabled: true,
          checkInjection: true,
          checkAuth: true,
          checkSecrets: true,
          checkXSS: false, // No HTML rendering
        },
        performance: {
          enabled: true,
          checkN1Queries: true,
        },
      },
    },
  });

  const result = await guardian.run();
  const output = guardian.format(result, 'terminal', true);
  console.log(output);
}

main();
