# Task 271 - Purchase Return direct mode and source picker parity

**Date:** 2026-06-26
**Branch:** `codex/271-returns-parity`
**Status:** Complete locally, pending PR/merge
**Estimated / actual:** 6-10h / ~3.5h

## Technical Developer View

Task 271 was narrowed to the safe accounting slice needed before exposing direct Purchase Returns cleanly:

- Direct PR draft creation now preserves unit cost, base cost, exchange rate, selected purchase tax code, tax rate, inclusive/exclusive basis, and computed tax amounts.
- Direct PR posting now credits the purchase tax account when tax applies, so the voucher balances as AP debit = net return credit + tax credit.
- Existing source-based PR behavior and golden voucher output are unchanged.
- Purchase Return create UI now uses an explicit `Direct / From PI / From GRN` mode control.
- `From PI` and `From GRN` use posted document pickers instead of raw source ID inputs.
- Direct mode uses vendor, warehouse, item, UOM, discount, and tax selectors.
- Posted Purchase Returns now expose **GL Impact**.
- Shared GL Impact labels now distinguish return vouchers from invoice vouchers.

Files changed:

- `backend/src/application/purchases/use-cases/PurchaseReturnUseCases.ts`
- `backend/src/api/controllers/purchases/PurchaseController.ts`
- `backend/src/api/validators/purchases.validators.ts`
- `backend/src/tests/application/purchases/PurchaseReturnUseCases.test.ts`
- `frontend/src/api/purchasesApi.ts`
- `frontend/src/modules/purchases/pages/PurchaseReturnDetailPage.tsx`
- `frontend/src/modules/sales/components/GlImpactModal.tsx`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `docs/architecture/purchases.md`
- `docs/user-guide/purchases/README.md`

## End-User View

Purchase Returns are now easier to start:

- Choose **Direct** when returning to a vendor without a linked purchase invoice or goods receipt.
- Choose **From PI** to select a posted Purchase Invoice from a picker.
- Choose **From GRN** to select a posted Goods Receipt from a picker.
- Direct returns let the user select vendor, warehouse, item lines, UOM, quantity, unit cost, discount, and tax code.
- Posted Purchase Returns include **GL Impact** so users can inspect the accounting entry.

## Verification

- `npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchaseReturnUseCases.test.ts` PASS
- `npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchaseReturnGoldenVoucher.test.ts` PASS
- `npm --prefix backend test -- --runInBand src/tests/application/sales/SalesReturnGoldenVoucher.test.ts` PASS
- `npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts` PASS
- `npm --prefix backend run build` PASS
- `npm --prefix frontend run typecheck` PASS
- `npm --prefix frontend run build` PASS

## Known Follow-Up

Sales Return already had the modern segmented create flow, source document dropdowns, direct mode, and GL Impact before this slice. A later UI-only polish slice can replace its native `<select>` source controls with richer modal pickers if owner QA still finds them insufficient.
