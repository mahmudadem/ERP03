# 144 - Task 132 Phase 4/5: Invoice list standardization

Status: Done (2026-05-30)
Branch: `feat/init-wizard-forms-selection`
Source task: [tasks/132-ux-layout-production-hardening.md](../tasks/132-ux-layout-production-hardening.md)

## Scope

Standardize the first high-traffic operational list pair: Sales Invoices and Purchase Invoices. This is a focused Phase 4/5 slice, not a system-wide table rewrite.

## Technical Developer View

Changed files:

- `frontend/src/modules/sales/pages/SalesInvoicesListPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoicesListPage.tsx`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `docs/architecture/operational-lists.md`
- `docs/user-guide/lists/invoice-lists.md`

What changed:

- Sales and Purchase invoice lists now share the same page shape:
  - `PageHeader`
  - filter card
  - shared `PartySelector` for customer/vendor filtering
  - refresh action
  - clear filters action
  - status/payment chips
  - `EmptyState`
  - explicit Open row action
- Removed page-local customer/vendor filter dropdowns from these two pages.
- Added English, Arabic, and Turkish locale keys for the new visible strings.
- Documented the operational-list standard and end-user invoice list behavior.

## End-User View

Sales and Purchase invoice lists now behave the same way. Users can filter by status, payment status, and customer/vendor, refresh the list, clear filters, and open records from a consistent row action. Empty lists now explain what to do next instead of showing a plain table message.

## Accounting and Control Notes

No posting, payment, cancellation, or ledger behavior changed. The control improvement is UI consistency: customer/vendor filters now use the shared party selector, and posted/cancelled/payment states are visually distinguishable without changing the underlying status source.

## Verification

- `npm --prefix frontend run typecheck` - passed
- `npm --prefix frontend run check:reports` - passed, 21 report routes checked, 0 allowlisted
- `npm --prefix frontend run check:no-confirm` - passed, no raw `window.confirm` / `alert`
- `npm --prefix frontend run build` - passed

## Known Follow-Ups

- Apply the same operational-list pattern to Accounting vouchers and Inventory items.
- Continue replacing remaining raw date filters with shared `DatePicker` where they are user-facing page controls.
- Authenticated visual QA is still required for both invoice list pages.

## Time Spent

Actual: ~0.8h
