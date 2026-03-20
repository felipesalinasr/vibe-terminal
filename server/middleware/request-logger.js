import { logger } from '../logger.js';

/**
 * Express middleware that logs API requests with method, URL, status, and duration.
 * Only logs /api/ routes to avoid noise from static file serving.
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    if (req.originalUrl.startsWith('/api/')) {
      const duration = Date.now() - start;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      logger[level]('request', {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
      });
    }
  });
  next();
}
