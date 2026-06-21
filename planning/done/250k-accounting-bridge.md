# 250k — Accounting Bridge Hardening Completion Report

**Date:** 2026-06-21  
**Status:** Complete, committed  
**Actual time:** ~1.1h

## Technical Developer View

Hardened `IAccountingBridge` so financial-event recording has explicit full/minimal modes:

- `full` mode is selected when `companyModule.accounting.isEnabled === true` and delegates to the existing `SubledgerVoucherPostingService.postInTransaction(...)`.
- `minimal` mode is selected when the Accounting App is disabled or absent and writes a `PostingLog` event record instead of a ledger voucher.
- The bridge return now exposes `{ mode, voucher, eventLogId }`, so callers can distinguish a full voucher from a minimal journal capture.

Rewired the remaining POS direct-post bypass:

- POS sale and return already used `IAccountingBridge`; their voucher-id handling now reads `result.voucher?.id`.
- POS shift close/force-close over-short posting now emits `POS_SHIFT_OVER_SHORT` through `IAccountingBridge`.
- `PosController` no longer constructs `SubledgerVoucherPostingService`.
- `SystemCoreBoundaries.test.ts` now blocks POS application/controllers from importing `SubledgerVoucherPostingService` or calling `postInTransaction(...)` directly.

Persistence changes:

- `PostingLog` now allows `sourceModule: 'pos'` and POS source types.
- `IPostingLogRepository.create(...)` accepts an optional transaction; the Firestore implementation writes through the transaction when provided.

Scope decision: Sales, Purchases, and Inventory still use their existing full-posting workflows in this contained hardening slice. Rewiring every source-module poster behind `IAccountingBridge` would touch many posting-sensitive files and should be a separate module-by-module migration with golden voucher-output checks.

## End-User View

There is no UI workflow change. POS sales, returns, and shift close should behave the same when Accounting is enabled.

If the Accounting App is disabled for a company, POS financial events are still recorded as minimal journal records for auditability instead of being silently ignored. Those records are not full ledger vouchers and do not produce financial statements until a future explicit replay/migration policy converts them.

## Verification

- Focused bridge/POS/architecture tests passed: 5 suites / 26 tests.
- `npm --prefix backend run typecheck` passed.
- `npm --prefix backend run build` passed.
- Full backend suite passed: 184 passed / 2 skipped suites; 1,600 passed / 18 skipped tests.

## Known Follow-Ups

- Move Sales, Purchases, and Inventory source-module posting behind `IAccountingBridge` in separate slices with golden voucher-output checks.
- Define the owner-approved replay/migration policy for minimal-journal events before production use of Accounting-off operational mode.
