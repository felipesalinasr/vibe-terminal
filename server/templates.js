import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdir, readFile, writeFile, readdir, unlink } from 'fs/promises';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

async function ensureDir() {
  await mkdir(TEMPLATES_DIR, { recursive: true });
}

function generateTemplateId() {
  return 'tpl-' + randomBytes(4).toString('hex');
}

export async function listTemplates() {
  await ensureDir();
  try {
    const files = await readdir(TEMPLATES_DIR);
    const templates = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await readFile(join(TEMPLATES_DIR, file), 'utf8');
        templates.push(JSON.parse(raw));
      } catch { /* corrupt template file — skip */ }
    }
    return templates.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch { /* templates dir may not exist yet */
    return [];
  }
}

export async function getTemplate(id) {
  try {
    const raw = await readFile(join(TEMPLATES_DIR, `${id}.json`), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function createTemplate({ name, defaultCwd, purpose, identity, constraints, skills, tools, connectors }) {
  await ensureDir();
  const id = generateTemplateId();
  const now = Date.now();
  const template = {
    id,
    name: name || 'Untitled',
    defaultCwd: defaultCwd || '',
    purpose: purpose || '',
    identity: identity || '',
    constraints: constraints || '',
    skills: skills || [],
    tools: tools || [],
    connectors: connectors || [],
    createdAt: now,
    updatedAt: now,
  };
  await writeFile(join(TEMPLATES_DIR, `${id}.json`), JSON.stringify(template, null, 2));
  return template;
}

export async function updateTemplate(id, data) {
  const existing = await getTemplate(id);
  if (!existing) return null;
  const merged = { ...existing, ...data, id, updatedAt: Date.now() };
  await writeFile(join(TEMPLATES_DIR, `${id}.json`), JSON.stringify(merged, null, 2));
  return merged;
}

export async function deleteTemplate(id) {
  try {
    await unlink(join(TEMPLATES_DIR, `${id}.json`));
    return true;
  } catch {
    return false;
  }
}
