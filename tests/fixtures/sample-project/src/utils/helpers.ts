import * as path from 'node:path';

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

export function getBasename(filePath: string): string {
  return path.basename(filePath);
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
