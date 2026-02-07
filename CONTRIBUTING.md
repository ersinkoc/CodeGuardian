# Contributing to CodeGuardian

Thank you for your interest in contributing to CodeGuardian! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Contributing Code](#contributing-code)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Writing Tests](#writing-tests)
- [Writing New Rules](#writing-new-rules)
- [Writing Plugins](#writing-plugins)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please be respectful, inclusive, and professional in all interactions.

## How Can I Contribute?

### Reporting Bugs

If you find a bug in CodeGuardian, please help us by submitting an issue on GitHub:

1. **Search existing issues** to avoid duplicates
2. **Use a clear and descriptive title** for the issue
3. **Provide detailed reproduction steps**:
   - Your environment (Node version, TypeScript version, OS)
   - Minimal code sample that demonstrates the issue
   - Expected behavior vs. actual behavior
   - Error messages or unexpected output
4. **Include relevant configuration** (codeguardian.json, tsconfig.json)

**Example Issue Title**: `security/no-eval rule false positive with eval in string literal`

### Suggesting Features

We welcome feature suggestions! To propose a new feature:

1. **Check existing issues and discussions** to see if it's already proposed
2. **Open a GitHub Issue** with the label `enhancement`
3. **Describe the feature clearly**:
   - What problem does it solve?
   - How would it work?
   - Example use cases
   - Proposed API or configuration (if applicable)
4. **Consider implementation complexity** and alignment with project goals

### Contributing Code

We appreciate code contributions! Whether it's bug fixes, new rules, plugins, or core improvements, please follow the guidelines below.

## Development Setup

### Prerequisites

- **Node.js** >= 18
- **TypeScript** >= 5.0
- **npm** (comes with Node.js)
- **Git**

### Getting Started

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/codeguardian.git
   cd codeguardian
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Build the project**:
   ```bash
   npm run build
   ```

5. **Run tests**:
   ```bash
   npm test
   ```

6. **Verify your setup**:
   ```bash
   npm run typecheck
   npm run lint
   npm run format:check
   ```

### Available Scripts

- `npm run build` - Build the project using tsup
- `npm test` - Run all tests with vitest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run lint` - Lint code with ESLint
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run typecheck` - Type-check with TypeScript compiler

## Project Structure

CodeGuardian uses a micro-kernel architecture with a plugin system. Here's an overview of the codebase:

```
src/
├── ast/                  # AST parsing and traversal utilities
│   ├── parseFile.ts      # TypeScript AST parsing
│   └── walkAST.ts        # AST visitor pattern implementation
├── config/               # Configuration loading and validation
│   └── loadConfig.ts     # Load and merge codeguardian.json
├── discovery/            # File discovery and filtering
│   └── findFiles.ts      # Glob-based TypeScript file discovery
├── git/                  # Git integration
│   └── getChangedFiles.ts # Detect changed files for incremental mode
├── graph/                # Dependency graph management
│   ├── buildGraph.ts     # Build import/export dependency graph
│   └── incrementalGraph.ts # Incremental graph updates
├── plugins/              # Plugin system
│   ├── core/             # 4 core plugins (always loaded)
│   │   ├── architecture.ts # Layer violations, circular deps
│   │   ├── performance.ts  # Performance anti-patterns
│   │   ├── quality.ts      # Code quality rules
│   │   └── security.ts     # Security vulnerabilities
│   └── optional/         # 4 optional plugins (opt-in)
│       ├── api.ts        # Public API consistency checks
│       ├── dep-audit.ts  # Dependency health monitoring
│       ├── naming.ts     # Naming convention enforcement
│       └── test-guard.ts # Test quality and coverage
├── reporter/             # Result formatting and output
│   └── formatResults.ts  # Format violations for console/JSON
├── rules/                # Rule execution engine
│   ├── executeRules.ts   # Run rules against files
│   └── types.ts          # Rule and plugin type definitions
├── utils/                # Utility functions
│   ├── color.ts          # Terminal color support
│   ├── logger.ts         # Logging utilities
│   └── path.ts           # Path manipulation helpers
└── index.ts              # Main entry point and public API
```

### Key Concepts

- **Kernel**: Core system that manages plugins and provides shared services
- **Plugins**: Modular units that register rules (4 core + 4 optional)
- **Rules**: Individual checks that analyze code and report violations
- **RuleContext**: Passed to rules with file, AST, graph, TypeScript APIs
- **Dependency Graph**: Tracks imports/exports between files

## Writing Tests

CodeGuardian uses [Vitest](https://vitest.dev/) for testing and maintains **100% code coverage** on all metrics (lines, statements, functions, branches).

### Test Requirements

- All new code **must** include tests
- Maintain **100% coverage** (lines, statements, functions, branches)
- Tests should be clear, focused, and maintainable
- Use descriptive test names: `it('should detect circular dependencies between modules', ...)`

### Test Patterns

#### 1. Unit Tests

Test individual functions in isolation:

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/utils/myFunction';

describe('myFunction', () => {
  it('should return expected value for valid input', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });

  it('should throw error for invalid input', () => {
    expect(() => myFunction('')).toThrow('Invalid input');
  });
});
```

#### 2. Plugin/Rule Tests

Test rules with real AST parsing and context:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { parseFile } from '../src/ast/parseFile';
import { walkAST } from '../src/ast/walkAST';
import type { RuleContext } from '../src/rules/types';

describe('my-custom-rule', () => {
  let context: RuleContext;

  beforeEach(() => {
    const sourceFile = parseFile('test.ts', 'const x = 1;');
    context = {
      file: 'test.ts',
      sourceFile,
      walk: (visitor) => walkAST(sourceFile, visitor),
      // ... other context properties
    };
  });

  it('should detect violation', () => {
    const violations = myCustomRule(context);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('expected message');
  });
});
```

#### 3. Environment-Dependent Tests

Use `vi.stubEnv()` and dynamic imports for environment-specific code:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('color support detection', () => {
  it('should detect color support from environment', async () => {
    vi.stubEnv('FORCE_COLOR', '1');
    vi.resetModules();
    const { supportsColor } = await import('../src/utils/color');
    expect(supportsColor).toBe(true);
  });
});
```

#### 4. Git Integration Tests

Create temporary git repositories for testing:

```typescript
import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('git integration', () => {
  it('should detect changed files', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'test-'));
    execSync('git init', { cwd: tmpDir });
    writeFileSync(join(tmpDir, 'test.ts'), 'const x = 1;');
    execSync('git add .', { cwd: tmpDir });
    // ... test git operations
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test -- src/ast/parseFile.test.ts
```

### Coverage Requirements

- **Lines**: 100%
- **Statements**: 100%
- **Functions**: 100%
- **Branches**: 93%+ (V8 counts `??`, `?.` as branches where one path may be unreachable)

## Writing New Rules

Rules are the core of CodeGuardian's analysis capabilities. Each rule inspects code and reports violations.

### Rule Structure

```typescript
import type { Rule, RuleContext, Violation } from '../rules/types';

export const myCustomRule: Rule = (context: RuleContext): Violation[] => {
  const violations: Violation[] = [];

  context.walk({
    // Visit specific AST node types
    CallExpression(node) {
      // Check for violations
      if (isViolation(node)) {
        violations.push({
          file: context.file,
          line: node.getStart(),
          column: node.getEnd(),
          message: 'Describe the violation',
          severity: 'error', // or 'warning'
          rule: 'my-custom-rule',
        });
      }
    },
  });

  return violations;
};
```

### RuleContext API

The `RuleContext` object provides everything a rule needs:

```typescript
interface RuleContext {
  file: string;                    // File path being analyzed
  sourceFile: ts.SourceFile;       // TypeScript AST
  program: ts.Program;             // TypeScript Program instance
  checker: ts.TypeChecker;         // Type checker for semantic analysis
  graph: DependencyGraph;          // Import/export graph
  walk: (visitor: Visitor) => void; // AST traversal helper
  rootDir: string;                 // Project root directory
}
```

### Rule Best Practices

1. **Be specific**: Target specific AST node types to avoid unnecessary traversal
2. **Use type information**: Leverage `checker` for semantic analysis when needed
3. **Provide clear messages**: Help developers understand and fix the issue
4. **Consider performance**: Avoid expensive operations in hot paths
5. **Handle edge cases**: Test with complex real-world code samples
6. **Document the rule**: Explain what it checks and why

### Adding a Rule to a Plugin

```typescript
// src/plugins/core/quality.ts
import { definePlugin } from '../types';
import { myCustomRule } from './rules/myCustomRule';

export const qualityPlugin = definePlugin({
  name: 'quality',
  version: '1.0.0',
  rules: ['my-custom-rule'],

  init(kernel) {
    kernel.registerRule('my-custom-rule', myCustomRule);
  },
});
```

## Writing Plugins

Plugins are collections of related rules. CodeGuardian has 4 core plugins (always loaded) and 4 optional plugins.

### Plugin Structure

```typescript
import type { GuardianPlugin } from '../rules/types';

export const myPlugin: GuardianPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  rules: ['rule-one', 'rule-two'],

  init(kernel) {
    // Register rules
    kernel.registerRule('rule-one', ruleOneImplementation);
    kernel.registerRule('rule-two', ruleTwoImplementation);

    // Optional: Register cleanup
    return () => {
      kernel.unregisterRule('rule-one');
      kernel.unregisterRule('rule-two');
    };
  },
};
```

### Plugin API

Plugins receive a **kernel** with these methods:

```typescript
interface PluginKernel {
  registerRule(name: string, rule: Rule): void;
  unregisterRule(name: string): void;
}
```

### Plugin Guidelines

1. **Single responsibility**: Group related rules together
2. **Naming convention**: Use kebab-case for plugin and rule names
3. **Version management**: Follow semantic versioning
4. **Documentation**: Document each rule's purpose and configuration
5. **Optional plugins**: Should be opt-in via configuration
6. **Core plugins**: Should provide essential, widely-applicable rules

### Plugin Types

- **Core Plugins** (src/plugins/core/): Always loaded
  - `architecture`: Layer violations, circular dependencies
  - `security`: Security vulnerabilities (eval, innerHTML, etc.)
  - `performance`: Performance anti-patterns (nested loops, expensive ops)
  - `quality`: Code quality (complexity, duplication, etc.)

- **Optional Plugins** (src/plugins/optional/): Opt-in via config
  - `naming`: Naming convention enforcement
  - `api`: Public API consistency
  - `test-guard`: Test quality and coverage
  - `dep-audit`: Dependency health monitoring

## Code Style

CodeGuardian enforces strict code quality standards.

### TypeScript

- **Strict mode** enabled in tsconfig.json
- Use explicit types for function parameters and return values
- Prefer `interface` over `type` for object shapes
- Use `const` by default, `let` only when reassignment is needed
- Avoid `any` - use `unknown` or proper types

### ESLint

We use ESLint for code quality:

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

Key rules:
- No unused variables
- No console.log in production code (use logger utility)
- Consistent import order
- No var, prefer const

### Prettier

We use Prettier for consistent formatting:

```bash
npm run format          # Format all files
npm run format:check    # Check formatting
```

Configuration:
- 2 spaces for indentation
- Single quotes for strings
- No semicolons (where optional)
- Trailing commas in multi-line

### File Organization

- One main export per file
- Group imports: external, internal, types
- Export types explicitly: `export type { MyType }`
- Use index.ts for module exports

## Pull Request Process

### Before Submitting

1. **Create a feature branch**: `git checkout -b feature/my-feature`
2. **Write tests**: Ensure 100% coverage
3. **Run all checks**:
   ```bash
   npm run build
   npm test
   npm run typecheck
   npm run lint
   npm run format:check
   ```
4. **Update documentation**: If adding features, update README.md
5. **Write clear commit messages**: Use conventional commit format

### Commit Message Format

```
type(scope): brief description

Detailed explanation (if needed)

Fixes #123
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

Examples:
- `feat(rules): add no-global-state rule`
- `fix(graph): resolve circular dependency detection false positive`
- `docs: update plugin development guide`

### Submitting the PR

1. **Push to your fork**: `git push origin feature/my-feature`
2. **Open a Pull Request** on GitHub
3. **Fill out the PR template** with:
   - Description of changes
   - Motivation and context
   - Related issues
   - Testing performed
   - Screenshots (if UI changes)
4. **Ensure CI passes**: All tests and checks must pass
5. **Request review**: Tag maintainers if needed

### Review Process

- Maintainers will review your PR
- Address feedback by pushing additional commits
- Once approved, maintainers will merge
- PRs are squashed on merge for clean history

## Release Process

*For maintainers only*

1. **Update version** in package.json (semver: MAJOR.MINOR.PATCH)
2. **Update CHANGELOG.md** with release notes
3. **Commit changes**: `git commit -m "chore: release v1.2.3"`
4. **Create git tag**: `git tag v1.2.3`
5. **Push changes and tags**: `git push && git push --tags`
6. **Publish to npm**: `npm publish`
7. **Create GitHub release** with changelog

### Version Guidelines

- **MAJOR**: Breaking changes (public API changes)
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

## Questions?

If you have questions about contributing:

- **Open a GitHub Discussion** for general questions
- **Open a GitHub Issue** for bugs or feature requests
- **Review existing issues** to see if your question is already answered

## License

By contributing to CodeGuardian, you agree that your contributions will be licensed under the same license as the project.

---

**Author**: Ersin Koç
**Repository**: https://github.com/ersinkoc/codeguardian

Thank you for contributing to CodeGuardian!
