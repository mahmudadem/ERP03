# Task 267-F — Purchase Return Bridge Migration

**Date:** 2026-06-25
**Branch:** `codex/267-system-core-boundary-audit`
**Slice:** Purchases / Purchase Return document voucher path.

## What Changed

`PostPurchaseReturnUseCase` no longer holds a direct `SubledgerVoucherPostingService` dependency for document voucher posting. Purchase Return document vouchers now route through `IAccountingBridge` only:

- Removed the posting-service import, field, and constructor dependency from `PostPurchaseReturnUseCase`.
- Made `accountingBridge` required for posting.
- Changed both `postFinancialEvent({ bridge, postingService })` calls to `postFinancialEvent({ bridge })`.
- Updated `PurchaseController.postReturn` to pass `buildAccountingBridge()` directly.
- Kept `UnpostPurchaseReturnUseCase` on a narrow local voucher-deletion interface for reversing an already-posted PR; the post path is bridge-only.

## Golden Tests

New `PurchaseReturnGoldenVoucher.test.ts` pins:

- AFTER_INVOICE AP/return/tax reversal voucher output: account ids, sides, amounts, currency, source metadata, reference, and voucher id linking.
- BEFORE_INVOICE PERPETUAL GRNI/Inventory reversal voucher output.
- `createAccountingEffect=false`: no bridge event and no GL voucher link.
- Minimal mode: the event reaches the bridge, but no GL voucher id is linked.
- Output stability across repeated runs.

## Files Touched

| File | Change |
|---|---|
| `backend/src/application/purchases/use-cases/PurchaseReturnUseCases.ts` | Removed posting-service fallback from post path; required bridge |
| `backend/src/api/controllers/purchases/PurchaseController.ts` | `postReturn` passes bridge directly |
| `backend/src/tests/application/purchases/PurchaseReturnGoldenVoucher.test.ts` | New golden voucher-output tests |
| `backend/src/tests/application/purchases/PurchaseReturnUseCases.test.ts` | Existing PR constructions wired with `LegacyAccountingBridgeAdapter` |
| `backend/src/tests/architecture/SystemCoreBoundaries.test.ts` | New 267-F PR guard |
| `docs/architecture/accounting.md` | Added PR migration notes |
| `docs/architecture/module-boundaries.md` | Updated FUP-3 migrated/remaining paths |
| `docs/architecture/posting-log.md` | Updated PR row |
| `docs/architecture/system-core.md` | Updated bridge-migration scope note |

## Verification

```
npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchaseReturnGoldenVoucher.test.ts
-> 5/5 PASS

npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchaseReturnUseCases.test.ts
-> 8/8 PASS

npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchasePostingUseCases.test.ts
-> 22/22 PASS

npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts
-> 23/23 PASS

npm --prefix backend run build
-> tsc clean

git diff --check
-> no whitespace errors (CRLF normalization warnings only)
```

## Accounting / Control Impact

No accounting-output change intended. The Purchase Return voucher branches remain the same: AFTER_INVOICE/DIRECT reverses AP against purchase-return/tax/exchange lines, and BEFORE_INVOICE PERPETUAL reverses GRNI against Inventory. Minimal mode remains bridge-owned and links no GL voucher id when the Accounting Engine is not initialized.

## Technical Developer View

The post use case now has a compile-time required bridge dependency. Existing full-mode tests use `LegacyAccountingBridgeAdapter` to keep exercising the same subledger posting behavior through the bridge boundary. `UnpostPurchaseReturnUseCase` is intentionally not migrated to bridge posting; it only needs a deletion adapter for reversing an existing voucher.

## End-User View

No user-facing change. Posting a Purchase Return behaves the same for stock, vendor balance, taxes, and voucher links. Internally, the return financial event now uses the accounting bridge as the single posting decision point.
