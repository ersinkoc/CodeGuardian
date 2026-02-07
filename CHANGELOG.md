# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-02-07

### Fixed
- **ESM import resolution**: `.js`/`.jsx` extensions in import paths (e.g., `from './types.js'`) are now correctly mapped to `.ts`/`.tsx` in the knowledge graph, fixing ~100 false-positive `quality/dead-code` warnings
- Same `.js` → `.ts` resolution fix applied to the architecture plugin's layer-violation import resolver
- `performance/n1-query` no longer flags `Map.get()` calls inside loops as database queries (removed `'get'` from `DB_CALL_PATTERNS`)
- `security/hardcoded-secret` no longer flags the security plugin's own `'password'` detection keyword (added inline suppression)

### Changed
- Self-analysis results improved from 189 warnings → 74 warnings (eliminated all false positives)
- Test fixture `user.controller.ts` now uses `.js` import extension to match ESM conventions

## [1.0.1] - 2026-02-07

### Fixed
- Removed unreachable dead code branches in AST visitor type guards across security, performance, quality, and api plugins
- Removed unnecessary `?? []` / `?? {}` fallbacks on config values guaranteed by defaults in `loader.ts`, `index.ts`, and `architecture.ts`
- Fixed `isGitRepo` detection in integration tests when run inside a parent git repository (use `os.tmpdir()` for temp dirs)

### Changed
- Branch coverage threshold raised from 93% to 100% in `vitest.config.ts`
- Added `/* v8 ignore next */` comments for V8 coverage quirks on `??` / `?.` operators where only one path is reachable at runtime

### Added
- 68 new branch coverage tests in `tests/unit/coverage/branch-coverage-100.test.ts`
- 100% branch coverage across all 39 source files (517 tests total)
- CONTRIBUTING.md — Development setup, testing patterns, writing rules/plugins, PR process
- SECURITY.md — Vulnerability reporting, supported versions, disclosure policy
- `docs/API_DOCS.md` — Complete API reference for all public functions, types, plugins, and CLI
- `docs/TROUBLESHOOTING.md` — Common issues with installation, git hooks, config, false positives, CI/CD
- `docs/` directory for project documentation (moved SPECIFICATION, IMPLEMENTATION, TASKS, API_DOCS, TROUBLESHOOTING)
- Documentation links table in README.md

## [1.0.0] - 2026-02-01

### Added
- Initial release of @oxog/codeguardian
- Codebase knowledge graph builder with incremental updates
- Micro-kernel architecture with plugin system
- 4 core plugins: architecture, security, performance, quality
- 4 optional plugins: naming, api-consistency, test-guard, dep-audit
- 29 built-in analysis rules
- Git pre-commit hook integration
- CLI tool with init, run, stats, rules, conventions, scan, uninstall commands
- Terminal reporter with colored output
- JSON output format for CI/CD
- SARIF output format for GitHub Code Scanning
- Inline suppression comments (`// codeguardian-disable-next-line`, `// codeguardian-disable`, `// codeguardian-enable`)
- Auto-discovery of project conventions (file naming, export patterns, import directions)
- Severity-based commit control (`blockOn`, `warnOn` configuration)
- Zero runtime dependencies (TypeScript as peer dependency)
- LLM-native design with llms.txt and predictable API naming
- 15+ examples organized by category (basic, advanced, CI/CD, custom-plugins)
- 100% line, statement, and function test coverage
- Comprehensive type definitions with JSDoc examples

[1.0.2]: https://github.com/ersinkoc/codeguardian/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/ersinkoc/codeguardian/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/ersinkoc/codeguardian/releases/tag/v1.0.0
