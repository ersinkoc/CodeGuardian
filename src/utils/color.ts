/**
 * Terminal ANSI color utilities (zero dependencies).
 *
 * @example
 * ```typescript
 * import { color } from './color';
 * console.log(color.red('Error!'));
 * console.log(color.bold(color.green('Success')));
 * ```
 */

const isColorSupported = (): boolean => {
  if (typeof process !== 'undefined') {
    if (process.env['NO_COLOR'] !== undefined) return false;
    if (process.env['FORCE_COLOR'] !== undefined) return true;
    /* v8 ignore next */
    if (process.stdout && 'isTTY' in process.stdout) return !!process.stdout.isTTY;
  }
  return false;
};

const enabled = isColorSupported();

const wrap = (open: string, close: string) => {
  if (!enabled) return (str: string) => str;
  return (str: string) => `\x1b[${open}m${str}\x1b[${close}m`;
};

/** Terminal color functions. */
export const color = {
  /** Check if colors are enabled */
  enabled,

  // Modifiers
  bold: wrap('1', '22'),
  dim: wrap('2', '22'),
  italic: wrap('3', '23'),
  underline: wrap('4', '24'),

  // Colors
  red: wrap('31', '39'),
  green: wrap('32', '39'),
  yellow: wrap('33', '39'),
  blue: wrap('34', '39'),
  magenta: wrap('35', '39'),
  cyan: wrap('36', '39'),
  white: wrap('37', '39'),
  gray: wrap('90', '39'),

  // Background
  bgRed: wrap('41', '49'),
  bgGreen: wrap('42', '49'),
  bgYellow: wrap('43', '49'),
  bgBlue: wrap('44', '49'),
};
