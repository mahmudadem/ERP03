# 205 — Discount Type Currency Label Fix

**Date:** 2026-06-12  
**Actual time spent:** ~0.3h

## Technical Developer View

Fixed the shared discount-type UI so amount discounts are labeled with the active document currency instead of a hardcoded `$`.

Files changed:
- `frontend/src/components/shared/selectors/DiscountTypeSelector.tsx`
- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/modules/sales/pages/SalesOrderDetailPage.tsx`
- `frontend/src/modules/sales/pages/QuotationDetailPage.tsx`
- `frontend/src/modules/sales/pages/SalesReturnDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseOrderDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseReturnDetailPage.tsx`

Implementation notes:
- Added a `currencyCode` prop to `DiscountTypeSelector`.
- The AMOUNT option now displays the document currency code, e.g. `SYP`, while still accepting `$` as a typed shortcut for amount discount.
- Updated editable discount-type cells across Sales and Purchases documents.
- Updated read-only discount-type display paths that previously rendered `$` directly.

Accounting impact:
- Display-only correction. No changes to discount math, taxable base calculation, backend DTOs, validation, posting, AR/AP, inventory valuation, ledger entries, audit, approval, or period-lock behavior.
- This reduces user confusion by making fixed-amount line discounts visibly tied to the document currency.

## End-User View

When a document uses a currency such as `SYP`, the line discount type for fixed amount discounts now shows `SYP` instead of `$`.

This applies to Sales and Purchases document line tables where line discounts are available.

## Verification

- `npm --prefix frontend run typecheck` passed.
- Scoped search confirmed no remaining hardcoded `$` amount-discount symbols in the patched selector/page paths.

## Manual QA

Open a Sales Invoice or Purchase Invoice in a non-USD currency such as `SYP`, choose the line Discount Type picker, and confirm the Amount row and selected cell show `SYP`.
