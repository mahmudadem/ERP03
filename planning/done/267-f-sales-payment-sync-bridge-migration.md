# Task 267-F — Sales PaymentSync Bridge Migration

**Date:** 2026-06-25
**Branch:** `codex/267-system-core-boundary-audit`
**Slice:** Sales PaymentSync / record-payment receipt vouchers.

## What Changed

`PostSalesInvoiceWithSettlementUseCase` and `RecordSalesInvoicePaymentUseCase` now require `IAccountingBridge`. The prior optional fallback path was removed: `PaymentSyncUseCases.ts` no longer imports or constructs `PostingGateway` directly.

Full-mode receipt persistence moved behind `PreBuiltVoucherFullPoster.postPreBuiltVoucherFullMode(...)`. The Sales use case passes that function as the `postFull` callback to `accountingBridge.recordPreBuiltVoucher(...)`; the bridge decides whether the callback runs.

## Golden Tests

New `SalesPaymentSyncGoldenVoucher.test.ts` pins:

- Exact prebuilt receipt voucher sent to the bridge: voucher number, type/status, date, currency/rate, metadata, Dr Cash / Cr AR lines, base/document amounts, and totals.
- Minimal mode: the same voucher output reaches the bridge, but no GL voucher id is linked to payment history.
- Foreign-currency receipt with realized FX gain line.

## Files Touched

| File | Change |
|---|---|
| `backend/src/application/sales/use-cases/PaymentSyncUseCases.ts` | Required `IAccountingBridge`; removed direct `PostingGateway` import/fallback; routes only through `recordPreBuiltVoucher` |
| `backend/src/application/accounting/services/PreBuiltVoucherFullPoster.ts` | New accounting-layer helper for full-mode persistence of prebuilt system vouchers |
| `backend/src/api/controllers/sales/SalesController.ts` | `recordPayment` passes `buildAccountingBridge()` in the required bridge position |
| `backend/src/tests/application/sales/SalesPaymentSyncGoldenVoucher.test.ts` | New golden voucher-output tests |
| `backend/src/tests/application/sales/SalesPaymentSyncUseCases.test.ts` | Existing tests wired with a full-mode bridge stub |
| `backend/src/tests/application/sales/FxGainLossSettlement.test.ts` | Existing FX tests wired with a full-mode bridge stub |
| `backend/src/tests/architecture/SystemCoreBoundaries.test.ts` | New 267-F Sales PaymentSync guard |
| `docs/architecture/accounting.md` | Updated Sales touchpoint and migration notes |
| `docs/architecture/posting-log.md` | Updated Sales record-payment row |

## Verification

```
npm --prefix backend test -- --runInBand src/tests/application/sales/SalesPaymentSyncGoldenVoucher.test.ts
-> 3/3 PASS

npm --prefix backend test -- --runInBand src/tests/application/sales/SalesPaymentSyncUseCases.test.ts
-> 10/10 PASS

npm --prefix backend test -- --runInBand src/tests/application/sales/FxGainLossSettlement.test.ts
-> 4/4 PASS

npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts
-> 20/20 PASS

npm --prefix backend run build
-> tsc clean
```

## Accounting / Control Impact

No intended accounting-output change. Full mode still runs the same ledger-door persistence and voucher save. Minimal mode remains the bridge-owned fallback for companies whose Accounting Engine is not initialized; payment history links no GL voucher in that mode.

## End-User View

No user-facing change. Recording a Sales Invoice payment behaves the same for users. Internally, the receipt voucher now goes through the accounting bridge as the single full-vs-minimal posting decision point.
