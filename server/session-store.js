import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream, readFileSync as readFS } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const BASE_DIR = join(homedir(), '.vibe-terminal');
const SESSIONS_FILE = join(BASE_DIR, 'sessions.json');
const AGENTS_DIR = join(BASE_DIR, 'agents');

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

export function loadSessionMetadata() {
  try {
    ensureDir(BASE_DIR);
    if (!existsSync(SESSIONS_FILE)) return [];
    const raw = readFileSync(SESSIONS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSessionMetadata(sessions) {
  ensureDir(BASE_DIR);
  writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

export function removeSessionFromMetadata(sessionId) {
  const sessions = loadSessionMetadata();
  const filtered = sessions.filter(s => s.id !== sessionId);
  saveSessionMetadata(filtered);
}

export function createScrollbackStream(sessionId) {
  const dir = join(AGENTS_DIR, sessionId);
  ensureDir(dir);
  return createWriteStream(join(dir, 'scrollback.log'), { flags: 'a' });
}

export function readScrollback(sessionId) {
  const filePath = join(AGENTS_DIR, sessionId, 'scrollback.log');
  try {
    if (!existsSync(filePath)) return '';
    const buf = readFileSync(filePath);
    // Cap at last 2MB
    if (buf.length > 2 * 1024 * 1024) {
      return buf.slice(buf.length - 2 * 1024 * 1024).toString('utf8');
    }
    return buf.toString('utf8');
  } catch {
    return '';
  }
}
