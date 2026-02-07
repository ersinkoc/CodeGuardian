# Troubleshooting Guide

This guide helps you resolve common issues with @oxog/codeguardian.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Git Hook Not Running](#git-hook-not-running)
3. [Configuration Problems](#configuration-problems)
4. [False Positives](#false-positives)
5. [Performance Issues](#performance-issues)
6. [TypeScript Errors](#typescript-errors)
7. [CI/CD Integration](#cicd-integration)
8. [Rule-Specific Issues](#rule-specific-issues)

---

## Installation Issues

### Node Version Mismatch

**Problem:** `Error: The engine "node" is incompatible with this module`

**Solution:**
```bash
# Check your Node version
node --version

# codeguardian requires Node.js >= 18
# Install Node 18 or later from nodejs.org
```

If using nvm:
```bash
nvm install 18
nvm use 18
```

### TypeScript Peer Dependency

**Problem:** `npm ERR! peer typescript@">=5.0.0" from @oxog/codeguardian`

**Solution:**
```bash
# Install TypeScript 5.0 or later
npm install --save-dev typescript@latest

# Verify installation
npx tsc --version
```

Note: codeguardian uses TypeScript as a peer dependency to avoid version conflicts. You must have TypeScript installed in your project.

### Permission Errors (Unix/Linux/macOS)

**Problem:** `EACCES: permission denied` when installing

**Solution:**
```bash
# DO NOT use sudo with npm
# Instead, fix npm permissions:
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.profile
source ~/.profile

# Then reinstall
npm install @oxog/codeguardian --save-dev
```

### Windows Execution Policy

**Problem:** `codeguardian: File cannot be loaded because running scripts is disabled`

**Solution:**
```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then try again
npx codeguardian --version
```

---

## Git Hook Not Running

### Hook Not Installed

**Problem:** Commits succeed without running codeguardian

**Solution:**
```bash
# Initialize codeguardian
npx codeguardian init

# Verify hook is installed
cat .git/hooks/pre-commit

# Expected output:
# #!/bin/sh
# # codeguardian pre-commit hook
# npx codeguardian run --staged
```

### Not a Git Repository

**Problem:** `Error: Not a git repository`

**Solution:**
```bash
# Initialize git first
git init

# Then install codeguardian
npx codeguardian init
```

### Hook Path Issues

**Problem:** Hook exists but doesn't run

**Solution:**
```bash
# Check hook permissions (Unix/Linux/macOS)
ls -la .git/hooks/pre-commit
# Should show executable bit (-rwxr-xr-x)

# If not executable:
chmod +x .git/hooks/pre-commit
```

On Windows (Git Bash):
```bash
# Ensure the hook file has Unix line endings (LF, not CRLF)
git config core.autocrlf input
```

### Husky Conflict

**Problem:** Using husky, codeguardian hook not running

**Solution:**

If you're already using husky for git hooks, don't run `codeguardian init`. Instead, add codeguardian to your existing pre-commit hook:

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx codeguardian run --staged
```

Or in package.json if using simple-git-hooks:
```json
{
  "simple-git-hooks": {
    "pre-commit": "npx codeguardian run --staged && lint-staged"
  }
}
```

### Hook Runs But Exits Immediately

**Problem:** Hook executes but codeguardian doesn't analyze files

**Solution:**
```bash
# Test manually
npx codeguardian run --staged

# If you see "Error: No staged files", try:
git add .
npx codeguardian run --staged

# If still failing, check config:
npx codeguardian run --verbose
```

---

## Configuration Problems

### Configuration File Not Found

**Problem:** `Config file not found: .codeguardian.json`

**Solution:**

codeguardian searches for configuration in this order:
1. `.codeguardian.json` in project root
2. `codeguardian` field in `package.json`
3. Default configuration

To create a config file:
```bash
# Run init to generate .codeguardian.json
npx codeguardian init

# Or manually create it:
cat > .codeguardian.json << 'EOF'
{
  "include": ["src/**/*.ts"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts"],
  "plugins": {
    "architecture": { "enabled": true },
    "security": { "enabled": true },
    "performance": { "enabled": true },
    "quality": { "enabled": true }
  }
}
EOF
```

Or add to package.json:
```json
{
  "name": "my-project",
  "codeguardian": {
    "include": ["src/**/*.ts"],
    "exclude": ["**/*.test.ts"]
  }
}
```

### Invalid JSON Syntax

**Problem:** `SyntaxError: Unexpected token in JSON`

**Solution:**
```bash
# Validate your JSON
cat .codeguardian.json | jq .

# Common issues:
# - Trailing commas (not allowed in JSON)
# - Missing quotes around strings
# - Single quotes instead of double quotes
# - Comments (JSON doesn't support comments)
```

Example of valid configuration:
```json
{
  "include": ["src/**/*.ts"],
  "exclude": ["**/*.test.ts"],
  "plugins": {
    "architecture": {
      "enabled": true,
      "layers": ["controller", "service", "repository"]
    }
  }
}
```

### Wrong Include/Exclude Patterns

**Problem:** codeguardian not analyzing expected files

**Solution:**

Use glob patterns (not regex):
```json
{
  "include": [
    "src/**/*.ts",           // All .ts files in src/
    "lib/**/*.{ts,tsx}"      // .ts and .tsx in lib/
  ],
  "exclude": [
    "**/*.test.ts",          // All test files
    "**/*.spec.ts",
    "**/node_modules/**",    // Dependencies
    "**/dist/**",            // Build output
    "**/__tests__/**"        // Test directories
  ]
}
```

Test your patterns:
```bash
# Show what files will be analyzed
npx codeguardian stats
```

### tsconfig.json Path Issues

**Problem:** `Error: Cannot find tsconfig.json`

**Solution:**
```json
{
  "tsconfig": "./tsconfig.json"  // Relative to project root
}
```

For monorepos:
```json
{
  "tsconfig": "./packages/api/tsconfig.json"
}
```

---

## False Positives

### Inline Suppression

To suppress a specific rule on the next line:
```typescript
// codeguardian-disable-next-line security/sql-injection
const query = `SELECT * FROM users WHERE id = ${id}`;
```

To suppress a rule for a block:
```typescript
// codeguardian-disable security/hardcoded-secret
const LEGACY_KEY = 'secret_test_123';  // Legacy code, tracked separately
const OLD_TOKEN = 'token_abc';
// codeguardian-enable security/hardcoded-secret
```

To suppress all rules on the next line:
```typescript
// codeguardian-disable-next-line
const problematic = eval(userInput);
```

With a comment explaining why:
```typescript
// codeguardian-disable-next-line security/eval-usage -- Required for plugin system
const fn = new Function(code);
```

### Configuration-Level Suppression

To disable specific rules globally:
```json
{
  "ignore": {
    "rules": [
      "quality/magic-number",
      "quality/any-type"
    ]
  }
}
```

To disable rules for specific files:
```json
{
  "ignore": {
    "files": {
      "**/*.config.ts": ["quality/any-type"],
      "src/legacy/**": ["security/sql-injection", "quality/dead-code"]
    }
  }
}
```

To disable rules for specific lines:
```json
{
  "ignore": {
    "lines": {
      "src/config.ts:42": ["security/hardcoded-secret"],
      "src/db.ts:15-20": ["performance/sync-in-async"]
    }
  }
}
```

### Adjust Severity Levels

```json
{
  "severity": {
    "blockOn": ["critical", "error"],  // Only block on critical/error
    "warnOn": ["warning"]              // Show warnings but don't block
  }
}
```

To allow commits with warnings:
```json
{
  "severity": {
    "blockOn": ["critical"],  // Only block on critical issues
    "warnOn": ["error", "warning"]
  }
}
```

### Disable Entire Plugins

```json
{
  "plugins": {
    "architecture": { "enabled": true },
    "security": { "enabled": true },
    "performance": { "enabled": false },  // Disable performance checks
    "quality": { "enabled": true }
  }
}
```

---

## Performance Issues

### Large Codebase Slow Initial Scan

**Problem:** First run takes minutes on large codebases

**Solution:**

1. Use incremental mode (default for git repos):
```bash
# Only analyzes changed files
npx codeguardian run --staged
```

2. Exclude unnecessary files:
```json
{
  "exclude": [
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/__tests__/**",
    "**/node_modules/**",
    "**/*.d.ts"  // Type definitions usually don't need analysis
  ]
}
```

3. Disable expensive checks:
```json
{
  "plugins": {
    "quality": {
      "enabled": true,
      "maxCyclomaticComplexity": 20  // Increase threshold
    },
    "performance": {
      "enabled": true,
      "checkMemoryLeaks": false  // Disable deep AST traversal
    }
  }
}
```

### Pre-commit Hook Too Slow

**Problem:** Commits are blocked for too long

**Expected:** Pre-commit should take < 2 seconds for typical changes

**Solution:**

1. Ensure incremental mode is working:
```bash
# Should only scan staged files
npx codeguardian run --staged --verbose
```

2. Check graph cache:
```bash
# Force rebuild if cache is corrupt
npx codeguardian scan --full
```

3. Profile performance:
```bash
# Add timing information
time npx codeguardian run --staged
```

If consistently slow (> 5s), consider:
- Reducing rule count
- Excluding test files from pre-commit
- Using CI for full scans instead

### Memory Issues

**Problem:** `JavaScript heap out of memory`

**Solution:**
```bash
# Increase Node.js heap size
NODE_OPTIONS="--max-old-space-size=4096" npx codeguardian run

# Or in package.json scripts:
{
  "scripts": {
    "guardian": "NODE_OPTIONS='--max-old-space-size=4096' codeguardian run"
  }
}
```

For very large monorepos, analyze packages separately:
```bash
# In each package directory
cd packages/api
npx codeguardian run

cd packages/web
npx codeguardian run
```

---

## TypeScript Errors

### Cannot Find tsconfig.json

**Problem:** `Error: Cannot find tsconfig.json at ./tsconfig.json`

**Solution:**
```json
{
  "tsconfig": "./tsconfig.json"  // Must exist at this path
}
```

Create tsconfig.json if missing:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### TypeScript Version Mismatch

**Problem:** `Error: Unsupported TypeScript version`

**Solution:**
```bash
# Upgrade TypeScript
npm install --save-dev typescript@latest

# Verify version
npx tsc --version  # Should be >= 5.0.0
```

### Strict Mode Errors

**Problem:** codeguardian reports errors that TypeScript doesn't

**Explanation:** codeguardian uses strict type checking internally. Your tsconfig.json may have looser settings.

**Solution:**

If you want to match codeguardian's behavior:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

Or adjust codeguardian's quality rules:
```json
{
  "plugins": {
    "quality": {
      "enabled": true,
      "anyType": false  // Allow 'any' type
    }
  }
}
```

### Module Resolution Errors

**Problem:** `Cannot find module 'x'` when it exists

**Solution:**

Ensure tsconfig.json paths match your project structure:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

For monorepos:
```json
{
  "compilerOptions": {
    "paths": {
      "@my-org/package-a": ["packages/package-a/src"],
      "@my-org/package-b": ["packages/package-b/src"]
    }
  }
}
```

---

## CI/CD Integration

### Exit Codes

codeguardian uses standard exit codes:
- `0` - Success (no blocking issues found)
- `1` - Failure (blocking issues found, or error occurred)

### GitHub Actions

```yaml
name: CodeGuardian

on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - run: npm ci

      - name: Run CodeGuardian
        run: npx codeguardian run --format sarif > codeguardian.sarif
        continue-on-error: true

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: codeguardian.sarif
```

### JSON Output for Parsing

```bash
npx codeguardian run --format json > results.json
```

Example output:
```json
{
  "findings": [
    {
      "rule": "security/sql-injection",
      "severity": "critical",
      "message": "Potential SQL injection",
      "file": "src/db.ts",
      "line": 42,
      "column": 15
    }
  ],
  "blocked": true,
  "summary": {
    "critical": 1,
    "error": 0,
    "warning": 3,
    "info": 0
  }
}
```

Parse in CI:
```bash
#!/bin/bash
npx codeguardian run --format json > results.json

CRITICAL=$(jq '.summary.critical' results.json)
ERROR=$(jq '.summary.error' results.json)

if [ "$CRITICAL" -gt 0 ] || [ "$ERROR" -gt 0 ]; then
  echo "::error::Found $CRITICAL critical and $ERROR error issues"
  exit 1
fi
```

### SARIF Output (GitHub Code Scanning)

```bash
# Generate SARIF report
npx codeguardian run --format sarif > codeguardian.sarif

# Upload to GitHub Code Scanning
# (Requires GitHub Advanced Security)
```

SARIF format is compatible with:
- GitHub Code Scanning
- Azure DevOps
- GitLab SAST
- SonarQube

### GitLab CI

```yaml
codeguardian:
  stage: test
  image: node:18
  script:
    - npm ci
    - npx codeguardian run --format json > codeguardian.json
  artifacts:
    reports:
      codequality: codeguardian.json
    when: always
```

### Jenkins

```groovy
pipeline {
  agent { docker { image 'node:18' } }
  stages {
    stage('CodeGuardian') {
      steps {
        sh 'npm ci'
        sh 'npx codeguardian run --format json > results.json'
      }
      post {
        always {
          archiveArtifacts artifacts: 'results.json'
        }
      }
    }
  }
}
```

---

## Rule-Specific Issues

### architecture/layer-violation

**Problem:** False positives for layer violations

**Solution:**

Define your architecture layers explicitly:
```json
{
  "plugins": {
    "architecture": {
      "enabled": true,
      "layers": ["controller", "service", "repository", "util"],
      "enforceDirection": true
    }
  }
}
```

Expected structure:
```
src/
  controllers/  (layer 0 - highest)
  services/     (layer 1)
  repositories/ (layer 2)
  utils/        (layer 3 - lowest)
```

Rules:
- Controllers can import services, repositories, utils
- Services can import repositories, utils (NOT controllers)
- Repositories can import utils (NOT services or controllers)
- Utils cannot import anything from project

To disable:
```json
{
  "ignore": {
    "rules": ["architecture/layer-violation"]
  }
}
```

### security/hardcoded-secret

**Problem:** False positives on example/test data

**Solution:**

1. For test files, exclude from analysis:
```json
{
  "exclude": ["**/*.test.ts", "**/__tests__/**"]
}
```

2. For specific lines:
```typescript
// codeguardian-disable-next-line security/hardcoded-secret
const EXAMPLE_KEY = 'secret_test_example';  // Example from documentation
```

3. Adjust secret detection patterns:
```json
{
  "plugins": {
    "security": {
      "enabled": true,
      "checkSecrets": true,
      "secretPatterns": {
        "apiKey": "secret_[a-zA-Z0-9]{32}"  // Custom pattern
      }
    }
  }
}
```

Common false positives:
- Test fixtures with `secret_test_` prefix (not real secrets)
- Example code in documentation
- Environment variable examples

### security/sql-injection

**Problem:** False positive with safe SQL builders

**Solution:**

If using a query builder (Prisma, TypeORM, Knex):
```typescript
// Safe - parameterized query
// codeguardian-disable-next-line security/sql-injection
const users = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
```

For raw SQL that's safe:
```typescript
// codeguardian-disable-next-line security/sql-injection -- Using db.escape()
const query = `SELECT * FROM users WHERE name = ${db.escape(userName)}`;
```

Better: Configure to ignore files using safe libraries:
```json
{
  "ignore": {
    "files": {
      "src/db/queries.ts": ["security/sql-injection"]
    }
  }
}
```

### performance/n1-query

**Problem:** False positive for intentional batch processing

**Solution:**

```typescript
// codeguardian-disable-next-line performance/n1-query -- Intentional batch processing
for (const user of users) {
  await updateUser(user.id, user.data);
}
```

Or if using proper batching:
```typescript
// Safe - using batch operation
await db.users.updateMany(users.map(u => ({ id: u.id, data: u.data })));
```

### quality/any-type

**Problem:** Too many warnings about `any` usage

**Solution:**

1. Gradually improve types:
```typescript
// Instead of:
function process(data: any) { }

// Use:
function process(data: unknown) {
  if (typeof data === 'object' && data !== null) {
    // Type narrowing
  }
}
```

2. For external libraries without types:
```typescript
// codeguardian-disable-next-line quality/any-type
import legacy from 'legacy-lib';  // No @types available
```

3. Disable for specific patterns:
```json
{
  "ignore": {
    "files": {
      "src/types/external.ts": ["quality/any-type"]
    }
  }
}
```

### quality/dead-code

**Problem:** Exported functions flagged as unused

**Explanation:** codeguardian only sees usage within the analyzed codebase. Functions exported for external consumption may appear unused.

**Solution:**

1. Mark public API files:
```json
{
  "ignore": {
    "files": {
      "src/index.ts": ["quality/dead-code"],
      "src/api/**": ["quality/dead-code"]
    }
  }
}
```

2. Document exports:
```typescript
/**
 * Public API - exported for external use
 * codeguardian-disable-next-line quality/dead-code
 */
export function publicAPI() { }
```

---

## Getting Help

If your issue isn't covered here:

1. **Check the documentation**: https://codeguardian.oxog.dev
2. **Search existing issues**: https://github.com/ersinkoc/codeguardian/issues
3. **Enable verbose mode**: `npx codeguardian run --verbose`
4. **Create an issue**: Include:
   - codeguardian version (`npx codeguardian --version`)
   - Node version (`node --version`)
   - TypeScript version (`npx tsc --version`)
   - Configuration file (`.codeguardian.json`)
   - Error message or unexpected behavior
   - Minimal reproduction example

## Quick Reference

Common commands:
```bash
npx codeguardian init              # Setup
npx codeguardian run               # Full analysis
npx codeguardian run --staged      # Pre-commit mode
npx codeguardian run --verbose     # Include info findings
npx codeguardian run --format json # JSON output
npx codeguardian stats             # Show statistics
npx codeguardian rules             # List all rules
npx codeguardian uninstall         # Remove hook
```

Configuration locations (in order):
1. `.codeguardian.json`
2. `codeguardian` field in `package.json`
3. Default configuration

Exit codes:
- `0` = Success
- `1` = Failure or error
