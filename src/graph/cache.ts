import * as path from 'node:path';
import type { CodebaseGraph, SerializedGraph } from '../types.js';
import { fileExists, readJsonSync, writeJsonSync } from '../utils/fs.js';
import { GraphError } from '../errors.js';

const GRAPH_VERSION = '1.0.0';

/**
 * Serialize a CodebaseGraph to a JSON-safe object for caching.
 *
 * @param graph - The graph to serialize
 * @returns Serialized graph object
 *
 * @example
 * ```typescript
 * const serialized = serializeGraph(graph);
 * writeJsonSync('.codeguardian/graph.json', serialized);
 * ```
 */
export function serializeGraph(graph: CodebaseGraph): SerializedGraph {
  return {
    version: GRAPH_VERSION,
    timestamp: Date.now(),
    files: Array.from(graph.files.entries()),
    symbols: Array.from(graph.symbols.entries()),
    edges: graph.edges,
    layers: graph.layers,
    patterns: graph.patterns,
    adjacency: Array.from(graph.dependencies.adjacency.entries()).map(
      ([key, value]) => [key, Array.from(value)] as [string, string[]],
    ),
  };
}

/**
 * Deserialize a cached graph back into a CodebaseGraph.
 *
 * @param data - Serialized graph data
 * @returns Reconstructed CodebaseGraph
 *
 * @example
 * ```typescript
 * const data = readJsonSync<SerializedGraph>('.codeguardian/graph.json');
 * const graph = deserializeGraph(data);
 * ```
 */
export function deserializeGraph(data: SerializedGraph): CodebaseGraph {
  if (data.version !== GRAPH_VERSION) {
    throw new GraphError(`Graph cache version mismatch: expected ${GRAPH_VERSION}, got ${data.version}`);
  }

  const adjacency = new Map<string, Set<string>>();
  for (const [key, values] of data.adjacency) {
    adjacency.set(key, new Set(values));
  }

  return {
    files: new Map(data.files),
    symbols: new Map(data.symbols),
    edges: data.edges,
    layers: data.layers,
    patterns: data.patterns,
    dependencies: { adjacency },
  };
}

/**
 * Save graph to the .codeguardian cache directory.
 *
 * @param rootDir - Project root directory
 * @param graph - Graph to save
 *
 * @example
 * ```typescript
 * saveGraphCache('/my-project', graph);
 * ```
 */
export function saveGraphCache(rootDir: string, graph: CodebaseGraph): void {
  const cachePath = path.join(rootDir, '.codeguardian', 'graph.json');
  const serialized = serializeGraph(graph);
  writeJsonSync(cachePath, serialized);
}

/**
 * Load graph from the .codeguardian cache directory.
 *
 * @param rootDir - Project root directory
 * @returns Cached graph or null if not found/invalid
 *
 * @example
 * ```typescript
 * const graph = loadGraphCache('/my-project');
 * if (graph) { console.log('Loaded cached graph'); }
 * ```
 */
export function loadGraphCache(rootDir: string): CodebaseGraph | null {
  const cachePath = path.join(rootDir, '.codeguardian', 'graph.json');

  if (!fileExists(cachePath)) {
    return null;
  }

  try {
    const data = readJsonSync<SerializedGraph>(cachePath);
    return deserializeGraph(data);
  } catch {
    return null;
  }
}
