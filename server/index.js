import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { sessionRoutes } from './routes/sessions.js';
import { agentRoutes } from './routes/agents.js';
import { skillRoutes } from './routes/skills.js';
import { templateRoutes } from './routes/templates.js';
import { connectorRoutes } from './routes/connectors.js';
import { fileRoutes } from './routes/files.js';
import { healthRoutes } from './routes/health.js';
import { setupWebSocket } from './ws.js';
import { setCatalog } from './connectors.js';
import { loadHistoricalSessions } from './sessions.js';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(__dirname, 'connectors-catalog.json');

// Load persisted connector catalog if available
try {
  const saved = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
  if (saved && Object.keys(saved).length > 0) {
    setCatalog(saved);
    logger.info('Loaded connector catalog from disk', { count: Object.keys(saved).length });
  }
} catch {
  // No persisted catalog — use hardcoded defaults
}

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8765;

// ── Middleware ──
app.use(express.json());
app.use(requestLogger);
app.use(express.static(join(__dirname, '..', 'public')));

// ── Routes ──
app.use('/api', sessionRoutes());
app.use('/api/agents', agentRoutes());
app.use('/api', skillRoutes());
app.use('/api/templates', templateRoutes());
app.use('/api/connectors', connectorRoutes({ catalogPath: CATALOG_PATH }));
app.use('/api', fileRoutes({ serverDir: __dirname }));
app.use('/api', healthRoutes());

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Centralized error handler (must be last middleware)
app.use(errorHandler);

// ── WebSocket ──
setupWebSocket(server);

// ── Start ──
const recovered = loadHistoricalSessions();
if (recovered > 0) logger.info('Restored previous sessions', { count: recovered });

server.listen(PORT, () => {
  logger.info('Vibe Terminal running', { url: `http://localhost:${PORT}` });
});
