# Task 267-F — Inventory Stock Adjustment bridge migration

**Date:** 2026-06-25  
**Branch:** `codex/267-system-core-boundary-audit`  
**Status:** Complete

## Technical Developer View

### What changed

- Added golden voucher-output coverage in `backend/src/tests/application/inventory/StockAdjustmentGoldenVoucher.test.ts`.
- Migrated `PostStockAdjustmentUseCase` from a direct `SubledgerVoucherPostingService` fallback to required `IAccountingBridge`.
- Changed the Stock Adjustment `postFinancialEvent(...)` call to pass `{ bridge }` only.
- Removed the old `accountingPostingService` gate from voucher creation; the decision remains accounting-effect + accounting mode, and the bridge owns full vs minimal mode.
- Updated `InventoryController.postStockAdjustment` so it no longer constructs a posting service for this path; it passes `InventoryController.buildAccountingBridge()` explicitly.
- Updated existing Stock Adjustment valuation/atomicity tests to inject a full-mode bridge and assert bridge events.
- Added a `267-F (Inventory Stock Adjustment)` architecture guard in `SystemCoreBoundaries.test.ts`.
- Updated accounting/system-core/module-boundary/posting-log docs.

### Voucher output pinned

`StockAdjustmentGoldenVoucher.test.ts` pins:

- PERPETUAL stock gain and stock loss voucher output.
- Inventory Asset debit / Inventory Gain credit for adjustment IN.
- Inventory Loss debit / Inventory Asset credit for adjustment OUT.
- Exact voucher header fields, source metadata, `postingLockPolicy`, movement metadata, and base/doc amounts.
- Minimal mode: bridge event still emitted, but no GL voucher id is linked.
- PERIODIC mode: no bridge event and no GL voucher link.
- Output stability across repeated postings.

### Files changed

- `backend/src/application/inventory/use-cases/StockAdjustmentUseCases.ts`
- `backend/src/api/controllers/inventory/InventoryController.ts`
- `backend/src/tests/application/inventory/StockAdjustmentGoldenVoucher.test.ts`
- `backend/src/tests/application/inventory/StockAdjustmentGLValuation.test.ts`
- `backend/src/tests/application/inventory/StockAdjustmentAtomicity.test.ts`
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`
- `docs/architecture/accounting.md`
- `docs/architecture/system-core.md`
- `docs/architecture/module-boundaries.md`
- `docs/architecture/posting-log.md`

### Verification

- `npm --prefix backend test -- --runInBand src/tests/application/inventory/StockAdjustmentGoldenVoucher.test.ts`
- `npm --prefix backend test -- --runInBand src/tests/application/inventory/StockAdjustmentGLValuation.test.ts`
- `npm --prefix backend test -- --runInBand src/tests/application/inventory/StockAdjustmentAtomicity.test.ts`
- Full architecture/build verification recorded in `planning/JOURNAL.md`.

### Accounting impact

No accounting math changed. Voucher lines are still valued from actual stock movement cost, not typed adjustment cost. Dedicated Inventory Gain/Loss account routing remains unchanged. The only boundary change is that the assembled voucher is now recorded through `IAccountingBridge`, which owns full-vs-minimal mode from Accounting Engine initialization.

## End-User View

Stock Adjustment posting behaves the same for users. Stock increases still debit Inventory and credit the configured Inventory Gain account. Stock decreases still debit Inventory Loss and credit Inventory. In periodic inventory mode, the adjustment still changes stock records without creating a GL voucher. The internal posting path now uses the shared accounting bridge for more consistent audit and engine behavior.

## Known follow-ups

Remaining Task 267-F inventory slices:

- Stock Transfer posting
- Inventory Revaluation posting
