import type { ParsedArgs } from '../types.js';

/**
 * Parse CLI arguments (zero dependencies — no commander, no yargs).
 *
 * @param argv - Process argv (typically process.argv.slice(2))
 * @returns Parsed command, flags, and positional args
 *
 * @example
 * ```typescript
 * const args = parseArgs(['run', '--staged', '--format', 'json']);
 * // { command: 'run', flags: { staged: true, format: 'json' }, positional: [] }
 * ```
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: '',
    flags: {},
    positional: [],
  };

  let i = 0;

  // First non-flag argument is the command
  while (i < argv.length) {
    const arg = argv[i]!;
    if (!arg.startsWith('-')) {
      result.command = arg;
      i++;
      break;
    }
    i++;
  }

  // Parse remaining args
  while (i < argv.length) {
    const arg = argv[i]!;

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const eqIndex = key.indexOf('=');

      if (eqIndex !== -1) {
        // --key=value
        const name = key.slice(0, eqIndex);
        const value = key.slice(eqIndex + 1);
        if (name) {
          result.flags[name] = value;
        }
      } else {
        // --key or --key value
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
          result.flags[key] = next;
          i++;
        } else {
          result.flags[key] = true;
        }
      }
    } else if (arg.startsWith('-')) {
      // Short flag: -v, -f value
      const key = arg.slice(1);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        result.flags[key] = next;
        i++;
      } else {
        result.flags[key] = true;
      }
    } else {
      result.positional.push(arg);
    }

    i++;
  }

  return result;
}
