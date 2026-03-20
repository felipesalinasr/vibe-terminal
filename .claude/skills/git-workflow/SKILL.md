---
name: git-workflow
description: Enforces atomic commits, conventional commit messages, and branch-based development. Use ALWAYS when writing code, completing features, fixing bugs, or making any changes to the codebase. Triggers on any code modification, file creation, or development task.
---

# Git Workflow — Atomic Commits & Conventional Messages

This skill is ALWAYS active during development. Every code change must follow these rules.

## Commit Cadence

- **Commit after each logical unit of work** — one feature, one fix, one refactor, never mixed
- **Commit often** — small, frequent commits over large batches
- **Never commit half-done work** — use `git stash` if you need to context-switch
- **Test before committing** — ensure the code works and doesn't break the build
- **Never batch unrelated changes** — if you added a feature AND fixed a bug, that's 2 commits

## Commit Message Format

```
<type>: <subject>

<body>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

### Subject Line Rules

- **Use Conventional Commits prefixes**: `feat:`, `fix:`, `docs:`, `refactor:`, `style:`, `test:`, `chore:`, `perf:`, `ci:`, `build:`
- **Imperative mood**: "Add feature" not "Added feature" or "Adding feature"
- **Under 50 characters** (hard limit: 72)
- **Capitalize** the first word after the prefix
- **No trailing period**

### Body Rules

- Separate from subject with a blank line
- Wrap at 72 characters
- Explain **what** changed and **why**, not how (the diff shows how)
- Reference issues/tickets when applicable: `Fixes #123`

### Examples

```
feat: Add memory sidebar section to agent panel

Display JSONL memory entries with type badges (convention,
correction, decision, preference) in the agent editor sidebar.
Entries load from GET /api/agents/:id/memory endpoint.
```

```
fix: Prevent audit double-write on skill scan

The onSkillsChanged callback was logging one audit entry per
skill on every scan. Now only logs when skills actually change.
```

```
refactor: Extract AGENTS.md read/write into helper functions

Moves inline file operations into readAgentsMd() and
writeAgentsMd() for consistency with existing readClaudeMd()
pattern.
```

## Branch Strategy

- **Use branches** for features and fixes: `feat/memory-sidebar`, `fix/audit-dedup`
- Keep `main` stable — only merge tested, complete work
- Branch names: `<type>/<short-description>` using kebab-case

## What NOT to Do

- Never `git add -A` or `git add .` — stage specific files
- Never skip hooks (`--no-verify`)
- Never force-push to main
- Never amend published commits
- Never commit `.env`, credentials, or large binaries
- Never combine a feature + a refactor + a docs update in one commit
