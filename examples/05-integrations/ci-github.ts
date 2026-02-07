/**
 * Example: GitHub Actions integration with SARIF output.
 *
 * Add this to your .github/workflows/codeguardian.yml:
 *
 * ```yaml
 * name: Code Guardian
 * on: [push, pull_request]
 * jobs:
 *   analyze:
 *     runs-on: ubuntu-latest
 *     steps:
 *       - uses: actions/checkout@v4
 *       - uses: actions/setup-node@v4
 *         with:
 *           node-version: '20'
 *       - run: npm ci
 *       - run: npx codeguardian run --format sarif > results.sarif
 *       - uses: github/codeql-action/upload-sarif@v3
 *         with:
 *           sarif_file: results.sarif
 * ```
 */
import { createGuardian } from '@oxog/codeguardian';
import * as fs from 'node:fs';

async function ciRun() {
  const guardian = createGuardian({ rootDir: process.cwd() });
  const result = await guardian.run();

  // Write SARIF for GitHub Code Scanning
  const sarif = guardian.format(result, 'sarif');
  fs.writeFileSync('results.sarif', sarif);

  // Also write JSON summary
  const json = guardian.format(result, 'json');
  fs.writeFileSync('codeguardian-report.json', json);

  console.log(`Analysis complete: ${result.findings.length} findings`);
  if (result.blocked) {
    process.exit(1);
  }
}

ciRun();
