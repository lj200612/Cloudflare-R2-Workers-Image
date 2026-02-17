import { DEFAULT_MAX_FILE_SIZE } from '../config';

export function parseMaxFileSize(value: string | undefined): number {
  if (!value) return DEFAULT_MAX_FILE_SIZE;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) || parsed <= 0 ? DEFAULT_MAX_FILE_SIZE : parsed;
}

export function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

export function parsePositiveInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) || parsed <= 0 ? defaultValue : parsed;
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
}
