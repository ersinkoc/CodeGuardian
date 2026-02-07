import ts from 'typescript';
import * as path from 'node:path';
import type { CodebaseGraph, IncrementalResult } from '../types.js';
import { processFile } from './builder.js';
import { parseFile } from '../ast/parser.js';
import { relativePath } from '../utils/fs.js';

/**
 * Incrementally update the graph with changed files.
 *
 * @param graph - Existing graph to update
 * @param changedFiles - List of changed file paths (relative to rootDir)
 * @param rootDir - Project root directory
 * @param program - TypeScript program (for type checking)
 * @returns IncrementalResult with changed and affected files
 *
 * @example
 * ```typescript
 * const result = updateGraphIncremental(graph, ['src/service.ts'], '/project', program);
 * console.log(`Updated ${result.changedFiles.length} files`);
 * ```
 */
export function updateGraphIncremental(
  graph: CodebaseGraph,
  changedFiles: string[],
  rootDir: string,
  program: ts.Program,
): IncrementalResult {
  const checker = program.getTypeChecker();
  const affectedFiles = new Set<string>();

  for (const filePath of changedFiles) {
    const relPath = filePath.startsWith(rootDir)
      ? relativePath(rootDir, filePath)
      : filePath;

    // Find files that import this file BEFORE removing old data
    const dependents = findDependents(graph, relPath);
    for (const dep of dependents) {
      affectedFiles.add(dep);
    }

    // Remove old data for this file
    removeFileFromGraph(graph, relPath);

    // Re-parse the file
    const absolutePath = path.resolve(rootDir, relPath);
    try {
      const sourceFile = program.getSourceFile(absolutePath) ?? parseFile(absolutePath);
      processFile(graph, sourceFile, relPath, rootDir, checker);
    } catch {
      // File might have been deleted
      continue;
    }

    affectedFiles.add(relPath);
  }

  // Rebuild dependency adjacency
  rebuildAdjacency(graph);

  return {
    changedFiles,
    affectedFiles: Array.from(affectedFiles),
    graph,
  };
}

/**
 * Remove all graph data related to a specific file.
 */
function removeFileFromGraph(graph: CodebaseGraph, filePath: string): void {
  // Remove file node
  graph.files.delete(filePath);

  // Remove symbols from this file
  const symbolKeysToDelete: string[] = [];
  for (const [key, symbol] of graph.symbols) {
    if (symbol.file === filePath) {
      symbolKeysToDelete.push(key);
    }
  }
  for (const key of symbolKeysToDelete) {
    graph.symbols.delete(key);
  }

  // Remove edges from/to this file
  graph.edges = graph.edges.filter(
    (edge) => edge.from !== filePath && edge.to !== filePath,
  );

  // Remove from dependency graph
  graph.dependencies.adjacency.delete(filePath);
  for (const deps of graph.dependencies.adjacency.values()) {
    deps.delete(filePath);
  }
}

/**
 * Find all files that depend on (import from) the given file.
 */
function findDependents(graph: CodebaseGraph, filePath: string): string[] {
  const dependents: string[] = [];

  for (const [file, deps] of graph.dependencies.adjacency) {
    if (deps.has(filePath)) {
      dependents.push(file);
    }
  }

  return dependents;
}

/**
 * Rebuild the dependency adjacency list from edges.
 */
function rebuildAdjacency(graph: CodebaseGraph): void {
  const adjacency = new Map<string, Set<string>>();

  for (const filePath of graph.files.keys()) {
    adjacency.set(filePath, new Set());
  }

  for (const edge of graph.edges) {
    const deps = adjacency.get(edge.from);
    if (deps) {
      deps.add(edge.to);
    }
  }

  graph.dependencies.adjacency = adjacency;
}
