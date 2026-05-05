# Task 58 Completion Report: Dynamic Document List Visibility

**Date:** 2026-05-01  
**Agent:** Codex (CTO Mode)  
**Estimate:** 0.5h  
**Actual:** 0.6h  
**Status:** Done - Ready for QA

## Technical Developer View

### Task
Fix the dynamic form route list (`/sales/:formCode`, `/purchases/:formCode`) so saved documents are actually visible.

### Root Cause
`frontend/src/modules/tools/pages/DynamicDocumentPage.tsx` rendered a static placeholder and never queried records.  
Result: users could save documents successfully but always saw "No Documents Found" on the dynamic form page.

### What Changed
- Added module-aware record loading in dynamic list mode.
- Added document-kind inference from `voucherType/formType/baseType/code` and route `formCode`.
- Added API-backed listing for:
  - Sales: invoices, orders, delivery notes, returns
  - Purchases: invoices, orders, goods receipts, returns
- Added fallback to accounting voucher list for non-subledger forms.
- Added per-form filtering by `formType/code/id`.
- Replaced static empty view with a clickable records table.
- Added `vouchers-updated` listener so list refreshes after save/post events.
- Fixed the follow-up first-load bug where a custom route such as `/sales/SA_177...` was classified before the form config was loaded, causing it to query accounting vouchers instead of Sales invoices.
- Broadened matching to include canonical `voucherType + persona` (`sales_invoice` + `direct`) so cloned/custom forms show records saved as `sales_invoice_direct`.
- Routed dynamic Sales rows to native Sales detail pages.
- Added a Sales dashboard Recent Sales Invoices card in Operational workflow mode so draft/direct invoices are visible even when the main workflow card shows Sales Orders.

### Files Changed
- `frontend/src/modules/tools/pages/DynamicDocumentPage.tsx`
- `frontend/src/modules/sales/pages/SalesHomePage.tsx`
- `ACTIVE.md`
- `JOURNAL.md`

### Verification
- `npm run build` in `frontend/` passed.
- Final follow-up patch was not test-run per developer instruction to avoid running builds/tests on every small fix.

### Acceptance Criteria Met
- Saved documents are visible on dynamic form list pages.
- Empty state appears only when there are truly no records.
- Clicking a row opens the specific document detail route.
- List updates after save/post events.

## End-User View

When you open a dynamic form page (for example `sales_invoice_direct`), you now see the actual saved documents in a list.  
Previously that page always looked empty even after successful saves.  
Now it behaves like a real document list: you can review records and open them directly.

In Operational Sales mode, the dashboard now also shows recent Sales Invoices. A draft Direct Sales Invoice can be found without switching away from the dashboard.
