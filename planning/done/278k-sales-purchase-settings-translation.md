# 278k — Sales dashboard and Purchase Settings translation hardening

## Technical Developer View

Telegram QA screenshots 14 and 15 showed Arabic sessions with hardcoded English text.

Changed:

- `frontend/src/modules/sales/pages/SalesHomePage.tsx`
  - Replaced visible dashboard strings with `t('sales.home.*')`.
  - Covered the header, badge, subtitle, KPI cards, recent order/invoice tables, top-client panel, quick navigation, and recent activity labels.
- `frontend/src/modules/purchases/pages/PurchaseSettingsPage.tsx`
  - Replaced hardcoded AP account-code preset labels with translatable preset keys.
- `frontend/src/locales/{en,ar,tr}/common.json`
  - Added `sales.home.*` labels.
- `frontend/src/locales/{en,ar,tr}/purchases.json`
  - Added/translated AP-generation, AP-parent, and AP account-code format labels.
- `docs/architecture/i18n.md`
  - Added the i18n continuation rules for future translation sweeps.
- `docs/user-guide/settings/language-and-translation.md`
  - Added plain-language note for the affected areas.

## End-User View

Arabic and Turkish users should no longer see English labels in the Sales Dashboard areas shown in the Telegram
screenshot or in the Purchase Settings AP sub-account generation card. The settings behavior is unchanged.

## Accounting and control impact

- Presentation/i18n only.
- No purchase settings values, AP parent accounts, account-code formats, invoices, vendors, ledger records, vouchers,
  tenant data, or permissions changed.

## Verification

- Locale JSON parse passed.
- `npm run typecheck` passed in `frontend/`.
- `npm run build` passed in `frontend/`.
- Build warnings are existing bundle/browser-data warnings.
- `git diff --check` passed.
- `graphify update .` could not run because `graphify` is not installed/available in this shell.

## Time spent

~0.6h.
