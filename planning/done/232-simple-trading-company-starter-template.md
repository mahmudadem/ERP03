# 232 — Simple Trading Company Starter Template

**Date:** 2026-06-16  
**Status:** Complete  
**Actual time spent:** ~2.5h

## Technical Developer View

Added the first user-facing company starter template: `simple-trading-company`.

The backend now supports auto-initializing a new company through the onboarding create-company endpoint. The initializer reuses the existing Accounting, Inventory, Sales, and Purchases initialization use cases, creates only missing starter accounts, links the default posting accounts, and returns a policy summary to the frontend.

Files changed:

- `backend/src/application/onboarding/use-cases/SimpleTradingCompanyInitializer.ts`
- `backend/src/application/onboarding/use-cases/__tests__/SimpleTradingCompanyInitializer.test.ts`
- `backend/src/api/controllers/onboarding/OnboardingController.ts`
- `backend/src/application/onboarding/use-cases/CreateCompanyUseCase.ts`
- `frontend/src/modules/onboarding/api/onboardingApi.ts`
- `frontend/src/modules/onboarding/components/company-wizard/CompanyWizard.tsx`
- `frontend/src/modules/onboarding/components/company-wizard/StepBasicNeeds.tsx`
- `frontend/src/modules/onboarding/components/company-wizard/StepReview.tsx`
- `frontend/src/modules/onboarding/components/company-wizard/StepSuccess.tsx`
- `frontend/src/modules/onboarding/components/company-wizard/types.ts`
- `frontend/src/locales/*/common.json`
- `docs/architecture/onboarding.md`
- `docs/user-guide/settings/company-starter-template.md`

Accounting/control behavior:

- Standard COA is initialized.
- The wizard now includes a Company Setup step immediately before Review for base currency, timezone, date format, language, and optional starter policy confirmation.
- The backend validates base currency before creating the company when auto-initialization is enabled.
- Inventory uses invoice-driven accounting, moving-average costing, global costing basis, and negative stock disabled.
- Sales and Purchases use SIMPLE workflow with direct invoicing enabled.
- Purchases links the standard AP account as the default AP posting account so financial integration is active immediately.
- Missing starter accounts are created for opening equity, inventory revaluation, inventory gain, and inventory loss.
- Tax is explicitly tax-ready only; no legal country tax rate is silently applied.
- Strict approval is not enabled by the starter template because inventory-generated GL strict approval still needs the full approval-record model.

## End-User View

When creating a company, the user confirms **Company Setup** such as base currency, date/time defaults, and language, and can keep **Auto initialize Trading Company - Simple** enabled. ERP03 then prepares a basic trading company automatically: Accounting, Inventory, Sales, and Purchases are ready, default accounts are linked, direct invoices are enabled, and negative stock is blocked.

After creation, the user sees a Company Policy Summary showing what was configured and which accounts were linked.

## Verification

- `npm --prefix backend test -- --runInBand backend/src/application/onboarding/use-cases/__tests__/SimpleTradingCompanyInitializer.test.ts` — passed.
- `npm --prefix backend run build` — passed.
- `npm --prefix frontend run typecheck` — passed.
- `npm --prefix frontend run build` — passed.
- Browser QA — passed: created a fresh `Wholesale Trading` company with Syria defaults (`SYP`, `Asia/Damascus`, `DD/MM/YYYY`, `ar`) and confirmed the success-page Company Policy Summary with linked accounts and the tax-ready/no-hidden-rate note.
- Browser QA correction — passed: created fresh `QA Simple Trading 102654`, confirmed Company Setup and Review show global average cost, Purchase Settings shows **Financial Integration Active** with default AP `20100 - Accounts Payable – General`, and Inventory Settings shows costing basis **Global (one company-wide average per item)**.

## Known Follow-Ups

- Add downloadable PDF/export for the Company Policy Summary.
- Add more starter templates after this one is proven: controlled trading, services company, retail/POS.
- Add a proper country tax-preset layer before applying legal tax rates automatically.
