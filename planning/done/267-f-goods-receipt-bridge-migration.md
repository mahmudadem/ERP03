# Task 267-F — Goods Receipt Bridge Migration

**Date:** 2026-06-25
**Branch:** `codex/267-system-core-boundary-audit`
**Slice:** Purchases / Goods Receipt Inventory-GRNI voucher path.

## What Changed

`PostGoodsReceiptUseCase` no longer holds a direct `SubledgerVoucherPostingService` dependency. Goods Receipt posting now sends its financial event through `IAccountingBridge` only:

- Removed the posting-service constructor dependency from `PostGoodsReceiptUseCase`.
- Made `accountingBridge` required for posting.
- Changed `postFinancialEvent({ bridge, postingService })` to `postFinancialEvent({ bridge })`.
- Updated `PurchaseController.postGRN` to pass `buildAccountingBridge()` directly.
- Kept `UnpostGoodsReceiptUseCase` on a narrow local voucher-deletion interface for reversing an already-posted GRN; the post path is bridge-only.

## Golden Tests

New `GoodsReceiptGoldenVoucher.test.ts` pins:

- PERPETUAL mode Inventory/GRNI voucher output: account ids, sides, amounts, currency, source metadata, reference, and voucher id linking.
- Minimal mode: the same event reaches the bridge, but the GRN links no GL voucher id.
- PERIODIC mode: no GRNI bridge event is created.

## Files Touched

| File | Change |
|---|---|
| `backend/src/application/purchases/use-cases/GoodsReceiptUseCases.ts` | Removed posting-service fallback from post path; required bridge |
| `backend/src/api/controllers/purchases/PurchaseController.ts` | `postGRN` passes bridge directly; wording updated to Engine initialized/not initialized |
| `backend/src/tests/application/purchases/GoodsReceiptGoldenVoucher.test.ts` | New golden voucher-output tests |
| `backend/src/tests/application/purchases/PurchasePostingUseCases.test.ts` | Existing GRN constructions wired with `LegacyAccountingBridgeAdapter` |
| `backend/src/tests/architecture/SystemCoreBoundaries.test.ts` | New 267-F GRN guard |
| `docs/architecture/accounting.md` | Added GRN migration notes |
| `docs/architecture/posting-log.md` | Updated GRN row |

## Verification

```
npm --prefix backend test -- --runInBand src/tests/application/purchases/GoodsReceiptGoldenVoucher.test.ts
-> 3/3 PASS

npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchasePostingUseCases.test.ts
-> 22/22 PASS

npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts
-> 21/21 PASS

npm --prefix backend run build
-> tsc clean
```

## Accounting / Control Impact

No accounting-output change intended. The GRN voucher remains Dr Inventory / Cr GRNI in PERPETUAL mode, no voucher in PERIODIC mode, and no GL voucher id in minimal mode when the Accounting Engine is not initialized.

## End-User View

No user-facing change. Posting a Goods Receipt behaves the same, but internally the GRN financial event now uses the accounting bridge as the single posting decision point.
