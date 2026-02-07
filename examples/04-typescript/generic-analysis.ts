/**
 * Example: Analyzing generic types and patterns in the codebase.
 */
import { createGuardian } from '@oxog/codeguardian';

async function main() {
  const guardian = createGuardian({ rootDir: process.cwd() });
  const graph = await guardian.scan();

  // Find all async functions
  const asyncFunctions = [];
  for (const file of graph.files.values()) {
    for (const fn of file.functions) {
      if (fn.isAsync) {
        asyncFunctions.push({ file: file.path, name: fn.name, complexity: fn.complexity });
      }
    }
  }

  console.log(`Found ${asyncFunctions.length} async functions:`);
  for (const fn of asyncFunctions) {
    console.log(`  ${fn.file}:${fn.name} (complexity: ${fn.complexity})`);
  }

  // Find most complex files
  const sorted = Array.from(graph.files.values())
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, 10);

  console.log('\nTop 10 most complex files:');
  for (const file of sorted) {
    console.log(`  ${file.path}: complexity ${file.complexity}, ${file.loc} LOC`);
  }
}

main();
