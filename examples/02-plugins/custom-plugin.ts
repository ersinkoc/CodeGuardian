/**
 * Example: Creating a custom plugin that bundles multiple rules.
 */
import { definePlugin, defineRule, type Finding } from '@oxog/codeguardian';
import ts from 'typescript';

const noTodoComments = defineRule({
  name: 'team/no-todo-comments',
  severity: 'info',
  description: 'Detects TODO comments that should be tracked in issue tracker',
  category: 'quality',
  check: (context) => {
    const findings: Finding[] = [];
    const text = context.ast.getFullText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (/\/\/\s*TODO/i.test(line)) {
        findings.push({
          message: 'TODO comment found — create an issue instead',
          file: context.file.path,
          line: i + 1,
          column: 1,
          fix: { suggestion: 'Create a ticket in your issue tracker and remove the TODO.' },
        });
      }
    }

    return findings;
  },
});

const teamPlugin = definePlugin({
  name: 'team-standards',
  version: '1.0.0',
  install: (kernel) => {
    kernel.registerRule(noTodoComments);
  },
});

export default teamPlugin;
