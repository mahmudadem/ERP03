# Task 243-A — Selectable Pricing Policy

**Date:** 2026-06-19  
**Branch:** `codex/243a-selectable-pricing-policy`  
**Status:** PR-ready; Task 243-B/C/D remain open.

## Technical Developer View

Implemented the Part A slice of Task 243: document-level line price source selection and party-level price-list reconciliation.

Changed:

- `backend/src/application/sales/use-cases/PriceListUseCases.ts`
- `backend/src/application/purchases/use-cases/PurchasePriceListUseCases.ts`
- `backend/src/api/controllers/sales/SalesMasterDataController.ts`
- `backend/src/api/controllers/purchases/PurchaseMasterDataController.ts`
- `backend/src/tests/application/sales/PriceListResolution.test.ts`
- `backend/src/tests/application/purchases/PurchasePriceListUseCases.test.ts`
- `frontend/src/api/salesMasterDataApi.ts`
- `frontend/src/api/purchasesApi.ts`
- `frontend/src/components/shared/pricing/LinePriceSourceSelector.tsx`
- `frontend/src/modules/sales/services/salesLinePriceResolver.ts`
- `frontend/src/modules/purchases/services/purchaseLinePriceResolver.ts`
- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseOrderDetailPage.tsx`
- `frontend/src/modules/accounting/components/shared/GenericVoucherRenderer.tsx`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/tr/common.json`
- `docs/architecture/pricing.md`
- `docs/user-guide/sales/pricing-policy-selection.md`

Backend effective-price queries now accept optional `priceSource` with `PRICE_LIST`, `LAST_PARTY_PRICE`, `LAST_EVENT`, or `ITEM_DEFAULT`. When omitted, the existing company setting remains the default. When supplied, the lookup is strict to that single source.

Party-level price-list assignment was reconciled with the existing `Party.defaultPriceListId` field. The customer/vendor commercial card already saves this field, and the strict `PRICE_LIST` resolver already reads it before the currency default list.

## End-User View

Users can choose how ERP03 suggests item line prices on draft sales and purchase documents:

- last price for this customer/vendor,
- assigned/default price list,
- last item sale/purchase event,
- item default price.

If the selected source has no matching price, ERP03 leaves the price blank so the user can type it manually. It does not silently borrow a different price source.

## Verification

- `npm --prefix backend test -- --runTestsByPath src/tests/application/sales/PriceListResolution.test.ts src/tests/application/purchases/PurchasePriceListUseCases.test.ts --runInBand` — passed, 2 suites / 47 tests.
- `npm --prefix frontend run typecheck` — passed.
- `npm --prefix backend run build` — passed.
- `npm --prefix frontend run build` — passed with existing bundle-size/Browserslist/baseline-data warnings.

## Remaining Work

- Task 243-B: Forms Management per-form settings and persisted per-form defaults.
- Task 243-C: right-click price-column override for one document.
- Task 243-D: full parity audit after B/C land.
