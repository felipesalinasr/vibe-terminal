import { Router } from 'express';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { readFile, readdir } from 'fs/promises';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { createSessionSchema } from '../schemas.js';
import { notFound } from '../errors.js';
import { createSession, getSession, listSessions, killSession } from '../sessions.js';
import { removeSessionFromMetadata } from '../session-store.js';
import { createStateDetector } from '../state-detector.js';
import { getDirectorySuggestions } from '../autocomplete.js';
import { ensureAgentDir, createAgentConfig, saveAgentConfig, addAgentFile, appendAuditEntry } from '../agents.js';
import { ensureAgentScaffolding, writeClaudeMd, writeAgentsMd, syncSkillsToCLAUDEmd } from '../agent-helpers.js';
import { getTemplate } from '../templates.js';
import { resolveConnectorPermissions } from '../connectors.js';

export function sessionRoutes() {
  const router = Router();

  router.get('/sessions', (req, res) => {
    res.json(listSessions());
  });

  router.post('/sessions', validate(createSessionSchema), asyncHandler(async (req, res) => {
    const { name, cwd, templateId } = req.body;
    const session = createSession({ name, cwd });

    await ensureAgentDir(session.id);
    await createAgentConfig(session.id, name);

    // Apply template if provided
    if (templateId) {
      const template = await getTemplate(templateId);
      if (template) {
        const identityContent = template.identity || template.purpose || '';
        if (identityContent && cwd) await writeClaudeMd(cwd, identityContent);
        if (template.constraints && cwd) await writeAgentsMd(cwd, template.constraints);

        const configUpdate = {};
        if (template.skills?.length) {
          configUpdate.skills = template.skills.map(s => typeof s === 'string' ? s : s.name);
        }
        if (template.tools?.length) configUpdate.tools = template.tools;
        if (Object.keys(configUpdate).length) await saveAgentConfig(session.id, configUpdate);

        if (template.connectors?.length && cwd) {
          const mcpTools = resolveConnectorPermissions(template.connectors);
          if (mcpTools.length) {
            const settingsDir = join(cwd, '.claude');
            const settingsPath = join(settingsDir, 'settings.local.json');
            let settings = {};
            try { settings = JSON.parse(await readFile(settingsPath, 'utf8')); } catch { /* no existing settings — start fresh */ }
            if (!settings.permissions) settings.permissions = {};
            const existing = settings.permissions.allow || [];
            settings.permissions.allow = [...new Set([...existing, ...mcpTools])];
            mkdirSync(settingsDir, { recursive: true });
            writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
          }
        }
      }
    }

    if (cwd) await ensureAgentScaffolding(cwd, name);
    if (cwd) await appendAuditEntry(cwd, { sessionId: session.id, event: 'session_start', detail: { name } });

    // Attach state detector
    const detector = createStateDetector((newState) => {
      const s = getSession(session.id);
      if (s) {
        s.status = newState;
        for (const listener of s.listeners) listener({ type: 'state', state: newState });
      }
    }, (filePath) => {
      const s = getSession(session.id);
      if (s) {
        for (const listener of s.listeners) listener({ type: 'file', path: filePath });
        addAgentFile(session.id, filePath);
        if (s.cwd) appendAuditEntry(s.cwd, { sessionId: session.id, event: 'file_write', detail: { path: filePath } });
      }
    }, async () => {
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
          } catch { /* no SKILL.md in folder — skip */ }
        }
        for (const listener of s.listeners) listener({ type: 'skills-changed', skills });
        await syncSkillsToCLAUDEmd(s.cwd, skills);
        for (const skill of skills) {
          appendAuditEntry(s.cwd, { sessionId: session.id, event: 'skill_install', detail: { skill: skill.name } });
        }
      } catch { /* skills dir may not exist yet */ }
    });

    const s = getSession(session.id);
    s._detector = detector;
    s.pty.onData((data) => detector.processOutput(data));

    res.status(201).json(session);
  }));

  router.get('/sessions/:id', (req, res) => {
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

  // HTTP fallback for scrollback data (used when WebSocket reconnects or is unavailable)
  router.get('/sessions/:id/scrollback', (req, res) => {
    const session = getSession(req.params.id);
    if (!session) throw notFound('session not found');
    const offset = parseInt(req.query.offset) || 0;
    const data = session.scrollback.slice(offset).join('');
    res.json({ data, offset, total: session.scrollback.length });
  });

  router.delete('/sessions/:id', (req, res) => {
    const session = getSession(req.params.id);
    if (!session) throw notFound('session not found');
    if (session._detector) session._detector.destroy();
    if (session.status === 'historical') removeSessionFromMetadata(req.params.id);
    const ok = killSession(req.params.id);
    if (!ok) return res.status(404).json({ error: 'session not found' });
    removeSessionFromMetadata(req.params.id);
    res.json({ ok: true });
  });

  router.get('/autocomplete', async (req, res) => {
    const { path } = req.query;
    if (!path) return res.json([]);
    const suggestions = await getDirectorySuggestions(path);
    res.json(suggestions);
  });

  return router;
}
