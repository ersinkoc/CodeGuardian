# @oxog/codeguardian

**Zero-dependency TypeScript codebase guardian** that enforces architecture, security, performance, and quality rules as a pre-commit hook.

Unlike traditional linters that check syntax, codeguardian builds a **knowledge graph** of your codebase and evaluates every change against that graph. It understands your project's architectural patterns, detects security anti-patterns, catches performance pitfalls, and blocks or warns based on severity.

## Features

- **Codebase Knowledge Graph** — Maps all files, symbols, imports, and dependencies
- **ESM & CommonJS Support** — Correctly resolves `.js`/`.ts` import extensions
- **Incremental Analysis** — Only re-parses changed files (< 2s pre-commit)
- **29 Built-in Rules** — Architecture, security, performance, and quality checks
- **Plugin System** — Extend with custom rules and plugins
- **Zero Dependencies** — Only TypeScript as a peer dependency
- **Pre-commit Hook** — Blocks commits with critical/error findings
- **Multiple Output Formats** — Terminal, JSON, SARIF (GitHub Code Scanning)

## Quick Start

```bash
npm install @oxog/codeguardian --save-dev
npx codeguardian init
```

That's it. codeguardian will now run on every commit.

## Programmatic Usage

```typescript
import { createGuardian } from '@oxog/codeguardian';

const guardian = createGuardian({
  rootDir: process.cwd(),
  tsconfig: './tsconfig.json',
});

// Full scan
const graph = await guardian.scan();
console.log(`${graph.files.size} files, ${graph.symbols.size} symbols`);

// Run analysis
const result = await guardian.run({ staged: true });
if (result.blocked) {
  console.error('Commit blocked!');
  process.exit(1);
}
```

## CLI

```bash
codeguardian init                      # Setup project
codeguardian run                       # Analyze all files
codeguardian run --staged              # Analyze staged files (pre-commit)
codeguardian run --format json         # JSON output
codeguardian run --format sarif        # SARIF for GitHub
codeguardian run --plugin security     # Run specific plugin
codeguardian run --verbose             # Include info findings
codeguardian stats                     # Show graph statistics
codeguardian rules                     # List all rules
codeguardian conventions               # Show detected conventions
codeguardian scan --full               # Force full re-scan
codeguardian uninstall                 # Remove hook
```

## Configuration

Create `.codeguardian.json` in your project root:

```json
{
  "include": ["src/**/*.ts"],
  "exclude": ["**/*.test.ts"],
  "severity": {
    "blockOn": ["critical", "error"],
    "warnOn": ["warning"]
  },
  "plugins": {
    "architecture": {
      "enabled": true,
      "layers": ["controller", "service", "repository", "util"],
      "enforceDirection": true,
      "maxFileLines": 300,
      "maxFunctionLines": 50
    },
    "security": {
      "enabled": true,
      "checkInjection": true,
      "checkSecrets": true,
      "checkXSS": true
    },
    "performance": {
      "enabled": true,
      "checkN1Queries": true,
      "checkMemoryLeaks": true
    },
    "quality": {
      "enabled": true,
      "maxCyclomaticComplexity": 15
    }
  }
}
```

## Core Plugins & Rules

### Architecture (6 rules)
| Rule | Severity | Description |
|------|----------|-------------|
| `architecture/layer-violation` | error | Lower layer importing from higher layer |
| `architecture/circular-dependency` | error | Circular import chains (A -> B -> C -> A) |
| `architecture/file-role-mismatch` | warning | File content doesn't match directory role |
| `architecture/god-file` | warning | File exceeds max line count |
| `architecture/god-function` | warning | Function exceeds max line count |
| `architecture/barrel-explosion` | info | Barrel files re-exporting too many symbols |

### Security (8 rules)
| Rule | Severity | Description |
|------|----------|-------------|
| `security/sql-injection` | critical | String concatenation in SQL queries |
| `security/hardcoded-secret` | critical | API keys, tokens, passwords in code |
| `security/eval-usage` | critical | eval(), Function(), setTimeout(string) |
| `security/prototype-pollution` | error | Direct prototype assignment |
| `security/xss-risk` | error | innerHTML, document.write |
| `security/missing-auth-check` | warning | Controllers without auth references |
| `security/insecure-random` | warning | Math.random() in security contexts |
| `security/path-traversal` | error | Dynamic paths in file operations |

### Performance (7 rules)
| Rule | Severity | Description |
|------|----------|-------------|
| `performance/n1-query` | warning | Database calls (find, query, execute) inside loops |
| `performance/sync-in-async` | warning | readFileSync in async functions |
| `performance/memory-leak-risk` | warning | addEventListener without cleanup |
| `performance/unbounded-query` | warning | Queries without LIMIT |
| `performance/missing-index-hint` | info | Queries needing indexes |
| `performance/heavy-import` | info | Full library imports |
| `performance/blocking-operation` | warning | CPU-heavy ops in handlers |

### Quality (8 rules)
| Rule | Severity | Description |
|------|----------|-------------|
| `quality/cyclomatic-complexity` | warning | Functions exceeding complexity limit |
| `quality/dead-code` | warning | Exported symbols never imported (supports ESM `.js` imports) |
| `quality/any-type` | warning | Usage of `any` type |
| `quality/no-error-handling` | warning | Async functions without try-catch |
| `quality/inconsistent-naming` | info | Non-camelCase function names |
| `quality/magic-number` | info | Numeric literals without constants |
| `quality/empty-catch` | warning | Empty catch blocks |
| `quality/nested-callbacks` | warning | Deeply nested callbacks (> 3 levels) |

## Custom Rules

```typescript
import { defineRule, type Finding } from '@oxog/codeguardian';

const noConsole = defineRule({
  name: 'custom/no-console',
  severity: 'warning',
  description: 'No console.log in production',
  category: 'quality',
  check: (context) => {
    const findings: Finding[] = [];
    context.walk(context.ast, {
      CallExpression(node) {
        if (context.isConsoleCall(node as any, 'log')) {
          findings.push({
            message: 'Remove console.log',
            file: context.file.path,
            line: 1,
            column: 1,
          });
        }
      },
    });
    return findings;
  },
});
```

## Custom Plugins

```typescript
import { definePlugin, defineRule } from '@oxog/codeguardian';

const myPlugin = definePlugin({
  name: 'my-team-rules',
  version: '1.0.0',
  install: (kernel) => {
    kernel.registerRule(noConsole);
    kernel.registerRule(anotherRule);
  },
});

guardian.use(myPlugin);
```

## Inline Suppression

```typescript
// codeguardian-disable-next-line security/sql-injection
const query = `SELECT * FROM users WHERE id = ${id}`;

// codeguardian-disable security/hardcoded-secret -- legacy code
const key = 'secret_live_abc123xyz';
// codeguardian-enable security/hardcoded-secret
```

## Severity Levels

| Level | Blocks Commit | When Shown |
|-------|--------------|------------|
| `critical` | Yes | Always |
| `error` | Yes | Always |
| `warning` | No | Always |
| `info` | No | Only with `--verbose` |

## Requirements

- Node.js >= 18
- TypeScript >= 5.0 (peer dependency)

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](docs/API_DOCS.md) | Complete API reference for all public functions, types, and plugins |
| [Contributing](CONTRIBUTING.md) | Development setup, testing, writing rules/plugins, PR process |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Common issues and solutions |
| [Security Policy](SECURITY.md) | Vulnerability reporting and disclosure policy |
| [Changelog](CHANGELOG.md) | Version history and release notes |
| [Specification](docs/SPECIFICATION.md) | Package specification and design decisions |
| [Implementation](docs/IMPLEMENTATION.md) | Architecture decisions and implementation guide |

## Links

- [Documentation](https://codeguardian.oxog.dev)
- [GitHub](https://github.com/ersinkoc/codeguardian)
- [npm](https://www.npmjs.com/package/@oxog/codeguardian)

## License

MIT - Ersin Koc
