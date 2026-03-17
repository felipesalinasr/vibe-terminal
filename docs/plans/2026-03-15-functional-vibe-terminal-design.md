# Functional Vibe Terminal — Design Document

**Date:** 2026-03-15
**Status:** Approved

## Problem

Vibe Terminal is currently a static HTML prototype. The goal is to make it a functional local tool that can spawn real terminal sessions, run Claude Code CLI in them, and organize sessions visually via the kanban board.

## User Flow

1. **Create task** — Click "+ New Agent", type a task name. Card appears in **Backlog** (no terminal session yet).
2. **Start session** — Click a backlog card, choose a directory path (with autocomplete), hit "Start". Server spawns a PTY shell in that directory. Card moves to **Active**.
3. **Interact** — Side panel shows a real terminal (xterm.js). User types commands (`cd`, `claude`, anything). Output streams in real-time.
4. **Auto-state** — Server parses PTY output to detect Claude's state:
   - Claude is processing/writing → card stays in **Active**
   - Claude shows prompt (waiting for input) → card moves to **Review**
5. **Background persistence** — Closing the side panel hides it; the PTY process keeps running. Reopening reconnects and shows full scrollback.
6. **Done** — User manually drags card to **Done** when finished. Can optionally kill the session.

## Architecture

### Components

```
┌─────────────────────────────────────────────┐
│  Browser (localhost:8765)                   │
│  ┌──────────────┐  ┌─────────────────────┐  │
│  │  Kanban Board │  │  Side Panel         │  │
│  │  (cards,      │  │  (xterm.js terminal │  │
│  │   drag/drop)  │  │   + WebSocket)      │  │
│  └──────────────┘  └─────────────────────┘  │
└──────────────┬──────────────┬───────────────┘
               │ REST         │ WebSocket
               │              │ (per session)
┌──────────────▼──────────────▼───────────────┐
│  Node.js Backend Server                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Express  │  │ WS Server│  │ PTY Pool  │  │
│  │ (REST)   │  │ (stream) │  │ (node-pty)│  │
│  └──────────┘  └──────────┘  └───────────┘  │
└─────────────────────────────────────────────┘
```

### Backend (Node.js)

**Dependencies:**
- `express` — HTTP server + static file serving
- `ws` — WebSocket server (co-located on same HTTP server)
- `node-pty` — pseudo-terminal spawning (what VS Code uses)

**REST Endpoints:**
- `POST /api/sessions` — Create session `{ name, cwd }` → spawns PTY, returns `{ id, name, cwd, status }`
- `GET /api/sessions` — List all sessions with current status
- `GET /api/sessions/:id` — Get session details + scrollback buffer
- `DELETE /api/sessions/:id` — Kill PTY process, remove session
- `GET /api/autocomplete?path=...` — Return matching directories for path prefix

**WebSocket Protocol:**
- Client connects to `ws://localhost:8765/ws/:sessionId`
- Server → Client: `{ type: "output", data: "..." }` (terminal output bytes)
- Server → Client: `{ type: "state", state: "active"|"review" }` (state change)
- Client → Server: `{ type: "input", data: "..." }` (user keystrokes)
- Client → Server: `{ type: "resize", cols, rows }` (terminal resize)

**PTY Management:**
- Each session gets a `node-pty` instance running the user's default shell (zsh)
- PTY output is buffered (scrollback, ~10k lines) so reconnecting shows history
- PTY output is also parsed for Claude state detection

**State Detection (heuristic):**
- Watch PTY output for Claude Code prompt patterns:
  - `❯` or `>` at line start after tool output → **Review** (Claude waiting for input)
  - Tool calls (`Read`, `Edit`, `Bash`, etc.) or streaming text → **Active** (Claude working)
  - Permission prompts (`Allow? (y/n)`) → **Review**
- Default: if no output for 5s after Claude was active → assume **Review**
- Non-Claude terminal sessions stay in whatever column the user puts them

### Frontend (evolved index.html)

**New dependencies (CDN or bundled):**
- `xterm.js` — real terminal emulator in the browser
- `xterm-addon-fit` — auto-sizes terminal to panel dimensions
- `xterm-addon-web-links` — clickable URLs

**Changes from prototype:**
- Card data fetched from `GET /api/sessions` instead of hardcoded array
- Backlog cards are local-only (stored in localStorage) until a session is started
- Side panel replaces the fake terminal div with an xterm.js `Terminal` instance
- Panel input row removed — xterm.js handles all input directly
- Mode bar reads state from WebSocket state messages
- New "Start Session" flow on backlog card click: directory picker → spawn

**Kanban state sync:**
- On WebSocket state change messages, auto-move cards between Active/Review columns
- Polling `GET /api/sessions` every 10s as fallback
- Drag to Done is manual; drag to other columns is manual override (server doesn't auto-move back unless state changes again)

### Directory Autocomplete

- User types a path in the spawn modal input
- Frontend debounces (200ms) and calls `GET /api/autocomplete?path=/Users/felipe/Doc`
- Server uses `fs.readdir` to list matching directories
- Returns sorted list of directory names that match the prefix
- Frontend renders as dropdown suggestions below input

## Data Model

```js
// Server-side session
{
  id: "sess-a8f2",           // random ID
  name: "Fix auth bug",      // user-provided task name
  cwd: "/Users/.../project", // working directory
  status: "active",          // active | review | done
  pid: 12345,                // PTY process ID
  pty: <node-pty instance>,  // not serialized
  scrollback: [...],         // buffered output lines
  createdAt: 1710532800000,
}

// Client-side backlog task (localStorage)
{
  id: "task-1",
  name: "Set up CI pipeline",
  tag: "infra",
  col: "backlog",
}
```

## File Structure

```
vibe-terminal/
├── server/
│   ├── index.js          # Express + WS server entry
│   ├── sessions.js       # PTY session management
│   ├── autocomplete.js   # Directory autocomplete
│   └── state-detector.js # Claude output state parser
├── public/
│   └── index.html        # Frontend (evolved from current)
├── package.json
└── docs/plans/
    └── 2026-03-15-functional-vibe-terminal-design.md
```

## Constraints

- **Local only** — runs on localhost, no auth needed
- **macOS** — `node-pty` compiles native bindings, tested on Darwin
- **Claude CLI must be installed** — server doesn't install it, just spawns it
- **Single user** — no multi-user concerns

## Risks

1. **State detection accuracy** — Claude's output patterns may change across versions. Mitigation: keep detection heuristics in a single file, easy to update.
2. **node-pty native compilation** — requires Xcode command line tools on macOS. Mitigation: document in setup instructions.
3. **Memory from long sessions** — scrollback buffer grows. Mitigation: cap at 10k lines, oldest lines dropped.

## Success Criteria

- Can spawn 3+ concurrent terminal sessions from the UI
- Can run Claude Code in each and interact in real-time
- Cards auto-move between Active and Review based on Claude's state
- Closing/reopening a panel reconnects with full scrollback
- Directory autocomplete works for path selection
