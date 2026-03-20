/**
 * Wraps an async Express route handler to forward rejections
 * to the centralized error middleware.
 *
 * Express 4 does not catch async errors automatically — without this wrapper,
 * unhandled promise rejections crash the process.
 *
 * @param {Function} fn - Async route handler (req, res, next) => Promise
 * @returns {Function} Express middleware that catches and forwards errors
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
