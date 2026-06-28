# Task 275e — SQL integration tests (real Postgres) — IN PROGRESS (accounting + inventory + sales + purchases done)

**Epic:** [275 — Supabase Launch](../tasks/275-supabase-launch-epic.md)
**Status:** 🔶 In progress 2026-06-28 — **Accounting + Inventory + Sales + Purchases slices complete & green**; RBAC/Core/POS remain. (executor: Claude/Opus CTO)
**Branch:** `feat/275-supabase-integration` (same integration branch as 275c).

## Why this matters: 7 launch-blocking bugs caught so far
Driving the **real** money-path flows against a live PostgreSQL has exposed **seven** bugs that would each have broken core SQL-mode behaviour at launch — exactly the "schema-strictness" risk the epic was created to de-risk. All fixed. **2 of them were missing schema columns** (data the Firestore path stored but the Prisma schema simply didn't have), so a `prisma db push` is required after pulling this branch.

### Sales + Purchases slices (modules C, D) — 3 more bugs
5. **`PrismaSalesInvoiceRepository.create` AND `PrismaPurchaseInvoiceRepository.create` set both scalar `companyId` and `company: { connect }`.** With the nested `lines.create` forcing Prisma's checked input, the scalar is rejected → "Unknown argument companyId". **Every SI and PI create threw.** Fixed: drop the redundant scalar, keep the relation connect.
6. **`SalesInvoice`/`PurchaseInvoice` schema had no `voucherType` column.** The SI domain *requires* `voucherType` (throws without it) and both persist it via `toJSON` in Firestore — so reading back a posted SI threw and the value was silently lost for PI. Fixed: added `voucherType` + `voucherTypeId` columns to both invoice models and mapped them in create/update/toDomain.
7. **`PurchaseInvoiceLine` schema was missing 6 columns the repo writes** (`trackInventory`, `uomId`, `taxCode`, `grnLineId`, `accountId`, `stockMovementId`). **PI was never persistable in SQL mode** — the create threw on the first missing column. (SalesInvoiceLine already had its equivalents, which is why SI persisted.) Fixed: added the 6 columns.

### Inventory slice (module B) — 2 bugs

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

### Sales + Purchases flows (modules C, D) prove
- Create a Sales Invoice (header + 1 line, reusing the inventory item) and read it back: 1 line, grand total 100, invoice number preserved.
- Create a Purchase Invoice (header + 1 line) and read it back: 1 line, grand total 20, invoice number preserved.

**15 checks total, all green, run twice** (isolated/repeatable; self-cleaning per run).

## QA script (reproduce)
```bash
cd backend
export DATABASE_URL="postgresql://postgres@localhost:5433/erp_db?schema=public"
node_modules/.bin/prisma db push --skip-generate               # picks up the new SI/PI/PILine columns
npx ts-node --transpile-only scripts/sql-integration-275e.ts   # expect: ALL 15 INTEGRATION CHECKS PASSED
# run again -> still passes (repeatable)
node_modules/.bin/tsc --noEmit                                 # expect: clean
```

## Remaining 275e modules (next, same harness)
RBAC (role assign + permission check), Core (company + settings + module enable), POS (open shift → sale → close). Each extends `sql-integration-275e.ts` with a `flowX()` function. Given 7 bugs in the first 4 modules, expect more schema-strictness bugs to surface — that is the point.

**Format note:** Implemented as a runnable ts-node script (the established, immediately-executable pattern), not yet a Jest CI job. Converting to a CI integration suite under `src/tests/integration/sql/**` is a follow-up; it does not block finding/fixing the bugs.

## Accounting impact
The bug fixes are infrastructure-only (Prisma write shape); they do not change accounting math. The Firestore path is untouched (Prisma-only files). The voucher balancing, ledger amounts, and trial-balance logic are unchanged — the integration test now proves they execute correctly on Postgres.
