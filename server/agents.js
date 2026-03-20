import { join } from 'path';
import { homedir } from 'os';
import { mkdir, readFile, writeFile, appendFile, readdir, stat, unlink } from 'fs/promises';

const BASE_DIR = join(homedir(), '.vibe-terminal', 'agents');

export function getAgentDir(agentId) {
  return join(BASE_DIR, agentId);
}

export async function ensureAgentDir(agentId) {
  const dir = getAgentDir(agentId);
  await mkdir(join(dir, 'knowledge'), { recursive: true });
  return dir;
}

export async function createAgentConfig(agentId, name) {
  const dir = getAgentDir(agentId);
  const configPath = join(dir, 'config.json');
  const purposePath = join(dir, 'purpose.md');

  const config = {
    id: agentId,
    name,
    skills: [],
    tools: [],
    files: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await writeFile(configPath, JSON.stringify(config, null, 2));
  await writeFile(purposePath, '');
  return config;
}

export async function getAgentConfig(agentId) {
  try {
    const raw = await readFile(join(getAgentDir(agentId), 'config.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveAgentConfig(agentId, data) {
  const existing = await getAgentConfig(agentId);
  if (!existing) return null;
  const merged = { ...existing, ...data, updatedAt: Date.now() };
  await writeFile(join(getAgentDir(agentId), 'config.json'), JSON.stringify(merged, null, 2));
  return merged;
}

export async function getAgentPurpose(agentId) {
  try {
    return await readFile(join(getAgentDir(agentId), 'purpose.md'), 'utf8');
  } catch {
    return '';
  }
}

export async function saveAgentPurpose(agentId, content) {
  await writeFile(join(getAgentDir(agentId), 'purpose.md'), content);
}

export async function addAgentFile(agentId, filePath) {
  const config = await getAgentConfig(agentId);
  if (!config) return;
  if (!config.files.includes(filePath)) {
    config.files.push(filePath);
    await saveAgentConfig(agentId, { files: config.files });
  }
}

export async function removeAgentFile(agentId, filePath) {
  const config = await getAgentConfig(agentId);
  if (!config) return;
  config.files = config.files.filter(f => f !== filePath);
  await saveAgentConfig(agentId, { files: config.files });
}

export async function listAgentKnowledge(agentId) {
  const kbDir = join(getAgentDir(agentId), 'knowledge');
  try {
    const entries = await readdir(kbDir);
    const results = [];
    for (const name of entries) {
      if (name.startsWith('.')) continue;
      const filePath = join(kbDir, name);
      const s = await stat(filePath);
      results.push({ name, size: s.size, path: filePath });
    }
    return results;
  } catch {
    return [];
  }
}

export async function deleteAgentKnowledge(agentId, filename) {
  const filePath = join(getAgentDir(agentId), 'knowledge', filename);
  await unlink(filePath);
}

// ── Memory (JSONL) ──

export async function ensureMemoryDir(cwd) {
  const memDir = join(cwd, 'memory');
  const memFile = join(memDir, 'memory.jsonl');
  await mkdir(memDir, { recursive: true });
  try {
    await readFile(memFile);
  } catch {
    await writeFile(memFile, '');
  }
}

export async function readMemory(cwd) {
  try {
    const raw = await readFile(join(cwd, 'memory', 'memory.jsonl'), 'utf8');
    if (!raw.trim()) return [];
    return raw.trim().split('\n').map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

// ── Audit (JSONL) ──

export async function ensureAuditDir(cwd) {
  const auditDir = join(cwd, 'audit');
  const auditFile = join(auditDir, 'audit.jsonl');
  await mkdir(auditDir, { recursive: true });
  try {
    await readFile(auditFile);
  } catch {
    await writeFile(auditFile, '');
  }
}

const REDACTED_KEYS = new Set(['password', 'secret', 'token', 'apiKey', 'api_key', 'authorization', 'cookie']);

function sanitizeRecord(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeRecord);
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else {
      cleaned[key] = sanitizeRecord(value);
    }
  }
  return cleaned;
}

export async function appendAuditEntry(cwd, entry) {
  const auditFile = join(cwd, 'audit', 'audit.jsonl');
  const sanitized = sanitizeRecord(entry);
  const line = JSON.stringify({ ts: new Date().toISOString(), ...sanitized }) + '\n';
  try {
    await appendFile(auditFile, line);
  } catch {
    // Audit dir may not exist yet — ensure and retry
    await ensureAuditDir(cwd);
    await appendFile(auditFile, line);
  }
}

export async function readAudit(cwd) {
  try {
    const raw = await readFile(join(cwd, 'audit', 'audit.jsonl'), 'utf8');
    if (!raw.trim()) return [];
    return raw.trim().split('\n').map(line => JSON.parse(line));
  } catch {
    return [];
  }
}
