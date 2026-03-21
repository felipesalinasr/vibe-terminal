# Migration Parity Checklist

## REST Endpoints Used by Frontend

### Sessions
- [ ] `GET /api/sessions` — list all sessions (10s poll)
- [ ] `POST /api/sessions` — create session `{ name, cwd?, templateId? }`
- [ ] `DELETE /api/sessions/:id` — kill/delete session

### Agent Config
- [ ] `GET /api/agents/:id` — load config + purpose `{ config, purpose }`
- [ ] `PUT /api/agents/:id` — patch config (skills, tools, files)
- [ ] `PUT /api/agents/:id/purpose` — autosave CLAUDE.md `{ content }`
- [ ] `GET /api/agents/:id/agents-md` — load constraints `{ content }`
- [ ] `PUT /api/agents/:id/agents-md` — autosave AGENTS.md `{ content }`

### Agent Skills
- [ ] `GET /api/agents/:id/skills` — list skills `[{ folder, name, description }]`
- [ ] `GET /api/agents/:id/skills/:folder` — read skill `{ content }`
- [ ] `PUT /api/agents/:id/skills/:folder` — write skill `{ content }`

### Agent Files
- [ ] `POST /api/agents/:id/files` — add tracked file `{ path }`
- [ ] `DELETE /api/agents/:id/files` — remove tracked file `{ path }`

### Agent Knowledge
- [ ] `GET /api/agents/:id/knowledge` — list KB files `[{ name, size, path }]`
- [ ] `POST /api/agents/:id/knowledge` — upload KB file (multipart)
- [ ] `DELETE /api/agents/:id/knowledge/:filename` — delete KB file

### Agent Memory & Audit (read-only)
- [ ] `GET /api/agents/:id/memory` — memory entries
- [ ] `GET /api/agents/:id/audit` — audit entries

### Global Skills
- [ ] `GET /api/skills` — local skills catalog
- [ ] `GET /api/skills/external` — external skills registry
- [ ] `GET /api/skill-content?path=` — read SKILL.md by path
- [ ] `PUT /api/skill-content` — write SKILL.md `{ path, content }`

### Templates
- [ ] `GET /api/templates` — list all templates
- [ ] `POST /api/templates` — create template
- [ ] `PUT /api/templates/:id` — update template
- [ ] `DELETE /api/templates/:id` — delete template

### Connectors
- [ ] `GET /api/connectors/catalog` — connector catalog (cached)

### Files / System
- [ ] `POST /api/drop` — upload dropped file (multipart) → `{ path }`
- [ ] `POST /api/open` — open file/folder `{ path, action }`
- [ ] `GET /api/browse` — native OS directory picker → `{ path }`
- [ ] `GET /api/import-agent?path=` — import CLAUDE.md/AGENTS.md
- [ ] `GET /api/autocomplete?path=` — directory path completion

---

## WebSocket Messages

### Inbound (server → client)
- [ ] `output` — `{ data: string }` → write to xterm
- [ ] `scrollback` — `{ data: string }` → replay buffered history
- [ ] `state` — `{ state: string }` → update session status + mode indicator
- [ ] `file` — `{ path: string }` → show file toast + update Files tab
- [ ] `skills-changed` — `{ skills: [] }` → refresh Skills/Identity tabs
- [ ] `historical` — `{}` → disable stdin, show restart bar
- [ ] `exit` — `{}` → write "[Process exited]" to terminal

### Outbound (client → server)
- [ ] `input` — `{ type: 'input', data: string }` — keystrokes + file paths
- [ ] `resize` — `{ type: 'resize', cols, rows }` — terminal resize

---

## Local Persistence
- [ ] `localStorage['vt-backlog']` — JSON array of `{ id, name, tag, templateId? }`

---

## Keyboard Behavior
- [ ] `Escape` closes side panel (document listener, added/removed with panel)
- [ ] `Escape` closes modals (create task, template, start session)
- [ ] `Escape` hides autocomplete dropdowns
- [ ] `Enter` confirms modal actions
- [ ] `Tab` accepts single autocomplete suggestion
- [ ] `ArrowDown`/`ArrowUp` navigates autocomplete list
- [ ] `Enter`/`Escape` on inline tag/file inputs

---

## User Journey Smoke Tests

### Board
- [ ] Board loads with 4 columns
- [ ] Session cards appear in correct columns by status
- [ ] Backlog tasks persist across reload
- [ ] Header shows live session count
- [ ] "+ New Task" opens create task modal

### Session Lifecycle
- [ ] Create session from template
- [ ] Session card moves to "In Progress" column
- [ ] Kill session from panel
- [ ] Delete session card

### Terminal Panel
- [ ] Open panel by clicking session card
- [ ] Terminal I/O works (keystrokes → output)
- [ ] Terminal resizes with panel
- [ ] File drag-and-drop uploads and pastes path
- [ ] File toast shows with Open/Finder actions
- [ ] Historical session opens read-only
- [ ] Historical session restart creates new session
- [ ] Panel closes on Escape / overlay click / close button

### Agent Editor
- [ ] Tab switch: Terminal ↔ Agent
- [ ] Identity (CLAUDE.md) loads and autosaves
- [ ] Constraints (AGENTS.md) loads and autosaves
- [ ] Skills list, view, edit, create
- [ ] Tools tag add/remove
- [ ] Files add/remove/open
- [ ] Knowledge upload/delete
- [ ] Memory read-only view
- [ ] Audit read-only view

### Templates
- [ ] Templates view shows grid of cards
- [ ] Create new template
- [ ] Edit existing template
- [ ] Delete template
- [ ] Start session from template (with cwd modal)
- [ ] Skills picker: paste command, local browse, external browse
- [ ] Connector picker with chips

### Tools
- [ ] Tools view loads connector catalog
- [ ] Search/filter works
- [ ] Detail panel shows connector info
