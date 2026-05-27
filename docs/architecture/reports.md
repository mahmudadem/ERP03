# Reports — UI conventions

All report pages in this project MUST follow two rules. Both are enforced
by `frontend/scripts/check-reports.mjs`, which runs as part of `npm run build`.

## Rule 1 — Sidebar registration

Every route in `frontend/src/router/routes.config.ts` whose path matches
`/<module>/reports/*` MUST be present in `frontend/src/config/moduleMenuMap.ts`,
under that module's `Reports` parent group.

Convention: each module that has reports defines a single `Reports` parent
with `icon: 'BarChart3'`, and lists the report routes as `children`.
Look at the `accounting`, `inventory`, and `sales` modules for examples.

## Rule 2 — `<ReportContainer>` usage

Every page component referenced by a `/reports/` route MUST import and
use `<ReportContainer>` from `frontend/src/components/reports/ReportContainer.tsx`.

This is non-negotiable because `ReportContainer` provides:

- **UI-mode awareness** — in `uiMode === 'windows'` it routes the report into
  the floating window manager instead of rendering inline. Reports that
  don't use it are broken in windows mode.
- **Standard toolbar** — back, refresh, filter editor, column visibility,
  export to Excel, export to PDF, print.
- **Two-stage flow** — filter form (Initiator) → results page. Predictable
  for users across all reports.
- **Density toggle** — compact / comfortable.
- **Pagination bar** — page navigation + page-size selector.
- **i18n** — built in.

## How to add a new report

1. Build the page using `<ReportContainer>`. Pattern:

   ```tsx
   import { ReportContainer } from '../../../components/reports/ReportContainer';

   interface Params { fromDate: string; toDate: string; }

   const Initiator: React.FC<{ onSubmit: (p: Params) => void; initialParams?: Params | null }>
     = ({ onSubmit, initialParams }) => { /* filter form */ };

   const ReportContent: React.FC<{ params: Params; ... }>
     = ({ params }) => { /* results table */ };

   const MyReportPage: React.FC = () => (
     <ReportContainer
       title="My Report"
       subtitle="What it shows"
       initiator={Initiator}
       ReportContent={ReportContent}
       onExportExcel={(p) => /* ... */}
     />
   );
   export default MyReportPage;
   ```

2. Add the route to `frontend/src/router/routes.config.ts` with path
   `/<module>/reports/<slug>` and the correct `section` and `requiredModule`.

3. Add the same path to `frontend/src/config/moduleMenuMap.ts` under the
   module's `Reports` parent.

4. Run `npm run check:reports` from `frontend/` to verify.

## Temporary allowlist

`frontend/scripts/check-reports.allowlist.json` exempts a small number of
legacy report pages from Rule 2 while they are being migrated to
`<ReportContainer>`. The allowlist must shrink to zero. When it is empty,
delete the file and the corresponding logic in `check-reports.mjs`.

Pages currently on the allowlist (as of 2026-05-27) — Phase B of the
report-standardization initiative:

- `src/modules/sales/pages/ArAgingReportPage.tsx`
- `src/modules/sales/pages/CustomerStatementPage.tsx`
- `src/modules/sales/pages/SalesAnalyticsPage.tsx`
- `src/modules/inventory/pages/InventoryValuationPage.tsx`
- `src/modules/inventory/pages/UnsettledCostsPage.tsx`

Each page that gets refactored removes its own entry from the allowlist
in the same commit.
