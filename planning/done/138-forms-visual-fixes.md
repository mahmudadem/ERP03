# 138 — Forms visual fixes and layout alignment

**Date:** 2026-05-30
**Agent:** Antigravity (Gemini 3.5 Pro)
**Branch:** `feat/init-wizard-forms-selection`
**Status:** ✅ Implemented & Verified

---

## 1. Technical View (Future Developers)

### Context & Root Cause
1. **Duplicate Footer Cards:** In the Document/Forms Designer's preview and active runs, the footer metadata contains both the calculation-driven system field `grandTotalDoc` and the module-specific template field `totalAmount`. Both retrieve the exact same value (`formData.grandTotalDoc ?? formData.totalAmount ?? computedDocumentTotals.grandTotalDoc`) and resolve to the same label `"Total Amount"`. In `windows` mode (using `renderStickySummaryDock()`) and `classic` mode (using `renderSection('FOOTER')`), this led to two identical summary cards rendering side-by-side.
2. **Exchange Rate Icon & Cramping:** The `CurrencyExchangeWidget` used the plain unicode arrow character `→` (right arrow) for rendering the rate direction. Under current font weights and styles, this character rendered as a plain hyphen/dash (`-`). When currencies were identical, this created confusing same-currency layout text (e.g., `1 SYP - 1` instead of `1 SYP → 1`). Also, the container widths (`min-w-[60px]` for left-hand currency name, and `min-w-[80px]` for right-hand base currency and status icon) were either too small (causing truncation of the label) or too wide (creating blank layout gaps).

### Implementation Details
* **[GenericVoucherRenderer.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/accounting/components/shared/GenericVoucherRenderer.tsx):**
  * Added a deduplication pass in `renderStickySummaryDock()` (Windows mode) and `renderSection()` when `sectionKey === 'FOOTER'` (Classic mode).
  * The fields are filtered dynamically using a `seenLowerIds` Set. Both `grandtotaldoc` and `totalamount` map to a common canonical ID `'total_amount_canonical'`. If one of them has already been processed, the duplicate is skipped.
* **[CurrencyExchangeWidget.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/accounting/components/shared/CurrencyExchangeWidget.tsx):**
  * Replaced the text character `→` with a clean, inline vector `<svg>` arrow element. It has a CSS class `rtl:rotate-180` to automatically flip pointing direction when RTL language (Arabic) is active.
  * Increased left-hand currency label box width boundary from `min-w-[60px]` to `min-w-[72px]` to comfortably fit standard currency identifiers (e.g. `1 SYP` or `1 USD`) along with the SVG arrow without any squeeze.
  * Reduced right-hand base currency/status box boundary from `min-w-[80px]` to `min-w-[64px]` to eliminate excessive empty margins and improve visual alignment.

---

## 2. End-User View (User Guide)

### What Was Fixed

1. **Cleaned Up Double "Total Amount" Boxes:**
   * When looking at the bottom (footer) section of a form or voucher during a design preview or test run, you will no longer see duplicate "Total Amount" cards side-by-side. The system now automatically groups and shows only one clean card representing the document's total.
2. **Clearer Exchange Rate Indicators:**
   * The arrow symbol indicating rate conversion (e.g., converting from foreign currency to local currency) has been upgraded from a text symbol to a clean vector arrow. It now correctly looks like a right-pointing arrow (`→`) instead of looking like a hyphen (`-`), and it flips direction automatically when switching to Arabic.
   * The labels and spacing around the exchange rate fields have been polished to prevent texts from squeezing or looking awkwardly spread out.

---

## Verification
* **TypeScript compilation (`npm run typecheck:web`):** Passed cleanly (Exit 0).
* **Production Bundle build (`npm run build:web`):** Compiled successfully (Exit 0).
