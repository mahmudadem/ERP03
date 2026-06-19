# 242 — Strict Pricing-Policy Resolution

**Date:** 2026-06-19  
**Agent:** Codex  
**Branch:** `codex/242-strict-pricing-policy-resolution`  
**Status:** Complete; PR-ready, not merged  
**Time spent:** ~1.2h

## Technical Developer View

Task 242 changes sales and purchase line-price resolution from a cascading source chain to a strict single-source policy.

Before this task, the effective-price resolver could move through `PRICE_LIST -> LAST_PARTY_PRICE -> LAST_EVENT -> ITEM_DEFAULT`. That meant a new customer/vendor could silently inherit a price observed from another party through `LAST_EVENT`. The owner rejected that behavior during Task 241 manual QA.

What changed:

- `backend/src/application/sales/use-cases/PriceListUseCases.ts`
  - `buildSourceOrder()` now returns one configured source only.
  - Missing/invalid settings default to `LAST_PARTY_PRICE`.
- `backend/src/application/purchases/use-cases/PurchasePriceListUseCases.ts`
  - Same strict single-source behavior for vendor prices.
- `backend/src/application/inventory/use-cases/InitializeInventoryUseCase.ts`
  - New inventory settings default to `LAST_PARTY_PRICE`.
- `backend/src/domain/inventory/entities/InventorySettings.ts`
  - Domain defaults and legacy/invalid normalization now use `LAST_PARTY_PRICE`.
- `backend/src/api/controllers/inventory/InventoryController.ts`
  - Inventory settings update fallback now uses `LAST_PARTY_PRICE`.
- `backend/src/application/onboarding/use-cases/SimpleTradingCompanyInitializer.ts`
  - Simple trading starter explicitly seeds `LAST_PARTY_PRICE`.
- `backend/scripts/task242-emulator-smoke.cjs`
  - Added compiled-backend Firestore emulator smoke for strict new-party blank behavior.

Tests added/updated:

- Sales resolver strict default, strict `PRICE_LIST`, and strict `ITEM_DEFAULT` cases.
- Purchase resolver strict default, strict `PRICE_LIST`, and strict `ITEM_DEFAULT` cases.
- Inventory settings default and legacy fallback assertions.
- Simple trading starter assertion for `LAST_PARTY_PRICE`.

## End-User View

ERP03 now follows one clear pricing rule at a time. By default, a line price is filled only when the same customer/vendor previously used that item in the same currency and UOM.

If the customer/vendor is new and has no own remembered price, the line is left blank for the user to enter manually. ERP03 no longer borrows another customer's or vendor's last item price.

When a company later chooses Price List or Item Default as the pricing source, that source is also strict. If the selected source has no matching price, the line stays blank.

## Verification

- `npm --prefix backend test -- --runTestsByPath src/tests/application/sales/PriceListResolution.test.ts src/tests/application/purchases/PurchasePriceListUseCases.test.ts src/tests/domain/inventory/InventorySettings.test.ts src/application/onboarding/use-cases/__tests__/SimpleTradingCompanyInitializer.test.ts --runInBand`
  - Passed: 4 suites / 51 tests.
- `npm --prefix backend run build`
  - Passed.
- `$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'; $env:GCLOUD_PROJECT='erp-03'; node backend/scripts/task242-emulator-smoke.cjs`
  - Passed against compiled `backend/lib`.
  - Returning customer/vendor resolved from `LAST_PARTY_PRICE`.
  - New customer/vendor returned blank/null even though item-level last-event and item-default prices existed.

## Acceptance Criteria

- Policy `LAST_PARTY_PRICE`: returning customer/vendor auto-fills own last price; new customer/vendor stays blank.
- Policy `PRICE_LIST`: only price-list source is used; no fallback to party memory or item default.
- Policy `ITEM_DEFAULT`: only item default is used.
- `source` remains returned on successful resolution.
- New simple trading company starter defaults to `LAST_PARTY_PRICE`.
- Architecture and user guide docs updated.

## Residual Risk

- Task 243 still needs to expose policy management in the UI. Until then, this task changes backend/default behavior and preserves API support for existing stored policy values.
