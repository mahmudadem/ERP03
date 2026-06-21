# 250h — Tax Engine Extraction

**Date:** 2026-06-21  
**Branch:** `feat/system-core-transformation`  
**Status:** Done, green.  
**Actual time:** ~1.8h

## Technical Developer View

250h moves audited invoice/POS tax calculation into System Core behind `ITaxEngine`.

### What changed

- Added `backend/src/application/system-core/tax/TaxEngine.ts`.
- Replaced the Sales-coupled `ITaxEngine` contract with neutral tax inputs/outputs.
- Changed `LegacyTaxEngineAdapter` to extend the real `TaxEngine`.
- Kept `SalesInvoiceCalculationService` as a thin compatibility wrapper over System Core.
- Rewired POS preview and POS sale posting to consume `ITaxEngine`.
- Rewired Sales Invoice and Purchase Invoice entity normalization to use shared tax calculation.
- Rewired Purchase Invoice create and tax-freeze paths to use shared tax calculation.
- Added `allocateInvoiceDiscount(...)` and `recoverable(...)`.
- Added T8/golden/recoverable/allocation tests and architecture guards.

### Accounting / ERP impact

This is a calculation-ownership refactor with additive APIs. Existing SI/PI/POS line totals, inclusive-tax behavior, and line-discount behavior are intended unchanged and are pinned by golden tests.

The new invoice-discount allocation API is not silently applied to live posting totals in this slice. Applying it would intentionally change invoice tax/grand totals for invoice-level discounts, so it should be handled as a separate accounting-approved behavior slice.

Purchase recoverability is now represented by the Tax Engine API. Existing purchase posting remains unchanged until a later slice decides how non-recoverable input tax should be capitalized or expensed.

## End-User View

Users should not see a workflow change from this task. The same invoice and POS tax totals should continue to appear, but the system now calculates those totals from one shared tax engine. This reduces the risk that Sales, Purchases, and POS calculate tax differently for the same tax code.

## Verification

- `npm --prefix backend test -- --runInBand src/tests/application/system-core/TaxEngine.test.ts src/tests/application/sales/TaxInclusivePricing.test.ts src/tests/domain/purchases/PurchaseInvoice.test.ts src/tests/application/pos/PostPosSale.test.ts src/tests/architecture/SystemCoreBoundaries.test.ts` — passed, 5 suites / 50 tests.
- `npm --prefix backend run typecheck` — passed.
- `npm --prefix backend run build` — passed.
- `npm --prefix backend test -- --runInBand` — passed, 182 passed / 2 skipped suites; 1,592 passed / 18 skipped tests.

## Next

Continue Phase 3 with 250i Numbering Engine unification. Do not start Phase 4 after 250j; hard-stop for CTO audit.
