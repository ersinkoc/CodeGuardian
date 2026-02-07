/**
 * Example: Using codeguardian as a pre-commit hook programmatically.
 */
import { createGuardian } from '@oxog/codeguardian';

async function preCommit() {
  const guardian = createGuardian({ rootDir: process.cwd() });

  // Run analysis on staged files only
  const result = await guardian.run({ staged: true });

  // Output results to terminal
  const output = guardian.format(result, 'terminal');
  console.log(output);

  // Exit with non-zero if commit should be blocked
  if (result.blocked) {
    process.exit(1);
  }
}

preCommit();
