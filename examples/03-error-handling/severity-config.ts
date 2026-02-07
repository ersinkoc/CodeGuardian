/**
 * Example: Configuring severity levels for commit control.
 */
import { createGuardian } from '@oxog/codeguardian';

async function main() {
  const guardian = createGuardian({
    rootDir: process.cwd(),
    config: {
      severity: {
        // Only critical findings block commits
        blockOn: ['critical'],
        // Errors and warnings are shown but don't block
        warnOn: ['error', 'warning'],
      },
    },
  });

  const result = await guardian.run();

  console.log(`Critical: ${result.bySeverity.critical.length}`);
  console.log(`Errors:   ${result.bySeverity.error.length}`);
  console.log(`Warnings: ${result.bySeverity.warning.length}`);
  console.log(`Info:     ${result.bySeverity.info.length}`);
  console.log(`Blocked:  ${result.blocked}`);
}

main();
