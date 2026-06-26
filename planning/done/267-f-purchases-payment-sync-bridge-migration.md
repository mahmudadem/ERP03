# Task 267-F — Purchases PaymentSync Bridge Migration

**Date:** 2026-06-25
**Branch:** `codex/267-system-core-boundary-audit`
**Slice:** Purchases PaymentSync / Purchase Invoice record-payment vouchers.

## What Changed

`PostPurchaseInvoiceWithSettlementUseCase` and `RecordPurchaseInvoicePaymentUseCase` now require `IAccountingBridge`. The prior optional fallback path was removed: `PaymentSyncUseCases.ts` no longer imports or constructs `PostingGateway` directly.

Full-mode payment voucher persistence now uses `PreBuiltVoucherFullPoster.postPreBuiltVoucherFullMode(...)`. The Purchases use case passes that function as the `postFull` callback to `accountingBridge.recordPreBuiltVoucher(...)`; the bridge decides whether the callback runs.

## Golden Tests

New `PurchasePaymentSyncGoldenVoucher.test.ts` pins:

- Exact prebuilt payment voucher sent to the bridge: voucher number, type/status, date, currency/rate, metadata, Dr AP / Cr Cash lines, base/document amounts, and totals.
- Minimal mode: the same voucher output reaches the bridge, but no GL voucher id is linked to payment history.
- DEFERRED mode: no bridge event and no voucher id.

## Files Touched

| File | Change |
|---|---|
| `backend/src/application/purchases/use-cases/PaymentSyncUseCases.ts` | Required `IAccountingBridge`; removed direct `PostingGateway` import/fallback; routes only through `recordPreBuiltVoucher` |
| `backend/src/api/controllers/purchases/PurchaseController.ts` | `recordPayment` passes `buildAccountingBridge()` in the required bridge position |
| `backend/src/tests/application/purchases/PurchasePaymentSyncGoldenVoucher.test.ts` | New golden voucher-output tests |
| `backend/src/tests/application/purchases/PurchasePaymentSyncUseCases.test.ts` | Existing tests wired with a full-mode bridge stub |
| `backend/src/tests/architecture/SystemCoreBoundaries.test.ts` | New 267-F Purchases PaymentSync guard |
| `docs/architecture/accounting.md` | Updated Purchases touchpoint and migration notes |
| `docs/architecture/module-boundaries.md` | Updated FUP-3 migrated/remaining paths |
| `docs/architecture/posting-log.md` | Added Purchases record-payment row |
| `docs/architecture/system-core.md` | Updated bridge-migration scope note |

## Verification

```
npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchasePaymentSyncGoldenVoucher.test.ts
-> 3/3 PASS

npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchasePaymentSyncUseCases.test.ts
-> 9/9 PASS

npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts
-> 24/24 PASS

npm --prefix backend run build
-> tsc clean

git diff --check
-> no whitespace errors (CRLF normalization warnings only)
```

## Accounting / Control Impact

No intended accounting-output change. Full mode still runs the same ledger-door persistence and voucher save. Minimal mode remains the bridge-owned fallback for companies whose Accounting Engine is not initialized; payment history links no GL voucher in that mode.

## Technical Developer View

The payment sync use cases now have a compile-time required bridge dependency. Existing tests use a full-mode bridge stub that invokes `event.postFull()`, preserving the prior gateway/voucher persistence assertions while removing the source-module direct fallback.

## End-User View

No user-facing change. Recording a Purchase Invoice payment behaves the same for users. Internally, the payment voucher now goes through the accounting bridge as the single full-vs-minimal posting decision point.
