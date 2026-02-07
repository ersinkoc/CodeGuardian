/**
 * Example: Creating a custom analysis rule.
 */
import { defineRule, type Finding } from '@oxog/codeguardian';
import ts from 'typescript';

const noConsoleLog = defineRule({
  name: 'custom/no-console-log',
  severity: 'warning',
  description: 'Disallow console.log in non-test files',
  category: 'quality',
  check: (context) => {
    if (context.file.role === 'test') return [];

    const findings: Finding[] = [];

    context.walk(context.ast, {
      CallExpression(node: ts.Node) {
        const call = node as ts.CallExpression;
        if (context.isConsoleCall(call, 'log')) {
          const pos = context.ast.getLineAndCharacterOfPosition(call.getStart(context.ast));
          findings.push({
            message: 'console.log should not be in production code. Use a logger instead.',
            file: context.file.path,
            line: pos.line + 1,
            column: pos.character + 1,
            fix: {
              suggestion: "Replace with your project's logger",
            },
          });
        }
      },
    });

    return findings;
  },
});

export default noConsoleLog;
