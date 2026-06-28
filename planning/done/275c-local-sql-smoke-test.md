# Task 275c — Integrate 275a+b+d & smoke-test the SQL path on real Postgres — COMPLETE

**Epic:** [275 — Supabase Launch](../tasks/275-supabase-launch-epic.md)
**Status:** ✅ Complete 2026-06-28 (executor + audit: Claude/Opus CTO, after a spawned agent hit a session limit and produced nothing)
**Branch:** `feat/275-supabase-integration` — integrates 275d, 275a, 275b. NOT merged to main yet (awaits owner go + 275e).

## What this task delivered
The first time the SQL/Prisma path was ever **run** against a real PostgreSQL database (prior work was only type-checked). This de-risks the central unknown of Epic 275.

### 1. Integration (3 branches → 1)
Merged cleanly, no conflicts (the branches touch disjoint files):
- `worktree-agent-a3e746de9fc53b3c7` (275d) — schema +23 models, 20 Prisma repos, DI bindings.
- `worktree-agent-a54d125f17875b2ef` (275a) — 10 system seeders + `seed:sql` script.
- `worktree-agent-a6174b30b54ebc701` (275b) — `SettingsResolverSQL`.

Verified post-merge: `package.json` keeps both the `seed:sql` script and Prisma `^5.x`; `SettingsResolverSQL` is imported and instantiated in `bindRepositories.ts`.

### 2. FK bug fixed (the bug 275a surfaced)
PostgreSQL enforces the `companyId -> Company.id` FK that Firestore ignored. The voucher-type-definition seeder writes `companyId = 'SYSTEM'`, which had no parent row → FK violation.

**Fix:** new seeder `backend/prisma/seeds/seedSystemCompany.ts` upserts a reserved **SYSTEM sentinel Company** (`id = 'SYSTEM'`) as step 0 of `runSqlSeed.ts`. It has **no `CompanyUser` memberships**, and company listings are always scoped by membership, so it never appears in any user's company list — no UI pollution. This is the natural anchor for all `companyId='SYSTEM'` system-template rows.

### 3. Proof on real Postgres (local portable PG 16, port 5433, db `erp_db`)
- `prisma db push` → **128 tables, in sync**.
- `npm run seed:sql` → all 10 seeders complete (previously failed at step 10).
- **Run twice → idempotent.** Row counts after 2 runs: companies **1**, voucher_type_definitions **16** (not 32 → no dupes), currencies **32**, permission_registries **71**, COA templates **8**.
- `tsc --noEmit` on the merged tree → **clean** (no cross-branch type breakage).
- **Runtime repository smoke test** (`backend/scripts/sql-smoke-275c.ts`) → **all checks pass**:
  - Core `PrismaCompanyRepository` save + findById round-trip.
  - 275d-new `PrismaSalespersonRepository` create + getById — proves a new mapping runs AND the `companyId` FK to a real Company is satisfied.
  - `PrismaIdempotencyKeyRepository` put + get + **replay no-op** — proves the offline-sync idempotency infra works on Postgres.

## QA script (reproduce locally)
```bash
# Postgres running on localhost:5433, db erp_db (trust auth, no password)
cd backend
export DATABASE_URL="postgresql://postgres@localhost:5433/erp_db?schema=public"
node_modules/.bin/prisma db push --skip-generate     # expect: in sync, 128 tables
npm run seed:sql                                      # expect: ALL SYSTEM SEEDING COMPLETE
npm run seed:sql                                      # run again → still clean (idempotent)
npx ts-node --transpile-only scripts/sql-smoke-275c.ts   # expect: ALL SMOKE CHECKS PASSED
node_modules/.bin/tsc --noEmit                        # expect: clean
```

## Scope boundary — what 275c deliberately did NOT do
Full **service-level posting flows** (Sales Invoice post → ledger + stock, Purchase Invoice post → ledger + stock) are **not** exercised here. They require the application/orchestration layer and an auth context, and are the defined scope of **275e (SQL integration tests per module)**. 275c proves the repository plumbing executes on Postgres; 275e is the behavioral safety net for posting math.

## Follow-ups / open audit markers (carry into 275e)
- 5× `TODO(275a-audit)`, 7× `TODO(275b-audit)` model-name guesses still need CTO review against the real schema (now that the schema is live, these can be checked directly).
- Branch `feat/275-supabase-integration` is **not merged** — merge to main after 275e passes.

## End-user view
Internal infrastructure milestone. The ERP can now actually create companies, system data, and records on the new PostgreSQL database — the load-bearing prerequisite for the Supabase launch. No user-facing change yet.
