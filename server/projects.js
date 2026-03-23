import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdir, readFile, writeFile, readdir, unlink } from 'fs/promises';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECTS_DIR = join(__dirname, '..', 'projects');

async function ensureDir() {
  await mkdir(PROJECTS_DIR, { recursive: true });
}

function generateProjectId() {
  return 'proj-' + randomBytes(4).toString('hex');
}

export async function listProjects() {
  await ensureDir();
  try {
    const files = await readdir(PROJECTS_DIR);
    const projects = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await readFile(join(PROJECTS_DIR, file), 'utf8');
        projects.push(JSON.parse(raw));
      } catch { /* corrupt project file — skip */ }
    }
    return projects.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch { /* projects dir may not exist yet */
    return [];
  }
}

export async function getProject(id) {
  try {
    const raw = await readFile(join(PROJECTS_DIR, `${id}.json`), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function createProject({ name, description, path }) {
  await ensureDir();
  const id = generateProjectId();
  const now = Date.now();
  const project = {
    id,
    name: name || 'Untitled',
    description: description || '',
    path: path || '',
    context: '',
    techStack: null,
    repoUrl: null,
    createdAt: now,
    updatedAt: now,
  };
  await writeFile(join(PROJECTS_DIR, `${id}.json`), JSON.stringify(project, null, 2));
  return project;
}

export async function updateProject(id, data) {
  const existing = await getProject(id);
  if (!existing) return null;
  const merged = { ...existing, ...data, id, updatedAt: Date.now() };
  await writeFile(join(PROJECTS_DIR, `${id}.json`), JSON.stringify(merged, null, 2));
  return merged;
}

export async function deleteProject(id) {
  try {
    await unlink(join(PROJECTS_DIR, `${id}.json`));
    return true;
  } catch {
    return false;
  }
}
