# Task 267-F — Inventory Stock Transfer bridge migration

**Date:** 2026-06-25  
**Branch:** `codex/267-system-core-boundary-audit`  
**Status:** Complete

## Technical Developer View

### What changed

- Added golden voucher-output coverage in `backend/src/tests/application/inventory/StockTransferGoldenVoucher.test.ts`.
- Migrated `CompleteStockTransferUseCase` from a direct `SubledgerVoucherPostingService` fallback to required `IAccountingBridge`.
- Changed explicit valued-transfer uplift vouchers to call `postFinancialEvent({ bridge })` only.
- Updated `InventoryController.buildCompleteStockTransferUseCase()` so it no longer constructs a posting service for this path.
- Updated existing Stock Transfer valuation tests to inject a full-mode bridge and assert bridge events.
- Added a `267-F (Inventory Stock Transfer)` architecture guard in `SystemCoreBoundaries.test.ts`.
- Updated accounting/system-core/module-boundary/posting-log docs.

### Voucher output pinned

`StockTransferGoldenVoucher.test.ts` pins:

- Added-cost VALUED transfer: debit Inventory, credit Inventory Transfer Clearing.
- Explicit revaluation transfer: debit/credit Inventory and Inventory Revaluation account according to the delta.
- Exact voucher header fields, source metadata, `postingLockPolicy`, line metadata, and base/doc amounts.
- Minimal mode: bridge event still emitted, but no GL voucher id is linked.
- VALUED transfer with no explicit added cost or revaluation: no bridge event and no GL voucher link.
- Output stability across repeated postings.

### Files changed

- `backend/src/application/inventory/use-cases/StockTransferUseCases.ts`
- `backend/src/api/controllers/inventory/InventoryController.ts`
- `backend/src/tests/application/inventory/StockTransferGoldenVoucher.test.ts`
- `backend/src/tests/application/inventory/StockTransferValuedVoucher.test.ts`
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`
- `docs/architecture/accounting.md`
- `docs/architecture/system-core.md`
- `docs/architecture/module-boundaries.md`
- `docs/architecture/posting-log.md`

### Verification

- `npm --prefix backend test -- --runInBand src/tests/application/inventory/StockTransferGoldenVoucher.test.ts`
- `npm --prefix backend test -- --runInBand src/tests/application/inventory/StockTransferValuedVoucher.test.ts`
- Full architecture/build verification recorded in `planning/JOURNAL.md`.

### Accounting impact

No accounting math changed. The path still posts only explicit valued-transfer deltas; ordinary flat transfers and valued transfers without explicit uplift remain no-GL. Added cost and revaluation account routing are unchanged. The boundary change is that the assembled voucher is now recorded through `IAccountingBridge`.

## End-User View

Stock Transfer completion behaves the same. Normal transfers move stock without creating a GL voucher. Valued transfers with explicit added cost or revaluation still create the same accounting entry. The internal posting path now goes through the shared accounting bridge so full posting and minimal event capture follow the same engine rule as other modules.

## Known follow-ups

Remaining Task 267-F inventory slice:

- Inventory Revaluation posting
