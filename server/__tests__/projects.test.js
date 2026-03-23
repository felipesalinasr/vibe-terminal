import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { projectRoutes } from '../routes/projects.js';
import { errorHandler } from '../middleware/error-handler.js';

// We override PROJECTS_DIR by importing the module functions directly won't work
// because the dir is hardcoded. Instead, build a small test app that exercises
// the route handlers end-to-end against the real filesystem.
// For isolation, we'll use the actual project routes (which write to ../projects/).
// We'll clean up any created projects at the end.

let app;
const createdIds = [];

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/projects', projectRoutes());
  app.use(errorHandler);
});

afterAll(async () => {
  // Clean up any projects we created during tests
  for (const id of createdIds) {
    await request(app).delete(`/api/projects/${id}`);
  }
});

describe('Projects API', () => {
  it('GET /api/projects returns empty or existing list', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/projects creates a project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Test Project' });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^proj-/);
    expect(res.body.name).toBe('Test Project');
    expect(res.body.context).toBe('');
    expect(res.body.createdAt).toBeTypeOf('number');
    expect(res.body.updatedAt).toBeTypeOf('number');
    createdIds.push(res.body.id);
  });

  it('POST /api/projects validates missing name → 400', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/projects validates empty name → 400', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('GET /api/projects/:id returns created project', async () => {
    const id = createdIds[0];
    const res = await request(app).get(`/api/projects/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.name).toBe('Test Project');
  });

  it('GET /api/projects/:id returns 404 for non-existent', async () => {
    const res = await request(app).get('/api/projects/proj-nonexistent');
    expect(res.status).toBe(404);
  });

  it('PUT /api/projects/:id updates name', async () => {
    const id = createdIds[0];
    const res = await request(app)
      .put(`/api/projects/${id}`)
      .send({ name: 'Renamed Project' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed Project');
    expect(res.body.updatedAt).toBeGreaterThanOrEqual(res.body.createdAt);
  });

  it('PUT /api/projects/:id updates context', async () => {
    const id = createdIds[0];
    const res = await request(app)
      .put(`/api/projects/${id}`)
      .send({ context: 'Use snake_case everywhere.' });
    expect(res.status).toBe(200);
    expect(res.body.context).toBe('Use snake_case everywhere.');
    expect(res.body.name).toBe('Renamed Project'); // name preserved
  });

  it('PUT /api/projects/:id returns 404 for non-existent', async () => {
    const res = await request(app)
      .put('/api/projects/proj-nonexistent')
      .send({ name: 'Nope' });
    expect(res.status).toBe(404);
  });

  it('GET /api/projects lists created projects', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    const ids = res.body.map((p) => p.id);
    expect(ids).toContain(createdIds[0]);
  });

  it('DELETE /api/projects/:id removes project', async () => {
    const id = createdIds[0];
    const res = await request(app).delete(`/api/projects/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify it's gone
    const getRes = await request(app).get(`/api/projects/${id}`);
    expect(getRes.status).toBe(404);

    // Remove from cleanup list
    createdIds.splice(createdIds.indexOf(id), 1);
  });

  it('DELETE /api/projects/:id returns 404 for non-existent', async () => {
    const res = await request(app).delete('/api/projects/proj-nonexistent');
    expect(res.status).toBe(404);
  });

  it('CRUD lifecycle: create → list → get → update → delete', async () => {
    // Create
    const createRes = await request(app)
      .post('/api/projects')
      .send({ name: 'Lifecycle Test' });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;
    createdIds.push(id);

    // List
    const listRes = await request(app).get('/api/projects');
    expect(listRes.body.some((p) => p.id === id)).toBe(true);

    // Get
    const getRes = await request(app).get(`/api/projects/${id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.name).toBe('Lifecycle Test');

    // Update
    const updateRes = await request(app)
      .put(`/api/projects/${id}`)
      .send({ name: 'Updated Lifecycle', context: 'some context' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Updated Lifecycle');
    expect(updateRes.body.context).toBe('some context');

    // Delete
    const deleteRes = await request(app).delete(`/api/projects/${id}`);
    expect(deleteRes.status).toBe(200);
    createdIds.splice(createdIds.indexOf(id), 1);

    // Verify gone
    const verifyRes = await request(app).get(`/api/projects/${id}`);
    expect(verifyRes.status).toBe(404);
  });
});
