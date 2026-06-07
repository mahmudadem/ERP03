# 146 - Task 132 Phase 5: Raw date input cleanup

Status: Done (2026-05-30)
Branch: `feat/init-wizard-forms-selection`
Source task: [tasks/132-ux-layout-production-hardening.md](../tasks/132-ux-layout-production-hardening.md)

## Scope

Remove the remaining user-facing native `type="date"` controls from Task 132 surfaces and route them through the shared company-aware `DatePicker`.

## Technical Developer View

Changed files:

- `frontend/src/modules/inventory/pages/StockMovementsPage.tsx`
- `frontend/src/modules/inventory/pages/StockTransfersPage.tsx`
- `frontend/src/modules/sales/pages/PromotionsPage.tsx`
- `frontend/src/modules/sales/pages/PriceListsPage.tsx`
- `frontend/src/components/ui/DataTable/DataTableFilter.tsx`
- `docs/architecture/operational-lists.md`
- `docs/user-guide/lists/date-controls.md`

What changed:

- Stock Movements `from` / `to` filters now use the shared `DatePicker`.
- Stock Transfers transfer date now uses the shared `DatePicker`.
- Sales Promotions `validFrom` / `validTo` now use the shared `DatePicker`.
- Sales Price Lists `validFrom` / `validTo` now use the shared `DatePicker`.
- Generic `DataTableFilter` date-range filters now use the shared `DatePicker`, which lifts the behavior to all table consumers.
- Updated operational-list architecture guidance to remove the old generic-table exception.

## End-User View

Date entry is now consistent across the cleaned pages and table filters. Users get the company-aware date format and the same calendar behavior instead of browser-specific native date controls.

## Accounting and Control Notes

No posting, pricing, promotion eligibility, inventory costing, stock valuation, or ledger behavior changed. The UI still passes ISO date strings to the existing APIs. This is a control improvement because date entry now follows company date/fiscal settings consistently.

## Verification

- Raw date scan: `rg -n 'type="date"|type=''date''|type=\{["'']date["'']\}' frontend/src` - no matches
- `npm --prefix frontend run typecheck` - passed
- `npm --prefix frontend run check:reports` - passed, 21 report routes checked, 0 allowlisted
- `npm --prefix frontend run check:no-confirm` - passed
- `npm --prefix frontend run build` - passed

## Known Follow-Ups

- Authenticated visual QA is still required for the affected pages.
- Continue shrinking any remaining unsafe action-feedback allowlist entries outside the frozen top-bar widget scope.

## Time Spent

Actual: ~0.4h
