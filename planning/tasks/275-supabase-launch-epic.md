# Epic 275 — Supabase (PostgreSQL) Production Launch

**Owner decision (2026-06-28):** The first production launch runs on **Supabase / PostgreSQL**, NOT Firestore. Firestore is demoted to dev/fallback only (the `DB_TYPE` toggle stays). One database engine in production: PostgreSQL.
**CTO:** Claude (Opus 4.8). **Status:** Planning complete — execution open.
**Strategic plan:** [DEPLOYMENT-PLAN-SUPABASE.md](./DEPLOYMENT-PLAN-SUPABASE.md). **Switch mechanics:** [SQL-MIGRATION-SWITCH-GUIDE.md](./SQL-MIGRATION-SWITCH-GUIDE.md).

---

## Why this epic exists

The repository pattern already produced a dual-database backend (`DB_TYPE=SQL` → Prisma/Postgres, else Firestore). The Postgres path is ~78% built but **has never run against a real database**. This epic hardens it and ships the first production deployment on Supabase. Reporting, costing, maintainability, and the future offline/desktop direction all require SQL — see the strategic plan.

## Locked decisions (do not re-litigate — see [[supabase_deploy_decisions]])

- Production DB = **PostgreSQL on Supabase**. Firestore = dev/fallback only. No second production DB ("free users on Firestore" is rejected — free vs paid is feature-gating, not a different DB).
- **Auth stays Firebase** for v1 (cloud-only; offline local-login is a future concern).
- **AI Assistant module OFF for v1** → its ~12 Prisma repos are OUT of scope here.
- Backend host = **Railway**. Frontend = static host (Vercel/Netlify/Cloudflare Pages).
- Attachments + push notifications stay on **Firebase** for v1.

## Out of scope for this epic (parked / future)

- Offline queue + sync (design captured in [docs/architecture/offline-sync-queue.md](../../docs/architecture/offline-sync-queue.md) and the strategic plan; build is post-launch — relates to Task 222).
- Desktop-as-local-authority (parked future feature).
- AI module SQL port.

---

## Execution order (each task has its own file + audit gate)

| # | Task | File | Depends on | Est |
|---|------|------|-----------|-----|
| 275a | SQL seeders (system data via Prisma) | [275a](./275a-sql-seeders.md) | — | 2–3 d |
| 275b | Implement `SettingsResolverSQL` (remove the stub) | [275b](./275b-settings-resolver-sql.md) | — | 1 d |
| 275c | Stand up local Postgres + smoke-test core flows | [275c](./275c-local-sql-smoke-test.md) | 275a, 275b | 5–8 d |
| 275d | Port the ~15 missing Prisma repos (non-AI) | [275d](./275d-missing-prisma-repos.md) | — (parallelizable) | 4–7 d |
| 275e | SQL integration tests (one per module, real Postgres) | [275e](./275e-sql-integration-tests.md) | 275c, 275d | 3–5 d |
| 275f | Provision Supabase + deploy backend/frontend (staging) | [275f](./275f-provision-and-deploy-supabase.md) | 275c, 275e | 3–5 d |

**Critical path:** 275a + 275b → 275c → 275e → 275f. 275d runs in parallel and must merge before 275e.

---

## Executor protocol (per AGENTS.md multi-agent rules)

1. `git pull`; read this epic + the specific task file + `DEPLOYMENT-PLAN-SUPABASE.md` + `SQL-MIGRATION-SWITCH-GUIDE.md`.
2. Add yourself to the **Task Lock** table in `PRIORITIES.md` before starting. One builder per task file.
3. Branch per task: `feat/275a-sql-seeders`, etc. Do NOT work on `main` directly.
4. Stay strictly within the task's listed file scope. New file needed? Note it in the task file; don't silently expand.
5. **No commit on failure.** Build + targeted tests must pass before commit. Reference the task in the commit (`feat(sql): seed system data [275a]`).
6. On completion: write `planning/done/275x-*.md` (technical + end-user sections + the exact QA/verification commands you ran), update `ACTIVE.md` + `JOURNAL.md`, mark the Task Lock ✅, and STOP for CTO audit.

## CTO audit gates (Claude audits before the next task starts)

Each task is "done" only when the CTO confirms its **Audit Gate** (defined in the task file). The CTO checks: scope respected, acceptance criteria objectively met, verification commands reproduce green, no Firestore-layer regressions (the `DB_TYPE=FIRESTORE` path must still pass its tests), no engine/boundary violations (`SystemCoreBoundaries.test.ts` green), docs updated. A task that weakens a guard or boundary to pass is rejected.

**Global exit criteria for the epic:** with `DB_TYPE=SQL` against a real Supabase Postgres, a fresh tenant can be created, every v1-enabled module works, the full test suite is green against Postgres, and a user can log in and run a full Sales + Purchase document flow on the deployed staging URL.
