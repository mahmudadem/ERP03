# Task 268 - Tax Code Master-Data Controls and Page Repolish

**Status:** Complete  
**Date:** 2026-06-26  
**Branch/worktree:** `codex/267-system-core-boundary-audit` / `D:\DEV2026\ERP03-267-engine-audit`  
**Estimated time:** 1.5-2.5 hours  
**Actual time:** ~2.1 hours

## Technical Developer View

Task 268 made Tax Codes a safer accounting master-data surface.

Changed files:

- `backend/src/application/shared/use-cases/TaxCodeUseCases.ts`
- `backend/src/api/controllers/shared/SharedController.ts`
- `backend/src/tests/application/shared/TaxCodeUseCases.test.ts`
- `frontend/src/api/sharedApi.ts`
- `frontend/src/modules/settings/pages/TaxCodesPage.tsx`
- `docs/architecture/settings.md`
- `docs/user-guide/settings/tax-codes.md`
- `planning/tasks/268-tax-code-master-data-controls-and-page-repolish.md`

Backend behavior:

- List/get tax-code APIs now expose `usedInPostedDocuments` and `lockedFields`.
- `UpdateTaxCodeUseCase` checks posted Sales Invoices, Purchase Invoices, Sales Returns, and Purchase Returns through repository interfaces.
- After posted usage, accounting-critical fields are blocked: code, rate, tax type, scope, purchase/sales tax accounts, and price basis.
- Name and active status remain editable after posted usage.

Frontend behavior:

- Tax Codes is now list-first.
- Add/edit opens a modal.
- Rate entry is `Rate %`; `10` is sent to the backend as `0.10`.
- Price Basis is required and explicit: Exclusive vs Inclusive.
- Used tax codes show a lock icon and disabled locked fields.

## End-User View

Users now create and edit tax codes from a clear list page. The tax rate is entered the way business users expect: type `10` for a 10% rate.

The page also makes tax basis explicit. Users must choose whether prices are exclusive of tax or already include tax. This prevents a tax code name like `10%INC` from hiding an exclusive saved setting.

Once a tax code has been used in posted documents, the system protects the tax treatment. Users can rename or deactivate the code, but must create a new tax code if rate, accounts, scope, or inclusive/exclusive treatment needs to change.

## Verification

Passed:

```powershell
npm --prefix backend test -- --runInBand src/tests/application/shared/TaxCodeUseCases.test.ts
npm --prefix frontend run typecheck
npm --prefix backend run build
npm --prefix frontend run build
git diff --check
```

Notes:

- Frontend build still reports existing baseline-browser-mapping, Browserslist, dynamic import, and chunk-size warnings.
- `git diff --check` reports only existing CRLF normalization warnings.

## Follow-Ups

- Task 269 extends tax-code behavior with recoverable vs non-recoverable purchase tax treatment.
