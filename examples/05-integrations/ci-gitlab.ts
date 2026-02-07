/**
 * Example: GitLab CI integration.
 *
 * Add this to your .gitlab-ci.yml:
 *
 * ```yaml
 * codeguardian:
 *   stage: test
 *   script:
 *     - npm ci
 *     - npx codeguardian run --format json > codeguardian-report.json
 *   artifacts:
 *     reports:
 *       codequality: codeguardian-report.json
 * ```
 */
import { createGuardian } from '@oxog/codeguardian';

async function main() {
  const guardian = createGuardian({ rootDir: process.cwd() });
  const result = await guardian.run({ format: 'json' });

  const output = guardian.format(result, 'json');
  process.stdout.write(output);

  process.exit(result.blocked ? 1 : 0);
}

main();
