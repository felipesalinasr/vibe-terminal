import { join } from 'path';
import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { ensureMemoryDir, ensureAuditDir } from './agents.js';

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

const INDEX_YAML_TEMPLATE = `# Knowledge Index
# Auto-managed by Vibe Terminal. AI agents append entries when saving knowledge files.
files: []
`;

export async function readClaudeMd(cwd) {
  try {
    return await readFile(join(cwd, 'CLAUDE.md'), 'utf8');
  } catch {
    return '';
  }
}

export async function writeClaudeMd(cwd, content) {
  await writeFile(join(cwd, 'CLAUDE.md'), content);
}

export async function readAgentsMd(cwd) {
  try {
    return await readFile(join(cwd, 'AGENTS.md'), 'utf8');
  } catch {
    return '';
  }
}

export async function writeAgentsMd(cwd, content) {
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

export async function ensureAgentScaffolding(cwd, agentName) {
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
  await ensureAgentsMd(cwd);
  await ensureKnowledgeDir(cwd);
  await ensureMemoryDir(cwd);
  await ensureAuditDir(cwd);
}

export async function syncSkillsToCLAUDEmd(cwd, skills) {
  if (!skills.length) return;
  let md = await readClaudeMd(cwd);
  const marker = '## Installed Skills';
  const skillsBlock = `${marker}\n\n${skills.map(s =>
    `- **${s.name}**: ${s.description || s.folder}`
  ).join('\n')}\n`;

  if (md.includes(marker)) {
    md = md.replace(new RegExp(`${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=\\n## |$)`), skillsBlock);
  } else {
    md = md.trimEnd() + '\n\n' + skillsBlock;
  }
  await writeClaudeMd(cwd, md);
}

export async function scanSkillsDir(skillsDir) {
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
      skills.push({ folder: entry.name, name, description, path: skillPath });
    } catch { /* no SKILL.md, skip */ }
  }
  return skills;
}
