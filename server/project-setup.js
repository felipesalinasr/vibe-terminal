import { execFileSync } from 'child_process';
import { readdir, readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';

/**
 * Check if GitHub CLI is installed and authenticated.
 * @returns {{ available: boolean, username?: string }}
 */
export function checkGitHubCli() {
  try {
    const out = execFileSync('gh', ['auth', 'status'], {
      encoding: 'utf8',
      timeout: 10_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // gh auth status prints to stderr on success, stdout may be empty
    const match = out.match(/Logged in to .+ as (\S+)/);
    return { available: true, username: match?.[1] ?? undefined };
  } catch (err) {
    // gh auth status prints to stderr — check stderr too
    const stderr = err.stderr?.toString() ?? '';
    const match = stderr.match(/Logged in to .+ as (\S+)/);
    if (match) {
      return { available: true, username: match[1] };
    }
    return { available: false };
  }
}

/**
 * Detect tech stack from common manifest files.
 * @param {string} dirPath
 * @returns {Promise<{ lang: string, framework?: string, buildCmd?: string, devCmd?: string, testCmd?: string }>}
 */
export async function detectTechStack(dirPath) {
  // Try package.json (Node)
  try {
    const raw = await readFile(join(dirPath, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const scripts = pkg.scripts ?? {};

    let framework;
    if (deps['next']) framework = 'Next.js';
    else if (deps['nuxt']) framework = 'Nuxt';
    else if (deps['@remix-run/react']) framework = 'Remix';
    else if (deps['vite']) framework = 'Vite';
    else if (deps['react']) framework = 'React';
    else if (deps['vue']) framework = 'Vue';
    else if (deps['express']) framework = 'Express';

    return {
      lang: 'node',
      framework,
      buildCmd: scripts.build ? 'npm run build' : undefined,
      devCmd: scripts.dev ? 'npm run dev' : (scripts.start ? 'npm start' : undefined),
      testCmd: scripts.test ? 'npm test' : undefined,
    };
  } catch { /* not node */ }

  // Try pyproject.toml (Python)
  try {
    await stat(join(dirPath, 'pyproject.toml'));
    return { lang: 'python', buildCmd: undefined, devCmd: 'python -m app', testCmd: 'pytest' };
  } catch { /* not python */ }

  // Try go.mod (Go)
  try {
    await stat(join(dirPath, 'go.mod'));
    return { lang: 'go', buildCmd: 'go build ./...', devCmd: 'go run .', testCmd: 'go test ./...' };
  } catch { /* not go */ }

  // Try Cargo.toml (Rust)
  try {
    await stat(join(dirPath, 'Cargo.toml'));
    return { lang: 'rust', buildCmd: 'cargo build', devCmd: 'cargo run', testCmd: 'cargo test' };
  } catch { /* not rust */ }

  return { lang: 'unknown' };
}

/**
 * Ensure directory is a git repo. Initializes if needed.
 * @param {string} dirPath
 * @returns {boolean} true if git was just initialized
 */
export function ensureGitRepo(dirPath) {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd: dirPath, stdio: 'pipe' });
    return false; // already a git repo
  } catch {
    execFileSync('git', ['init'], { cwd: dirPath, stdio: 'pipe' });
    return true;
  }
}

/**
 * Write multi-agent scaffolding files (non-destructive — skips existing).
 * @param {string} dirPath
 * @param {{ name: string, description: string, techStack: object }} opts
 * @returns {Promise<string[]>} list of files written
 */
export async function scaffoldMultiAgent(dirPath, { name, description, techStack }) {
  const written = [];

  // Helper: write only if file doesn't exist
  async function writeIfMissing(relPath, content) {
    const fullPath = join(dirPath, relPath);
    try {
      await writeFile(fullPath, content, { flag: 'wx' });
      written.push(relPath);
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // File exists — skip
    }
  }

  // Build directory tree (top-level only)
  let tree = '';
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const filtered = entries
      .filter((e) => !e.name.startsWith('.') || e.name === '.github')
      .sort((a, b) => a.name.localeCompare(b.name));
    tree = filtered
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .join('\n');
  } catch { tree = '(unable to read directory)'; }

  // Detect install command
  const installCmd = techStack?.lang === 'node' ? 'npm install' :
    techStack?.lang === 'python' ? 'pip install -e .' :
    techStack?.lang === 'go' ? 'go mod download' :
    techStack?.lang === 'rust' ? 'cargo fetch' : '# (add install command)';

  // 1. .claude/CLAUDE.md
  await mkdir(join(dirPath, '.claude'), { recursive: true });
  const claudeMd = `# ${name}

${description || '(no description)'}

## Tech Stack
${techStack?.framework ? `${techStack.lang} / ${techStack.framework}` : techStack?.lang ?? 'unknown'}

## Build & Run
- Install: \`${installCmd}\`
- Dev: \`${techStack?.devCmd ?? '# (add dev command)'}\`
- Test: \`${techStack?.testCmd ?? '# (add test command)'}\`
- Build: \`${techStack?.buildCmd ?? '# (add build command)'}\`

## Directory Structure
\`\`\`
${tree}
\`\`\`

## Git Workflow
- Feature branches: \`feature/{description}\`, \`fix/{description}\`, \`chore/{description}\`
- Open PRs for all changes — never commit directly to main
- PRs are auto-reviewed by Claude via GitHub Actions

## How to Update This Document
When you discover new conventions, save them to memory first.
Suggest additions at end of session. Project owner reviews changes.
`;
  await writeIfMissing('.claude/CLAUDE.md', claudeMd);

  // 2. .gitignore — append lines if not present
  const gitignoreLines = ['.claude/worktrees/', '.env', '.env.local'];
  try {
    const existing = await readFile(join(dirPath, '.gitignore'), 'utf8');
    const toAdd = gitignoreLines.filter((line) => !existing.includes(line));
    if (toAdd.length > 0) {
      await writeFile(join(dirPath, '.gitignore'), existing.trimEnd() + '\n' + toAdd.join('\n') + '\n');
      written.push('.gitignore (appended)');
    }
  } catch {
    // No .gitignore — create one
    await writeIfMissing('.gitignore', gitignoreLines.join('\n') + '\n');
  }

  // 3. REVIEW.md
  const reviewMd = `# Code Review Standards

## PR Requirements
- Every PR must have a clear description of what changed and why
- All CI checks must pass before merge
- At least one approval required

## Review Checklist
- [ ] Code follows project conventions
- [ ] Tests cover new functionality
- [ ] No security vulnerabilities introduced
- [ ] Performance implications considered
- [ ] Documentation updated if needed

## Commit Messages
Use Conventional Commits: \`type(scope): description\`
- \`feat\`: new feature
- \`fix\`: bug fix
- \`chore\`: maintenance
- \`docs\`: documentation
- \`test\`: test changes
- \`refactor\`: code restructuring
`;
  await writeIfMissing('REVIEW.md', reviewMd);

  // 4. GitHub Actions workflows
  await mkdir(join(dirPath, '.github', 'workflows'), { recursive: true });

  // 4a. PR verify workflow
  const prVerifyYml = `name: PR Verify
on:
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build --if-present
      - run: npm test --if-present
`;
  await writeIfMissing('.github/workflows/pr-verify.yml', prVerifyYml);

  // 4b. Claude PR review
  const claudePrReviewYml = `name: Claude PR Review
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    if: github.event.pull_request.draft == false
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Claude Code Review
        uses: anthropics/claude-code-action@beta
        with:
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}
          review_comment: |
            Review this PR for:
            - Code quality and conventions
            - Potential bugs or security issues
            - Test coverage
            - Performance implications
`;
  await writeIfMissing('.github/workflows/claude-pr-review.yml', claudePrReviewYml);

  // 4c. Claude mention
  const claudeMentionYml = `name: Claude Mention
on:
  issue_comment:
    types: [created]

jobs:
  respond:
    if: contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Claude Response
        uses: anthropics/claude-code-action@beta
        with:
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}
          trigger_phrase: "@claude"
`;
  await writeIfMissing('.github/workflows/claude-mention.yml', claudeMentionYml);

  return written;
}

/**
 * Create a GitHub repo from an existing directory.
 * @param {string} dirPath
 * @param {{ name: string, description?: string, isPrivate?: boolean }} opts
 * @returns {{ repoUrl: string }}
 */
export function createGitHubRepo(dirPath, { name, description, isPrivate = true }) {
  const args = [
    'repo', 'create', name,
    isPrivate ? '--private' : '--public',
    '--source', '.',
    '--remote', 'origin',
    '--push',
  ];
  if (description) {
    args.push('--description', description);
  }

  const out = execFileSync('gh', args, {
    cwd: dirPath,
    encoding: 'utf8',
    timeout: 30_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // gh repo create outputs the repo URL
  const repoUrl = out.trim();
  return { repoUrl };
}

/**
 * Create an initial commit and push.
 * @param {string} dirPath
 * @returns {boolean}
 */
export function initialCommitAndPush(dirPath) {
  try {
    execFileSync('git', ['add', '.'], { cwd: dirPath, stdio: 'pipe' });

    // Check if there's anything to commit
    try {
      execFileSync('git', ['diff', '--cached', '--quiet'], { cwd: dirPath, stdio: 'pipe' });
      // No changes staged — nothing to commit
      return false;
    } catch {
      // Changes exist — commit them
    }

    execFileSync('git', ['commit', '-m', 'Initial project setup with multi-agent workflow'], {
      cwd: dirPath,
      stdio: 'pipe',
    });

    // Determine current branch
    const branch = execFileSync('git', ['branch', '--show-current'], {
      cwd: dirPath,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim() || 'main';

    execFileSync('git', ['push', '-u', 'origin', branch], {
      cwd: dirPath,
      stdio: 'pipe',
      timeout: 30_000,
    });

    return true;
  } catch {
    return false;
  }
}
