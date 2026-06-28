# Task 275e — SQL integration tests (real Postgres) — IN PROGRESS (accounting slice done)

**Epic:** [275 — Supabase Launch](../tasks/275-supabase-launch-epic.md)
**Status:** 🔶 In progress 2026-06-28 — **Accounting module slice complete & green**; 6 modules remain. (executor: Claude/Opus CTO)
**Branch:** `feat/275-supabase-integration` (same integration branch as 275c).

## Why this slice already matters: it caught 2 launch-blocking bugs
Driving the **real** posting path against a live PostgreSQL immediately exposed two bugs that would have broken **all** of SQL mode at launch — exactly the "schema-strictness" risk the epic was created to de-risk. Both are now fixed:

1. **`PrismaAccountRepository.create` — Prisma checked/unchecked input mix.**
   The create used `company: { connect }` (checked input) but also passed `parentId` as a raw scalar. Prisma's checked create input exposes the self-relation only as `parent` (connect), not the scalar FK → `Unknown argument 'parentId'`. **Every account creation** would have thrown. Fixed: `parentId` now connects via `parent: { connect: { id } }` when set.

2. **`PrismaLedgerRepository.recordForVoucher` — `createMany` with relation `connect`.**
   Ledger rows were built with `company: { connect }` / `account: { connect }` and inserted via `createMany`, which accepts **scalar fields only** → `Argument 'companyId' is missing`. **Every ledger posting** would have thrown. Fixed: set scalar `companyId` / `accountId` directly.

(Scanned the sibling self-relation repos — `PrismaItemCategoryRepository`, `PrismaWarehouseRepository` — and confirmed they are **fine**: they use the all-scalar "unchecked" create input, so their scalar `parentId` is valid. `PrismaCostCenterRepository` has no self-relation. The bug was specific to Account's checked/unchecked mix.)

## What the slice proves (real outcomes, not "no throw")
Harness: `backend/scripts/sql-integration-275e.ts` — sets up a throwaway company + 2 POSTING accounts, then:
- Posts a balanced Journal Entry (Dr Cash 100 / Cr Revenue 100) **through the `PostingGateway`** (the single mandatory ledger choke point) → `PrismaLedgerRepository`.
- Asserts the cash account has 1 ledger row debit 100, revenue 1 row credit 100.
- Asserts the **trial balance ties** (total debit 100 == total credit 100) and **nets to zero**.
- Asserts `replaceForVoucher` does not duplicate ledger rows (resync safety).

7 checks, all green, **run twice** (isolated/repeatable; self-cleaning per run).

## QA script (reproduce)
```bash
cd backend
export DATABASE_URL="postgresql://postgres@localhost:5433/erp_db?schema=public"
npx ts-node --transpile-only scripts/sql-integration-275e.ts   # expect: ALL 7 INTEGRATION CHECKS PASSED
# run again -> still passes (repeatable)
node_modules/.bin/tsc --noEmit                                 # expect: clean
```

## Remaining 275e modules (next, same harness)
Inventory (movements + stock level + cost), Sales (SI post), Purchases (PI post), RBAC (role assign + permission check), Core (company + settings + module enable), POS (open shift → sale → close). Each extends `sql-integration-275e.ts` with a `flowX()` function. Expect more schema-strictness bugs to surface — that is the point.

**Format note:** Implemented as a runnable ts-node script (the established, immediately-executable pattern), not yet a Jest CI job. Converting to a CI integration suite under `src/tests/integration/sql/**` is a follow-up; it does not block finding/fixing the bugs.

## Accounting impact
The bug fixes are infrastructure-only (Prisma write shape); they do not change accounting math. The Firestore path is untouched (Prisma-only files). The voucher balancing, ledger amounts, and trial-balance logic are unchanged — the integration test now proves they execute correctly on Postgres.
