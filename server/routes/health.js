import { Router } from 'express';
import { listSessions } from '../sessions.js';

export function healthRoutes() {
  const router = Router();
  const startTime = Date.now();

  router.get('/health', (req, res) => {
    const sessions = listSessions();
    res.json({
      status: 'ok',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      sessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active' || s.status === 'review').length,
    });
  });

  return router;
}
