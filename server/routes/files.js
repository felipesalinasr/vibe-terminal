import { Router } from 'express';
import { join, resolve } from 'path';
import { spawn, execFileSync } from 'child_process';
import { existsSync, statSync, mkdirSync, renameSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { readFile, readdir } from 'fs/promises';
import multer from 'multer';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { openSchema } from '../schemas.js';
import { badRequest, notFound } from '../errors.js';
import { assertPathWithin } from '../security.js';
import { MAX_DROP_FILE_SIZE } from '../security.js';
import { logger } from '../logger.js';

export function fileRoutes({ serverDir }) {
  const router = Router();

  // ── File drop upload ──
  const dropDir = join(tmpdir(), 'vibe-terminal-drops');
  mkdirSync(dropDir, { recursive: true });
  const upload = multer({ dest: dropDir, limits: { fileSize: MAX_DROP_FILE_SIZE } });

  router.post('/drop', upload.single('file'), (req, res) => {
    if (!req.file) throw badRequest('no file');
    const dest = join(dropDir, req.file.originalname);
    try { renameSync(req.file.path, dest); } catch { /* rename failed — fall back to temp path */ }
    res.json({ path: existsSync(dest) ? dest : req.file.path });
  });

  // ── Browse helper (macOS) ──
  const helperSrc = join(serverDir, 'browse-helper.swift');
  const helperBin = join(serverDir, 'browse-helper');

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

  router.get('/browse', (req, res) => {
    const proc = spawn(helperBin);
    let out = '';
    proc.stdout.on('data', d => out += d);
    proc.on('close', code => {
      res.json({ path: code === 0 ? out.trim() || null : null });
    });
  });

  // ── Open file / Reveal in Finder ──
  router.post('/open', validate(openSchema), (req, res) => {
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

  // ── Import agent from directory ──
  router.get('/import-agent', asyncHandler(async (req, res) => {
    const dir = req.query.path;
    if (!dir) throw badRequest('path is required');

    const resolved = resolve(dir.replace(/^~/, homedir()));
    assertPathWithin(resolved, homedir());
    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
      throw notFound('directory does not exist');
    }
    const result = { name: '', purpose: '', skills: [], defaultCwd: resolved };
    result.name = resolved.split('/').filter(Boolean).pop() || 'Untitled';

    try {
      result.purpose = await readFile(join(resolved, 'CLAUDE.md'), 'utf8');
      const heading = result.purpose.match(/^#\s+(.+)$/m);
      if (heading) result.name = heading[1].trim();
    } catch { /* no CLAUDE.md — use directory name */ }

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
        } catch { /* no SKILL.md — skip */ }
      }
    } catch { /* no skills dir — skip */ }

    res.json(result);
  }));

  return router;
}
