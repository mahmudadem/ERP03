# Onboarding Architecture

## Simple Trading Company Starter Template

The company creation wizard can now request an automatic starter setup for a small trading company. The first supported template is `simple-trading-company`.

The wizard exposes this through a dedicated **Company Setup** step immediately before Review. That step confirms base currency, timezone, date format, language, and the optional simple trading starter before the backend creates any company records.

The template is implemented by `backend/src/application/onboarding/use-cases/SimpleTradingCompanyInitializer.ts`. It deliberately orchestrates existing module initializers instead of writing module settings directly:

- `InitializeAccountingUseCase`
- `InitializeInventoryUseCase`
- `InitializeSalesUseCase`
- `InitializePurchasesUseCase`

This keeps the setup SQL-ready and aligned with normal module initialization behavior.

## Default Policy

`simple-trading-company` creates a ready-to-use company with:

- Standard chart of accounts.
- Accounting initialized with base currency and current fiscal year.
- Inventory initialized in `INVOICE_DRIVEN` mode.
- Moving-average costing with global costing basis for a simple company-wide average cost.
- Negative stock disabled.
- Main warehouse `MAIN`.
- Sales initialized as `SIMPLE` with direct invoicing enabled.
- Purchases initialized as `SIMPLE` with direct invoicing enabled.
- Purchases default AP posting account linked to the standard AP account so financial integration is active immediately.
- Tax-ready policy summary, but no silent country tax rate.

The template returns a policy summary to the frontend. The user sees this immediately after company creation.

## Account Linking

The initializer resolves required accounts from the standard COA and creates missing simple-company accounts only when absent:

- `303` Opening Balance Equity
- `304` Inventory Revaluation Reserve
- `406` Inventory Adjustment Gain
- `50203` Inventory Adjustment Loss
- `50204` Inventory Revaluation Expense

The linked posting accounts include cash, bank, inventory asset, transfer clearing, AR parent, AP parent, GRNI, sales revenue, COGS, purchase expense, sales expense, inventory gain/loss, and inventory revaluation reserve.

## Control Notes

- This is not a silent default. It is selected in the company wizard and summarized after creation.
- Base currency is required before auto-initialization. The controller validates this before creating the company to avoid partial setup failures.
- Approval is not forced into strict mode. Strict approval currently requires the full approval-record model for inventory-generated GL postings.
- Tax setup is intentionally not country-assumed. A later tax-preset layer should own country-specific rates and legal defaults.
- The starter flow may be reused for QA because it creates the same user-facing setup that a simple company would receive.

## File Map

- `backend/src/application/onboarding/use-cases/SimpleTradingCompanyInitializer.ts`
- `backend/src/api/controllers/onboarding/OnboardingController.ts`
- `frontend/src/modules/onboarding/components/company-wizard/StepReview.tsx`
- `frontend/src/modules/onboarding/components/company-wizard/StepBasicNeeds.tsx`
- `frontend/src/modules/onboarding/components/company-wizard/StepSuccess.tsx`
- `frontend/src/modules/onboarding/api/onboardingApi.ts`
