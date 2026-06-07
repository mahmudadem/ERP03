# Operational List Architecture

## Purpose

Operational lists are the day-to-day work surfaces for ERP users. Unlike reports, they are not read-only analysis pages; users open, create, post, pay, cancel, attach, and audit documents from these surfaces. For v1, operational lists should follow one predictable interaction pattern while reports continue to use `ReportContainer`.

## Current Standard

Standardized operational-list slices now cover:

- `frontend/src/modules/sales/pages/SalesInvoicesListPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoicesListPage.tsx`
- `frontend/src/modules/accounting/pages/VouchersListPage.tsx`
- `frontend/src/modules/inventory/pages/ItemsListPage.tsx`

Both pages now use the same shape:

- `PageHeader` title/subtitle plus a clear primary create action.
- Filter card at the top.
- Shared `PartySelector` for customer/vendor filtering.
- Explicit Refresh action.
- Clear action when filters are active.
- Status and payment chips with consistent color semantics.
- Empty state through `EmptyState`.
- Loading row that does not collapse the table.
- Explicit Open row action.

Accounting vouchers already use specialized accounting components for the high-risk lifecycle actions:

- `VoucherFiltersBar` for search, status, form, and shared `DatePicker` range filters.
- `VoucherTable` for column configuration, row actions, pagination, and accounting lifecycle actions.
- `PageHeader` for consistent list heading and create/refresh actions.

Inventory items now follow the same outer list standards:

- `PageHeader` primary New Item action.
- Filter/search card.
- Refresh and clear actions.
- `EmptyState`.
- Status chips.
- Explicit Open row action.
- Toast feedback for create/load failures.

## Control Rules

Operational lists must preserve financial-control clarity:

- Filters that reference master data should use shared selectors, not free-text IDs.
- Date filters should use the shared `DatePicker`, including generic table date-range filters.
- Destructive or lifecycle-changing row actions must use `ConfirmDialog`.
- Server-triggering actions must show success/info/error feedback.
- Reports must stay on `ReportContainer`; do not merge report and operational-list patterns.

## Status Chip Semantics

- Draft / neutral: slate.
- Posted / paid / active: green.
- Partial / warning: amber.
- Cancelled / failed / blocked: red.

This is visual guidance only. Posting state still comes from backend document status and must not be inferred from chip color.

## Follow-Up

Next candidates for the same pattern:

- Any list page that still has page-local lifecycle actions without confirmation or feedback.
- Any operational list that still uses raw master-data IDs instead of shared selectors.
