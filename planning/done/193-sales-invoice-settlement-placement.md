# 193 - Sales Invoice Settlement Placement Polish

**Date:** 2026-06-09  
**Agent:** Codex  
**Branch:** `feat/overpayment-credit-balance`  
**Actual time:** ~0.9h

## Technical Developer View

### What Changed

- Updated `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`.
- Moved the editable `SettlementBlock` from above the invoice line grid to the end of the invoice body, after line items and the Account Ledger and Financial Taxes Allocation Grid placeholder.
- Removed duplicated lower body shortcut tiles for Attachments and Audit & Warnings.
- Preserved the attachment entry point through the existing top paperclip icon.
- Added a compact top History/Audit icon beside the existing document action icons; it opens the same audit modal and turns amber when a credit warning is active.
- Tightened the shared `SettlementBlock` full-paid editor so Method, Amount, and Contra Account render as one equal-width row.
- Moved settlement validation/over-payment messages into the section header instead of rendering a separate body alert row.
- Polished settlement editor labels/placeholders so editable field labels read as black/dark text while account placeholders keep the shared muted gray token.
- Widened the settlement mode dropdown by roughly 25% for clearer Fully paid / On credit / Multi payment choices.
- Fixed RTL rail behavior on the native Sales Invoice page: the edge trigger, drawer side, inner hide button, rail icon direction, and back arrow now mirror correctly in Arabic.
- Applied the same RTL rail-control pattern to the shared `DocumentDetailScaffold` used by SO/DN/SR/PI/PO detail pages.

### Accounting Boundary

This is a UI placement change only. It does not change:

- settlement payload shape
- invoice totals
- tax calculation
- posting
- payment voucher creation
- AR balances
- inventory valuation
- approval or period-lock behavior
- ledger writes or audit persistence

### Verification

- `npm --prefix frontend run typecheck` passed.
- `git diff --check -- frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx` passed with CRLF line-ending warning only.
- `git diff --check -- frontend/src/components/shared/settlement/SettlementBlock.tsx` passed.
- `git diff --check -- frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx frontend/src/components/shared/DocumentDetailScaffold.tsx frontend/src/components/shared/settlement/SettlementBlock.tsx` passed with CRLF line-ending warning only.
- Follow-up `npm --prefix frontend run typecheck` passed.

### Files Touched

- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/components/shared/DocumentDetailScaffold.tsx`
- `frontend/src/components/shared/settlement/SettlementBlock.tsx`
- `docs/architecture/sales.md`
- `docs/architecture/purchases.md`
- `docs/user-guide/sales/direct-invoice-and-operational-linked-invoice.md`
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`
- `planning/done/193-sales-invoice-settlement-placement.md`

## End-User View

The Sales Invoice form now follows the work sequence more naturally:

1. Enter invoice header details.
2. Add invoice lines.
3. Review tax/allocation information.
4. Choose settlement/payment handling.
5. Use the sticky footer actions to save or post.

Attachments are still available from the paperclip icon at the top of the invoice. History/audit is now available from the compact history icon in the same top action area.

In Arabic/RTL, the invoice rail now behaves from the correct left edge: hide/show controls, drawer opening, and rail icons mirror the Arabic layout instead of acting like the English right-side rail.

## Manual QA

- Open `Sales -> Invoices -> New Sales Invoice`.
- Confirm the visible order is Header -> Lines -> Allocation -> Settlement -> sticky footer.
- Click the top paperclip icon and confirm the Attachments panel opens.
- Open an existing invoice and click the top History/Audit icon.
- Switch to Arabic/RTL, hide the invoice rail, then reopen it from the edge button and confirm it opens from the left side without clipping.
- Repeat in Windows mode with a resized invoice window.
