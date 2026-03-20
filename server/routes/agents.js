import { Router } from 'express';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { readFile, writeFile, readdir } from 'fs/promises';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { updateAgentSchema, purposeSchema, agentsMdSchema, fileTrackSchema, skillWriteSchema } from '../schemas.js';
import { notFound, badRequest } from '../errors.js';
import { sanitizePathParam, assertPathWithin, ALLOWED_KB_TYPES, MAX_KB_FILE_SIZE } from '../security.js';
import { getSession } from '../sessions.js';
import { ensureAgentDir, createAgentConfig, getAgentConfig, saveAgentConfig, addAgentFile, removeAgentFile, listAgentKnowledge, deleteAgentKnowledge, getAgentDir, appendAuditEntry, readMemory, readAudit } from '../agents.js';
import { ensureAgentScaffolding, readClaudeMd, writeClaudeMd, readAgentsMd, writeAgentsMd, syncSkillsToCLAUDEmd, scanSkillsDir } from '../agent-helpers.js';
import multer from 'multer';

export function agentRoutes() {
  const router = Router();

  // ── Agent config ──
  router.get('/:id', async (req, res) => {
    let config = await getAgentConfig(req.params.id);
    if (!config) {
      const session = getSession(req.params.id);
      await ensureAgentDir(req.params.id);
      config = await createAgentConfig(req.params.id, session?.name || req.params.id);
    }
    const session = getSession(req.params.id) || {};
    if (session.cwd) await ensureAgentScaffolding(session.cwd, config?.name);
    const purpose = session.cwd ? await readClaudeMd(session.cwd) : '';
    res.json({ config, purpose });
  });

  router.put('/:id', validate(updateAgentSchema), asyncHandler(async (req, res) => {
    const updated = await saveAgentConfig(req.params.id, req.body);
    if (!updated) throw notFound('agent not found');
    res.json(updated);
  }));

  // ── Purpose (CLAUDE.md) ──
  router.get('/:id/purpose', async (req, res) => {
    const session = getSession(req.params.id);
    if (!session?.cwd) return res.json({ content: '' });
    const content = await readClaudeMd(session.cwd);
    res.json({ content });
  });

  router.put('/:id/purpose', validate(purposeSchema), asyncHandler(async (req, res) => {
    const session = getSession(req.params.id);
    if (!session?.cwd) throw notFound('session not found');
    await writeClaudeMd(session.cwd, req.body.content || '');
    res.json({ ok: true });
  }));

  // ── AGENTS.md ──
  router.get('/:id/agents-md', async (req, res) => {
    const session = getSession(req.params.id);
    if (!session?.cwd) return res.json({ content: '' });
    const content = await readAgentsMd(session.cwd);
    res.json({ content });
  });

  router.put('/:id/agents-md', validate(agentsMdSchema), asyncHandler(async (req, res) => {
    const session = getSession(req.params.id);
    if (!session?.cwd) throw notFound('session not found');
    await writeAgentsMd(session.cwd, req.body.content || '');
    res.json({ ok: true });
  }));

  // ── Skills (per-agent) ──
  router.get('/:id/skills', async (req, res) => {
    const session = getSession(req.params.id);
    if (!session?.cwd) return res.json([]);
    const skillsDir = join(session.cwd, '.claude', 'skills');
    try {
      const skills = await scanSkillsDir(skillsDir);
      res.json(skills);
    } catch { /* skills dir may not exist — return empty */
      res.json([]);
    }
  });

  router.get('/:id/skills/:folder', asyncHandler(async (req, res) => {
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

  router.put('/:id/skills/:folder', validate(skillWriteSchema), asyncHandler(async (req, res) => {
    const session = getSession(req.params.id);
    if (!session?.cwd) throw notFound('session not found');
    const folder = sanitizePathParam(req.params.folder);
    if (!folder || folder.includes('/')) throw badRequest('Invalid skill folder name');
    const skillsBase = join(session.cwd, '.claude', 'skills');
    const skillDir = assertPathWithin(join(skillsBase, folder), skillsBase);
    mkdirSync(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), req.body.content || '');
    // Re-scan and sync to CLAUDE.md
    try {
      const skills = await scanSkillsDir(join(session.cwd, '.claude', 'skills'));
      await syncSkillsToCLAUDEmd(session.cwd, skills);
    } catch { /* best-effort sync — don't fail the write */ }
    res.json({ ok: true });
  }));

  // ── Files ──
  router.post('/:id/files', validate(fileTrackSchema), asyncHandler(async (req, res) => {
    await addAgentFile(req.params.id, req.body.path);
    res.status(201).json({ ok: true });
  }));

  router.delete('/:id/files', validate(fileTrackSchema), asyncHandler(async (req, res) => {
    await removeAgentFile(req.params.id, req.body.path);
    res.json({ ok: true });
  }));

  // ── Knowledge ──
  router.get('/:id/knowledge', async (req, res) => {
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

  router.post('/:id/knowledge', kbUpload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('no file');
    const session = getSession(req.params.id);
    if (session?.cwd) await appendAuditEntry(session.cwd, { sessionId: req.params.id, event: 'knowledge_upload', detail: { filename: req.file.originalname } });
    res.status(201).json({ name: req.file.originalname, size: req.file.size, path: req.file.path });
  }));

  router.delete('/:id/knowledge/:filename', asyncHandler(async (req, res) => {
    const filename = sanitizePathParam(req.params.filename);
    if (!filename || filename.includes('/')) throw badRequest('Invalid filename');
    await deleteAgentKnowledge(req.params.id, filename);
    const session = getSession(req.params.id);
    if (session?.cwd) await appendAuditEntry(session.cwd, { sessionId: req.params.id, event: 'knowledge_delete', detail: { filename } });
    res.json({ ok: true });
  }));

  // ── Memory & Audit ──
  router.get('/:id/memory', async (req, res) => {
    const session = getSession(req.params.id);
    if (!session?.cwd) return res.json([]);
    res.json(await readMemory(session.cwd));
  });

  router.get('/:id/audit', async (req, res) => {
    const session = getSession(req.params.id);
    if (!session?.cwd) return res.json([]);
    res.json(await readAudit(session.cwd));
  });

  return router;
}
