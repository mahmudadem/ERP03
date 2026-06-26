# Task 267-F — Inventory Revaluation bridge migration

**Date:** 2026-06-25  
**Branch:** `codex/267-system-core-boundary-audit`  
**Status:** Complete

## Technical Developer View

### What changed

- Added golden voucher-output coverage in `backend/src/tests/application/inventory/InventoryRevaluationGoldenVoucher.test.ts`.
- Migrated `PostInventoryRevaluationUseCase` from a direct `SubledgerVoucherPostingService` fallback to required `IAccountingBridge`.
- Changed Inventory Revaluation vouchers to call `postFinancialEvent({ bridge })` only.
- Updated `InventoryController.postInventoryRevaluation` so it no longer constructs a posting service for this path.
- Updated existing Inventory Revaluation tests to inject a full-mode bridge and assert bridge events.
- Replaced the old posting-service smoke guard with a bridge dependency smoke guard.
- Added a `267-F (Inventory Revaluation)` architecture guard in `SystemCoreBoundaries.test.ts`.
- Updated accounting/system-core/module-boundary/posting-log docs.

### Voucher output pinned

`InventoryRevaluationGoldenVoucher.test.ts` pins:

- Write-up: debit Inventory Asset, credit Inventory Revaluation account.
- Write-down: debit Inventory Revaluation account, credit Inventory Asset.
- Exact voucher header fields, source metadata, `postingLockPolicy`, line metadata, and base/doc amounts.
- Minimal mode: bridge event still emitted, but no GL voucher id is linked.
- PERIODIC mode: no bridge event and no GL voucher link.
- Output stability across repeated postings.

### Files changed

- `backend/src/application/inventory/use-cases/InventoryRevaluationUseCases.ts`
- `backend/src/api/controllers/inventory/InventoryController.ts`
- `backend/src/tests/application/inventory/InventoryRevaluationGoldenVoucher.test.ts`
- `backend/src/tests/application/inventory/InventoryRevaluationUseCases.test.ts`
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`
- `docs/architecture/accounting.md`
- `docs/architecture/system-core.md`
- `docs/architecture/module-boundaries.md`
- `docs/architecture/posting-log.md`

### Verification

- `npm --prefix backend test -- --runInBand src/tests/application/inventory/InventoryRevaluationGoldenVoucher.test.ts`
- `npm --prefix backend test -- --runInBand src/tests/application/inventory/InventoryRevaluationUseCases.test.ts`
- Full architecture/build verification recorded in `planning/JOURNAL.md`.

### Accounting impact

No accounting math changed. Write-up/write-down account sides, absolute delta amounts, periodic no-GL behavior, and sub-ledger average-cost updates are unchanged. The boundary change is that the assembled voucher is now recorded through `IAccountingBridge`.

## End-User View

Inventory Revaluation posting behaves the same for users. A cost increase still debits Inventory and credits the Inventory Revaluation account. A cost decrease still debits the Inventory Revaluation account and credits Inventory. In periodic inventory mode, the system still updates inventory valuation records without creating a GL voucher. The internal posting path now uses the shared accounting bridge.

## Known follow-ups

No remaining audited Task 267-F source-module posting fallback slices are known after this migration. Future posting paths must be added through required `IAccountingBridge` with golden voucher-output tests first.
