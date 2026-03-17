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

  ptyProcess.onData((data) => {
    session.scrollback.push(data);
    if (session.scrollback.length > MAX_SCROLLBACK) {
      session.scrollback = session.scrollback.slice(-MAX_SCROLLBACK);
    }
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
