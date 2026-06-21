# 250l — Commercial Core Completion Report

**Date:** 2026-06-21  
**Status:** In progress by slices  
**Actual time:** 250l-1 ~1.0h; 250l-2 ~1.0h

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

- 250l-3: promotions with stacking/conflict model.
- Move SO/PO/SR/PR remaining local discount helpers behind Commercial Core in a later narrow cleanup.
- Merge Sales/Purchases price-list resolution behind a richer `ICommercialCore.resolvePrice(...)` result contract once current SI/PI totals are audited.

## Slice 250l-2 — Cost/Margin Guard

### Technical Developer View

Expanded `ICommercialCore` with `validateCostMargin(...)`:

- Computes margin from base unit selling price and base unit cost.
- Allows healthy margins.
- Treats missing/zero cost as `NO_COST` and does not block, so service/unsettled-cost paths are not falsely rejected.
- Routes below-cost and below-minimum-margin cases to `IApprovalEngine` with subject type `below_cost_sale`.
- Honors `approvedOverride` for already-approved manager/approval flows.

Wired POS sale posting to the guard after Inventory Core resolves actual stock OUT cost. If the approval result is pending, POS blocks before revenue/COGS/settlement vouchers are emitted. If the line carries `approvedCostMarginOverride`, posting continues.

### End-User View

POS can now prevent a cashier from completing a sale below cost unless an approved override is present. Normal sales above cost continue as before.

### Verification

- Focused 250l-2 tests passed: 5 suites / 38 tests.
- `npm --prefix backend run typecheck` passed.
- `npm --prefix backend run build` passed.
- Full backend suite passed: 186 passed / 2 skipped suites; 1,612 passed / 18 skipped tests.

### Known Follow-Ups

- Add the manager approval capture/UI flow for `approvedCostMarginOverride`.
- Apply margin checks to non-POS Sales flows after defining the Sales approval UX.
- 250l-3: promotions with stacking/conflict model.
