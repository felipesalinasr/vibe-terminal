import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { createTemplateSchema, updateTemplateSchema } from '../schemas.js';
import { notFound } from '../errors.js';
import { listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate } from '../templates.js';

export function templateRoutes() {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await listTemplates());
  });

  router.post('/', validate(createTemplateSchema), asyncHandler(async (req, res) => {
    const template = await createTemplate(req.body);
    res.status(201).json(template);
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    const template = await getTemplate(req.params.id);
    if (!template) throw notFound('template not found');
    res.json(template);
  }));

  router.put('/:id', validate(updateTemplateSchema), asyncHandler(async (req, res) => {
    const updated = await updateTemplate(req.params.id, req.body);
    if (!updated) throw notFound('template not found');
    res.json(updated);
  }));

  router.delete('/:id', asyncHandler(async (req, res) => {
    const ok = await deleteTemplate(req.params.id);
    if (!ok) throw notFound('template not found');
    res.json({ ok: true });
  }));

  return router;
}
