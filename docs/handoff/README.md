# Engineer Handoff Guide

Welcome. This guide is for engineers picking up ERP03 from the original product owner. Read this once front to back before touching code.

---

## What this project is

ERP03 is a multi-tenant SaaS ERP MVP built between late 2025 and mid-2026 by a non-technical product owner working with AI agents (Claude Code, Codex, OpenCode). The goal of the MVP was **idea validation**: prove that a single platform can serve businesses from one-person shops to multi-department enterprises with the same UI.

You are inheriting an MVP, not a production system. Treat it as:
- ✅ Strong product direction and feature breadth
- ✅ Clean module organization at the file-system level
- ⚠️ Mixed code quality — some modules are battle-tested, others are scaffolds
- ⚠️ Limited automated test coverage
- ⚠️ Security/scale work still required before going live

The product owner's expectation is that you (the incoming team) will harden, refactor, and productize. Refer to `planning/VISION.md` for the long-term direction.

---

## First-day reading list (in order)

1. **`README.md`** at repo root — 1-pager about the project
2. **`AGENTS.md`** at repo root — the collaboration protocol that the AI agents (and you) follow. **Critical.** It defines branching, commits, doc requirements, and architecture red lines.
3. **`planning/VISION.md`** — what the product *is* supposed to do
4. **`planning/ACTIVE.md`** — what was being worked on at handoff time
5. **`planning/JOURNAL.md`** — skim the last 10 entries to see how work flowed
6. **`docs/README.md`** — the doc map; lists what's documented and what's missing
7. **`docs/architecture/`** — read every file. There are only ~10. Most are AI Assistant; the rest cover infrastructure decisions.

---

## Architecture at a glance

### Frontend
- **Path:** `frontend/` (will become `apps/web/` in Phase 3 of the restructure)
- **Stack:** React 18, TypeScript, Vite, TailwindCSS, Zustand, React Query, i18next (EN/AR/TR)
- **Organization:** Feature modules under `frontend/src/modules/<module>/{pages,components,api,services}`
- **State:** Zustand stores, React Query for server cache
- **Routing:** `react-router-dom` v7

### Backend
- **Path:** `backend/` (will become `apps/api/` in Phase 3)
- **Stack:** Node 20, Express 5, TypeScript, Firebase Admin SDK
- **Organization:** DDD-lite — `domain/`, `application/`, `infrastructure/`, `api/`
- **Pattern:** Repository pattern enforced (interfaces in `repository/interfaces/`, Firestore impls in `infrastructure/firestore/repositories/`)
- **DI:** Manual DI container in `infrastructure/di/bindRepositories.ts`
- **Important:** Domain and application layers must NOT touch Firestore directly. This keeps the codebase SQL-migration-ready.

### Database
- **Now:** Firestore (Firebase emulator for local dev)
- **Planned:** Possible PostgreSQL migration. The repository pattern is the abstraction that makes this possible. Do not break it.

### Auth
- Firebase Auth, with custom claims for super-admin and per-tenant roles.

### AI Assistant
- A first-class module. Has its own provider catalog, runtime profile registry, tool calling, streaming chat, rate limiting, security hardening.
- Documented extensively in `docs/architecture/ai-assistant-*.md`.
- Two operating modes: `BYOK` (tenant brings own key) and `CREDITS` (platform pays, usage-capped).

---

## Get it running

```bash
# Prerequisites: Node 20+, Firebase CLI, Java (for Firestore emulator)

# 1. Install deps (currently two separate installs; will become `pnpm install` after Phase 3 monorepo work)
cd frontend && npm install
cd ../backend && npm install
cd ..

# 2. Start emulators (Firestore, Auth, Storage, Functions, UI on :4000)
npm run emulators

# 3. In another terminal — start the API
cd backend && npm run dev

# 4. In another terminal — start the web app
cd frontend && npm run dev

# 5. Open http://localhost:3000
```

Default super-admin credentials and seed data are described in `backend/src/seeder/`. **Do not commit production credentials.**

---

## Known sharp edges

| Area | Issue | Mitigation |
|---|---|---|
| Firestore rules | Production-grade rules not yet in place | Hard deadline: before going live (see `planning/tasks/23-firestore-security-rules.md`) |
| Test coverage | Sparse — mostly backend domain unit tests | Add E2E tests in Phase 6+ |
| Placeholder modules | HR, CRM, manufacturing, projects, POS render "Coming Soon" — registered in Super Admin entitlements but no backend | See `STATUS.md` in each module folder |
| Old API key encryption | Audit pending — see `planning/ACTIVE.md` deferred items |
| Currency conversion | Not yet implemented for multi-currency AI tools |
| i18n drift | Some pages have hardcoded English; `i18next` keys may be missing in AR/TR |
| `docs/audit/`, `docs/testing/`, `docs/qa/` | Heterogeneous historical artifacts; not in the new architecture/user-guide structure yet |

---

## How work happens here (the agent loop)

This project is collaboratively developed by a non-technical product owner and AI agents. The workflow is documented in `AGENTS.md`. Every feature passes through:

```
START → read planning/ACTIVE.md → do work → BEFORE marking done:
  ├── Update docs/architecture/<module>.md (technical)
  ├── Create docs/user-guide/<module>/<feature>.md (user-facing)
  ├── Write planning/done/NN-feature-name.md (completion report)
  ├── Append planning/JOURNAL.md
  └── Update planning/ACTIVE.md with next task
COMMIT all of the above together
```

If you join the AI-collaborative workflow, follow the same loop. The reviewer agent (`erp-reviewer` in `opencode.json`) will block merges that don't produce a user guide for user-facing features.

If you prefer pure-human workflow, you can ignore the agent prompts — but the **Definition of Done** in `AGENTS.md` still applies. Don't ship features without docs.

---

## First task suggestions for a new engineer

If you have nothing specific to work on yet, these are the highest-leverage tasks:

1. **Phase 3 of the restructure** — finish converting to a pnpm monorepo (`apps/web`, `apps/api`, `packages/shared-types`). The plan is documented in the chore branch `chore/enterprise-restructure`.
2. **Firestore security rules** — the highest-risk gap before going live. Plan: `planning/tasks/23-firestore-security-rules.md`.
3. **User guide backfill** — pick a module from the gap list in `docs/README.md` and write its user guide using the template at `docs/user-guide/README.md`.
4. **Test coverage** — start with the accounting domain (it's the most stable and the most critical).

---

## Who to ask

- **Product owner:** mahmudadem90@gmail.com (the original developer)
- **Architecture questions:** read `docs/architecture/` first, then `AGENTS.md` red lines
- **Past decisions:** check `planning/JOURNAL.md` and `planning/done/` — the agents logged extensively

Welcome aboard. Keep the docs honest.
