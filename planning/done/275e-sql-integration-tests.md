# Task 275e — SQL integration tests (real Postgres) — IN PROGRESS (accounting + inventory done)

**Epic:** [275 — Supabase Launch](../tasks/275-supabase-launch-epic.md)
**Status:** 🔶 In progress 2026-06-28 — **Accounting + Inventory slices complete & green**; Sales/Purchases/RBAC/Core/POS remain. (executor: Claude/Opus CTO)
**Branch:** `feat/275-supabase-integration` (same integration branch as 275c).

## Why this matters: 4 launch-blocking bugs caught so far
Driving the **real** flows against a live PostgreSQL has so far exposed **four** bugs that would each have broken core SQL-mode behaviour at launch — exactly the "schema-strictness" risk the epic was created to de-risk. All fixed.

### Inventory slice (module B) — 2 more bugs
3. **`PrismaStockLevelRepository.upsertLevel` was update-only.** The Firestore impl uses a blind `.set()` (create-or-replace); the Prisma version only ran `update` under a `version` guard, so the **first** persistence of a brand-new stock level (version 1, no prior row) threw `RecordNotFound`. **Receiving stock for any new item/warehouse would break.** Fixed: a true create-or-update that keeps the optimistic-concurrency guard (update on version match → insert if absent → throw on real version conflict).
4. **`PrismaStockMovementRepository.toDomain` mapped NULL settlement columns to `null`.** The domain treats a *present* (non-undefined) wrong-direction settlement field as an error, but Postgres stores the absent ones as NULL → reading back **any** IN or OUT movement threw "IN movement cannot include OUT settlement fields". **Stock movement history would be unreadable.** Fixed: coalesce the 5 settlement fields NULL → undefined.

### Accounting slice (module A) — 2 bugs

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

### Inventory flow (module B) proves
- Create item + warehouse (inventory FKs), append a `PURCHASE_RECEIPT` stock movement (10 @ cost 5) and read it back.
- **Create a brand-new stock level** via `upsertLevel` (the path bug #3 broke), then a second receipt that blends cost and bumps version under the optimistic-concurrency guard (qty 15, avg cost 6, v2).

**11 checks total, all green, run twice** (isolated/repeatable; self-cleaning per run).

## QA script (reproduce)
```bash
cd backend
export DATABASE_URL="postgresql://postgres@localhost:5433/erp_db?schema=public"
npx ts-node --transpile-only scripts/sql-integration-275e.ts   # expect: ALL 11 INTEGRATION CHECKS PASSED
# run again -> still passes (repeatable)
node_modules/.bin/tsc --noEmit                                 # expect: clean
```

## Remaining 275e modules (next, same harness)
Sales (SI post/round-trip), Purchases (PI post/round-trip), RBAC (role assign + permission check), Core (company + settings + module enable), POS (open shift → sale → close). Each extends `sql-integration-275e.ts` with a `flowX()` function. Given 4 bugs in the first 2 modules, expect more schema-strictness bugs to surface — that is the point.

**Format note:** Implemented as a runnable ts-node script (the established, immediately-executable pattern), not yet a Jest CI job. Converting to a CI integration suite under `src/tests/integration/sql/**` is a follow-up; it does not block finding/fixing the bugs.

## Accounting impact
The bug fixes are infrastructure-only (Prisma write shape); they do not change accounting math. The Firestore path is untouched (Prisma-only files). The voucher balancing, ledger amounts, and trial-balance logic are unchanged — the integration test now proves they execute correctly on Postgres.
