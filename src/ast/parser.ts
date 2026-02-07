import ts from 'typescript';
import * as path from 'node:path';
import { ParseError } from '../errors.js';
import { readFileSync } from '../utils/fs.js';

/**
 * Create a TypeScript program from a tsconfig path.
 *
 * @param rootDir - Project root directory
 * @param tsconfigPath - Path to tsconfig.json (relative to rootDir)
 * @returns TypeScript Program instance
 *
 * @example
 * ```typescript
 * const program = createTSProgram('/my-project', './tsconfig.json');
 * const checker = program.getTypeChecker();
 * ```
 */
export function createTSProgram(rootDir: string, tsconfigPath: string): ts.Program {
  const configPath = path.resolve(rootDir, tsconfigPath);

  const configFile = ts.readConfigFile(configPath, (p) => readFileSync(p));
  if (configFile.error) {
    throw new ParseError(`Failed to read tsconfig: ${configFile.error.messageText}`, {
      file: configPath,
    });
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    rootDir,
  );

  if (parsed.errors.length > 0) {
    const messages = parsed.errors
      /* v8 ignore next */
      .map((e) => (typeof e.messageText === 'string' ? e.messageText : e.messageText.messageText))
      .join(', ');
    throw new ParseError(`tsconfig parse errors: ${messages}`, { file: configPath });
  }

  return ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
  });
}

/**
 * Parse a single TypeScript file into a SourceFile AST.
 *
 * @param filePath - Absolute path to the .ts file
 * @param content - Optional file content (reads from disk if not provided)
 * @returns TypeScript SourceFile
 *
 * @example
 * ```typescript
 * const ast = parseFile('/project/src/index.ts');
 * ```
 */
export function parseFile(filePath: string, content?: string): ts.SourceFile {
  const source = content ?? readFileSync(filePath);
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  return sourceFile;
}

/**
 * Get all source file paths from a TypeScript program (excluding .d.ts and node_modules).
 *
 * @param program - TypeScript Program
 * @returns Array of source file paths
 *
 * @example
 * ```typescript
 * const files = getSourceFiles(program);
 * ```
 */
export function getSourceFiles(program: ts.Program): string[] {
  return program
    .getSourceFiles()
    .filter((sf) => !sf.isDeclarationFile && !sf.fileName.includes('node_modules'))
    .map((sf) => sf.fileName);
}
