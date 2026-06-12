# 189 - Sales Invoice Sticky Footer Totals

**Date:** 2026-06-07  
**Task:** Keep Sales Invoice totals visible when the side rail is hidden.  
**Agent:** Codex  
**Time spent:** ~0.4h

---

## Technical Developer View

### What changed

- Added a compact subtotal, tax amount, and grand total strip to the right side of the Sales Invoice sticky footer.
- Kept the existing side-rail totals card unchanged.
- Added localized footer-total labels in English, Arabic, and Turkish.
- Updated Sales architecture and user-guide docs.

### Accounting and ERP impact

This is a UI visibility change only. It does not change invoice total formulas, tax calculation, posting, settlement, approval, period-lock, AR, inventory, or ledger behavior.

The change improves financial review ergonomics because users can always see the invoice total before saving or posting, even when the side rail is hidden or collapsed into the drawer.

### Files changed

- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `docs/architecture/sales.md`
- `docs/user-guide/sales/direct-invoice-and-operational-linked-invoice.md`

### Verification

- `npm --prefix frontend run typecheck` passed.

---

## End-User View

Sales Invoice totals are now always visible in the bottom action bar.

When the side rail is open, it still shows the full totals card. When the rail is hidden, users can still see subtotal, tax amount, and grand total in the sticky footer before saving or posting the invoice.

