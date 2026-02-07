/**
 * Example: Using codeguardian in a monorepo setup.
 *
 * Run codeguardian on each package separately.
 */
import { createGuardian } from '@oxog/codeguardian';
import * as path from 'node:path';

const packages = ['packages/api', 'packages/web', 'packages/shared'];

async function main() {
  let totalFindings = 0;
  let blocked = false;

  for (const pkg of packages) {
    const pkgPath = path.resolve(process.cwd(), pkg);
    console.log(`\nAnalyzing ${pkg}...`);

    const guardian = createGuardian({
      rootDir: pkgPath,
      tsconfig: './tsconfig.json',
    });

    const result = await guardian.run();
    totalFindings += result.findings.length;

    if (result.blocked) {
      blocked = true;
    }

    console.log(guardian.format(result));
  }

  console.log(`\nTotal findings across all packages: ${totalFindings}`);
  if (blocked) {
    process.exit(1);
  }
}

main();
