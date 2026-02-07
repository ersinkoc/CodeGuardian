import ts from 'typescript';
import type { ImportInfo, ParamInfo } from '../types.js';

/**
 * Check if a CallExpression calls a specific function name.
 *
 * @example
 * ```typescript
 * // Checks for calls like: someFunction()
 * isCallTo(node, 'someFunction');
 * // Checks for calls like: db.query()
 * isCallTo(node, 'query');
 * ```
 */
export function isCallTo(node: ts.CallExpression, name: string): boolean {
  const expr = node.expression;

  // Direct call: name()
  if (ts.isIdentifier(expr)) {
    return expr.text === name;
  }

  // Property access: obj.name()
  if (ts.isPropertyAccessExpression(expr)) {
    return expr.name.text === name;
  }

  return false;
}

/**
 * Check if a CallExpression is a console.* call.
 *
 * @param node - CallExpression node
 * @param method - Optional specific method (e.g., 'log', 'error')
 * @returns true if it's a console call
 *
 * @example
 * ```typescript
 * isConsoleCall(node);         // any console.*
 * isConsoleCall(node, 'log');  // only console.log
 * ```
 */
export function isConsoleCall(node: ts.CallExpression, method?: string): boolean {
  const expr = node.expression;

  if (ts.isPropertyAccessExpression(expr)) {
    if (ts.isIdentifier(expr.expression) && expr.expression.text === 'console') {
      if (method) {
        return expr.name.text === method;
      }
      return true;
    }
  }

  return false;
}

/**
 * Get the type of a node as a string using the TypeChecker.
 *
 * @example
 * ```typescript
 * const typeStr = getTypeString(node, checker);
 * // e.g., 'string', 'Promise<User>', 'number[]'
 * ```
 */
export function getTypeString(node: ts.Node, checker: ts.TypeChecker): string {
  try {
    const type = checker.getTypeAtLocation(node);
    return checker.typeToString(type);
  } catch {
    return 'unknown';
  }
}

/**
 * Check if a node contains string concatenation or template literals.
 *
 * @example
 * ```typescript
 * // Returns true for: `SELECT * FROM ${table}`
 * // Returns true for: "SELECT " + table
 * hasStringConcat(node);
 * ```
 */
export function hasStringConcat(node: ts.Node): boolean {
  if (ts.isTemplateExpression(node)) {
    return true;
  }

  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    // Check if either side is a string
    if (ts.isStringLiteral(node.left) || ts.isStringLiteral(node.right)) {
      return true;
    }
    if (ts.isTemplateExpression(node.left) || ts.isTemplateExpression(node.right)) {
      return true;
    }
  }

  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && hasStringConcat(child)) {
      found = true;
    }
  });

  return found;
}

/**
 * Extract all imports from a source file.
 *
 * @example
 * ```typescript
 * const imports = extractImports(sourceFile);
 * // [{ source: './user.service', specifiers: ['UserService'], isTypeOnly: false }]
 * ```
 */
export function extractImports(sourceFile: ts.SourceFile): ImportInfo[] {
  const imports: ImportInfo[] = [];

  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt)) {
      const moduleSpecifier = stmt.moduleSpecifier;
      /* v8 ignore next */
      if (!ts.isStringLiteral(moduleSpecifier)) continue;

      const source = moduleSpecifier.text;
      const isTypeOnly = stmt.importClause?.isTypeOnly ?? false;
      const specifiers: string[] = [];

      if (stmt.importClause) {
        // Default import
        if (stmt.importClause.name) {
          specifiers.push(stmt.importClause.name.text);
        }

        // Named imports
        const namedBindings = stmt.importClause.namedBindings;
        if (namedBindings) {
          if (ts.isNamedImports(namedBindings)) {
            for (const element of namedBindings.elements) {
              specifiers.push(element.name.text);
            }
          } else if (ts.isNamespaceImport(namedBindings)) {
            specifiers.push(namedBindings.name.text);
          }
        }
      }

      imports.push({ source, specifiers, isTypeOnly });
    }
  }

  return imports;
}

/**
 * Extract all exports from a source file (named exports and declarations).
 *
 * @example
 * ```typescript
 * const exports = extractExports(sourceFile);
 * // ['UserService', 'getUser', 'UserType']
 * ```
 */
export function extractExports(sourceFile: ts.SourceFile): string[] {
  const exports: string[] = [];

  for (const stmt of sourceFile.statements) {
    // export function/class/interface/type/enum/variable
    if (hasExportModifier(stmt)) {
      if (ts.isFunctionDeclaration(stmt) && stmt.name) {
        exports.push(stmt.name.text);
      } else if (ts.isClassDeclaration(stmt) && stmt.name) {
        exports.push(stmt.name.text);
      } else if (ts.isInterfaceDeclaration(stmt)) {
        exports.push(stmt.name.text);
      } else if (ts.isTypeAliasDeclaration(stmt)) {
        exports.push(stmt.name.text);
      } else if (ts.isEnumDeclaration(stmt)) {
        exports.push(stmt.name.text);
      } else if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            exports.push(decl.name.text);
          }
        }
      }
    }

    // export { ... }
    if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const element of stmt.exportClause.elements) {
        exports.push(element.name.text);
      }
    }

    // export default
    if (ts.isExportAssignment(stmt)) {
      exports.push('default');
    }
  }

  return exports;
}

/**
 * Check if a statement has the 'export' modifier.
 */
function hasExportModifier(node: ts.Node): boolean {
  /* v8 ignore next */
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

/**
 * Extract function declarations and methods from a source file.
 *
 * @example
 * ```typescript
 * const fns = extractFunctions(sourceFile, 'src/service.ts');
 * ```
 */
export function extractFunctions(
  sourceFile: ts.SourceFile,
  filePath: string,
): Array<{
  name: string;
  startLine: number;
  endLine: number;
  params: ParamInfo[];
  returnType: string;
  isAsync: boolean;
  node: ts.Node;
}> {
  const functions: Array<{
    name: string;
    startLine: number;
    endLine: number;
    params: ParamInfo[];
    returnType: string;
    isAsync: boolean;
    node: ts.Node;
  }> = [];

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      functions.push(buildFunctionInfo(node, node.name.text, sourceFile, filePath));
    } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
      functions.push(buildFunctionInfo(node, node.name.text, sourceFile, filePath));
    } else if (ts.isArrowFunction(node)) {
      const parent = node.parent;
      if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        functions.push(buildFunctionInfo(node, parent.name.text, sourceFile, filePath));
      }
    } else if (ts.isFunctionExpression(node)) {
      const parent = node.parent;
      if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        functions.push(buildFunctionInfo(node, parent.name.text, sourceFile, filePath));
      }
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return functions;
}

function buildFunctionInfo(
  node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  name: string,
  sourceFile: ts.SourceFile,
  _filePath: string,
) {
  const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;

  const params: ParamInfo[] = node.parameters.map((p) => ({
    name: ts.isIdentifier(p.name) ? p.name.text : p.name.getText(sourceFile),
    type: p.type ? p.type.getText(sourceFile) : 'any',
    optional: !!p.questionToken || !!p.initializer,
  }));

  const returnType = node.type ? node.type.getText(sourceFile) : 'void';

  /* v8 ignore next */
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  const isAsync = modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;

  return {
    name,
    startLine,
    endLine,
    params,
    returnType,
    isAsync,
    node: node as ts.Node,
  };
}

/**
 * Detect the kind of a top-level symbol from its declaration.
 */
export function detectSymbolKind(
  node: ts.Node,
): 'function' | 'class' | 'interface' | 'type' | 'variable' | 'enum' {
  if (ts.isFunctionDeclaration(node)) return 'function';
  if (ts.isClassDeclaration(node)) return 'class';
  if (ts.isInterfaceDeclaration(node)) return 'interface';
  if (ts.isTypeAliasDeclaration(node)) return 'type';
  if (ts.isEnumDeclaration(node)) return 'enum';
  if (ts.isVariableStatement(node) || ts.isVariableDeclaration(node)) return 'variable';
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return 'function';
  return 'variable';
}
