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

## 🔶 SQL-readiness — Epic 275 (audit re-verified 2026-06-29)

**Backend SQL layer = VERIFIED working on real Postgres (this session):**
- `scripts/sql-integration-275e.ts` → **25/25 checks PASS** (Accounting, Inventory, Sales, Purchases, RBAC, Core, POS).
- `npm run smoke:companies` (forced SQL) → **PASS** — 2 companies created end-to-end (48-acct COA, 16 voucher types/forms, FY, balanced journal, ledger balanced).

**Why it felt "totally broken" before = environment, not code.** Root causes found + fixed:
1. This worktree had **zero deps installed** (`npm install` was never run here — git worktrees don't share `node_modules`).
2. Prisma client not generated.
3. DB schema stale — needed `prisma db push` (Task 277 added `uomBarcodes` columns).
4. One real regression fixed: `PrismaItemRepository.createItem` crashed on undefined `uomBarcodes` (commit `1ffee919`).
5. **Env trap:** `.env` has `DB_TYPE=FIRESTORE`; SQL lives in `.env.local`, but standalone scripts load `.env` → they silently run in Firestore mode. Must force `DB_TYPE=SQL` for SQL runs.

**Reproducible SQL setup (run in `backend/`):**
```bash
npm install
node_modules/.bin/prisma generate
node_modules/.bin/prisma db push --skip-generate            # uses .env DATABASE_URL (5432 erp_db)
npx ts-node --transpile-only scripts/sql-integration-275e.ts          # expect 25/25
DB_TYPE=SQL DATABASE_URL="postgresql://postgres:root@localhost:5432/erp_db?schema=public" npm run smoke:companies
```
Local DB the app uses: **port 5432**, `postgres:root`, db `erp_db` (per `.env`/`.env.local`). A second Postgres on 5433 exists but is unused/leftover.

**Running app on SQL = VERIFIED (2026-06-29, via in-process probe, now removed):** the real Express app boots in SQL mode (startup validation reads Postgres), serves `/health` (200), enforces auth (401 without a token), creates+initializes a company through the running DI (42–48 accounts, voucher types/forms, fiscal year), and an authenticated owner request `GET /tenant/accounting/accounts` returns **200 with 48 accounts** — full HTTP→auth→tenant→controller→use-case→Prisma→Postgres. (Only the Firebase token *signature* check was stubbed; it's DB-agnostic.)

**Known gaps (not blockers):**
- Deleting a company that has transactions fails on `voucher_lines→accounts` RESTRICT (documented; cleanup-ordering follow-up). One stale `SMOKE-*` company left in local QA db because of this.
- **Still UNVERIFIED:** literal browser end-to-end (frontend dev server + Firebase Auth emulator click-through) and cloud deploy (275f: Supabase + Railway/Vercel). **Not merged to `main`.** Detail: `planning/done/275*`, `planning/tasks/DEPLOYMENT-PLAN-SUPABASE.md`.
