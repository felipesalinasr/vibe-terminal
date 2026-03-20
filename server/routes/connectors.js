import { Router } from 'express';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { connectorSyncSchema } from '../schemas.js';
import { CONNECTOR_CATALOG, setCatalog, parseMcpTools } from '../connectors.js';

export function connectorRoutes({ catalogPath }) {
  const router = Router();

  router.get('/catalog', (req, res) => {
    res.json(CONNECTOR_CATALOG);
  });

  router.post('/sync', validate(connectorSyncSchema), asyncHandler(async (req, res) => {
    const { tools } = req.body;
    const catalog = parseMcpTools(tools);
    setCatalog(catalog);
    await writeFile(catalogPath, JSON.stringify(catalog, null, 2));
    const actionCount = Object.values(catalog).reduce((sum, c) => sum + c.actions.length, 0);
    res.json({ connectors: Object.keys(catalog).length, actions: actionCount, catalog });
  }));

  return router;
}
