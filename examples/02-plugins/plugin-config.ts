/**
 * Example: Configuring built-in plugins.
 */
import { createGuardian } from '@oxog/codeguardian';

async function main() {
  const guardian = createGuardian({
    rootDir: process.cwd(),
    config: {
      plugins: {
        architecture: {
          enabled: true,
          layers: ['controller', 'service', 'repository'],
          enforceDirection: true,
          maxFileLines: 500,
          maxFunctionLines: 80,
        },
        security: {
          enabled: true,
          checkInjection: true,
          checkSecrets: true,
          checkXSS: false, // Disable XSS checks for API-only project
        },
        performance: {
          enabled: true,
          checkN1Queries: true,
          checkMemoryLeaks: true,
        },
        quality: {
          enabled: true,
          maxCyclomaticComplexity: 20,
        },
      },
    },
  });

  const result = await guardian.run();
  console.log(`Found ${result.findings.length} issues`);
}

main();
