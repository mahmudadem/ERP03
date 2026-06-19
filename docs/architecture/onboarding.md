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

## Mode selection

The Company Setup step now asks for **Inventory Control Mode** before creation. The same answer drives:

- starter policy label shown in the wizard
- accounting COA template
- `InventorySettings.accountingMode`
- Sales and Purchases workflow defaults

Current mappings:

| Choice | Accounting mode | COA template | Sales/Purchases workflow | Costing basis |
|---|---|---|---|---|
| Simple | `PERIODIC` | `periodic_trading` | `SIMPLE` / direct invoicing | `GLOBAL` |
| Standard | `INVOICE_DRIVEN` | `standard` | `SIMPLE` / direct invoicing | `GLOBAL` |
| Advanced | `PERPETUAL` | `standard` | `OPERATIONAL` / linked flow | `WAREHOUSE` |

## Customizable starter policies (Task 245 NOTE-01)

The Company Setup step exposes an **advanced** disclosure that lets the operator override the auto-chosen policies without picking a different mode. The available fields are:

| Field | Default source | Possible values | Backend override field |
|---|---|---|---|
| Chart of Accounts | Mode | `periodic_trading` / `standard` | `coaTemplate` |
| Costing basis | Mode | `GLOBAL` / `WAREHOUSE` | `costingBasis` |
| Default warehouse code | `"MAIN"` | any short string | `defaultWarehouseCode` |
| Default warehouse name | `"Main Warehouse"` | any string | `defaultWarehouseName` |
| Sales workflow | Mode | `SIMPLE` / `OPERATIONAL` | `salesWorkflowMode` |
| Purchase workflow | Mode | `SIMPLE` / `OPERATIONAL` | `purchaseWorkflowMode` |

Behaviour:

- Each field's `value` in the form tracks the user's explicit choice. The auto-sync to the mode default only happens for fields the user has **not** touched; once a field is touched, subsequent mode changes leave it alone.
- The frontend posts the overrides through `createCompany({ coaTemplate, costingBasis, defaultWarehouseCode, defaultWarehouseName, salesWorkflowMode, purchaseWorkflowMode })`.
- `OnboardingController.createCompany` validates each override (HTTP 400 for unknown enum values, empty warehouse code/name).
- `SimpleTradingCompanyInitializer.execute()` accepts the same fields as optional inputs. Any field left undefined falls back to the existing mode-derived default so behaviour is unchanged for any caller that does not pass them.
- The policy summary returned by the initializer reflects the chosen values (not the mode defaults) so the post-creation summary is accurate.

This is intentionally an additive, narrow surface. Changing the **mode** still drives inventory accounting mode, costing method, persona, and other coupled settings. The overrides only touch the values the operator can already configure later from Sales Settings / Purchases Settings / Inventory Settings — except for COA template and the first default warehouse, which the wizard seeds at create time.

## Default Policy

`simple-trading-company` now creates a ready-to-use company according to the selected mode:

- Accounting initialized with base currency and current fiscal year.
- Inventory initialized in the selected accounting mode.
- Moving-average costing, with `GLOBAL` for Simple/Standard and `WAREHOUSE` for Advanced.
- Negative stock disabled.
- Main warehouse `MAIN`.
- Sales and Purchases initialized with mode-compatible workflow defaults.
- Purchases default AP posting account linked so financial integration is active immediately.
- Tax-ready policy summary, but no silent country tax rate.

The template returns a policy summary to the frontend. The user sees this immediately after company creation.

## Account Linking

The initializer resolves required accounts from the selected COA and creates supporting accounts only when absent:

- `10303` Inventory Transfer Clearing
- `303` Opening Balance Equity
- `304` Inventory Revaluation Reserve
- `406` Inventory Adjustment Gain
- `50203` Inventory Adjustment Loss
- `50204` Inventory Revaluation Expense

Linked posting accounts vary by mode. Periodic mode includes returns/discount accounts from the periodic trading chart. Invoice-driven and perpetual modes focus on inventory asset / COGS / GRNI-style accounts and may omit periodic-only return/discount defaults.

## Pre-posting mode changes

Inventory Settings can change `accountingMode` only while the company has **no posted voucher and no stock movement history**.

The backend enforces this through `InventoryAccountingModeLockService`:

- before history: allowed, and the same starter initializer is re-run to re-seed the matching COA + module defaults
- after history: blocked with a readable error

The reseed is intentionally **additive**, not destructive. Existing accounts are not deleted. This avoids breaking draft references or weakening auditability while still bringing the company into the correct starter policy before live posting begins.

## Control Notes

- This is not a silent default. It is selected in the company wizard and summarized after creation.
- Base currency is required before auto-initialization. The controller validates this before creating the company to avoid partial setup failures.
- Approval is not forced into strict mode. Strict approval currently requires the full approval-record model for inventory-generated GL postings.
- Tax setup is intentionally not country-assumed. A later tax-preset layer should own country-specific rates and legal defaults.
- The starter flow may be reused for QA because it creates the same user-facing setup that a simple company would receive.
- The Inventory Settings page receives `accountingModeLocked` + `accountingModeLockReason` from the backend so the frontend can communicate the state without re-implementing the rule.

## File Map

- `backend/src/application/onboarding/use-cases/SimpleTradingCompanyInitializer.ts`
- `backend/src/api/controllers/onboarding/OnboardingController.ts`
- `frontend/src/modules/onboarding/components/company-wizard/StepReview.tsx`
- `frontend/src/modules/onboarding/components/company-wizard/StepBasicNeeds.tsx`
- `frontend/src/modules/onboarding/components/company-wizard/StepSuccess.tsx`
- `frontend/src/modules/onboarding/api/onboardingApi.ts`
