import { Router } from 'express';
import { join, resolve } from 'path';
import { mkdirSync } from 'fs';
import { readFile, writeFile, readdir } from 'fs/promises';
import { homedir } from 'os';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { skillContentWriteSchema } from '../schemas.js';
import { badRequest, forbidden, notFound } from '../errors.js';
import { assertPathWithin } from '../security.js';
import { listTemplates } from '../templates.js';
import { scanSkillsDir } from '../agent-helpers.js';

export function skillRoutes() {
  const router = Router();

  // GET /skills — Scan all template defaultCwd dirs for .claude/skills/
  router.get('/', async (req, res) => {
    try {
      const allTemplates = await listTemplates();
      const seen = new Map();
      for (const t of allTemplates) {
        if (!t.defaultCwd) continue;
        const resolved = t.defaultCwd.replace(/^~/, process.env.HOME);
        const skillsDir = join(resolved, '.claude', 'skills');
        try {
          const skills = await scanSkillsDir(skillsDir);
          for (const skill of skills) {
            if (!seen.has(skill.folder)) {
              seen.set(skill.folder, { ...skill, sourceAgent: t.name, sourceCwd: resolved });
            }
          }
        } catch { /* skills dir may not exist for this template */ }
      }
      res.json(Array.from(seen.values()));
    } catch { /* no templates or scan failure — return empty */
      res.json([]);
    }
  });

  // GET /skills/external — Fetch Anthropic skills repo listing (cached 10 min)
  let externalSkillsCache = null;
  let externalSkillsCacheTime = 0;
  const EXTERNAL_CACHE_TTL = 10 * 60 * 1000;

  router.get('/external', async (req, res) => {
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
    } catch { /* GitHub API unavailable — serve cache or empty */
      res.json(externalSkillsCache || []);
    }
  });

  // GET /skill-content — Read a SKILL.md file by path
  router.get('/skill-content', asyncHandler(async (req, res) => {
    const filePath = req.query.path;
    if (!filePath) throw badRequest('path is required');
    const safePath = assertPathWithin(resolve(filePath), homedir());
    if (!safePath.endsWith('/SKILL.md') && !safePath.endsWith('\\SKILL.md')) {
      throw forbidden('Only SKILL.md files can be read via this endpoint');
    }
    const content = await readFile(safePath, 'utf8').catch(() => '');
    res.json({ content });
  }));

  // PUT /skill-content — Write a SKILL.md file by path
  router.put('/skill-content', validate(skillContentWriteSchema), asyncHandler(async (req, res) => {
    const { path: filePath, content } = req.body;
    const safePath = assertPathWithin(resolve(filePath), homedir());
    if (!safePath.endsWith('/SKILL.md') && !safePath.endsWith('\\SKILL.md')) {
      throw forbidden('Only SKILL.md files can be written via this endpoint');
    }
    const dir = safePath.substring(0, safePath.lastIndexOf('/'));
    mkdirSync(dir, { recursive: true });
    await writeFile(safePath, content || '');
    res.json({ ok: true });
  }));

  return router;
}
