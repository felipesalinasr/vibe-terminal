import pty from 'node-pty';
import { randomBytes } from 'crypto';
import os from 'os';
import { loadSessionMetadata, saveSessionMetadata, createScrollbackStream, readScrollback } from './session-store.js';

const sessions = new Map();
const MAX_SCROLLBACK = 10000;

function generateId() {
  return 'sess-' + randomBytes(4).toString('hex');
}

export function createSession({ name, cwd }) {
  const id = generateId();
  const shell = process.env.SHELL || '/bin/zsh';
  const resolvedCwd = (cwd || os.homedir()).replace(/^~/, os.homedir());

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: resolvedCwd,
    env: (() => { const e = { ...process.env, TERM: 'xterm-256color' }; delete e.CLAUDECODE; return e; })(),
  });

  const session = {
    id,
    name,
    cwd: resolvedCwd,
    status: 'active',
    pid: ptyProcess.pid,
    pty: ptyProcess,
    scrollback: [],
    listeners: new Set(),
    createdAt: Date.now(),
  };

  // Persistence: scrollback write stream
  const scrollbackStream = createScrollbackStream(id);
  session._scrollbackStream = scrollbackStream;

  ptyProcess.onData((data) => {
    session.scrollback.push(data);
    if (session.scrollback.length > MAX_SCROLLBACK) {
      session.scrollback = session.scrollback.slice(-MAX_SCROLLBACK);
    }
    // Persist to disk
    scrollbackStream.write(data);
    for (const listener of session.listeners) {
      listener({ type: 'output', data });
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    session.status = 'done';
    session.endedAt = Date.now();
    // Close scrollback stream and persist metadata
    scrollbackStream.end();
    const meta = loadSessionMetadata();
    const entry = meta.find(m => m.id === id);
    if (entry) {
      entry.endedAt = session.endedAt;
      saveSessionMetadata(meta);
    }
    for (const listener of session.listeners) {
      listener({ type: 'exit', exitCode });
    }
  });

  sessions.set(id, session);

  // Persist session metadata to disk
  const meta = loadSessionMetadata();
  meta.push({ id, name, cwd: session.cwd, createdAt: session.createdAt, endedAt: null });
  saveSessionMetadata(meta);

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
  // Close scrollback stream
  if (session._scrollbackStream) {
    session._scrollbackStream.end();
  }
  // Update metadata with endedAt
  session.endedAt = Date.now();
  const meta = loadSessionMetadata();
  const entry = meta.find(m => m.id === id);
  if (entry) {
    entry.endedAt = session.endedAt;
    saveSessionMetadata(meta);
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

export function loadHistoricalSessions() {
  const meta = loadSessionMetadata();
  let count = 0;
  for (const entry of meta) {
    if (sessions.has(entry.id)) continue;
    const scrollbackData = readScrollback(entry.id);
    sessions.set(entry.id, {
      id: entry.id,
      name: entry.name,
      cwd: entry.cwd,
      status: 'historical',
      pid: null,
      pty: null,
      scrollback: scrollbackData ? [scrollbackData] : [],
      listeners: new Set(),
      createdAt: entry.createdAt,
      endedAt: entry.endedAt,
    });
    count++;
  }
  return count;
}
