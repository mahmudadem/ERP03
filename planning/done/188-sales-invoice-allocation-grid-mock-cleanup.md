# 188 - Sales Invoice Allocation Grid Mock Cleanup

**Date:** 2026-06-07  
**Task:** Remove mocked Sales Invoice allocation-grid data and delete the Charge / Account Name table.  
**Agent:** Codex  
**Time spent:** ~0.6h

---

## Technical Developer View

### What changed

- Removed the hardcoded Sales Invoice allocation rows from `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`.
- Removed the lower editable **Charge / Account Name** table from the Sales Invoice page.
- Replaced the grid body with a localized empty state explaining that real ledger/tax allocation controls are not shown until the controlled allocation contract is implemented.
- Updated `planning/tasks/184-sales-invoice-allocation-grid-controlled-overrides.md` so the future implementation plan reflects the current UI state.
- Updated Sales architecture and user-guide docs to avoid telling users that the removed charge table is available.

### Accounting and ERP impact

This is a frontend cleanup only. It does not change Sales Invoice totals, tax calculation, posting, approval, period-lock, settlement, AR, inventory, or ledger behavior.

The cleanup reduces accounting risk because the page no longer presents mocked account codes and allocation rows as if they were real posting data.

### Files changed

- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `docs/architecture/sales.md`
- `docs/user-guide/sales/direct-invoice-and-operational-linked-invoice.md`
- `planning/tasks/184-sales-invoice-allocation-grid-controlled-overrides.md`

### Verification

- `npm --prefix frontend run typecheck` passed.
- Text scan confirmed the old mocked allocation labels and **Charge / Account Name** label are gone from `SalesInvoiceDetailPage.tsx`.

---

## End-User View

The Sales Invoice page no longer shows fake account allocation rows in the **Account Ledger & Financial Taxes Allocation Grid**.

The old **Charge / Account Name** table below it has also been removed. Until the real allocation feature is built, invoices continue to post using the system's validated backend accounting rules.

Users should continue entering invoice lines, discounts, tax codes, and payments normally.

