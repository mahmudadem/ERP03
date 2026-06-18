# 233 — Voucher Ledger Impact View

**Date:** 2026-06-16  
**Status:** Complete  
**Actual time spent:** ~1.3h

## Technical Developer View

Added a read-only voucher-level ledger impact view so accountants can inspect the posted ledger rows created by a voucher without confusing the voucher document with the general ledger.

Files changed:

- `backend/src/application/accounting/use-cases/ReportingUseCases.ts`
- `backend/src/api/controllers/accounting/AccountingReportsController.ts`
- `backend/src/tests/application/accounting/use-cases/GetGeneralLedgerUseCase.test.ts`
- `frontend/src/api/accountingApi.ts`
- `frontend/src/router/routes.config.ts`
- `frontend/src/modules/accounting/pages/VoucherLedgerImpactPage.tsx`
- `frontend/src/modules/accounting/pages/VoucherViewPage.tsx`
- `frontend/src/modules/accounting/pages/LedgerReportPage.tsx`
- `frontend/src/locales/en/accounting.json`
- `frontend/src/locales/ar/accounting.json`
- `frontend/src/locales/tr/accounting.json`
- `docs/architecture/accounting.md`
- `docs/user-guide/accounting/vouchers-and-ledger-impact.md`
- `backend/src/api/middlewares/authMiddleware.ts`
- `backend/src/tests/api/middlewares/authMiddleware.test.ts`
- `backend/src/api/middlewares/guards/companyContextGuard.ts`
- `backend/src/api/routes/company-modules.routes.ts`
- `backend/src/api/routes/company.moduleSettings.routes.ts`
- `backend/src/api/controllers/core/CompanySettingsController.ts`
- `backend/src/tests/api/middlewares/companyContextGuard.test.ts`
- `backend/src/tests/api/controllers/core/CompanySettingsController.test.ts`
- `docs/architecture/security-rules.md`

Architecture/control behavior:

- `GET /tenant/accounting/reports/general-ledger` now accepts `voucherId`.
- `GetGeneralLedgerUseCase` passes `voucherId` through to the ledger repository.
- The existing Firestore ledger repository already applies `voucherId` filtering and restricts that path to posted ledger rows.
- New hidden route: `#/accounting/vouchers/:id/ledger`, guarded by `accounting.reports.generalLedger.view`.
- Voucher read view now includes a **Ledger impact** action.
- The new page is read-only and shows an empty state for draft/unposted vouchers.
- Tenant isolation detour: verified that voucher repositories are company-scoped, then hardened `authMiddleware` so a forged `x-company-id` without membership is rejected with `403 COMPANY_ACCESS_DENIED` before tenant controllers run. A stale stored active company without membership is stripped to `null`.
- Broader route audit: added `requireCompanyParamMatchesContext()` and applied it to legacy company-id path routes for company modules and module settings. Tightened Core company settings so normal users use authenticated company context, not query/body `companyId`.
- No ledger mutation, posting, approval, reversal, period-lock, tax, AR/AP, inventory valuation, or voucher editing behavior changed.

## End-User View

Users can open a voucher and click **Ledger impact** to see what that voucher actually posted to the general ledger.

The page shows the voucher context, total debit, total credit, balance check, and line-level ledger effect by account. Draft vouchers show that no ledger impact exists yet.

## Verification

- `npm --prefix backend test -- --runInBand backend/src/tests/application/accounting/use-cases/GetGeneralLedgerUseCase.test.ts` — passed.
- Locale JSON parse check for `en/ar/tr accounting.json` — passed.
- `npm --prefix backend run build` — passed.
- `npm --prefix frontend run typecheck` — passed.
- `npm --prefix frontend run build` — passed, including report/no-confirm/SoD checks. Existing bundle/Browserslist warnings remain.
- `npm --prefix backend test -- --runInBand backend/src/tests/api/middlewares/authMiddleware.test.ts` — passed.
- `npm --prefix backend run build` after auth hardening — passed.
- `npm --prefix backend test -- --runInBand backend/src/tests/api/middlewares/authMiddleware.test.ts backend/src/tests/api/middlewares/companyContextGuard.test.ts backend/src/tests/api/controllers/core/CompanySettingsController.test.ts` — passed.

## Known Follow-Ups

- Browser-check the route against a live posted voucher once the local stack is running with a tenant.
- Separately decide whether `VoucherViewPage` itself should be redesigned to follow Web vs Windows mode; this task only added the ledger impact route.
