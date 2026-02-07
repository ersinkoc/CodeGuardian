#!/usr/bin/env node

/**
 * @oxog/codeguardian CLI entry point.
 *
 * Commands:
 * - init     — Initialize codeguardian in a project
 * - run      — Run analysis
 * - stats    — Show graph statistics
 * - rules    — List all rules
 * - conventions — List detected conventions
 * - scan     — Rebuild the full graph
 * - uninstall — Remove pre-commit hook
 */

import { parseArgs } from './utils/args.js';
import { color } from './utils/color.js';
import { createGuardian } from './index.js';
import { installHook, uninstallHook } from './git/hooks.js';
import { isGitRepo } from './git/staged.js';
import { writeFileSync } from './utils/fs.js';
import { getDefaultConfigJSON } from './config/defaults.js';
import * as path from 'node:path';

const VERSION = '1.0.0';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.flags['version'] || args.flags['v']) {
    console.log(`@oxog/codeguardian v${VERSION}`);
    return;
  }

  if (args.flags['help'] || args.flags['h'] || !args.command) {
    printHelp();
    return;
  }

  const rootDir = process.cwd();

  switch (args.command) {
    case 'init':
      await runInit(rootDir);
      break;
    case 'run':
      await runAnalysis(rootDir, args.flags);
      break;
    case 'stats':
      await runStats(rootDir);
      break;
    case 'rules':
      await runRules(rootDir);
      break;
    case 'conventions':
      await runConventions(rootDir);
      break;
    case 'scan':
      await runScan(rootDir, args.flags);
      break;
    case 'uninstall':
      runUninstall(rootDir);
      break;
    default:
      console.error(color.red(`Unknown command: ${args.command}`));
      printHelp();
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
${color.bold('@oxog/codeguardian')} v${VERSION}
Zero-dependency TypeScript codebase guardian

${color.bold('Usage:')}
  codeguardian <command> [options]

${color.bold('Commands:')}
  init          Initialize codeguardian in a project
  run           Run analysis on all or staged files
  stats         Show codebase graph statistics
  rules         List all registered rules
  conventions   List detected project conventions
  scan          Rebuild the full codebase graph
  uninstall     Remove pre-commit hook

${color.bold('Run Options:')}
  --staged      Analyze staged files only (pre-commit mode)
  --verbose     Include info-level findings
  --format      Output format: terminal (default), json, sarif
  --plugin      Run specific plugin(s) only

${color.bold('Global Options:')}
  --version, -v Show version
  --help, -h    Show help
`);
}

async function runInit(rootDir: string): Promise<void> {
  console.log(color.bold('\n  @oxog/codeguardian — Init\n'));

  // Check git repo
  if (!isGitRepo(rootDir)) {
    console.log(color.yellow('  ⚠ Not a git repository. Pre-commit hook will not be installed.'));
    console.log(color.dim('    Run `git init` first if you want hook integration.\n'));
  } else {
    // Install hook
    try {
      installHook(rootDir);
      console.log(color.green('  ✓ Pre-commit hook installed'));
    } catch (err) {
      console.log(color.yellow(`  ⚠ Could not install hook: ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  // Create config file
  const configPath = path.join(rootDir, '.codeguardian.json');
  try {
    writeFileSync(configPath, getDefaultConfigJSON());
    console.log(color.green('  ✓ Configuration file created (.codeguardian.json)'));
  } catch (err) {
    console.log(color.yellow(`  ⚠ Could not create config: ${err instanceof Error ? err.message : String(err)}`));
  }

  // Run first scan
  try {
    console.log(color.dim('  Scanning project...'));
    const guardian = createGuardian({ rootDir });
    const graph = await guardian.scan();
    console.log(color.green(`  ✓ Scanned ${graph.files.size} files, ${graph.symbols.size} symbols`));
    console.log(color.green('  ✓ Graph cached to .codeguardian/graph.json'));
  } catch (err) {
    console.log(color.yellow(`  ⚠ Scan failed: ${err instanceof Error ? err.message : String(err)}`));
    console.log(color.dim('    You can try running `codeguardian scan --full` later.'));
  }

  console.log(color.bold('\n  Done! codeguardian is ready.\n'));
}

async function runAnalysis(rootDir: string, flags: Record<string, string | boolean>): Promise<void> {
  const staged = flags['staged'] === true;
  const verbose = flags['verbose'] === true;
  const format = (typeof flags['format'] === 'string' ? flags['format'] : 'terminal') as 'terminal' | 'json' | 'sarif';
  const pluginFilter = typeof flags['plugin'] === 'string' ? [flags['plugin']] : undefined;

  try {
    const guardian = createGuardian({ rootDir });

    const result = await guardian.run({
      staged,
      verbose,
      plugins: pluginFilter,
      format,
    });

    const output = guardian.format(result, format, verbose);
    console.log(output);

    if (result.blocked) {
      process.exit(1);
    }
  } catch (err) {
    console.error(color.red(`\n  Error: ${err instanceof Error ? err.message : String(err)}\n`));
    process.exit(1);
  }
}

async function runStats(rootDir: string): Promise<void> {
  try {
    const guardian = createGuardian({ rootDir });
    await guardian.scan();
    const stats = guardian.query.getStats();

    if (!stats) {
      console.log(color.yellow('  No graph available. Run scan first.'));
      return;
    }

    console.log(`
${color.bold('  @oxog/codeguardian — Stats')}

  Files:      ${stats.totalFiles}
  Symbols:    ${stats.totalSymbols}
  Edges:      ${stats.totalEdges}
  Functions:  ${stats.totalFunctions}
  Total LOC:  ${stats.totalLOC}
  Avg Complexity: ${stats.avgComplexity.toFixed(1)}

  ${color.bold('By Role:')}
${Object.entries(stats.filesByRole).map(([role, count]) => `    ${role}: ${count}`).join('\n')}

  ${color.bold('By Layer:')}
${Object.entries(stats.filesByLayer).map(([layer, count]) => `    ${layer}: ${count}`).join('\n')}
`);
  } catch (err) {
    console.error(color.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}

async function runRules(rootDir: string): Promise<void> {
  try {
    const guardian = createGuardian({ rootDir });
    const rules = guardian.getRules();

    console.log(`\n${color.bold('  @oxog/codeguardian — Rules')} (${rules.length} total)\n`);

    const byCategory = new Map<string, typeof rules>();
    for (const rule of rules) {
      if (!byCategory.has(rule.category)) {
        byCategory.set(rule.category, []);
      }
      byCategory.get(rule.category)!.push(rule);
    }

    for (const [category, categoryRules] of byCategory) {
      console.log(`  ${color.bold(category.toUpperCase())}`);
      for (const rule of categoryRules) {
        const sevColor = rule.severity === 'critical' || rule.severity === 'error' ? color.red : rule.severity === 'warning' ? color.yellow : color.dim;
        console.log(`    ${sevColor(rule.severity.padEnd(8))} ${rule.name}`);
        console.log(`    ${color.dim(rule.description)}`);
      }
      console.log('');
    }
  } catch (err) {
    console.error(color.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}

async function runConventions(rootDir: string): Promise<void> {
  try {
    const guardian = createGuardian({ rootDir });
    const conventions = await guardian.discover();

    console.log(`\n${color.bold('  @oxog/codeguardian — Conventions')} (${conventions.length} detected)\n`);

    for (const conv of conventions) {
      console.log(`  ${color.bold(conv.type)} (${conv.confidence}% confidence)`);
      console.log(`    ${conv.description}`);
      if (conv.files.length > 0) {
        console.log(`    Files: ${conv.files.slice(0, 3).join(', ')}${conv.files.length > 3 ? ` +${conv.files.length - 3} more` : ''}`);
      }
      console.log('');
    }
  } catch (err) {
    console.error(color.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}

async function runScan(rootDir: string, flags: Record<string, string | boolean>): Promise<void> {
  const full = flags['full'] === true;
  console.log(color.dim(`\n  ${full ? 'Full' : 'Incremental'} scan...\n`));

  try {
    const guardian = createGuardian({ rootDir });
    const graph = await guardian.scan();
    console.log(color.green(`  ✓ Scanned ${graph.files.size} files, ${graph.symbols.size} symbols`));
    console.log(color.green('  ✓ Graph cached to .codeguardian/graph.json\n'));
  } catch (err) {
    console.error(color.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}

function runUninstall(rootDir: string): void {
  try {
    const removed = uninstallHook(rootDir);
    if (removed) {
      console.log(color.green('\n  ✓ Pre-commit hook removed\n'));
    } else {
      console.log(color.yellow('\n  ⚠ No codeguardian hook found\n'));
    }
  } catch (err) {
    console.error(color.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(color.red(`Fatal error: ${err instanceof Error ? err.message : String(err)}`));
  process.exit(1);
});
