/**
 * Example: Basic project setup with codeguardian.
 *
 * @example
 * ```bash
 * npx codeguardian init
 * ```
 */
import { createGuardian } from '@oxog/codeguardian';

async function main() {
  // Create a guardian instance for the current project
  const guardian = createGuardian({
    rootDir: process.cwd(),
    tsconfig: './tsconfig.json',
  });

  // Scan the project and build knowledge graph
  const graph = await guardian.scan();
  console.log(`Scanned ${graph.files.size} files`);
  console.log(`Found ${graph.symbols.size} symbols`);
  console.log(`Found ${graph.edges.length} import edges`);
}

main();
