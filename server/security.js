import { resolve, normalize } from 'path';

/**
 * Validates that a resolved path falls within an allowed base directory.
 * Prevents directory traversal attacks.
 * @param {string} filePath - Path to validate
 * @param {string} allowedBase - Base directory the path must stay within
 * @returns {string} The resolved, safe path
 * @throws {Error} with .status = 403 if path escapes base
 */
export function assertPathWithin(filePath, allowedBase) {
  const resolved = resolve(normalize(filePath));
  const base = resolve(normalize(allowedBase));
  if (!resolved.startsWith(base + '/') && resolved !== base) {
    const err = new Error(`Path escapes allowed directory`);
    err.status = 403;
    throw err;
  }
  return resolved;
}

/**
 * Sanitize a path parameter to prevent directory traversal.
 * Strips .., ., and empty segments. Returns a single clean segment.
 * @param {string} param - Raw path parameter
 * @returns {string} Sanitized parameter
 */
export function sanitizePathParam(param) {
  if (typeof param !== 'string') return '';
  return param.split('/').filter(s => s !== '..' && s !== '.' && s !== '').join('/');
}

/** MIME types allowed for knowledge base uploads */
export const ALLOWED_KB_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/pdf',
  'text/yaml',
  'application/x-yaml',
  'text/x-yaml',
]);

/** Max file sizes in bytes */
export const MAX_DROP_FILE_SIZE = 10 * 1024 * 1024;  // 10 MB
export const MAX_KB_FILE_SIZE = 5 * 1024 * 1024;     // 5 MB
