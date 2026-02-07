import ts from 'typescript';
import * as path from 'node:path';
import type {
  CodebaseGraph,
  FileNode,
  FileRole,
  FunctionNode,
  LayerDefinition,
  SymbolNode,
} from '../types.js';
import { createTSProgram, getSourceFiles } from '../ast/parser.js';
import { extractExports, extractFunctions, extractImports } from '../ast/helpers.js';
import { calculateComplexity, countLOC } from '../ast/walker.js';
import { relativePath } from '../utils/fs.js';
import { globMatchAny } from '../utils/glob.js';

/**
 * Build a complete codebase knowledge graph.
 *
 * @param rootDir - Project root directory
 * @param tsconfigPath - Path to tsconfig.json
 * @param include - Glob patterns for files to include
 * @param exclude - Glob patterns for files to exclude
 * @param layers - Architectural layer definitions
 * @returns Complete CodebaseGraph
 *
 * @example
 * ```typescript
 * const graph = buildGraph('/project', './tsconfig.json', ['src/**\/*.ts'], ['**\/*.test.ts']);
 * console.log(`${graph.files.size} files scanned`);
 * ```
 */
export function buildGraph(
  rootDir: string,
  tsconfigPath: string,
  include: string[],
  exclude: string[],
  layers: string[] = ['controller', 'service', 'repository', 'util'],
): CodebaseGraph {
  const program = createTSProgram(rootDir, tsconfigPath);
  const checker = program.getTypeChecker();
  const sourceFilePaths = getSourceFiles(program);

  const graph: CodebaseGraph = {
    files: new Map(),
    symbols: new Map(),
    edges: [],
    layers: buildLayerDefinitions(layers),
    patterns: [],
    dependencies: { adjacency: new Map() },
  };

  // Filter files by include/exclude
  const filteredPaths = sourceFilePaths.filter((fp) => {
    const rel = relativePath(rootDir, fp);
    const included = include.length === 0 || globMatchAny(rel, include);
    const excluded = exclude.length > 0 && globMatchAny(rel, exclude);
    return included && !excluded;
  });

  // Process each file
  for (const filePath of filteredPaths) {
    const sourceFile = program.getSourceFile(filePath);
    /* v8 ignore next */
    if (!sourceFile) continue;

    const relPath = relativePath(rootDir, filePath);
    processFile(graph, sourceFile, relPath, rootDir, checker);
  }

  // Build dependency graph
  buildDependencyGraph(graph);

  return graph;
}

/**
 * Process a single file and add its data to the graph.
 *
 * @example
 * ```typescript
 * processFile(graph, sourceFile, 'src/services/user.ts', rootDir, checker);
 * ```
 */
export function processFile(
  graph: CodebaseGraph,
  sourceFile: ts.SourceFile,
  relPath: string,
  rootDir: string,
  _checker: ts.TypeChecker,
): void {
  const imports = extractImports(sourceFile);
  const exports = extractExports(sourceFile);
  const rawFunctions = extractFunctions(sourceFile, relPath);
  const role = detectFileRole(relPath);
  const layer = detectLayer(relPath);
  const loc = countLOC(sourceFile);

  // Build function nodes
  const functions: FunctionNode[] = rawFunctions.map((fn) => ({
    name: fn.name,
    file: relPath,
    startLine: fn.startLine,
    endLine: fn.endLine,
    params: fn.params,
    returnType: fn.returnType,
    complexity: calculateComplexity(fn.node),
    isAsync: fn.isAsync,
    hasSideEffects: false,
    issues: [],
  }));

  // Calculate file complexity
  const fileComplexity = functions.reduce((sum, fn) => sum + fn.complexity, 0);

  const fileNode: FileNode = {
    path: relPath,
    role,
    layer,
    exports,
    imports,
    complexity: fileComplexity,
    loc,
    functions,
  };

  graph.files.set(relPath, fileNode);

  // Add symbol nodes
  for (const exportName of exports) {
    const symbolNode: SymbolNode = {
      name: exportName,
      kind: 'variable',
      file: relPath,
      usedBy: [],
      dependsOn: [],
      isPublicAPI: false,
    };
    graph.symbols.set(`${relPath}:${exportName}`, symbolNode);
  }

  // Add import edges
  for (const imp of imports) {
    const resolvedPath = resolveImportPath(relPath, imp.source, rootDir);
    if (resolvedPath) {
      graph.edges.push({
        from: relPath,
        to: resolvedPath,
        specifiers: imp.specifiers,
        isTypeOnly: imp.isTypeOnly,
      });
    }
  }
}

/**
 * Detect file role from path patterns.
 *
 * @example
 * ```typescript
 * detectFileRole('src/services/user.service.ts'); // 'service'
 * detectFileRole('src/controllers/auth.ts');       // 'controller'
 * detectFileRole('tests/user.test.ts');            // 'test'
 * ```
 */
export function detectFileRole(filePath: string): FileRole {
  const lower = filePath.toLowerCase();

  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(lower) || lower.includes('/tests/') || lower.includes('/__tests__/')) {
    return 'test';
  }
  if (lower.includes('/controller') || lower.includes('.controller.')) return 'controller';
  if (lower.includes('/service') || lower.includes('.service.')) return 'service';
  if (lower.includes('/repositor') || lower.includes('.repository.') || lower.includes('.repo.')) return 'repository';
  if (lower.includes('/util') || lower.includes('/helper') || lower.includes('.util.') || lower.includes('.helper.')) return 'util';
  if (lower.includes('/type') || lower.endsWith('.d.ts') || lower.includes('.types.')) return 'type';
  if (lower.includes('/config') || lower.includes('.config.')) return 'config';

  return 'unknown';
}

/**
 * Detect architectural layer from file path.
 *
 * @example
 * ```typescript
 * detectLayer('src/controllers/user.ts'); // 'controller'
 * detectLayer('src/services/auth.ts');    // 'service'
 * detectLayer('src/utils/hash.ts');       // 'util'
 * ```
 */
export function detectLayer(filePath: string): string {
  const lower = filePath.toLowerCase();

  if (lower.includes('/controller')) return 'controller';
  if (lower.includes('/service')) return 'service';
  if (lower.includes('/repositor')) return 'repository';
  if (lower.includes('/util') || lower.includes('/helper')) return 'util';
  if (lower.includes('/middleware')) return 'middleware';
  if (lower.includes('/model')) return 'model';

  return 'unknown';
}

/**
 * Build layer definitions from layer names.
 */
function buildLayerDefinitions(layers: string[]): LayerDefinition[] {
  return layers.map((name, index) => ({
    name,
    order: index,
    patterns: [`**/${name}s/**`, `**/${name}/**`, `**/*.${name}.*`],
  }));
}

/**
 * Resolve an import path to a relative file path.
 */
function resolveImportPath(
  fromFile: string,
  importSource: string,
  _rootDir: string,
): string | undefined {
  // Skip external imports (node_modules, node: prefix, etc.)
  if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
    return undefined;
  }

  const fromDir = path.dirname(fromFile);
  let resolved = path.posix.join(fromDir, importSource);

  // Handle .js/.jsx -> .ts/.tsx mapping (ESM moduleResolution: NodeNext)
  if (resolved.endsWith('.js')) {
    resolved = resolved.slice(0, -3) + '.ts';
  /* v8 ignore next 2 */
  } else if (resolved.endsWith('.jsx')) {
    resolved = resolved.slice(0, -4) + '.tsx';
  } else if (!resolved.endsWith('.ts') && !resolved.endsWith('.tsx')) {
    resolved = resolved + '.ts';
  }

  return resolved.replace(/\\/g, '/');
}

/**
 * Build dependency graph (adjacency list) from import edges.
 */
function buildDependencyGraph(graph: CodebaseGraph): void {
  const adjacency = new Map<string, Set<string>>();

  // Initialize all files
  for (const filePath of graph.files.keys()) {
    adjacency.set(filePath, new Set());
  }

  // Add edges
  for (const edge of graph.edges) {
    const deps = adjacency.get(edge.from);
    if (deps) {
      deps.add(edge.to);
    }
  }

  // Update usedBy for symbols
  for (const edge of graph.edges) {
    for (const spec of edge.specifiers) {
      const symbolKey = `${edge.to}:${spec}`;
      const symbol = graph.symbols.get(symbolKey);
      if (symbol) {
        symbol.usedBy.push(edge.from);
      }
    }
  }

  graph.dependencies = { adjacency };
}
