# 250j — Inventory Core Tidy Completion Report

**Date:** 2026-06-21  
**Status:** Complete, committed  
**Actual time:** ~1.0h

## Technical Developer View

Made `IInventoryCore` the canonical inventory integration contract. The previous `ISalesInventoryService` and `IPurchasesInventoryService` names remain only as deprecated aliases in the contract file for one phase; active Sales, Purchases, POS, and inventory service implementations now use `IInventoryCore`.

Moved COGS account resolution and COGS bucket accumulation into the inventory core contract:

- `resolveCOGSAccounts(...)` resolves item/category/default COGS and inventory asset accounts.
- `addToCOGSBucket(...)` aggregates COGS amounts by account pair.
- `ensureInventoryCore(...)` lets legacy test doubles/thin adapters receive the same helper methods without putting the logic back into Sales.

Rewired Sales Delivery Note, Sales Invoice, and Sales Return posting to call the inventory core helpers instead of local Sales-owned `AccumulatedCOGS` / `COGSBucketLine` helpers. Voucher posting remains in Sales because the document source, timing, metadata, and period-lock context are Sales-document-specific.

Files changed include:

- `backend/src/application/inventory/contracts/InventoryIntegrationContracts.ts`
- `backend/src/application/inventory/services/SalesInventoryService.ts`
- `backend/src/application/inventory/services/PurchasesInventoryService.ts`
- `backend/src/application/system-core/contracts/IInventoryCore.ts`
- `backend/src/application/sales/use-cases/DeliveryNoteUseCases.ts`
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
- `backend/src/application/sales/use-cases/SalesReturnUseCases.ts`
- Purchase posting use cases now type their inventory dependency as `IInventoryCore`.
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`
- `docs/architecture/system-core.md`

## End-User View

There is no user-facing workflow change. Sales invoices, delivery notes, sales returns, purchase invoices, purchase returns, and inventory movements should behave the same as before.

The internal accounting control is cleaner: COGS account selection and grouping now comes from the shared Inventory Core instead of Sales owning that logic locally. This reduces the risk of Sales, POS, and future modules drifting into different COGS behavior.

## Verification

- Focused COGS/architecture regressions passed: 5 suites / 80 tests.
- `npm --prefix backend run typecheck` passed.
- `npm --prefix backend run build` passed.
- Full backend suite passed: 183 passed / 2 skipped suites; 1,597 passed / 18 skipped tests.

## Known Follow-Ups

`SalesInventoryService` and `PurchasesInventoryService` class names still exist as implementation names. The contract is neutral now; class-name cleanup can be a later mechanical rename after CTO audit.
