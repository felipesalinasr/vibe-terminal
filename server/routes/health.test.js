import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { healthRoutes } from './health.js';

function createApp() {
  const app = express();
  app.use('/api', healthRoutes());
  return app;
}

describe('GET /api/health', () => {
  it('returns status ok with uptime and session counts', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(typeof res.body.sessions).toBe('number');
    expect(typeof res.body.activeSessions).toBe('number');
  });

  it('returns JSON content type', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.headers['content-type']).toMatch(/json/);
  });
});
