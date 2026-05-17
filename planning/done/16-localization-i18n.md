## 16 — Localization / i18n (DONE)

### What changed
- Integrated `i18next` with `react-i18next` + language detector, loaded from JSON locale files (en, ar, tr) with RTL handling.
- Added locale-aware formatting hook (`useLocaleFormat`) for numbers, currency, and dates.
- Translated the Dashboard page using new translation keys and locale formatters.
- Added language switcher to the top bar user menu and automatic `dir` switching for Arabic.

### Files
- `frontend/src/i18n/config.ts`
- `frontend/src/locales/*/{common,dashboard}.json`
- `frontend/src/hooks/useLocaleFormat.ts`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/layout/TopBar.tsx`

### Tests / Checks
- `backend`: `npm test -- --runInBand` ✅
- `frontend`: `npm run build` ⚠️ fails on pre-existing type errors in accounting pages (AccountForm, AccountingSettingsPage, BalanceSheetPage, BudgetPage, RecurringVouchersPage) and missing @types/file-saver. New i18n code compiles; remaining issues pre-date this task.

### Notes
- RTL is applied by updating `document.dir` when language is Arabic.
- Language preference persists via `i18next-browser-languagedetector` (localStorage + browser detection).
