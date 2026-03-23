# Vibe Terminal

A kanban-style control plane for managing AI agents. Launch, monitor, and configure Claude Code and Codex sessions from a single dashboard.

## Overview

Vibe Terminal provides a visual interface for running multiple agents simultaneously. Each agent gets its own terminal session, configuration panel, and structured file organization.

### Key Features

- **Kanban Board** — Drag-and-drop cards across Backlog, In Progress, Review, and Done columns
- **Live Terminal** — Full xterm.js terminal with WebSocket streaming per agent
- **Agent Templates** — Reusable configurations with identity, constraints, skills, and MCP connectors
- **Structured Agent Files** — Progressive disclosure via CLAUDE.md (identity) + AGENTS.md (constraints)
- **Skills Management** — Install, browse, and edit Claude Code skills per agent
- **MCP Connectors** — Configure Apollo, Gmail, Slack, Google Calendar, Ahrefs, and more
- **Knowledge Base** — Per-agent knowledge directory with YAML index
- **Memory & Audit** — JSONL-based persistent memory and server-managed audit trail
- **Session History** — Browse and restart previous sessions

## Architecture

### Agent File Organization

Each agent working directory follows a canonical layout:

```
{agent-cwd}/
  CLAUDE.md                       # Identity (~50-80 lines) — who the agent is
  AGENTS.md                       # Operational constraints — how the agent operates
  .claude/
    skills/{folder}/SKILL.md      # Modular skills
    settings.local.json           # MCP permissions
  knowledge/
    _index.yaml                   # File registry with metadata tags
    {topic}.md                    # Domain reference docs
  memory/
    memory.jsonl                  # Structured persistent memory
  audit/
    audit.jsonl                   # Server-managed action trail
```

**CLAUDE.md** (loaded every context window) contains only:
- Role description
- Scope of authority (MUST / MUST NOT)
- Communication style
- File organization pointers
- Installed skills list
- Self-maintenance rules

**AGENTS.md** (loaded on-demand) contains:
- Domain-specific messaging rules
- Operational modes
- Standard output structure templates
- Execution workflows and checklists
- Safety guardrails
- Performance rules and definition of done

**memory/memory.jsonl** — Append-only structured memory:
```jsonc
{"ts":"2026-03-19T14:30:00Z","type":"convention","content":"Always use Apollo for enrichment before Clay","tags":["tools"],"source":"user"}
```
Types: `convention` | `correction` | `decision` | `observation` | `preference`

**audit/audit.jsonl** — Server-managed action trail:
```jsonc
{"ts":"2026-03-19T14:30:00Z","sessionId":"sess-abc123","event":"session_start","detail":{"name":"SDR Agent"}}
```
Events: `session_start` | `file_write` | `skill_install` | `knowledge_upload` | `knowledge_delete`

### Server Stack

| Component | File | Purpose |
|-----------|------|---------|
| HTTP + WebSocket | `server/index.js` | Express app, REST API, WS streaming |
| Agent Config | `server/agents.js` | Agent CRUD, knowledge, memory, audit |
| Sessions | `server/sessions.js` | PTY lifecycle, output buffering |
| Session Store | `server/session-store.js` | Session persistence across restarts |
| State Detector | `server/state-detector.js` | Shell state parsing, file/skill change events |
| Templates | `server/templates.js` | Template CRUD with identity/constraints |
| Connectors | `server/connectors.js` | MCP connector catalog and permissions |

### REST API

#### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/sessions` | List all sessions |
| `POST` | `/api/sessions` | Create session (scaffolds CLAUDE.md, AGENTS.md, memory/, audit/) |
| `GET` | `/api/sessions/:id` | Get session details |
| `DELETE` | `/api/sessions/:id` | Kill and remove session |

#### Agents
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/agents/:id` | Get agent config + CLAUDE.md content |
| `PUT` | `/api/agents/:id` | Update agent config |
| `GET` | `/api/agents/:id/purpose` | Read CLAUDE.md (identity) |
| `PUT` | `/api/agents/:id/purpose` | Write CLAUDE.md |
| `GET` | `/api/agents/:id/agents-md` | Read AGENTS.md (constraints) |
| `PUT` | `/api/agents/:id/agents-md` | Write AGENTS.md |
| `GET` | `/api/agents/:id/memory` | Read memory.jsonl entries |
| `GET` | `/api/agents/:id/audit` | Read audit.jsonl entries |
| `GET` | `/api/agents/:id/skills` | List installed skills |
| `PUT` | `/api/agents/:id/skills/:folder` | Write skill + sync to CLAUDE.md |
| `GET` | `/api/agents/:id/knowledge` | List knowledge files |
| `POST` | `/api/agents/:id/knowledge` | Upload knowledge file |
| `DELETE` | `/api/agents/:id/knowledge/:filename` | Delete knowledge file |

#### Templates
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/templates` | List all templates |
| `POST` | `/api/templates` | Create template (supports identity + constraints) |
| `GET` | `/api/templates/:id` | Get template |
| `PUT` | `/api/templates/:id` | Update template |
| `DELETE` | `/api/templates/:id` | Delete template |

## Setup

```bash
npm install
node server/index.js
# → http://localhost:8765
```

Requires Node.js 18+ and macOS (uses native file picker via Swift helper).

## Template Schema

Templates support both legacy and new field layouts:

```jsonc
{
  "name": "SDR Agent",
  "defaultCwd": "~/agents/sdr",
  "identity": "# SDR Agent\n\n## Role\n...",     // → writes to CLAUDE.md
  "constraints": "# Constraints\n\n## Rules\n...", // → writes to AGENTS.md
  "purpose": "...",                                 // legacy fallback → CLAUDE.md
  "skills": [{"name": "sdr-master-prompts"}],
  "connectors": [{"connectorId": "apollo", "allEnabled": true}]
}
```

If `identity` is present, it takes precedence over `purpose`. If only `purpose` exists (legacy templates), it writes to CLAUDE.md and AGENTS.md gets the default scaffold.

## License

MIT
