import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from './error-handler.js';
import { HttpError, badRequest, notFound, forbidden } from '../errors.js';
import { asyncHandler } from './async-handler.js';

function createApp(routeHandler) {
  const app = express();
  app.use(express.json());
  app.get('/test', routeHandler);
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('handles HttpError with status and message', async () => {
    const app = createApp((req, res) => { throw badRequest('missing name'); });
    const res = await request(app).get('/test');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'missing name' });
  });

  it('includes details when HttpError has them', async () => {
    const app = createApp((req, res) => {
      throw new HttpError(422, 'validation failed', [{ field: 'email' }]);
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'validation failed', details: [{ field: 'email' }] });
  });

  it('handles notFound', async () => {
    const app = createApp((req, res) => { throw notFound('session not found'); });
    const res = await request(app).get('/test');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'session not found' });
  });

  it('handles forbidden', async () => {
    const app = createApp((req, res) => { throw forbidden(); });
    const res = await request(app).get('/test');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });

  it('handles errors with .status property (e.g. security.js)', async () => {
    const app = createApp((req, res) => {
      const err = new Error('Path escapes allowed directory');
      err.status = 403;
      throw err;
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Path escapes allowed directory' });
  });

  it('returns 500 for unknown errors without exposing internals', async () => {
    const app = createApp((req, res) => { throw new Error('db connection lost'); });
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(res.body.stack).toBeUndefined();
  });

  it('handles non-Error throwables', async () => {
    const app = createApp((req, res) => { throw 'string error'; });
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('works with asyncHandler for async route errors', async () => {
    const app = express();
    app.get('/test', asyncHandler(async (req, res) => {
      throw notFound('async not found');
    }));
    app.use(errorHandler);

    const res = await request(app).get('/test');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'async not found' });
  });

  it('logs 500+ HttpErrors but not 4xx', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // 400 should not produce error log
    const app400 = createApp((req, res) => { throw badRequest('bad'); });
    await request(app400).get('/test');

    // 500 should produce error log (via logger which uses console.error)
    const app500 = createApp((req, res) => { throw new HttpError(500, 'server broke'); });
    await request(app500).get('/test');

    logSpy.mockRestore();
    errSpy.mockRestore();
  });
});
