# 145 - Task 132 Phase 4/5: Voucher and item list standardization

Status: Done (2026-05-30)
Branch: `feat/init-wizard-forms-selection`
Source task: [tasks/132-ux-layout-production-hardening.md](../tasks/132-ux-layout-production-hardening.md)

## Scope

Continue the operational-list standardization pass after Sales/Purchase invoice lists by covering Accounting Vouchers and Inventory Items.

## Technical Developer View

Changed files:

- `frontend/src/modules/accounting/pages/VouchersListPage.tsx`
- `frontend/src/modules/inventory/pages/ItemsListPage.tsx`
- `frontend/src/locales/en/accounting.json`
- `frontend/src/locales/ar/accounting.json`
- `frontend/src/locales/tr/accounting.json`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `docs/architecture/operational-lists.md`
- `docs/user-guide/lists/accounting-and-items-lists.md`

What changed:

- Accounting Vouchers:
  - switched the outer page heading to shared `PageHeader`;
  - kept the existing specialized `VoucherFiltersBar` and `VoucherTable` because they already handle date filtering, column configuration, row actions, and accounting lifecycle behavior.
- Inventory Items:
  - added shared `PageHeader`;
  - added translated search/filter labels;
  - added refresh/clear actions;
  - added `EmptyState`;
  - added active/inactive status chips;
  - added explicit Open row action;
  - added toast feedback for item creation/load failures.
- Added English, Arabic, and Turkish locale keys for new visible strings.
- Updated operational-list architecture docs and added a user guide.

## End-User View

Accounting Vouchers now use the same outer list header style as the other standardized operational lists. Inventory Items now has a clearer search/filter area, visible refresh/clear actions, status badges, and Open actions.

## Accounting and Control Notes

No accounting posting, voucher approval, item costing, or inventory valuation logic changed. The accounting voucher list kept its specialized action table because replacing it with a generic table would risk losing financial lifecycle behavior. The item list now gives clearer feedback on create/load actions, which reduces silent data-entry failures.

## Verification

- `npm --prefix frontend run typecheck` - passed
- `npm --prefix frontend run check:reports` - passed, 21 report routes checked, 0 allowlisted
- `npm --prefix frontend run check:no-confirm` - passed
- `npm --prefix frontend run build` - passed

## Known Follow-Ups

- Continue remaining raw date filter cleanup in Stock Movements, Stock Transfers, Promotions, and Price Lists.
- Authenticated visual QA is required for Accounting Vouchers and Inventory Items.

## Time Spent

Actual: ~0.7h
