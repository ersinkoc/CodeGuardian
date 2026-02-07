import type { CodebaseGraph, FileNode, SymbolNode } from '../types.js';

/**
 * Get a file node from the graph.
 *
 * @example
 * ```typescript
 * const file = getFile(graph, 'src/services/user.service.ts');
 * ```
 */
export function getFile(graph: CodebaseGraph, filePath: string): FileNode | undefined {
  return graph.files.get(filePath);
}

/**
 * Get a symbol node from the graph.
 *
 * @example
 * ```typescript
 * const symbol = getSymbol(graph, 'UserService');
 * ```
 */
export function getSymbol(graph: CodebaseGraph, name: string): SymbolNode | undefined {
  // Try direct lookup first
  for (const [, symbol] of graph.symbols) {
    if (symbol.name === name) {
      return symbol;
    }
  }
  return undefined;
}

/**
 * Get all files that the given file depends on (imports from).
 *
 * @example
 * ```typescript
 * const deps = getDependencies(graph, 'src/controllers/user.controller.ts');
 * // ['src/services/user.service.ts', 'src/types.ts']
 * ```
 */
export function getDependencies(graph: CodebaseGraph, filePath: string): string[] {
  const deps = graph.dependencies.adjacency.get(filePath);
  return deps ? Array.from(deps) : [];
}

/**
 * Get all files that depend on (import from) the given file.
 *
 * @example
 * ```typescript
 * const dependents = getDependents(graph, 'src/services/user.service.ts');
 * // ['src/controllers/user.controller.ts']
 * ```
 */
export function getDependents(graph: CodebaseGraph, filePath: string): string[] {
  const dependents: string[] = [];
  for (const [file, deps] of graph.dependencies.adjacency) {
    if (deps.has(filePath)) {
      dependents.push(file);
    }
  }
  return dependents;
}

/**
 * Find all circular dependency chains in the graph.
 *
 * Uses DFS cycle detection on the dependency adjacency list.
 *
 * @returns Array of circular dependency chains (each chain is a string array of file paths)
 *
 * @example
 * ```typescript
 * const cycles = findCircularDeps(graph);
 * // [['a.ts', 'b.ts', 'c.ts', 'a.ts']]
 * ```
 */
export function findCircularDeps(graph: CodebaseGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];

  const dfs = (node: string): void => {
    if (inStack.has(node)) {
      // Found a cycle
      const cycleStart = stack.indexOf(node);
      if (cycleStart !== -1) {
        const cycle = [...stack.slice(cycleStart), node];
        cycles.push(cycle);
      }
      return;
    }

    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    stack.push(node);

    const deps = graph.dependencies.adjacency.get(node);
    if (deps) {
      for (const dep of deps) {
        dfs(dep);
      }
    }

    stack.pop();
    inStack.delete(node);
  };

  for (const node of graph.dependencies.adjacency.keys()) {
    dfs(node);
  }

  return cycles;
}

/**
 * Get graph statistics.
 *
 * @example
 * ```typescript
 * const stats = getGraphStats(graph);
 * console.log(`${stats.totalFiles} files, ${stats.totalSymbols} symbols`);
 * ```
 */
export function getGraphStats(graph: CodebaseGraph): {
  totalFiles: number;
  totalSymbols: number;
  totalEdges: number;
  totalFunctions: number;
  totalLOC: number;
  avgComplexity: number;
  filesByRole: Record<string, number>;
  filesByLayer: Record<string, number>;
} {
  let totalFunctions = 0;
  let totalLOC = 0;
  let totalComplexity = 0;
  const filesByRole: Record<string, number> = {};
  const filesByLayer: Record<string, number> = {};

  for (const file of graph.files.values()) {
    totalFunctions += file.functions.length;
    totalLOC += file.loc;
    totalComplexity += file.complexity;

    filesByRole[file.role] = (filesByRole[file.role] ?? 0) + 1;
    filesByLayer[file.layer] = (filesByLayer[file.layer] ?? 0) + 1;
  }

  const fileCount = graph.files.size;

  return {
    totalFiles: fileCount,
    totalSymbols: graph.symbols.size,
    totalEdges: graph.edges.length,
    totalFunctions,
    totalLOC,
    avgComplexity: fileCount > 0 ? totalComplexity / fileCount : 0,
    filesByRole,
    filesByLayer,
  };
}
