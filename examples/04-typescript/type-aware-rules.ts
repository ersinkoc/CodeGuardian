/**
 * Example: Creating rules that use the TypeScript type checker.
 */
import { defineRule, type Finding } from '@oxog/codeguardian';
import ts from 'typescript';

const noImplicitAnyReturn = defineRule({
  name: 'custom/no-implicit-any-return',
  severity: 'warning',
  description: 'Functions must have explicit return types (no implicit any)',
  category: 'quality',
  check: (context) => {
    const findings: Finding[] = [];

    context.walk(context.ast, {
      FunctionDeclaration(node: ts.Node) {
        const fn = node as ts.FunctionDeclaration;
        if (!fn.type && fn.name) {
          const returnType = context.getTypeString(fn);
          if (returnType.includes('any')) {
            const pos = context.ast.getLineAndCharacterOfPosition(fn.getStart(context.ast));
            findings.push({
              message: `Function "${fn.name.text}" has implicit return type`,
              file: context.file.path,
              line: pos.line + 1,
              column: pos.character + 1,
              fix: { suggestion: `Add explicit return type annotation.` },
            });
          }
        }
      },
    });

    return findings;
  },
});

export default noImplicitAnyReturn;
