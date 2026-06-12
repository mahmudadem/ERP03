# 199 - Sales Return Source Control Parity

**Date:** 2026-06-09  
**Agent:** Codex  
**Actual time:** ~0.5h

## Technical Developer View

Updated the native Sales Return create page so return-source selection matches the Sales Invoice source-control pattern.

Files changed:

- `frontend/src/modules/sales/pages/SalesReturnDetailPage.tsx`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `docs/architecture/sales.md`
- `docs/user-guide/sales/sales-returns.md`

Implementation:

- Added a compact **Return Control** strip with `After Invoice`, `Before Invoice`, and `Direct Return` options.
- Moved mode selection out of the header form.
- Kept the source-specific picker in the header below the control strip:
  - `AFTER_INVOICE` shows posted Sales Invoice selection.
  - `BEFORE_INVOICE` shows posted Delivery Note selection.
  - `DIRECT` shows the customer selector.
- Added localized helper copy for the SI-style "pick source in header" / "direct header driven" indicator.

## End-User View

When creating a Sales Return, the top control section now decides what kind of return you are making. After choosing the mode, the header shows the correct next field: Sales Invoice, Delivery Note, or Customer.

This makes Sales Return behave like Sales Invoice source selection: choose the source mode first, then fill the matching header fields.

## Accounting Boundary

UI/data-entry layout only. No Sales Return posting, tax, AR reversal, credit-note/refund settlement, inventory receipt, COGS reversal, approval, period-lock, audit, or ledger behavior changed.

## Verification

- `npm --prefix frontend run typecheck` passed.

## Manual QA

Open `Sales -> Returns -> New Return` and verify:

1. `After Invoice` is selected from the Return Control strip and the header shows posted Sales Invoice.
2. `Before Invoice` switches the header to posted Delivery Note.
3. `Direct Return` switches the header to Customer.
4. Creating a draft still requires the correct source/customer for the selected mode.
