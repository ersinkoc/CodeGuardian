import type { CodebaseGraph, DetectedPattern } from '../types.js';

/**
 * Auto-discover project conventions by analyzing the codebase graph.
 *
 * Detects patterns like:
 * - File naming conventions (*.service.ts, *.controller.ts)
 * - Export patterns (services export classes, utils export functions)
 * - Import direction (controllers → services → repositories)
 * - Naming conventions (camelCase functions, PascalCase classes)
 *
 * @param graph - Codebase knowledge graph
 * @returns Array of detected patterns
 *
 * @example
 * ```typescript
 * const patterns = discoverConventions(graph);
 * for (const p of patterns) {
 *   console.log(`${p.type}: ${p.description} (${p.confidence}%)`);
 * }
 * ```
 */
export function discoverConventions(graph: CodebaseGraph): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  patterns.push(...detectFileNamingPatterns(graph));
  patterns.push(...detectExportPatterns(graph));
  patterns.push(...detectImportDirectionPatterns(graph));
  patterns.push(...detectNamingConventions(graph));

  return patterns;
}

/**
 * Detect file naming patterns in directories.
 */
function detectFileNamingPatterns(graph: CodebaseGraph): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const dirFiles = new Map<string, string[]>();

  // Group files by directory
  for (const [filePath] of graph.files) {
    const parts = filePath.split('/');
    const dir = parts.slice(0, -1).join('/');
    /* v8 ignore next */
    const file = parts[parts.length - 1] ?? '';

    if (!dirFiles.has(dir)) {
      dirFiles.set(dir, []);
    }
    dirFiles.get(dir)!.push(file);
  }

  // Find naming patterns in each directory
  for (const [dir, files] of dirFiles) {
    if (files.length < 2) continue;

    // Check for suffix patterns like *.service.ts, *.controller.ts
    const suffixes = new Map<string, string[]>();
    for (const file of files) {
      const parts = file.split('.');
      if (parts.length >= 3) {
        const suffix = parts.slice(-2).join('.');
        if (!suffixes.has(suffix)) {
          suffixes.set(suffix, []);
        }
        suffixes.get(suffix)!.push(file);
      }
    }

    for (const [suffix, matchingFiles] of suffixes) {
      const ratio = matchingFiles.length / files.length;
      if (ratio >= 0.5 && matchingFiles.length >= 2) {
        patterns.push({
          type: 'file-naming',
          description: `Files in ${dir}/ follow *.${suffix} naming pattern`,
          files: matchingFiles.map((f) => `${dir}/${f}`),
          confidence: Math.round(ratio * 100),
        });
      }
    }
  }

  return patterns;
}

/**
 * Detect export patterns (e.g., services export classes).
 */
function detectExportPatterns(graph: CodebaseGraph): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const roleExports = new Map<string, { classes: number; functions: number; files: string[] }>();

  for (const [filePath, fileNode] of graph.files) {
    if (fileNode.role === 'unknown' || fileNode.role === 'test') continue;

    if (!roleExports.has(fileNode.role)) {
      roleExports.set(fileNode.role, { classes: 0, functions: 0, files: [] });
    }

    const entry = roleExports.get(fileNode.role)!;
    entry.files.push(filePath);

    // Check export types
    for (const exp of fileNode.exports) {
      const symbol = graph.symbols.get(`${filePath}:${exp}`);
      if (symbol) {
        if (symbol.kind === 'class') entry.classes++;
        if (symbol.kind === 'function') entry.functions++;
      }
    }
  }

  for (const [role, data] of roleExports) {
    if (data.files.length < 2) continue;

    if (data.classes > data.functions && data.classes >= 2) {
      patterns.push({
        type: 'export-pattern',
        description: `${role} files primarily export classes`,
        files: data.files,
        confidence: Math.round((data.classes / (data.classes + data.functions)) * 100),
      });
    } else if (data.functions > data.classes && data.functions >= 2) {
      patterns.push({
        type: 'export-pattern',
        description: `${role} files primarily export functions`,
        files: data.files,
        confidence: Math.round((data.functions / (data.classes + data.functions)) * 100),
      });
    }
  }

  return patterns;
}

/**
 * Detect import direction patterns.
 */
function detectImportDirectionPatterns(graph: CodebaseGraph): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const layerImports = new Map<string, Map<string, number>>();

  for (const edge of graph.edges) {
    const fromFile = graph.files.get(edge.from);
    const toFile = graph.files.get(edge.to);
    if (!fromFile || !toFile) continue;

    const fromLayer = fromFile.layer;
    const toLayer = toFile.layer;
    if (fromLayer === 'unknown' || toLayer === 'unknown') continue;

    if (!layerImports.has(fromLayer)) {
      layerImports.set(fromLayer, new Map());
    }
    const targets = layerImports.get(fromLayer)!;
    targets.set(toLayer, (targets.get(toLayer) ?? 0) + 1);
  }

  for (const [fromLayer, targets] of layerImports) {
    for (const [toLayer, count] of targets) {
      if (count >= 2) {
        patterns.push({
          type: 'import-direction',
          description: `${fromLayer} → ${toLayer} (${count} imports)`,
          files: [],
          confidence: Math.min(100, count * 20),
        });
      }
    }
  }

  return patterns;
}

/**
 * Detect naming conventions.
 */
function detectNamingConventions(graph: CodebaseGraph): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  let camelCase = 0;
  let pascalCase = 0;
  let snakeCase = 0;

  for (const file of graph.files.values()) {
    for (const fn of file.functions) {
      if (/^[a-z][a-zA-Z0-9]*$/.test(fn.name)) camelCase++;
      else if (/^[A-Z][a-zA-Z0-9]*$/.test(fn.name)) pascalCase++;
      else if (/^[a-z][a-z0-9_]*$/.test(fn.name)) snakeCase++;
    }
  }

  const total = camelCase + pascalCase + snakeCase;
  if (total >= 5) {
    if (camelCase / total >= 0.7) {
      patterns.push({
        type: 'naming-convention',
        description: 'Functions use camelCase naming',
        files: [],
        confidence: Math.round((camelCase / total) * 100),
      });
    }
  }

  return patterns;
}
