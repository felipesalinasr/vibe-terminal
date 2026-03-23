import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { createProjectSchema, updateProjectSchema, setupProjectSchema } from '../schemas.js';
import { notFound, badRequest } from '../errors.js';
import { listProjects, getProject, createProject, updateProject, deleteProject } from '../projects.js';
import {
  checkGitHubCli,
  detectTechStack,
  ensureGitRepo,
  scaffoldMultiAgent,
  createGitHubRepo,
  initialCommitAndPush,
} from '../project-setup.js';

export function projectRoutes() {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await listProjects());
  });

  router.post('/', validate(createProjectSchema), asyncHandler(async (req, res) => {
    const project = await createProject(req.body);
    res.status(201).json(project);
  }));

  router.get('/github-status', asyncHandler(async (req, res) => {
    res.json(checkGitHubCli());
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    const project = await getProject(req.params.id);
    if (!project) throw notFound('project not found');
    res.json(project);
  }));

  router.put('/:id', validate(updateProjectSchema), asyncHandler(async (req, res) => {
    const updated = await updateProject(req.params.id, req.body);
    if (!updated) throw notFound('project not found');
    res.json(updated);
  }));

  router.delete('/:id', asyncHandler(async (req, res) => {
    const ok = await deleteProject(req.params.id);
    if (!ok) throw notFound('project not found');
    res.json({ ok: true });
  }));

  router.post('/:id/setup', validate(setupProjectSchema), asyncHandler(async (req, res) => {
    const project = await getProject(req.params.id);
    if (!project) throw notFound('project not found');
    if (!project.path) throw badRequest('project has no path');

    const { createRepo, repoPrivate } = req.body;
    const result = { filesWritten: [], techStack: null, repoUrl: null, gitInitialized: false };

    // 1. Detect tech stack
    result.techStack = await detectTechStack(project.path);

    // 2. Ensure git repo
    result.gitInitialized = ensureGitRepo(project.path);

    // 3. Write scaffolding files
    result.filesWritten = await scaffoldMultiAgent(project.path, {
      name: project.name,
      description: project.description,
      techStack: result.techStack,
    });

    // 4. Create GitHub repo if requested
    if (createRepo) {
      const repo = createGitHubRepo(project.path, {
        name: project.name,
        description: project.description,
        isPrivate: repoPrivate,
      });
      result.repoUrl = repo.repoUrl;
    }

    // 5. Initial commit + push
    if (result.filesWritten.length > 0) {
      initialCommitAndPush(project.path);
    }

    // 6. Update project record with detected info
    await updateProject(project.id, {
      techStack: result.techStack,
      repoUrl: result.repoUrl,
    });

    res.json(result);
  }));

  return router;
}
