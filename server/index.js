import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { spawn, execFileSync } from 'child_process';
import { existsSync, statSync, mkdirSync, writeFileSync, renameSync } from 'fs';
import { homedir, tmpdir } from 'os';
import multer from 'multer';
import { createSession, getSession, listSessions, killSession, writeToSession, resizeSession, addListener, removeListener, loadHistoricalSessions } from './sessions.js';
import { removeSessionFromMetadata } from './session-store.js';
import { createStateDetector } from './state-detector.js';
import { getDirectorySuggestions } from './autocomplete.js';
import { ensureAgentDir, createAgentConfig, getAgentConfig, saveAgentConfig, addAgentFile, removeAgentFile, listAgentKnowledge, deleteAgentKnowledge, getAgentDir, ensureMemoryDir, ensureAuditDir, appendAuditEntry, readMemory, readAudit } from './agents.js';
import { listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate } from './templates.js';
import { CONNECTOR_CATALOG, resolveConnectorPermissions, setCatalog, parseMcpTools } from './connectors.js';
import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { assertPathWithin, sanitizePathParam, ALLOWED_KB_TYPES, MAX_DROP_FILE_SIZE, MAX_KB_FILE_SIZE } from './security.js';
import { badRequest, notFound, forbidden, unprocessable } from './errors.js';
import { errorHandler } from './middleware/error-handler.js';
import { asyncHandler } from './middleware/async-handler.js';
import { validate } from './middleware/validate.js';
import { requestLogger } from './middleware/request-logger.js';
import { createSessionSchema, updateAgentSchema, purposeSchema, agentsMdSchema, skillContentWriteSchema, createTemplateSchema, updateTemplateSchema, openSchema, fileTrackSchema, connectorSyncSchema } from './schemas.js';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load persisted connector catalog if available
const CATALOG_PATH = join(__dirname, 'connectors-catalog.json');
try {
  const saved = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
  if (saved && Object.keys(saved).length > 0) {
    setCatalog(saved);
    logger.info('Loaded connector catalog from disk', { count: Object.keys(saved).length });
  }
} catch {
  // No persisted catalog — use hardcoded defaults
}

async function readClaudeMd(cwd) {
  try {
    return await readFile(join(cwd, 'CLAUDE.md'), 'utf8');
  } catch {
    return '';
  }
}

async function writeClaudeMd(cwd, content) {
  await writeFile(join(cwd, 'CLAUDE.md'), content);
}

const CLAUDE_MD_TEMPLATE = `# {AGENT_NAME}

## Role

[Describe what this agent does, its primary purpose, and the domain it operates in.]

## Scope of Authority

### MUST
- [Required behaviors and responsibilities]

### MUST NOT
- [Prohibited actions and boundaries]

## Communication Style

- [Tone, format, and channel preferences]

## File Organization

- \`AGENTS.md\` — detailed constraints, operational modes, execution workflows
- \`knowledge/\` — domain reference docs (see _index.yaml for index)
- \`memory/memory.jsonl\` — persistent structured memory
- \`audit/audit.jsonl\` — action trail

## Self-Maintenance Rules

When corrected about a convention, log to \`memory/memory.jsonl\` with type "convention".
When shared reference material (>200 words, reusable, factual), save to \`knowledge/\` and update \`_index.yaml\`.

`;

const AGENTS_MD_TEMPLATE = `# Operational Constraints

## Messaging Rules

[Domain-specific rules for how this agent communicates and operates.]

## Operational Modes

[Mode definitions — e.g., draft mode, review mode, autonomous mode.]

## Standard Output Structure

[Response format templates and expected output shapes.]

## Execution Workflow

[Pre-task checklists, step-by-step procedures.]

## Safety & Guardrails

[Edge case handling, prohibited patterns, escalation rules.]

## Performance Rules

[Completion criteria, quality checks, definition of done.]
`;

const REQUIRED_SECTIONS = [
  { marker: '## Self-Maintenance Rules', content: `## Self-Maintenance Rules\n\nWhen corrected about a convention, log to \`memory/memory.jsonl\` with type "convention".\nWhen shared reference material (>200 words, reusable, factual), save to \`knowledge/\` and update \`_index.yaml\`.\n` },
];

async function ensureAgentScaffolding(cwd, agentName) {
  // 1. CLAUDE.md — identity
  let md = await readClaudeMd(cwd);
  if (!md.trim()) {
    md = CLAUDE_MD_TEMPLATE.replace('{AGENT_NAME}', agentName || 'Agent');
    await writeClaudeMd(cwd, md);
  } else {
    let changed = false;
    for (const section of REQUIRED_SECTIONS) {
      if (!md.includes(section.marker)) {
        md = md.trimEnd() + '\n\n' + section.content;
        changed = true;
      }
    }
    if (changed) await writeClaudeMd(cwd, md);
  }
  // 2. AGENTS.md — operational constraints
  await ensureAgentsMd(cwd);
  // 3. knowledge/ dir + _index.yaml
  await ensureKnowledgeDir(cwd);
  // 4. memory/memory.jsonl
  await ensureMemoryDir(cwd);
  // 5. audit/audit.jsonl
  await ensureAuditDir(cwd);
}

async function readAgentsMd(cwd) {
  try {
    return await readFile(join(cwd, 'AGENTS.md'), 'utf8');
  } catch {
    return '';
  }
}

async function writeAgentsMd(cwd, content) {
  await writeFile(join(cwd, 'AGENTS.md'), content);
}

async function ensureAgentsMd(cwd) {
  const agentsMdPath = join(cwd, 'AGENTS.md');
  try {
    await readFile(agentsMdPath);
  } catch {
    await writeFile(agentsMdPath, AGENTS_MD_TEMPLATE);
  }
}

const INDEX_YAML_TEMPLATE = `# Knowledge Index
# Auto-managed by Vibe Terminal. AI agents append entries when saving knowledge files.
files: []
`;

async function ensureKnowledgeDir(cwd) {
  const kbDir = join(cwd, 'knowledge');
  const indexPath = join(kbDir, '_index.yaml');
  await mkdir(kbDir, { recursive: true });
  try {
    await readFile(indexPath);
  } catch {
    await writeFile(indexPath, INDEX_YAML_TEMPLATE);
  }
}

async function syncSkillsToCLAUDEmd(cwd, skills) {
  if (!skills.length) return;
  let md = await readClaudeMd(cwd);
  const marker = '## Installed Skills';
  const skillsBlock = `${marker}\n\n${skills.map(s =>
    `- **${s.name}**: ${s.description || s.folder}`
  ).join('\n')}\n`;

  if (md.includes(marker)) {
    // Replace existing skills section (up to next ## or end of file)
    md = md.replace(new RegExp(`${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=\\n## |$)`), skillsBlock);
  } else {
    md = md.trimEnd() + '\n\n' + skillsBlock;
  }
  await writeClaudeMd(cwd, md);
}

const app = express();
const server = createServer(app);
const PORT = 8765;

app.use(express.json());
app.use(requestLogger);
app.use(express.static(join(__dirname, '..', 'public')));

// ── REST API ──

app.get('/api/sessions', (req, res) => {
  res.json(listSessions());
});

app.post('/api/sessions', validate(createSessionSchema), asyncHandler(async (req, res) => {
  const { name, cwd, templateId } = req.body;
  const session = createSession({ name, cwd });

    // Auto-create agent config on disk
    await ensureAgentDir(session.id);
    await createAgentConfig(session.id, name);

    // Apply template if provided
    let template = null;
    if (templateId) {
      template = await getTemplate(templateId);
      if (template) {
        // Write identity/purpose to CLAUDE.md, constraints to AGENTS.md
        const identityContent = template.identity || template.purpose || '';
        if (identityContent && cwd) {
          await writeClaudeMd(cwd, identityContent);
        }
        if (template.constraints && cwd) {
          await writeAgentsMd(cwd, template.constraints);
        }
        // Save skills/tools to agent config (normalize SkillEntry[] to string[])
        const configUpdate = {};
        if (template.skills?.length) {
          configUpdate.skills = template.skills.map(s => typeof s === 'string' ? s : s.name);
        }
        if (template.tools?.length) configUpdate.tools = template.tools;
        if (Object.keys(configUpdate).length) {
          await saveAgentConfig(session.id, configUpdate);
        }
        // Resolve connector permissions into settings.local.json
        if (template.connectors?.length && cwd) {
          const mcpTools = resolveConnectorPermissions(template.connectors);
          if (mcpTools.length) {
            const settingsDir = join(cwd, '.claude');
            const settingsPath = join(settingsDir, 'settings.local.json');
            let settings = {};
            try {
              settings = JSON.parse(await readFile(settingsPath, 'utf8'));
            } catch {}
            if (!settings.permissions) settings.permissions = {};
            const existing = settings.permissions.allow || [];
            const merged = [...new Set([...existing, ...mcpTools])];
            settings.permissions.allow = merged;
            mkdirSync(settingsDir, { recursive: true });
            writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
          }
        }
      }
    }

    // Ensure full agent scaffolding (CLAUDE.md, AGENTS.md, memory, audit, knowledge)
    if (cwd) await ensureAgentScaffolding(cwd, name);

    // Log session start to audit trail
    if (cwd) await appendAuditEntry(cwd, { sessionId: session.id, event: 'session_start', detail: { name } });

    // Attach state detector
    const detector = createStateDetector((newState) => {
      const s = getSession(session.id);
      if (s) {
        s.status = newState;
        for (const listener of s.listeners) {
          listener({ type: 'state', state: newState });
        }
      }
    }, (filePath) => {
      const s = getSession(session.id);
      if (s) {
        for (const listener of s.listeners) {
          listener({ type: 'file', path: filePath });
        }
        // Auto-track file in agent config
        addAgentFile(session.id, filePath);
        // Audit trail
        if (s.cwd) appendAuditEntry(s.cwd, { sessionId: session.id, event: 'file_write', detail: { path: filePath } });
      }
    }, async () => {
      // onSkillsChanged — scan skills dir, broadcast, update CLAUDE.md
      const s = getSession(session.id);
      if (!s?.cwd) return;
      const skillsDir = join(s.cwd, '.claude', 'skills');
      try {
        const entries = await readdir(skillsDir, { withFileTypes: true });
        const skills = [];
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const skillPath = join(skillsDir, entry.name, 'SKILL.md');
          try {
            const content = await readFile(skillPath, 'utf8');
            let name = entry.name;
            let description = '';
            const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (fmMatch) {
              const nameMatch = fmMatch[1].match(/^name:\s*(.+)$/m);
              const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m);
              if (nameMatch) name = nameMatch[1].trim();
              if (descMatch) description = descMatch[1].trim();
            }
            skills.push({ folder: entry.name, name, description });
          } catch {}
        }
        // Broadcast skills-changed to all listeners
        for (const listener of s.listeners) {
          listener({ type: 'skills-changed', skills });
        }
        // Update CLAUDE.md with skills references
        await syncSkillsToCLAUDEmd(s.cwd, skills);
        // Audit trail for skill changes
        for (const skill of skills) {
          appendAuditEntry(s.cwd, { sessionId: session.id, event: 'skill_install', detail: { skill: skill.name } });
        }
      } catch {}
    });

    const s = getSession(session.id);
    s._detector = detector;
    s.pty.onData((data) => {
      detector.processOutput(data);
    });

    res.status(201).json(session);
}));

app.get('/api/sessions/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) throw notFound('session not found');
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
  if (!session) throw notFound('session not found');
  if (session._detector) session._detector.destroy();
  // Historical sessions have no pty — just remove from map and disk
  if (session.status === 'historical') {
    removeSessionFromMetadata(req.params.id);
    // Remove from in-memory map via killSession (handles missing pty gracefully)
  }
  const ok = killSession(req.params.id);
  if (!ok) return res.status(404).json({ error: 'session not found' });
  // Also remove from persisted sessions.json (full delete, not just mark ended)
  removeSessionFromMetadata(req.params.id);
  res.json({ ok: true });
});

app.get('/api/autocomplete', async (req, res) => {
  const { path } = req.query;
  if (!path) return res.json([]);
  const suggestions = await getDirectorySuggestions(path);
  res.json(suggestions);
});

// ── File drop upload ──
const dropDir = join(tmpdir(), 'vibe-terminal-drops');
mkdirSync(dropDir, { recursive: true });
const upload = multer({ dest: dropDir, limits: { fileSize: MAX_DROP_FILE_SIZE } });

app.post('/api/drop', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const dest = join(dropDir, req.file.originalname);
  try { renameSync(req.file.path, dest); } catch {}
  res.json({ path: existsSync(dest) ? dest : req.file.path });
});

// Compile Swift browse helper (one-time, cached)
const helperSrc = join(__dirname, 'browse-helper.swift');
const helperBin = join(__dirname, 'browse-helper');

function ensureBrowseHelper() {
  const needsCompile = !existsSync(helperBin) ||
    statSync(helperSrc).mtimeMs > statSync(helperBin).mtimeMs;
  if (needsCompile) {
    logger.info('Compiling browse helper');
    execFileSync('swiftc', [helperSrc, '-o', helperBin, '-framework', 'AppKit']);
    logger.info('Browse helper ready');
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

// ── Open file / Reveal in Finder ──
app.post('/api/open', validate(openSchema), (req, res) => {
  const { path: rawPath, action } = req.body;
  const safePath = resolve(rawPath);
  if (!existsSync(safePath)) throw notFound('path does not exist');
  if (action === 'folder') {
    spawn('open', ['-R', safePath]);
  } else {
    spawn('open', [safePath]);
  }
  res.json({ ok: true });
});

// ── Agent Config API ──

app.get('/api/agents/:id', async (req, res) => {
  let config = await getAgentConfig(req.params.id);
  if (!config) {
    // Auto-create for existing sessions that predate agent configs
    const session = getSession(req.params.id);
    await ensureAgentDir(req.params.id);
    config = await createAgentConfig(req.params.id, session?.name || req.params.id);
  }
  const session = getSession(req.params.id) || {};
  // Ensure standard sections exist in CLAUDE.md
  if (session.cwd) await ensureAgentScaffolding(session.cwd, config?.name);
  const purpose = session.cwd ? await readClaudeMd(session.cwd) : '';
  res.json({ config, purpose });
});

app.put('/api/agents/:id', validate(updateAgentSchema), asyncHandler(async (req, res) => {
  const updated = await saveAgentConfig(req.params.id, req.body);
  if (!updated) throw notFound('agent not found');
  res.json(updated);
}));

app.get('/api/agents/:id/purpose', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session?.cwd) return res.json({ content: '' });
  const content = await readClaudeMd(session.cwd);
  res.json({ content });
});

app.put('/api/agents/:id/purpose', validate(purposeSchema), asyncHandler(async (req, res) => {
  const session = getSession(req.params.id);
  if (!session?.cwd) throw notFound('session not found');
  const { content } = req.body;
  await writeClaudeMd(session.cwd, content || '');
  res.json({ ok: true });
}));

// ── Skills (read from {cwd}/.claude/skills/) ──

app.get('/api/agents/:id/skills', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session?.cwd) return res.json([]);
  const skillsDir = join(session.cwd, '.claude', 'skills');
  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    const skills = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = join(skillsDir, entry.name, 'SKILL.md');
      try {
        const content = await readFile(skillPath, 'utf8');
        // Parse YAML frontmatter
        let name = entry.name;
        let description = '';
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (fmMatch) {
          const nameMatch = fmMatch[1].match(/^name:\s*(.+)$/m);
          const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m);
          if (nameMatch) name = nameMatch[1].trim();
          if (descMatch) description = descMatch[1].trim();
        }
        skills.push({ folder: entry.name, name, description, path: skillPath });
      } catch { /* no SKILL.md, skip */ }
    }
    res.json(skills);
  } catch {
    res.json([]);
  }
});

app.get('/api/agents/:id/skills/:folder', asyncHandler(async (req, res) => {
  const session = getSession(req.params.id);
  if (!session?.cwd) throw notFound('session not found');
  const folder = sanitizePathParam(req.params.folder);
  if (!folder || folder.includes('/')) throw badRequest('Invalid skill folder name');
  const skillsBase = join(session.cwd, '.claude', 'skills');
  const skillPath = assertPathWithin(join(skillsBase, folder, 'SKILL.md'), skillsBase);
  const content = await readFile(skillPath, 'utf8').catch(() => null);
  if (content === null) throw notFound('skill not found');
  res.json({ content });
}));

app.put('/api/agents/:id/skills/:folder', asyncHandler(async (req, res) => {
  const session = getSession(req.params.id);
  if (!session?.cwd) throw notFound('session not found');
  const folder = sanitizePathParam(req.params.folder);
  if (!folder || folder.includes('/')) throw badRequest('Invalid skill folder name');
  const skillsBase = join(session.cwd, '.claude', 'skills');
  const skillDir = assertPathWithin(join(skillsBase, folder), skillsBase);
  mkdirSync(skillDir, { recursive: true });
  const skillPath = join(skillDir, 'SKILL.md');
  await writeFile(skillPath, req.body.content || '');
  // Re-scan all skills and update CLAUDE.md
  try {
    const skillsDir = join(session.cwd, '.claude', 'skills');
    const entries = await readdir(skillsDir, { withFileTypes: true });
    const skills = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const sp = join(skillsDir, entry.name, 'SKILL.md');
      try {
        const c = await readFile(sp, 'utf8');
        let name = entry.name, description = '';
        const fm = c.match(/^---\n([\s\S]*?)\n---/);
        if (fm) {
          const nm = fm[1].match(/^name:\s*(.+)$/m);
          const dm = fm[1].match(/^description:\s*(.+)$/m);
          if (nm) name = nm[1].trim();
          if (dm) description = dm[1].trim();
        }
        skills.push({ folder: entry.name, name, description });
      } catch {}
    }
    await syncSkillsToCLAUDEmd(session.cwd, skills);
  } catch {}
  res.json({ ok: true });
}));

app.post('/api/agents/:id/files', validate(fileTrackSchema), asyncHandler(async (req, res) => {
  const { path } = req.body;
  await addAgentFile(req.params.id, path);
  res.status(201).json({ ok: true });
}));

app.delete('/api/agents/:id/files', validate(fileTrackSchema), asyncHandler(async (req, res) => {
  const { path } = req.body;
  await removeAgentFile(req.params.id, path);
  res.json({ ok: true });
}));

app.get('/api/agents/:id/knowledge', async (req, res) => {
  const files = await listAgentKnowledge(req.params.id);
  res.json(files);
});

const kbUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = getAgentDir(req.params.id) + '/knowledge';
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, file.originalname),
  }),
  limits: { fileSize: MAX_KB_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_KB_TYPES.has(file.mimetype)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

app.post('/api/agents/:id/knowledge', kbUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('no file');
  // Audit trail
  const session = getSession(req.params.id);
  if (session?.cwd) await appendAuditEntry(session.cwd, { sessionId: req.params.id, event: 'knowledge_upload', detail: { filename: req.file.originalname } });
  res.status(201).json({ name: req.file.originalname, size: req.file.size, path: req.file.path });
}));

app.delete('/api/agents/:id/knowledge/:filename', asyncHandler(async (req, res) => {
  const filename = sanitizePathParam(req.params.filename);
  if (!filename || filename.includes('/')) throw badRequest('Invalid filename');
  await deleteAgentKnowledge(req.params.id, filename);
  // Audit trail
  const session = getSession(req.params.id);
  if (session?.cwd) await appendAuditEntry(session.cwd, { sessionId: req.params.id, event: 'knowledge_delete', detail: { filename } });
  res.json({ ok: true });
}));

// ── Memory & Audit API ──

app.get('/api/agents/:id/memory', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session?.cwd) return res.json([]);
  const entries = await readMemory(session.cwd);
  res.json(entries);
});

app.get('/api/agents/:id/audit', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session?.cwd) return res.json([]);
  const entries = await readAudit(session.cwd);
  res.json(entries);
});

// ── AGENTS.md API ──

app.get('/api/agents/:id/agents-md', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session?.cwd) return res.json({ content: '' });
  const content = await readAgentsMd(session.cwd);
  res.json({ content });
});

app.put('/api/agents/:id/agents-md', validate(agentsMdSchema), asyncHandler(async (req, res) => {
  const session = getSession(req.params.id);
  if (!session?.cwd) throw notFound('session not found');
  const { content } = req.body;
  await writeAgentsMd(session.cwd, content || '');
  res.json({ ok: true });
}));

// ── Import agent from directory ──

app.get('/api/import-agent', asyncHandler(async (req, res) => {
  const dir = req.query.path;
  if (!dir) throw badRequest('path is required');

  const resolved = resolve(dir.replace(/^~/, homedir()));
  // Validate path is a directory within home
  assertPathWithin(resolved, homedir());
  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
    throw notFound('directory does not exist');
  }
  const result = { name: '', purpose: '', skills: [], defaultCwd: resolved };

  // Derive name from directory basename
  result.name = resolved.split('/').filter(Boolean).pop() || 'Untitled';

  // Read CLAUDE.md for purpose
  try {
    result.purpose = await readFile(join(resolved, 'CLAUDE.md'), 'utf8');
    // Try to extract name from first heading
    const heading = result.purpose.match(/^#\s+(.+)$/m);
    if (heading) result.name = heading[1].trim();
  } catch {}

  // Scan .claude/skills/ for skill names
  try {
    const skillsDir = join(resolved, '.claude', 'skills');
    const entries = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = join(skillsDir, entry.name, 'SKILL.md');
      try {
        const content = await readFile(skillPath, 'utf8');
        let name = entry.name;
        const fm = content.match(/^---\n([\s\S]*?)\n---/);
        if (fm) {
          const nm = fm[1].match(/^name:\s*(.+)$/m);
          if (nm) name = nm[1].trim();
        }
        result.skills.push(name);
      } catch {}
    }
  } catch {}

  res.json(result);
}));

// ── Template API ──

app.get('/api/templates', async (req, res) => {
  res.json(await listTemplates());
});

app.post('/api/templates', validate(createTemplateSchema), asyncHandler(async (req, res) => {
  const template = await createTemplate(req.body);
  res.status(201).json(template);
}));

app.get('/api/templates/:id', asyncHandler(async (req, res) => {
  const template = await getTemplate(req.params.id);
  if (!template) throw notFound('template not found');
  res.json(template);
}));

app.put('/api/templates/:id', validate(updateTemplateSchema), asyncHandler(async (req, res) => {
  const updated = await updateTemplate(req.params.id, req.body);
  if (!updated) throw notFound('template not found');
  res.json(updated);
}));

app.delete('/api/templates/:id', asyncHandler(async (req, res) => {
  const ok = await deleteTemplate(req.params.id);
  if (!ok) throw notFound('template not found');
  res.json({ ok: true });
}));

// ── Connectors catalog ──

app.get('/api/connectors/catalog', (req, res) => {
  res.json(CONNECTOR_CATALOG);
});

app.post('/api/connectors/sync', validate(connectorSyncSchema), asyncHandler(async (req, res) => {
  const { tools } = req.body;
  const catalog = parseMcpTools(tools);
  setCatalog(catalog);
  await writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2));
  const actionCount = Object.values(catalog).reduce((sum, c) => sum + c.actions.length, 0);
  res.json({ connectors: Object.keys(catalog).length, actions: actionCount, catalog });
}));

// ── Skills catalog endpoints ──

// GET /api/skills — Scan all template defaultCwd dirs for .claude/skills/
app.get('/api/skills', async (req, res) => {
  try {
    const allTemplates = await listTemplates();
    const seen = new Map(); // folder -> skill object (dedup by folder)
    for (const t of allTemplates) {
      if (!t.defaultCwd) continue;
      const resolved = t.defaultCwd.replace(/^~/, process.env.HOME);
      const skillsDir = join(resolved, '.claude', 'skills');
      try {
        const entries = await readdir(skillsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (seen.has(entry.name)) continue;
          const skillPath = join(skillsDir, entry.name, 'SKILL.md');
          try {
            const content = await readFile(skillPath, 'utf8');
            let name = entry.name;
            let description = '';
            const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (fmMatch) {
              const nameMatch = fmMatch[1].match(/^name:\s*(.+)$/m);
              const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m);
              if (nameMatch) name = nameMatch[1].trim();
              if (descMatch) description = descMatch[1].trim();
            }
            seen.set(entry.name, {
              folder: entry.name,
              name,
              description,
              path: skillPath,
              sourceAgent: t.name,
              sourceCwd: resolved,
            });
          } catch {}
        }
      } catch {}
    }
    res.json(Array.from(seen.values()));
  } catch {
    res.json([]);
  }
});

// GET /api/skills/external — Fetch Anthropic skills repo directory listing (cached 10 min)
let externalSkillsCache = null;
let externalSkillsCacheTime = 0;
const EXTERNAL_CACHE_TTL = 10 * 60 * 1000;

app.get('/api/skills/external', async (req, res) => {
  const now = Date.now();
  if (externalSkillsCache && (now - externalSkillsCacheTime) < EXTERNAL_CACHE_TTL) {
    return res.json(externalSkillsCache);
  }
  try {
    const response = await fetch('https://api.github.com/repos/anthropics/skills/contents/skills', {
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'vibe-terminal' },
    });
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    const items = await response.json();
    const skills = items
      .filter(item => item.type === 'dir')
      .map(item => ({
        name: item.name,
        repo: 'anthropics/skills',
        installCommand: `npx @anthropic-ai/claude-code-skill add anthropics/skills --skill ${item.name}`,
      }));
    externalSkillsCache = skills;
    externalSkillsCacheTime = now;
    res.json(skills);
  } catch {
    res.json(externalSkillsCache || []);
  }
});

// GET /api/skill-content — Read a SKILL.md file by path (must be within home directory)
app.get('/api/skill-content', asyncHandler(async (req, res) => {
  const filePath = req.query.path;
  if (!filePath) throw badRequest('path is required');
  // Security: path must be within user's home directory and be a SKILL.md file
  const safePath = assertPathWithin(resolve(filePath), homedir());
  if (!safePath.endsWith('/SKILL.md') && !safePath.endsWith('\\SKILL.md')) {
    throw forbidden('Only SKILL.md files can be read via this endpoint');
  }
  const content = await readFile(safePath, 'utf8').catch(() => '');
  res.json({ content });
}));

// PUT /api/skill-content — Write a SKILL.md file by path (must be within home directory)
app.put('/api/skill-content', validate(skillContentWriteSchema), asyncHandler(async (req, res) => {
  const { path: filePath, content } = req.body;
  // Security: path must be within user's home directory and be a SKILL.md file
  const safePath = assertPathWithin(resolve(filePath), homedir());
  if (!safePath.endsWith('/SKILL.md') && !safePath.endsWith('\\SKILL.md')) {
    throw forbidden('Only SKILL.md files can be written via this endpoint');
  }
  const dir = safePath.substring(0, safePath.lastIndexOf('/'));
  mkdirSync(dir, { recursive: true });
  await writeFile(safePath, content || '');
  res.json({ ok: true });
}));

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Centralized error handler (must be last middleware)
app.use(errorHandler);

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

  // Historical session: send scrollback then signal read-only
  if (!session.pty) {
    if (session.scrollback.length > 0) {
      ws.send(JSON.stringify({ type: 'scrollback', data: session.scrollback.join('') }));
    }
    ws.send(JSON.stringify({ type: 'historical' }));
    // Keep connection open but no streaming
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

// ── Start ──

const recovered = loadHistoricalSessions();
if (recovered > 0) logger.info('Restored previous sessions', { count: recovered });

server.listen(PORT, () => {
  logger.info('Vibe Terminal running', { url: `http://localhost:${PORT}` });
});
