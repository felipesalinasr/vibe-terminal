import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mkdirSync, rmSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { templateRoutes } from './templates.js';
import { validate } from '../middleware/validate.js';
import { createTemplateSchema, updateTemplateSchema } from '../schemas.js';
import { errorHandler } from '../middleware/error-handler.js';

// Templates module reads TEMPLATES_DIR from ~/.vibe-terminal/templates/
// We need to test against the real module since it uses module-level state.
// These are integration tests that touch the filesystem.

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/templates', templateRoutes());
  app.use(errorHandler);
  return app;
}

describe('template routes', () => {
  let app;
  let createdIds = [];

  beforeEach(() => {
    app = createApp();
    createdIds = [];
  });

  afterEach(async () => {
    // Clean up created templates
    for (const id of createdIds) {
      await request(app).delete(`/api/templates/${id}`);
    }
  });

  it('GET /api/templates returns an array', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/templates creates a template and returns 201', async () => {
    const res = await request(app)
      .post('/api/templates')
      .send({ name: 'Test Template' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Template');
    expect(res.body.id).toBeTruthy();
    createdIds.push(res.body.id);
  });

  it('POST /api/templates rejects empty name with 400', async () => {
    const res = await request(app)
      .post('/api/templates')
      .send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('POST /api/templates rejects missing body with 400', async () => {
    const res = await request(app)
      .post('/api/templates')
      .send({});
    expect(res.status).toBe(400);
  });

  it('GET /api/templates/:id returns a created template', async () => {
    const create = await request(app)
      .post('/api/templates')
      .send({ name: 'Fetch Me' });
    createdIds.push(create.body.id);

    const res = await request(app).get(`/api/templates/${create.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Fetch Me');
  });

  it('GET /api/templates/:id returns 404 for nonexistent', async () => {
    const res = await request(app).get('/api/templates/tpl-nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('template not found');
  });

  it('PUT /api/templates/:id updates a template', async () => {
    const create = await request(app)
      .post('/api/templates')
      .send({ name: 'Original' });
    createdIds.push(create.body.id);

    const res = await request(app)
      .put(`/api/templates/${create.body.id}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
  });

  it('PUT /api/templates/:id returns 404 for nonexistent', async () => {
    const res = await request(app)
      .put('/api/templates/tpl-nonexistent')
      .send({ name: 'Nope' });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/templates/:id deletes a template', async () => {
    const create = await request(app)
      .post('/api/templates')
      .send({ name: 'Delete Me' });

    const del = await request(app).delete(`/api/templates/${create.body.id}`);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    const get = await request(app).get(`/api/templates/${create.body.id}`);
    expect(get.status).toBe(404);
  });

  it('DELETE /api/templates/:id returns 404 for nonexistent', async () => {
    const res = await request(app).delete('/api/templates/tpl-nonexistent');
    expect(res.status).toBe(404);
  });

  it('POST /api/templates with skills and connectors', async () => {
    const res = await request(app)
      .post('/api/templates')
      .send({
        name: 'Full Template',
        purpose: 'Test purpose',
        skills: ['skill-a', { name: 'skill-b' }],
        connectors: [{ connectorId: 'slack', allEnabled: true }],
      });
    expect(res.status).toBe(201);
    expect(res.body.skills).toHaveLength(2);
    expect(res.body.connectors).toHaveLength(1);
    createdIds.push(res.body.id);
  });
});
