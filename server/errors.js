/**
 * HTTP error with status code, message, and optional details.
 * Adapted from paperclip-master/server/src/errors.ts
 */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export function badRequest(message, details) {
  return new HttpError(400, message, details);
}

export function unauthorized(message = 'Unauthorized') {
  return new HttpError(401, message);
}

export function forbidden(message = 'Forbidden') {
  return new HttpError(403, message);
}

export function notFound(message = 'Not found') {
  return new HttpError(404, message);
}

export function unprocessable(message, details) {
  return new HttpError(422, message, details);
}
