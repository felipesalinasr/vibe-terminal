/**
 * Lightweight structured JSON logger.
 * Each log entry includes timestamp, level, message, and optional context.
 *
 * Adapted from paperclip-master's Pino-based logging approach,
 * simplified for a single-process local tool.
 */

function log(level, message, context = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...context,
  };
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(JSON.stringify(entry));
}

export const logger = {
  info: (msg, ctx) => log('info', msg, ctx),
  warn: (msg, ctx) => log('warn', msg, ctx),
  error: (msg, ctx) => log('error', msg, ctx),
  debug: (msg, ctx) => log('debug', msg, ctx),
};
