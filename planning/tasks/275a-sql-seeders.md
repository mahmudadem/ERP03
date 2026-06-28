# Task 275a — SQL Seeders (system data via Prisma)

**Epic:** [275 — Supabase Launch](./275-supabase-launch-epic.md) · **Depends on:** none · **Est:** 2–3 days
**Branch:** `feat/275a-sql-seeders`

## Objective
A fresh, empty PostgreSQL database must be seedable with all **system/global data** the app needs before any tenant can be created or any document posted. Today every seeder writes to Firestore; none populate Postgres.

## Why
On an empty Postgres, company creation and posting fail (no system voucher types, no module/permission registries, no currencies). This is the first hard blocker to running SQL mode.

## Context / references
- Existing Firestore seeders: `backend/src/seeder/*` (e.g. `seedSystemVoucherTypes.ts`, `seedSystemMetadata.ts`, `seedBusinessDomains.ts`, `runSystemSeeder.ts`), `backend/prisma/seeds/*` (currencies already started).
- Prisma client: `backend/src/infrastructure/prisma/prismaClient.ts`. Schema: `backend/prisma/schema.prisma`.
- Switch guide §3 Step 2 lists minimum seed data.

## Scope (files)
- New: `backend/prisma/seeds/` — SQL seeders for system data (or `backend/src/seeder/sql/`). Keep Firestore seeders untouched.
- A single entrypoint: `npm run seed:sql` (add script to `backend/package.json`).
- May read existing Firestore seed *data definitions* to reuse the canonical content; only the write target changes (Prisma instead of Firestore).

## Required seed coverage (minimum)
- System voucher type definitions (Journal, Payment, Receipt, SI, PI, etc.)
- Module registry, Permission registry, Bundle/Plan registries, Role templates
- Business domains, Currencies (+ company-wizard templates / COA templates the wizard needs)
- System metadata

## Steps
1. Inventory exactly what the company-creation wizard + first posting read at runtime; that set defines "minimum seed".
2. Write idempotent Prisma seeders (safe to re-run — upsert by stable key, no duplicates).
3. Wire `npm run seed:sql` to run them in dependency order against `DATABASE_URL`.
4. Verify against a local Postgres: empty DB → `prisma db push` → `npm run seed:sql` → tables populated.

## Acceptance criteria
- [ ] On a freshly `prisma db push`-ed empty Postgres, `npm run seed:sql` completes with no errors and is **idempotent** (second run = no duplicates, no errors).
- [ ] Seeded data is sufficient for Task 275c to create a tenant and post a voucher (verified there).
- [ ] Firestore seeders unchanged; `DB_TYPE=FIRESTORE` behavior unaffected.

## Audit gate (CTO checks)
Run on a clean Postgres: `prisma db push` → `npm run seed:sql` twice → inspect with `prisma studio` that registries/voucher-types/currencies exist and counts don't double on the second run. Confirm no edits to `src/seeder/*` Firestore writers.

## Out of scope
Tenant/demo data, AI module data, performance seeding.
