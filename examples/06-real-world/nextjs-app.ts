/**
 * Example: Using codeguardian with a Next.js project.
 */
import { createGuardian, defineRule, type Finding } from '@oxog/codeguardian';
import ts from 'typescript';

// Custom rule for Next.js: no direct API calls in components
const noDirectApiCalls = defineRule({
  name: 'nextjs/no-direct-api',
  severity: 'warning',
  description: 'Components should use hooks/services instead of direct fetch',
  category: 'architecture',
  check: (context) => {
    if (!context.file.path.includes('/components/')) return [];
    const findings: Finding[] = [];

    context.walk(context.ast, {
      CallExpression(node: ts.Node) {
        const call = node as ts.CallExpression;
        if (ts.isIdentifier(call.expression) && call.expression.text === 'fetch') {
          const pos = context.ast.getLineAndCharacterOfPosition(call.getStart(context.ast));
          findings.push({
            message: 'Direct fetch() in component — use a service or hook instead',
            file: context.file.path,
            line: pos.line + 1,
            column: pos.character + 1,
            fix: { suggestion: 'Create a service function or use a data-fetching hook.' },
          });
        }
      },
    });

    return findings;
  },
});

async function main() {
  const guardian = createGuardian({
    rootDir: process.cwd(),
    config: {
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      plugins: {
        architecture: { enabled: true },
        security: { enabled: true, checkXSS: true },
      },
    },
  });

  // Add custom Next.js rules via plugin
  guardian.use({
    name: 'nextjs-rules',
    version: '1.0.0',
    install: (kernel) => {
      kernel.registerRule(noDirectApiCalls);
    },
  });

  const result = await guardian.run();
  console.log(guardian.format(result));
}

main();
