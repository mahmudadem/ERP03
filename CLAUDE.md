# CLAUDE.md — Claude Code Entry Point

> This file is auto-loaded by Claude Code at the start of every session. Keep it short.

## Read these first, in order

1. **`AGENTS.md`** — Full agent protocol, CTO role, OpenCode multi-agent workflow, architecture red lines. **This is the single source of truth for how to work in this repo.**
2. **`planning/ACTIVE.md`** — Current task and "where I left off".
3. **`planning/JOURNAL.md`** — Recent session history (just skim the top entries).
4. **`planning/VISION.md`** — Product vision and what "done" means.

## Project at a glance

ERP03 is a multi-tenant SaaS ERP MVP. The user is a non-technical product owner who will hand off to professional engineers once the idea validates. Codebase must stay clean and well-documented.

- **Frontend:** `frontend/` (React + Vite + TypeScript)
- **Backend:** `backend/` (Node + Express + Firebase + TypeScript)
- **Branch:** `feat/phase-1a-core-bugs`

## Definition of Done (every feature)

A task is not done until all of these exist:
- [ ] Code merged
- [ ] `docs/architecture/<module>.md` updated (technical, for SWEs)
- [ ] `docs/user-guide/<module>/<feature>.md` created (plain language, for end users)
- [ ] `planning/done/NN-feature-name.md` completion report
- [ ] `planning/JOURNAL.md` entry appended
- [ ] `planning/ACTIVE.md` updated with next task

See `AGENTS.md` for details.

## Working across agents and devices

This project is worked on across Claude Code, Codex, OpenCode, and from multiple devices (laptop, phone). **All shared state lives in git** — `planning/ACTIVE.md`, `planning/JOURNAL.md`, and `docs/` are the handoff mechanism. Commit them as part of every session.
