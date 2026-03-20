import { WebSocketServer } from 'ws';
import { getSession, addListener, removeListener, writeToSession, resizeSession } from './sessions.js';

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      ws.close(4000, 'sessionId query param required');
      return;
    }

    const session = getSession(sessionId);
    if (!session) {
      ws.close(4004, 'session not found');
      return;
    }

    // Historical session: send scrollback then signal read-only
    if (!session.pty) {
      if (session.scrollback.length > 0) {
        ws.send(JSON.stringify({ type: 'scrollback', data: session.scrollback.join('') }));
      }
      ws.send(JSON.stringify({ type: 'historical' }));
      ws.on('close', () => {});
      return;
    }

    // Send scrollback buffer first
    if (session.scrollback.length > 0) {
      ws.send(JSON.stringify({ type: 'scrollback', data: session.scrollback.join('') }));
    }

    // Send current state
    ws.send(JSON.stringify({ type: 'state', state: session.status }));

    // Listen for PTY output
    const listener = (msg) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };
    addListener(sessionId, listener);

    // Handle input from client
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'input') {
          writeToSession(sessionId, msg.data);
        } else if (msg.type === 'resize') {
          resizeSession(sessionId, msg.cols, msg.rows);
        }
      } catch {}
    });

    ws.on('close', () => {
      removeListener(sessionId, listener);
    });
  });

  return wss;
}
