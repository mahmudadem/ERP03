# 208 — Sales Invoice Layout, Fonts, and Translation Fixes

**Date:** 2026-06-12  
**Actual time spent:** ~2.5h  
**Scope:** Sales Invoice Detail Page, font fallbacks, RTL layout, and localization alignment

## Technical Developer View

Resolved visual alignment, styling, and localization gaps across Arabic (RTL), Turkish, and English:

1. **Font Unification and Arabic Fallback:**
   * Updated `frontend/src/styles/globals.css` to add `'Cairo'` to `--font-sans` and the Apex Ledger `--app-font-family` variable.
   * Updated `frontend/src/theme/userAppearance.ts` to add `"Cairo"` fallback to `fontVars.system` and `fontVars.mono` across all theme configurations.
   * Modified `frontend/src/components/shared/ClassicLineItemsTable.tsx` so the `system` font selection uses `var(--app-font-family)` instead of hardcoded fonts, ensuring font changes are applied app-wide in any theme preset and render Arabic correctly.

2. **RTL Currency Selector Swap:**
   * Swapped the DOM layout order of the Currency selector and the Exchange Rate widget inside `SalesInvoiceDetailPage.tsx` dynamically when `isRtl` is true. Because CSS grid columns flow right-to-left in RTL mode, the Currency selector must come *after* the Exchange Rate widget in the DOM to be placed on the left side of the Exchange Rate widget visually.
   * Removed the legacy `CurrencyExchangeWidget` mount.
   * Renamed the redesigned widget label to "Exchange Rate" (translated via `t('sales.invoiceDetail.exchangeRate', 'Exchange Rate')`).

3. **Footer "New" Action Button:**
   * Implemented `handleNewInvoiceClick` in `SalesInvoiceDetailPage.tsx` to handle dirty-checking of active changes (`isTemplateTouched || formDirty`).
   * Wired a borderless, text-only `"New"` button in both edit/draft and posted views of the footer actions container using the translated `t('sidebar.new', 'New')` label.

4. **Sidebar Localization:**
   * Replaced hardcoded tooltips `title="Unpin Sidebar"`, `title="Pin Sidebar"`, and `title="Close Sidebar"` in `frontend/src/layout/Sidebar.tsx` with translations `sidebar.unpin`, `sidebar.pin`, and `sidebar.close`.
   * Replaced the hardcoded `"MODULES"` string with `{t('sidebar.modulesTitle', 'Modules')}`.

5. **Locale and Translation Sweeps:**
   * Relocated sales status translations (`pendingApprovalReadonly` and `draftWorking`) from `accounting.json` to the default namespace (`common.json`) under `sales.invoiceDetail` across English, Arabic, and Turkish locales.
   * Cleaned up duplicate `sales` translation blocks inside `accounting.json` files.
   * Added `currencyExchangeWidget` label/tooltip translation structures in Turkish `tr/accounting.json` and tools definitions.
   * Added missing `sidebar` menu links (e.g. `sidebar.salesInvoices`, `sidebar.salesOrders`, etc.) to common locales.
   * Restored corrupted characters / question marks inside `tr/common.json`.

## End-User View

Provides a cleaner interface, layout corrections for Arabic-speaking users, and fully translated navigation controls:

* **Redesigned Exchange Rate:** The compact, high-density exchange rate widget displays both Parity and Equivalent rates side-by-side inside a single border. Changing one rate will automatically calculate the other. If the invoice matches your base currency, a simple read-only green indicator is shown instead. An interactive status dot in the middle allows you to instantly clear manual rates back to default system-calculated rates.
* **Arabic Placement Correction:** When switching to Arabic (RTL), the Currency Selector automatically moves to the left of the Exchange Rate widget, keeping it clean and easy to scan.
* **Footer "New" button:** A normal text button labeled "New" is now placed in the footer action strip. Click it to reset the form. If there are unsaved changes on the current invoice, the system will warn you before clearing the data.
* **Sidebar Translation:** The sidebar menu items, search, and tooltips are now fully translated in English, Arabic, and Turkish.

## Accounting / Financial Systems Impact

UI workflow and presentation only. No changes to posting engines, ledger entries, tax calculation, AR/AP balances, inventory valuation, approval, period-lock, audit, DTO models, or backend use cases.

## Verification

* Verified that `npm --prefix frontend run typecheck` compiles cleanly.
* Verified that `npm --prefix frontend run build` completes production packaging successfully.

## Docs Created/Updated

* **Technical Doc:** [docs/architecture/sales.md](file:///d:/DEV2026/ERP03/docs/architecture/sales.md) (updated)
* **User Guide:** [docs/user-guide/sales/exchange-rate-and-new-button.md](file:///d:/DEV2026/ERP03/docs/user-guide/sales/exchange-rate-and-new-button.md) (created)
