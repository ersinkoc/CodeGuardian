/**
 * Example: Running the first codebase scan.
 */
import { createGuardian } from '@oxog/codeguardian';

async function main() {
  const guardian = createGuardian({ rootDir: process.cwd() });

  // Full scan builds the complete knowledge graph
  const graph = await guardian.scan();

  // Explore the graph
  for (const [path, file] of graph.files) {
    console.log(`${path} (${file.role}) - ${file.loc} LOC, complexity: ${file.complexity}`);
  }

  // Check for circular dependencies
  const cycles = guardian.query.findCircularDeps();
  if (cycles.length > 0) {
    console.log('\nCircular dependencies found:');
    for (const cycle of cycles) {
      console.log(`  ${cycle.join(' → ')}`);
    }
  }
}

main();
