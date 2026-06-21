# 250l — Commercial Core Completion Report

**Date:** 2026-06-21  
**Status:** In progress by slices  
**Actual time:** 250l-1 ~1.0h

## Slice 250l-1 — Pricing + Line/Discount Calculation

### Technical Developer View

Added `application/system-core/commercial/CommercialCore.ts` and expanded `ICommercialCore`:

- `calcDiscount(...)` / `calculateCommercialDiscountAmount(...)` owns PERCENT/AMOUNT line discount calculation with gross clamping.
- `calcLine(...)` / `calculateCommercialLineAmounts(...)` owns commercial line amount calculation by computing the explicit discount amount and passing that to Tax Engine for tax splitting.
- `resolvePrice(...)` remains the shared price-resolution seam; DI now provides a current item `salePrice` delegate.

Rewired amount calculation:

- `SalesInvoiceCalculationService.calculateSalesInvoiceLineAmounts(...)` delegates to Commercial Core.
- `SalesInvoice` normalization delegates to Commercial Core.
- `PurchaseInvoice` normalization delegates to Commercial Core.
- `PurchaseInvoiceUseCases` tax-freeze and source-line normalization delegates to Commercial Core.

Rewired POS price display:

- `SearchPosProductsUseCase` now calls `ICommercialCore.resolvePrice(...)` for cashier product prices.
- If Commercial Core has no price, POS falls back to the item `salePrice`, preserving current behavior.

Scope decision: Sales and Purchase price-list CRUD/resolution use cases remain module-local in 250l-1. Sales Order, Purchase Order, Sales Return, and Purchase Return still have local line-discount helpers; moving those paths is a follow-up within Commercial Core after the posting-sensitive SI/PI path is stable.

### End-User View

There is no intended user-facing change in totals. Sales invoices and purchase invoices should show the same subtotal, discount, tax, and grand total as before.

POS product search now gets its displayed price through the shared Commercial Core seam. For users, the visible result should remain the same unless a future pricing resolver supplies a different approved price.

### Verification

- Focused 250l-1 tests passed: 7 suites / 80 tests.
- `npm --prefix backend run typecheck` passed.
- `npm --prefix backend run build` passed.
- Full backend suite passed: 186 passed / 2 skipped suites; 1,607 passed / 18 skipped tests.

### Known Follow-Ups

- 250l-2: cost/margin guard and below-cost approval.
- 250l-3: promotions with stacking/conflict model.
- Move SO/PO/SR/PR remaining local discount helpers behind Commercial Core in a later narrow cleanup.
- Merge Sales/Purchases price-list resolution behind a richer `ICommercialCore.resolvePrice(...)` result contract once current SI/PI totals are audited.
