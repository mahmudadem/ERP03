# 🎯 Current Focus

> Keep this file SHORT. It is "what's happening now + where I left off."
> Completed-task detail lives in `planning/done/NN-*.md` and session history in `planning/JOURNAL.md`.
> (Trimmed 2026-06-29 from a 1700-line backlog — all of that history is preserved in `done/` + `JOURNAL.md`.)

---

## ⚠️ Worktree map (read first)

Two worktrees, one repo. **Do not mix their roles.**

> 🔒 **SCOPE LOCK — read before any edit.**
> - Working in **this** folder (`ERP03`, branch `codex/sql-readiness-wip-20260628`)? You are committed to **SQL / PostgreSQL readiness ONLY**. Do **not** make Firebase/Firestore production fixes or deploys here.
> - Working in `ERP03-unified` (branch `codex/unified-firestore-deploy-20260628`)? You are committed to **Firebase production ONLY**. Do **not** do SQL/Postgres work there.
> - If a task doesn't match the lane you're in, **STOP and switch folders** — never let SQL changes land on the Firebase deploy branch, or production changes land on the SQL branch.
> - Lanes stay separate until a deliberate reconciliation through `main`.

| Worktree | Branch | Role |
|---|---|---|
| `D:\DEV2026\ERP03` | `codex/sql-readiness-wip-20260628` | **SQL-readiness lane** — Supabase / PostgreSQL continuation. |
| `D:\DEV2026\ERP03-unified` | `codex/unified-firestore-deploy-20260628` | **Production lane** — Firebase/Firestore live fixes + deploys. |

- Production fix / retest / Firebase deploy → **`ERP03-unified`**.
- SQL readiness / Supabase / PostgreSQL → **`ERP03`** (this folder).
- Backups of both dirty states: `D:\DEV2026\ERP03-worktree-backups\20260629-160718`.
- Rollback tag for the prod lane: `backup/unified-before-heal`.

---

## ✅ Production — healed & LIVE (2026-06-29)

The verified 503/500 storm fix (`9e5d0ac1`) was split across lanes; it is now complete in the
production lane and **deployed live to `erp-03`** (functions + firestore indexes). Verified:
server boots and serves (no more `503 Server not ready`). Details in `JOURNAL.md`.

---

## ⏭️ Next: collapse to ONE canonical worktree

Hold the two-lane model until production is confirmed stable under ~1 day of real use, **then**:

1. Land the production work to `main` (route through `main`, never merge the two dirty branches directly).
2. Rebase the SQL-readiness branch on top of the updated `main`; resolve conflicts here at leisure.
3. Delete the `ERP03-unified` worktree/branch → single folder `D:\DEV2026\ERP03` remains.

Firebase and SQL stay independent (same codebase, either DB stands alone) — reconciliation is folder
tidy-up only, not an architecture change.

---

## 🔶 SQL-readiness — Epic 275 (paused, awaiting owner go)

SQL path runs on real Postgres; Task 275e proved Accounting/Inventory/Sales/Purchases/RBAC/Core/POS.
Two-company creation bug sweep done (`npm run smoke:companies` PASS). **Not merged to `main`.**
Next when resumed: owner commit approval → 275f (provision Supabase, deploy backend Railway + frontend Vercel).
Full detail: `planning/done/275*` and `planning/tasks/DEPLOYMENT-PLAN-SUPABASE.md`.
Local env: portable Postgres 16 on `localhost:5433`, db `erp_db` (`DATABASE_URL=postgresql://postgres@localhost:5433/erp_db?schema=public`).
