# @oxog/codeguardian — Task List

## Phase 1: Project Setup

- [x] Task 1: Create SPECIFICATION.md
- [x] Task 2: Create IMPLEMENTATION.md
- [x] Task 3: Create TASKS.md
- [x] Task 4: Initialize npm project (package.json, tsconfig.json, tsup.config.ts, vitest.config.ts, .gitignore)

## Phase 2: Core Types & Utilities

- [x] Task 5: Create `src/types.ts` — All type definitions
- [x] Task 6: Create `src/errors.ts` — Custom error classes
- [x] Task 7: Create `src/utils/color.ts` — Terminal ANSI colors
- [x] Task 8: Create `src/utils/glob.ts` — Glob pattern matching
- [x] Task 9: Create `src/utils/args.ts` — CLI argument parser
- [x] Task 10: Create `src/utils/fs.ts` — File system helpers
- [x] Task 11: Create `src/utils/crypto.ts` — Hash utility

## Phase 3: AST Layer

- [x] Task 12: Create `src/ast/parser.ts` — TypeScript AST parsing
- [x] Task 13: Create `src/ast/walker.ts` — AST visitor/walker
- [x] Task 14: Create `src/ast/helpers.ts` — AST query helpers

## Phase 4: Git Layer

- [x] Task 15: Create `src/git/diff.ts` — Git diff parser
- [x] Task 16: Create `src/git/staged.ts` — Staged files list
- [x] Task 17: Create `src/git/hooks.ts` — Pre-commit hook install/uninstall

## Phase 5: Configuration

- [x] Task 18: Create `src/config/defaults.ts` — Default config values
- [x] Task 19: Create `src/config/validator.ts` — Config validation
- [x] Task 20: Create `src/config/loader.ts` — Config file loader

## Phase 6: Knowledge Graph

- [x] Task 21: Create `src/graph/builder.ts` — Graph construction
- [x] Task 22: Create `src/graph/cache.ts` — Graph serialization
- [x] Task 23: Create `src/graph/incremental.ts` — Incremental updates
- [x] Task 24: Create `src/graph/query.ts` — Graph query helpers

## Phase 7: Rule Engine

- [x] Task 25: Create `src/rules/suppression.ts` — Inline suppression parser
- [x] Task 26: Create `src/rules/context.ts` — RuleContext factory
- [x] Task 27: Create `src/rules/engine.ts` — Rule execution engine

## Phase 8: Reporter

- [x] Task 28: Create `src/reporter/terminal.ts` — Terminal reporter
- [x] Task 29: Create `src/reporter/json.ts` — JSON reporter
- [x] Task 30: Create `src/reporter/sarif.ts` — SARIF reporter

## Phase 9: Discovery

- [x] Task 31: Create `src/discovery/conventions.ts` — Auto-discovery

## Phase 10: Kernel & Main API

- [x] Task 32: Create `src/kernel.ts` — Micro kernel
- [x] Task 33: Create `src/index.ts` — Main entry point (createGuardian, defineRule, definePlugin)

## Phase 11: Core Plugins

- [x] Task 34: Create `src/plugins/core/architecture.ts` — Architecture plugin (6 rules)
- [x] Task 35: Create `src/plugins/core/security.ts` — Security plugin (8 rules)
- [x] Task 36: Create `src/plugins/core/performance.ts` — Performance plugin (7 rules)
- [x] Task 37: Create `src/plugins/core/quality.ts` — Quality plugin (8 rules)
- [x] Task 38: Create `src/plugins/index.ts` — Plugin exports

## Phase 12: Optional Plugins

- [x] Task 39: Create `src/plugins/optional/naming.ts`
- [x] Task 40: Create `src/plugins/optional/api.ts`
- [x] Task 41: Create `src/plugins/optional/test-guard.ts`
- [x] Task 42: Create `src/plugins/optional/dep-audit.ts`

## Phase 13: CLI

- [x] Task 43: Create `src/cli.ts` — CLI entry point

## Phase 14: Tests

- [x] Task 44: Create test fixtures
- [x] Task 45: Unit tests for utils
- [x] Task 46: Unit tests for AST layer
- [x] Task 47: Unit tests for git layer
- [x] Task 48: Unit tests for config
- [x] Task 49: Unit tests for graph
- [x] Task 50: Unit tests for rules engine
- [x] Task 51: Unit tests for reporter
- [x] Task 52: Unit tests for core plugins
- [x] Task 53: Unit tests for optional plugins
- [x] Task 54: Integration tests
- [x] Task 55: Achieve 100% coverage

## Phase 15: Examples

- [x] Task 56: Create 15+ examples in organized folders

## Phase 16: Documentation & LLM

- [x] Task 57: Create llms.txt
- [x] Task 58: Create README.md
- [x] Task 59: Create CHANGELOG.md
- [x] Task 60: Create LICENSE

## Phase 17: Website

- [x] Task 61: Create documentation website (React + Vite)

## Phase 18: Final Verification

- [x] Task 62: Build verification (npm run build)
- [x] Task 63: Full test pass (npm run test:coverage)
- [x] Task 64: CLI end-to-end test

## Phase 19: 100% Branch Coverage & Production Documentation

- [x] Task 65: Remove 17 unreachable dead code branches (AST visitor type guards, unnecessary ?? fallbacks)
- [x] Task 66: Add v8 ignore comments for V8 coverage quirks on unreachable ?? / ?. operator branches
- [x] Task 67: Write 68 new branch coverage tests (branch-coverage-100.test.ts)
- [x] Task 68: Achieve 100% branch coverage (517 tests, all metrics at 100%)
- [x] Task 69: Update vitest.config.ts branch threshold from 93% to 100%
- [x] Task 70: Create CONTRIBUTING.md
- [x] Task 71: Create SECURITY.md
- [x] Task 72: Create API_DOCS.md
- [x] Task 73: Create TROUBLESHOOTING.md
- [x] Task 74: Expand CHANGELOG.md with Keep a Changelog format
- [x] Task 75: Update TASKS.md with all completed phases
