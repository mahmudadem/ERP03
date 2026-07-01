# 278w — Sales and Purchases Analytics report translation

## Technical Developer View

Telegram QA requested continuing the all-report translation audit after report pages still showed English in Arabic sessions.

This slice localized the remaining visible text in:

- `frontend/src/modules/sales/pages/SalesAnalyticsPage.tsx`
- `frontend/src/modules/purchases/pages/PurchasesAnalyticsPage.tsx`

Sales Analytics now reads its title, subtitle, filters, mode labels, row count, loading/error states, section headings, empty states, table headers, and totals labels from `common:sales.analytics.*`.

Purchases Analytics already had partial `purchases:auto.PurchasesAnalyticsPage.*` coverage; this slice completed the hardcoded table headers, mode chip, fallback error, and row-count pluralization.

Locale keys were added to:

- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `frontend/src/locales/en/purchases.json`
- `frontend/src/locales/ar/purchases.json`
- `frontend/src/locales/tr/purchases.json`

## Accounting / ERP Impact

Presentation only. No report calculation, filter semantics, API contract, AR/AP balance logic, posting, tax, stock, settlement, period lock, permissions, tenant isolation, or audit behavior changed.

## Verification

- Locale JSON parse passed for EN/AR/TR common and purchases files.
- `npm run typecheck` passed in `frontend/`.
- `npm run build` passed in `frontend/`.
- Existing build warnings remain: browser data age, Firebase auth chunking, Sales Invoice static/dynamic import, and large bundle size.

## End-User View

When users open `Sales -> Reports -> Sales Analytics` or `Purchases -> Reports -> Purchases Analytics`, the page now follows the selected language more completely. In Arabic and Turkish, report filters, table headings, section titles, loading/empty messages, row count, and totals labels no longer remain in English.

## Time

- Estimated: 0.4h
- Actual: ~0.5h

## Next

Continue the all-report translation audit with the remaining report pages, starting with Sales Gross Profit or Accounting report pages that still show hardcoded English.
