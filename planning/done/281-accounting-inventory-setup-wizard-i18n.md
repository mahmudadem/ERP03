# 281 — Setup wizard localization and shared module UI

## Status

Code and local verification complete on `codex/setup-wizard-i18n`. Not committed, pushed, merged,
or deployed pending owner approval.

## Technical developer view

- Converted both initialization wizards from hardcoded English to their existing `accounting` and
  `inventory` i18n namespaces.
- Added complete English, Arabic, and Turkish translation contracts for every wizard step, action,
  validation message, help message, and confirmation summary.
- Added RTL-safe logical alignment utilities to the Accounting wizard.
- Added localized success/error toasts to Inventory initialization.
- Added one shared responsive wizard shell for Accounting, Inventory, Sales, and Purchases.
- Replaced the Purchases-only external page title and numbered stepper with the same compact
  progress header, content frame, error area, and navigation footer used by the other modules.
- Made shared navigation icons direction-aware for Arabic RTL.
- Prevented the Purchases home page from calling protected Purchase APIs when its module record is
  missing or uninitialized, avoiding the misleading pre-setup error toast.
- Kept submitted accounting and inventory values unchanged.

Files:

- `frontend/src/modules/accounting/wizards/AccountingInitializationWizard.tsx`
- `frontend/src/modules/inventory/wizards/InventoryInitializationWizard.tsx`
- `frontend/src/modules/sales/wizards/SalesInitializationWizard.tsx`
- `frontend/src/modules/purchases/wizards/PurchaseInitializationWizard.tsx`
- `frontend/src/modules/purchases/pages/PurchaseHomePage.tsx`
- `frontend/src/components/shared/ModuleSetupWizardShell.tsx`
- `frontend/src/locales/{en,ar,tr}/accounting.json`
- `frontend/src/locales/{en,ar,tr}/inventory.json`

## End-user view

Accounting Setup and Inventory Setup now follow the selected English, Arabic, or Turkish language
throughout the complete wizard, rather than showing English headings and instructions in Arabic.
Accounting, Inventory, Sales, and Purchases now use the same setup frame and place progress,
content, errors, and navigation consistently.

Guides:

- `docs/user-guide/accounting/setup-wizard.md`
- `docs/user-guide/inventory/setup-wizard.md`
- `docs/user-guide/company-admin/module-setup-wizards.md`

Architecture:

- `docs/architecture/i18n.md`
- `docs/architecture/module-setup-wizards.md`

## Accounting and inventory impact

Presentation and pre-initialization routing only. No posting, voucher generation, fiscal-period calculation, account
classification, inventory valuation, stock movement, database selection, tenant isolation, or
ledger behavior changed.

## Known follow-up

The Inventory wizard currently captures and displays a warehouse address, but the initialization
API does not accept that field. The address remains display-only and should be handled in a
separate API-contract task.

## Verification

- EN/AR/TR accounting and inventory locale JSON parse: passed.
- Locale key parity: passed.
- Frontend `npm run typecheck`: passed.
- Frontend `npm run build`: passed.
- Backend `npm run build`: passed while restoring the complete local emulator set for QA.
- `git diff --check`: passed.
- `graphify update .`: unavailable because the Graphify CLI is not installed in this environment.
- Automated responsive browser screenshot capture timed out and is not claimed as passed.
- Manual owner QA remains: compare the four setup wizards in Arabic and English at desktop and
  narrow widths.
- No deployment performed.

## Time

- Original localization estimate: 45–75 minutes.
- Shared UI follow-up estimate: 1–2 hours.
- Actual total: approximately 2 hours.
