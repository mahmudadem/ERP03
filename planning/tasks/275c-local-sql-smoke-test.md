# Task 275c — Stand up local Postgres + smoke-test core flows

**Epic:** [275 — Supabase Launch](./275-supabase-launch-epic.md) · **Depends on:** 275a, 275b · **Est:** 5–8 days (highest-risk task)
**Branch:** `feat/275c-local-sql-smoke-test`

## Objective
Run the backend with `DB_TYPE=SQL` against a **real local PostgreSQL** and walk every critical flow end-to-end, fixing whatever breaks. This is the task that converts "the SQL code exists" into "we know it works."

## Why
The Prisma path has never executed against a live DB. Postgres enforces NOT NULL / foreign-key / type / unique constraints that Firestore silently ignored, so the highest-value flows (posting, stock, invoicing) are the most likely to fail first.

## Context / references
- Switch guide §3 (smoke tests 1–6) and §4 (gotchas: required fields, optimistic concurrency, FK ordering).
- Toggle: `backend/src/infrastructure/di/bindRepositories.ts` (`DB_TYPE === 'SQL'`).

## Setup
1. Local Postgres (Docker or native). Set `DATABASE_URL`.
2. `prisma generate` → `prisma db push` (expect ~105 tables) → `npm run seed:sql` (275a).
3. `DB_TYPE=SQL`, `npm run build`, start the backend.

## Smoke flows to pass (each fix lands as a small commit)
1. **Company + user + role + list users.**
2. **Accounting — accounts:** parent/child create, get, list-by-classification, update, hierarchy.
3. **Accounting — vouchers:** draft (debit+credit) → update → submit → approve → post → ledger entries created → trial balance ties.
4. **Inventory — stock:** item + warehouse + opening stock → IN movement → OUT movement → stock level correct at each step (moving-average cost intact).
5. **Sales — invoice:** customer → SO → SI → post → voucher + ledger created.
6. **Purchases — invoice:** vendor → PO → GRN → PI → post → voucher + ledger created.

Prioritize the riskiest per the guide: voucher posting, stock movements, invoice posting (multi-table transactions via `PrismaTransactionManager`).

## Acceptance criteria
- [ ] All six smoke flows pass against real Postgres with `DB_TYPE=SQL`.
- [ ] Trial balance ties after posting; stock levels and moving-average cost correct.
- [ ] `SystemCoreBoundaries.test.ts` green; `DB_TYPE=FIRESTORE` suite still green (no cross-regression).
- [ ] Every fix documented in the completion report (symptom → root cause → fix), with the exact reproduction commands.

## Audit gate (CTO checks)
CTO reproduces flows 3, 4, 5, 6 against a clean seeded Postgres and confirms ledger/stock correctness, then re-runs the Firestore suite to confirm no regression. Any guard/boundary weakened to pass = rejected.

## Out of scope
UI polish, deployment, the missing repos (275d) unless a smoke flow directly hits one — if so, note it and coordinate, don't silently re-scope.
