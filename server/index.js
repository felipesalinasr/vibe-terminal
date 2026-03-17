import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn, execFileSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { createSession, getSession, listSessions, killSession, writeToSession, resizeSession, addListener, removeListener } from './sessions.js';
import { createStateDetector } from './state-detector.js';
import { getDirectorySuggestions } from './autocomplete.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const PORT = 8765;

app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

// ── REST API ──

app.get('/api/sessions', (req, res) => {
  res.json(listSessions());
});

app.post('/api/sessions', (req, res) => {
  const { name, cwd } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const session = createSession({ name, cwd });

    // Attach state detector
    const detector = createStateDetector((newState) => {
      const s = getSession(session.id);
      if (s) {
        s.status = newState;
        for (const listener of s.listeners) {
          listener({ type: 'state', state: newState });
        }
      }
    });

    const s = getSession(session.id);
    s._detector = detector;
    s.pty.onData((data) => {
      detector.processOutput(data);
    });

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session not found' });
  res.json({
    id: session.id,
    name: session.name,
    cwd: session.cwd,
    status: session.status,
    pid: session.pid,
    createdAt: session.createdAt,
    scrollback: session.scrollback,
  });
});

app.delete('/api/sessions/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (session && session._detector) session._detector.destroy();
  const ok = killSession(req.params.id);
  if (!ok) return res.status(404).json({ error: 'session not found' });
  res.json({ ok: true });
});

app.get('/api/autocomplete', async (req, res) => {
  const { path } = req.query;
  if (!path) return res.json([]);
  const suggestions = await getDirectorySuggestions(path);
  res.json(suggestions);
});

// Compile Swift browse helper (one-time, cached)
const helperSrc = join(__dirname, 'browse-helper.swift');
const helperBin = join(__dirname, 'browse-helper');

function ensureBrowseHelper() {
  const needsCompile = !existsSync(helperBin) ||
    statSync(helperSrc).mtimeMs > statSync(helperBin).mtimeMs;
  if (needsCompile) {
    console.log('Compiling browse helper...');
    execFileSync('swiftc', [helperSrc, '-o', helperBin, '-framework', 'AppKit']);
    console.log('Browse helper ready.');
  }
}

ensureBrowseHelper();

app.get('/api/browse', (req, res) => {
  const proc = spawn(helperBin);
  let out = '';
  proc.stdout.on('data', d => out += d);
  proc.on('close', code => {
    res.json({ path: code === 0 ? out.trim() || null : null });
  });
});

// ── WebSocket ──

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

// ── Start ──

server.listen(PORT, () => {
  console.log(`Vibe Terminal running at http://localhost:${PORT}`);
});
