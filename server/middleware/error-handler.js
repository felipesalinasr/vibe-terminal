import { HttpError } from '../errors.js';
import multer from 'multer';

/**
 * Centralized Express error handler.
 * Adapted from paperclip-master/server/src/middleware/error-handler.ts
 *
 * Handles:
 * - HttpError (custom) — returns status + message + optional details
 * - MulterError — file upload errors (size, count, field)
 * - Unknown errors — logs stack, returns 500
 */
export function errorHandler(err, req, res, _next) {
  // Multer file upload errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File too large' });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }

  // Custom HttpError
  if (err instanceof HttpError) {
    if (err.status >= 500) {
      console.error(`[${req.method} ${req.originalUrl}]`, err.message, err.stack);
    }
    res.status(err.status).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Errors with .status (e.g., from security.js assertPathWithin)
  if (err && typeof err.status === 'number' && err.status >= 400 && err.status < 600) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // Unknown error — log everything, expose nothing
  const rootError = err instanceof Error ? err : new Error(String(err));
  console.error(`[${req.method} ${req.originalUrl}] Unhandled:`, rootError.message, rootError.stack);
  res.status(500).json({ error: 'Internal server error' });
}
