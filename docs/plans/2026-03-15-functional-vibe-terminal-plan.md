# Functional Vibe Terminal — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the static Vibe Terminal prototype into a functional web-based terminal multiplexer that can spawn real shell sessions, run Claude Code CLI, and auto-organize sessions on a kanban board.

**Architecture:** Node.js backend (Express + WebSocket + node-pty) serves a frontend that uses xterm.js for real terminal rendering. Each kanban card maps to a PTY process. State detection parses Claude CLI output to auto-move cards between Active/Review columns.

**Tech Stack:** Node.js, Express, ws, node-pty, xterm.js, xterm-addon-fit

---

### Task 1: Project Scaffolding

**Files:**
- Create: `vibe-terminal/package.json`
- Create: `vibe-terminal/server/index.js` (stub)
- Move: `vibe-terminal/index.html` → `vibe-terminal/public/index.html`

**Step 1: Create package.json**

```json
{
  "name": "vibe-terminal",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server/index.js",
    "dev": "node --watch server/index.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "node-pty": "^1.0.0",
    "ws": "^8.18.0"
  }
}
```

**Step 2: Install dependencies**

Run: `cd vibe-terminal && npm install`
Expected: `node_modules/` created, `package-lock.json` generated. `node-pty` compiles native bindings (requires Xcode CLI tools).

**Step 3: Move index.html to public/**

Run: `mkdir -p public && mv index.html public/index.html`

**Step 4: Create server stub**

Create `server/index.js`:

```js
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 8765;

app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`Vibe Terminal running at http://localhost:${PORT}`);
});
```

**Step 5: Verify server starts and serves the frontend**

Run: `npm start`
Expected: "Vibe Terminal running at http://localhost:8765", browser loads the existing kanban UI.

**Step 6: Commit**

```bash
git add package.json package-lock.json server/index.js public/index.html
git commit -m "feat: scaffold node.js project with express server"
```

---

### Task 2: PTY Session Manager

**Files:**
- Create: `vibe-terminal/server/sessions.js`

**Step 1: Create the session manager module**

This module manages PTY lifecycle — spawn, write, kill, list, get scrollback.

```js
import pty from 'node-pty';
import { randomBytes } from 'crypto';
import os from 'os';

const sessions = new Map();
const MAX_SCROLLBACK = 10000;

function generateId() {
  return 'sess-' + randomBytes(2).toString('hex');
}

export function createSession({ name, cwd }) {
  const id = generateId();
  const shell = process.env.SHELL || '/bin/zsh';

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: cwd || os.homedir(),
    env: { ...process.env, TERM: 'xterm-256color' },
  });

  const session = {
    id,
    name,
    cwd: cwd || os.homedir(),
    status: 'active',
    pid: ptyProcess.pid,
    pty: ptyProcess,
    scrollback: [],
    listeners: new Set(),
    createdAt: Date.now(),
  };

  ptyProcess.onData((data) => {
    // Buffer scrollback
    session.scrollback.push(data);
    if (session.scrollback.length > MAX_SCROLLBACK) {
      session.scrollback = session.scrollback.slice(-MAX_SCROLLBACK);
    }
    // Notify all connected WebSocket listeners
    for (const listener of session.listeners) {
      listener({ type: 'output', data });
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    session.status = 'done';
    for (const listener of session.listeners) {
      listener({ type: 'exit', exitCode });
    }
  });

  sessions.set(id, session);
  return { id, name, cwd: session.cwd, status: session.status, pid: session.pid, createdAt: session.createdAt };
}

export function getSession(id) {
  return sessions.get(id);
}

export function listSessions() {
  return Array.from(sessions.values()).map(s => ({
    id: s.id,
    name: s.name,
    cwd: s.cwd,
    status: s.status,
    pid: s.pid,
    createdAt: s.createdAt,
  }));
}

export function writeToSession(id, data) {
  const session = sessions.get(id);
  if (!session || !session.pty) return false;
  session.pty.write(data);
  return true;
}

export function resizeSession(id, cols, rows) {
  const session = sessions.get(id);
  if (!session || !session.pty) return false;
  session.pty.resize(cols, rows);
  return true;
}

export function killSession(id) {
  const session = sessions.get(id);
  if (!session) return false;
  if (session.pty) {
    session.pty.kill();
  }
  sessions.delete(id);
  return true;
}

export function addListener(id, fn) {
  const session = sessions.get(id);
  if (!session) return false;
  session.listeners.add(fn);
  return true;
}

export function removeListener(id, fn) {
  const session = sessions.get(id);
  if (!session) return;
  session.listeners.delete(fn);
}

export function updateSessionStatus(id, status) {
  const session = sessions.get(id);
  if (!session) return false;
  session.status = status;
  return true;
}
```

**Step 2: Verify module loads without errors**

Run: `node -e "import('./server/sessions.js').then(() => console.log('OK'))"`
Expected: "OK"

**Step 3: Commit**

```bash
git add server/sessions.js
git commit -m "feat: add PTY session manager with spawn/kill/scrollback"
```

---

### Task 3: State Detector

**Files:**
- Create: `vibe-terminal/server/state-detector.js`

**Step 1: Create state detection module**

Parses raw terminal output to detect Claude Code state transitions.

```js
const IDLE_TIMEOUT_MS = 5000;

export function createStateDetector(onStateChange) {
  let currentState = 'active';
  let idleTimer = null;
  let buffer = '';

  // Patterns that indicate Claude is waiting for input
  const reviewPatterns = [
    /❯\s*$/m,                          // Claude prompt
    /^\s*>\s*$/m,                       // Generic prompt
    /\(y\/n\)/i,                        // Permission prompt
    /\(Y\)es.*\(N\)o/i,                // Yes/No prompt
    /Do you want to proceed/i,          // Confirmation
    /waiting for.*input/i,              // Explicit wait
    /Press Enter/i,                     // Enter prompt
  ];

  // Patterns that indicate Claude is actively working
  const activePatterns = [
    /● (Read|Write|Edit|Bash|Glob|Grep|Task)\(/,  // Tool calls
    /\.\.\./,                           // Streaming dots
    /Thinking/i,                        // Thinking indicator
  ];

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (currentState === 'active') {
        setState('review');
      }
    }, IDLE_TIMEOUT_MS);
  }

  function setState(newState) {
    if (newState !== currentState) {
      currentState = newState;
      onStateChange(newState);
    }
  }

  function processOutput(data) {
    buffer += data;
    // Keep buffer manageable
    if (buffer.length > 4000) {
      buffer = buffer.slice(-2000);
    }

    // Check for active patterns first
    for (const pattern of activePatterns) {
      if (pattern.test(data)) {
        setState('active');
        resetIdleTimer();
        return;
      }
    }

    // Check for review patterns
    for (const pattern of reviewPatterns) {
      if (pattern.test(data)) {
        setState('review');
        if (idleTimer) clearTimeout(idleTimer);
        return;
      }
    }

    // Any output resets idle timer (Claude is doing something)
    if (data.trim().length > 0) {
      setState('active');
      resetIdleTimer();
    }
  }

  function destroy() {
    if (idleTimer) clearTimeout(idleTimer);
  }

  return { processOutput, destroy, getState: () => currentState };
}
```

**Step 2: Commit**

```bash
git add server/state-detector.js
git commit -m "feat: add Claude output state detection heuristics"
```

---

### Task 4: Directory Autocomplete

**Files:**
- Create: `vibe-terminal/server/autocomplete.js`

**Step 1: Create autocomplete module**

```js
import { readdir, stat } from 'fs/promises';
import { dirname, basename, join, resolve } from 'path';
import os from 'os';

export async function getDirectorySuggestions(partial) {
  // Expand ~ to home directory
  let expanded = partial.replace(/^~/, os.homedir());
  expanded = resolve(expanded);

  let searchDir;
  let prefix;

  try {
    const s = await stat(expanded);
    if (s.isDirectory()) {
      // User typed a complete directory, list its children
      searchDir = expanded;
      prefix = '';
    } else {
      searchDir = dirname(expanded);
      prefix = basename(expanded).toLowerCase();
    }
  } catch {
    // Path doesn't exist yet — list parent dir and filter by partial name
    searchDir = dirname(expanded);
    prefix = basename(expanded).toLowerCase();
  }

  try {
    const entries = await readdir(searchDir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .filter(e => prefix === '' || e.name.toLowerCase().startsWith(prefix))
      .map(e => join(searchDir, e.name))
      .sort()
      .slice(0, 20);

    return dirs;
  } catch {
    return [];
  }
}
```

**Step 2: Commit**

```bash
git add server/autocomplete.js
git commit -m "feat: add directory autocomplete for session spawn"
```

---

### Task 5: REST API + WebSocket Server

**Files:**
- Modify: `vibe-terminal/server/index.js`

**Step 1: Wire up Express routes and WebSocket server**

Replace the stub `server/index.js` with the full server:

```js
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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
        // Notify all WebSocket listeners of state change
        for (const listener of s.listeners) {
          listener({ type: 'state', state: newState });
        }
      }
    });

    const s = getSession(session.id);
    // Tap into PTY output for state detection
    const originalListeners = s.listeners;
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

// ── WebSocket ──

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  // Expect ?sessionId=sess-xxxx
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
```

**Step 2: Test the server starts**

Run: `npm start`
Expected: "Vibe Terminal running at http://localhost:8765"

**Step 3: Test session creation via curl**

Run: `curl -X POST http://localhost:8765/api/sessions -H 'Content-Type: application/json' -d '{"name":"test","cwd":"/tmp"}'`
Expected: JSON response with `id`, `name`, `cwd`, `status: "active"`, `pid`

**Step 4: Test session listing**

Run: `curl http://localhost:8765/api/sessions`
Expected: Array with the session created above

**Step 5: Test session deletion**

Run: `curl -X DELETE http://localhost:8765/api/sessions/<id-from-step-3>`
Expected: `{"ok":true}`

**Step 6: Test autocomplete**

Run: `curl 'http://localhost:8765/api/autocomplete?path=/Users'`
Expected: Array of directory paths under /Users

**Step 7: Commit**

```bash
git add server/index.js
git commit -m "feat: complete REST API + WebSocket server with PTY streaming"
```

---

### Task 6: Frontend — Add xterm.js + Remove Mock Data

**Files:**
- Modify: `vibe-terminal/public/index.html`

This is the largest task. The frontend needs to:
1. Load xterm.js from CDN
2. Replace hardcoded card data with API-driven data
3. Replace the fake terminal div with xterm.js
4. Remove the panel input row (xterm.js handles input)
5. Connect via WebSocket for live terminal streaming
6. Update the modal to include directory path input with autocomplete

**Step 1: Add xterm.js CDN links to `<head>`**

Add after the Google Fonts link:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css">
<script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.min.js"></script>
```

**Step 2: Add CSS for directory autocomplete dropdown and start-session button**

Add to `<style>` before the closing `</style>`:

```css
/* ── Autocomplete dropdown ── */
.autocomplete-list {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  background: var(--card);
  border: 1px solid var(--border);
  max-height: 160px;
  overflow-y: auto;
  z-index: 10;
  display: none;
}

.autocomplete-list.visible { display: block; }

.autocomplete-item {
  padding: 6px 12px;
  font-size: 0.75rem;
  color: var(--text-dim);
  cursor: pointer;
}

.autocomplete-item:hover,
.autocomplete-item.selected {
  background: var(--card-hover);
  color: var(--text);
}

.path-input-wrapper {
  position: relative;
}

/* ── xterm container ── */
.panel-terminal {
  flex: 1;
  overflow: hidden;
  padding: 8px;
}

.panel-terminal .xterm {
  height: 100%;
}

/* ── Start session button on backlog cards ── */
.btn-start-session {
  font-family: var(--mono);
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--void);
  background: var(--green);
  border: none;
  padding: 5px 12px;
  cursor: pointer;
  margin-top: 8px;
  width: 100%;
  letter-spacing: 0.04em;
  transition: all 0.15s;
}

.btn-start-session:hover {
  background: #66ff33;
}
```

**Step 3: Update the modal HTML**

Replace the modal content to remove the column selector and add a directory path input:

```html
<div class="modal-overlay" id="modalOverlay">
  <div class="modal" onclick="event.stopPropagation()">
    <div class="modal-title">spawn agent</div>
    <div class="modal-subtitle">Create a new task in backlog</div>
    <label for="agentName">task name</label>
    <input type="text" id="agentName" placeholder="e.g. Refactor auth module" autofocus>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn-create" onclick="createAgent()">Create</button>
    </div>
  </div>
</div>

<!-- Start Session Modal (shown when clicking a backlog card) -->
<div class="modal-overlay" id="startSessionOverlay">
  <div class="modal" onclick="event.stopPropagation()">
    <div class="modal-title">start session</div>
    <div class="modal-subtitle" id="startSessionSubtitle">Open terminal for: Task Name</div>
    <label for="sessionPath">directory</label>
    <div class="path-input-wrapper">
      <input type="text" id="sessionPath" placeholder="~/Projects/my-app" autocomplete="off">
      <div class="autocomplete-list" id="autocompleteList"></div>
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeStartSessionModal()">Cancel</button>
      <button class="btn-create" onclick="startSession()">Start</button>
    </div>
  </div>
</div>
```

**Step 4: Update the side panel HTML**

Remove the panel-input-row and panel-footer (xterm.js handles input). Keep the header and mode bar:

```html
<div class="side-panel" id="sidePanel">
  <div class="panel-header">
    <div class="panel-header-left">
      <span class="panel-title" id="panelTitle">Agent</span>
      <span class="panel-session" id="panelSession">session-xxx</span>
    </div>
    <button class="btn-close" onclick="closePanel()">ESC ×</button>
  </div>
  <div class="panel-terminal" id="panelTerminal"></div>
  <div class="panel-footer" id="panelFooter">
    <div class="panel-mode-bar" id="panelModeBar">
      <div class="mode-dot" id="panelModeDot"></div>
      <span id="panelModeText">active</span>
    </div>
  </div>
</div>
```

**Step 5: Replace the entire `<script>` block with the new JS**

This is the core rewrite — API-driven data, xterm.js integration, WebSocket streaming, autocomplete.

```js
// ── CONFIG ──
const API = '';  // same origin
const WS_URL = `ws://${location.host}/ws`;

// ── STATE ──
const columns = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'active',  label: 'Active' },
  { id: 'review',  label: 'Review' },
  { id: 'done',    label: 'Done' },
];

let backlogTasks = JSON.parse(localStorage.getItem('vt-backlog') || '[]');
let liveSessions = [];
let activeTerminal = null;  // { term, ws, sessionId }
let currentPanelSession = null;
let nextBacklogId = backlogTasks.length + 1;
let startSessionCardId = null;

// ── API ──
async function fetchSessions() {
  const res = await fetch(`${API}/api/sessions`);
  liveSessions = await res.json();
}

async function createSessionAPI(name, cwd) {
  const res = await fetch(`${API}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, cwd }),
  });
  return res.json();
}

async function deleteSessionAPI(id) {
  await fetch(`${API}/api/sessions/${id}`, { method: 'DELETE' });
}

async function fetchAutocomplete(path) {
  const res = await fetch(`${API}/api/autocomplete?path=${encodeURIComponent(path)}`);
  return res.json();
}

// ── RENDER ──
function getAllCards() {
  const cards = [];

  // Backlog tasks (local)
  backlogTasks.forEach(t => {
    cards.push({
      id: t.id,
      title: t.name,
      col: 'backlog',
      status: 'idle',
      tag: t.tag || 'task',
      preview: 'No session started',
      session: '—',
      isBacklog: true,
    });
  });

  // Live sessions
  liveSessions.forEach(s => {
    let col = 'active';
    let statusClass = 'running';
    if (s.status === 'review') { col = 'review'; statusClass = 'paused'; }
    if (s.status === 'done') { col = 'done'; statusClass = 'done'; }
    // Allow manual override
    if (s._manualCol) { col = s._manualCol; }

    cards.push({
      id: s.id,
      title: s.name,
      col,
      status: statusClass,
      tag: 'session',
      preview: s.cwd,
      session: s.id,
      isBacklog: false,
      sessionData: s,
    });
  });

  return cards;
}

function render() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  const cards = getAllCards();

  columns.forEach(col => {
    const colCards = cards.filter(c => c.col === col.id);
    const colEl = document.createElement('div');
    colEl.className = 'column';
    colEl.dataset.col = col.id;

    colEl.innerHTML = `
      <div class="column-header">
        <span class="column-title">${col.label}</span>
        <span class="column-count">${colCards.length}</span>
      </div>
      <div class="column-body" data-col="${col.id}"></div>
    `;

    const body = colEl.querySelector('.column-body');

    // Drop zone events
    body.addEventListener('dragover', e => {
      e.preventDefault();
      body.classList.add('drag-over');
    });
    body.addEventListener('dragleave', () => {
      body.classList.remove('drag-over');
    });
    body.addEventListener('drop', e => {
      e.preventDefault();
      body.classList.remove('drag-over');
      const cardId = e.dataTransfer.getData('text/plain');
      handleDrop(cardId, col.id);
    });

    colCards.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.draggable = true;
      cardEl.dataset.id = card.id;

      cardEl.innerHTML = `
        <div class="card-top">
          <div class="status-dot ${card.status}"></div>
          <div class="card-title">${escapeHtml(card.title)}</div>
        </div>
        <div class="card-preview"><span class="prompt-char">${escapeHtml(card.preview)}</span></div>
        <div class="card-meta">
          <span class="card-tag">${card.tag}</span>
          <span>${card.session}</span>
        </div>
      `;

      cardEl.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', card.id);
        cardEl.classList.add('dragging');
        setTimeout(() => cardEl.style.opacity = '0.4', 0);
      });
      cardEl.addEventListener('dragend', () => {
        cardEl.classList.remove('dragging');
        cardEl.style.opacity = '';
      });

      cardEl.addEventListener('click', e => {
        if (e.defaultPrevented) return;
        if (card.isBacklog) {
          openStartSessionModal(card);
        } else {
          openPanel(card);
        }
      });

      body.appendChild(cardEl);
    });

    board.appendChild(colEl);
  });

  updateHeaderCounts();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateHeaderCounts() {
  const total = backlogTasks.length + liveSessions.length;
  const active = liveSessions.filter(s => s.status === 'active').length;
  document.querySelector('.header-meta').innerHTML =
    `<span>${total}</span> agents &middot; <span>${active}</span> active`;
}

function handleDrop(cardId, targetCol) {
  // For live sessions, allow manual column override
  const session = liveSessions.find(s => s.id === cardId);
  if (session) {
    session._manualCol = targetCol;
    if (targetCol === 'done') {
      session.status = 'done';
    }
  }
  // For backlog tasks, don't allow drag to other columns (need to start session first)
  render();
}

// ── SIDE PANEL (xterm.js) ──
function openPanel(card) {
  const panel = document.getElementById('sidePanel');
  const overlay = document.getElementById('panelOverlay');
  const title = document.getElementById('panelTitle');
  const session = document.getElementById('panelSession');
  const terminalEl = document.getElementById('panelTerminal');
  const modeDot = document.getElementById('panelModeDot');
  const modeText = document.getElementById('panelModeText');

  // Clean up any existing terminal
  if (activeTerminal) {
    activeTerminal.term.dispose();
    if (activeTerminal.ws) activeTerminal.ws.close();
    activeTerminal = null;
  }

  title.textContent = card.title;
  session.textContent = card.session;
  currentPanelSession = card.sessionData;

  // Set initial state indicator
  const state = card.sessionData?.status || 'active';
  updateModeIndicator(state);

  // Create xterm.js terminal
  terminalEl.innerHTML = '';
  const term = new Terminal({
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 13,
    theme: {
      background: '#1a1b2e',
      foreground: '#b0b8c8',
      cursor: '#33ff00',
      cursorAccent: '#1a1b2e',
      selectionBackground: '#2a2c4280',
      black: '#1a1b2e',
      red: '#ff5c57',
      green: '#33ff00',
      yellow: '#f5bf4f',
      blue: '#00d4ff',
      magenta: '#c792ea',
      cyan: '#00d4ff',
      white: '#e0e4ef',
      brightBlack: '#4a5068',
      brightRed: '#ff5c57',
      brightGreen: '#33ff00',
      brightYellow: '#f5bf4f',
      brightBlue: '#00d4ff',
      brightMagenta: '#c792ea',
      brightCyan: '#00d4ff',
      brightWhite: '#f2f2f2',
    },
    cursorBlink: true,
    scrollback: 10000,
    allowProposedApi: true,
  });

  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(terminalEl);

  // Fit after a small delay to ensure panel is visible
  setTimeout(() => fitAddon.fit(), 50);

  // Connect WebSocket
  const ws = new WebSocket(`${WS_URL}?sessionId=${card.session}`);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'output') {
      term.write(msg.data);
    } else if (msg.type === 'scrollback') {
      term.write(msg.data);
    } else if (msg.type === 'state') {
      updateModeIndicator(msg.state);
      // Auto-move card in kanban
      const sess = liveSessions.find(s => s.id === card.session);
      if (sess) {
        sess.status = msg.state;
        delete sess._manualCol;
        render();
      }
    } else if (msg.type === 'exit') {
      term.write('\r\n\x1b[2m[Process exited]\x1b[0m\r\n');
    }
  };

  // Send keystrokes to PTY
  term.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }));
    }
  });

  // Handle resize
  term.onResize(({ cols, rows }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
  });

  // Resize on window resize
  const resizeHandler = () => fitAddon.fit();
  window.addEventListener('resize', resizeHandler);

  activeTerminal = { term, ws, sessionId: card.session, fitAddon, resizeHandler };

  panel.classList.add('open');
  overlay.classList.add('open');
  term.focus();

  document.addEventListener('keydown', handleEsc);
}

function updateModeIndicator(state) {
  const modeDot = document.getElementById('panelModeDot');
  const modeText = document.getElementById('panelModeText');
  if (state === 'active') {
    modeDot.className = 'mode-dot code';
    modeText.textContent = '\u26A1 active — processing';
  } else if (state === 'review') {
    modeDot.className = 'mode-dot plan';
    modeText.textContent = '\u26A1 waiting for input';
  } else {
    modeDot.className = 'mode-dot auto';
    modeText.textContent = '\u26A1 session ended';
  }
}

function closePanel() {
  document.getElementById('sidePanel').classList.remove('open');
  document.getElementById('panelOverlay').classList.remove('open');
  document.removeEventListener('keydown', handleEsc);

  // Disconnect WebSocket but keep PTY alive
  if (activeTerminal) {
    if (activeTerminal.ws) activeTerminal.ws.close();
    activeTerminal.term.dispose();
    window.removeEventListener('resize', activeTerminal.resizeHandler);
    activeTerminal = null;
  }
}

function handleEsc(e) {
  if (e.key === 'Escape') closePanel();
}

// ── BACKLOG MODAL ──
function openModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.add('open');
  document.getElementById('agentName').value = '';
  setTimeout(() => document.getElementById('agentName').focus(), 100);
  document.getElementById('agentName').onkeydown = e => {
    if (e.key === 'Enter') createAgent();
    if (e.key === 'Escape') closeModal();
  };
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

document.getElementById('modalOverlay').addEventListener('click', closeModal);

function createAgent() {
  const name = document.getElementById('agentName').value.trim();
  if (!name) return;

  backlogTasks.push({
    id: 'task-' + nextBacklogId++,
    name,
    tag: 'task',
  });
  localStorage.setItem('vt-backlog', JSON.stringify(backlogTasks));
  closeModal();
  render();
}

// ── START SESSION MODAL ──
function openStartSessionModal(card) {
  startSessionCardId = card.id;
  const overlay = document.getElementById('startSessionOverlay');
  const subtitle = document.getElementById('startSessionSubtitle');
  subtitle.textContent = `Open terminal for: ${card.title}`;
  document.getElementById('sessionPath').value = '~/';
  overlay.classList.add('open');
  setTimeout(() => document.getElementById('sessionPath').focus(), 100);

  // Wire up autocomplete
  const input = document.getElementById('sessionPath');
  let debounceTimer;
  input.oninput = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const suggestions = await fetchAutocomplete(input.value);
      renderAutocomplete(suggestions);
    }, 200);
  };

  input.onkeydown = e => {
    if (e.key === 'Enter') {
      const list = document.getElementById('autocompleteList');
      if (list.classList.contains('visible')) {
        const selected = list.querySelector('.selected');
        if (selected) {
          input.value = selected.dataset.path + '/';
          list.classList.remove('visible');
          return;
        }
      }
      startSession();
    }
    if (e.key === 'Escape') closeStartSessionModal();
    if (e.key === 'Tab') {
      e.preventDefault();
      const list = document.getElementById('autocompleteList');
      const items = list.querySelectorAll('.autocomplete-item');
      if (items.length === 1) {
        input.value = items[0].dataset.path + '/';
        list.classList.remove('visible');
        input.dispatchEvent(new Event('input'));
      }
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      navigateAutocomplete(e.key === 'ArrowDown' ? 1 : -1);
    }
  };
}

function closeStartSessionModal() {
  document.getElementById('startSessionOverlay').classList.remove('open');
  document.getElementById('autocompleteList').classList.remove('visible');
  startSessionCardId = null;
}

document.getElementById('startSessionOverlay').addEventListener('click', closeStartSessionModal);

function renderAutocomplete(suggestions) {
  const list = document.getElementById('autocompleteList');
  if (suggestions.length === 0) {
    list.classList.remove('visible');
    return;
  }
  list.innerHTML = suggestions.map(s =>
    `<div class="autocomplete-item" data-path="${escapeHtml(s)}" onclick="selectAutocomplete(this)">${escapeHtml(s)}</div>`
  ).join('');
  list.classList.add('visible');
}

function selectAutocomplete(el) {
  const input = document.getElementById('sessionPath');
  input.value = el.dataset.path + '/';
  document.getElementById('autocompleteList').classList.remove('visible');
  input.focus();
  input.dispatchEvent(new Event('input'));
}

function navigateAutocomplete(dir) {
  const list = document.getElementById('autocompleteList');
  const items = Array.from(list.querySelectorAll('.autocomplete-item'));
  if (items.length === 0) return;
  const current = list.querySelector('.selected');
  let idx = current ? items.indexOf(current) : -1;
  if (current) current.classList.remove('selected');
  idx = (idx + dir + items.length) % items.length;
  items[idx].classList.add('selected');
}

async function startSession() {
  const pathInput = document.getElementById('sessionPath');
  const cwd = pathInput.value.trim().replace(/^~/, '');
  const task = backlogTasks.find(t => t.id === startSessionCardId);
  if (!task) return;

  // Expand ~ in path
  const fullPath = pathInput.value.trim();

  const session = await createSessionAPI(task.name, fullPath);

  // Remove from backlog
  backlogTasks = backlogTasks.filter(t => t.id !== startSessionCardId);
  localStorage.setItem('vt-backlog', JSON.stringify(backlogTasks));

  closeStartSessionModal();
  await fetchSessions();
  render();

  // Auto-open the panel for the new session
  const card = getAllCards().find(c => c.session === session.id);
  if (card) openPanel(card);
}

// ── POLLING ──
setInterval(async () => {
  await fetchSessions();
  render();
}, 10000);

// ── INIT ──
(async () => {
  await fetchSessions();
  render();
  closePanel();
  closeModal();
})();
```

**Step 6: Verify the full stack works in Playwright**

1. Run: `npm start` (in vibe-terminal directory)
2. Navigate to `http://localhost:8765`
3. Click "+ New Agent" → type a name → "Create" → card appears in Backlog
4. Click the backlog card → start session modal opens → type a directory path → "Start"
5. Terminal opens in side panel → type `ls` → see real directory listing
6. Type `claude` → Claude Code starts in the terminal
7. Close panel → card stays in Active column
8. Reopen card → terminal reconnects with scrollback

**Step 7: Commit**

```bash
git add public/index.html
git commit -m "feat: integrate xterm.js, WebSocket streaming, and live kanban"
```

---

### Task 7: Polish and Edge Cases

**Files:**
- Modify: `vibe-terminal/public/index.html`
- Modify: `vibe-terminal/server/sessions.js`

**Step 1: Handle session process exit gracefully**

When a PTY exits (user types `exit` or Claude finishes), the card should update visually. Ensure the `onExit` handler in `sessions.js` properly marks the session as done and notifies listeners.

**Step 2: Add kill session button to panel header**

Add a "Kill" button next to "ESC ×" in the panel header. On click, call `DELETE /api/sessions/:id` and close the panel.

```html
<button class="btn-close" onclick="killCurrentSession()" style="margin-right:4px">Kill</button>
```

```js
async function killCurrentSession() {
  if (!currentPanelSession) return;
  await deleteSessionAPI(currentPanelSession.id);
  closePanel();
  await fetchSessions();
  render();
}
```

**Step 3: Handle ~ expansion on server side**

In `autocomplete.js` and the session creation endpoint, ensure `~` is expanded to the home directory server-side, since the PTY spawn needs an absolute path.

Update `createSession` in `sessions.js`:
```js
cwd: (cwd || os.homedir()).replace(/^~/, os.homedir()),
```

**Step 4: Verify everything works end-to-end**

Repeat the Playwright test sequence from Task 6, plus:
- Kill a session → card disappears
- Process exit → card moves to Done
- Multiple sessions open simultaneously

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: polish — kill button, exit handling, path expansion"
```

---

## Summary

| Task | Description | Key Files |
|------|------------|-----------|
| 1 | Project scaffolding | `package.json`, `server/index.js`, move HTML |
| 2 | PTY session manager | `server/sessions.js` |
| 3 | State detector | `server/state-detector.js` |
| 4 | Directory autocomplete | `server/autocomplete.js` |
| 5 | REST API + WebSocket server | `server/index.js` |
| 6 | Frontend rewrite (xterm.js + API) | `public/index.html` |
| 7 | Polish and edge cases | Various |

Tasks 1-5 are backend, Task 6 is the frontend rewrite, Task 7 is polish. Tasks 2-4 are independent and can be done in parallel. Task 5 depends on 2-4. Task 6 depends on 5.
