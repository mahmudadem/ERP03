# Task 267-F — Inventory Opening Stock bridge migration

**Date:** 2026-06-25  
**Branch:** `codex/267-system-core-boundary-audit`  
**Status:** Complete

## Technical Developer View

### What changed

- Added golden voucher-output coverage in `backend/src/tests/application/inventory/OpeningStockGoldenVoucher.test.ts`.
- Migrated `PostOpeningStockDocumentUseCase` from a direct `SubledgerVoucherPostingService` fallback to required `IAccountingBridge`.
- Changed the Opening Stock `postFinancialEvent(...)` call to pass `{ bridge }` only.
- Updated `InventoryController.postOpeningStockDocument` so it no longer constructs a posting service for this path; it passes `InventoryController.buildAccountingBridge()` explicitly.
- Updated existing Opening Stock tests to inject a full-mode bridge and assert bridge events instead of direct `postInTransaction(...)`.
- Added a `267-F (Inventory Opening Stock)` architecture guard in `SystemCoreBoundaries.test.ts`.
- Updated accounting/system-core/module-boundary/posting-log docs.

### Voucher output pinned

`OpeningStockGoldenVoucher.test.ts` pins:

- PERPETUAL Inventory Asset debit / Opening Equity credit output.
- Exact voucher header fields, source metadata, `postingLockPolicy`, and strategy payload balances.
- Minimal mode: bridge event still emitted, but no GL voucher id is linked.
- PERIODIC mode: inventory settings asset account is used instead of item-level asset account.
- Inventory-only opening stock: no bridge event and no GL link.
- Output stability across repeated postings.

### Files changed

- `backend/src/application/inventory/use-cases/OpeningStockDocumentUseCases.ts`
- `backend/src/api/controllers/inventory/InventoryController.ts`
- `backend/src/tests/application/inventory/OpeningStockGoldenVoucher.test.ts`
- `backend/src/tests/application/inventory/OpeningStockDocumentUseCases.test.ts`
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`
- `docs/architecture/accounting.md`
- `docs/architecture/system-core.md`
- `docs/architecture/module-boundaries.md`
- `docs/architecture/posting-log.md`

### Verification

- `npm --prefix backend test -- --runInBand src/tests/application/inventory/OpeningStockGoldenVoucher.test.ts`
- `npm --prefix backend test -- --runInBand src/tests/application/inventory/OpeningStockDocumentUseCases.test.ts`
- Full architecture/build verification recorded in `planning/JOURNAL.md`.

### Accounting impact

No accounting math changed. The same opening stock voucher payload is now handed to `IAccountingBridge`, which owns the full-vs-minimal decision based on Accounting Engine initialization. The Accounting App/UI visibility toggle is not a posting correctness gate.

## End-User View

Opening Stock posting behaves the same for users. If the document is inventory-only, it posts stock quantities and costs without creating a GL voucher. If the user chooses to create an accounting effect, the system posts the same Opening Stock accounting voucher as before: debit Inventory and credit the configured Opening Balance Equity account. The change is internal: the posting now uses the shared accounting engine bridge so future controls and audit behavior stay consistent across modules.

## Known follow-ups

Remaining Task 267-F inventory slices:

- Stock Adjustment posting
- Stock Transfer posting
- Inventory Revaluation posting
