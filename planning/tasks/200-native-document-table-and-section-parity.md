# Task 200 - Native Document Table and Section Parity

**Date:** 2026-06-09
**Owner:** Codex
**Estimated time:** 8-12 hours
**Status:** In progress

## Goal

Make Sales Invoice the strict anatomy template for all native document/form pages. The pages should share the same scaffold, table behavior, rail/footer structure, and empty-section presence. Only document-specific inputs, labels, selectors, validation, actions, and business content should differ.

## Scope

Native document/form pages in this slice:

- Sales Invoice
- Purchase Invoice
- Sales Order
- Delivery Note
- Sales Return
- Quotation
- Purchase Order
- Goods Receipt
- Purchase Return

List pages, reports, settings pages, and master-data pages are out of scope because they are different page types and should follow their own shared layouts.

## Architecture decision

Implement shared behavior in the shared components first:

- `ClassicLineItemsTable` owns row/table context menus, local table UI preferences, export/import, row highlighting, minimum edit rows, auto-append behavior, centered headers/cells, and contained scrolling.
- `DocumentDetailScaffold` owns the common section/rail/footer contract and standard empty placeholders.
- Native pages pass callbacks and document-specific content into those shared contracts.

Do not copy/paste Sales Invoice markup into every page. That creates drift. The safe ERP pattern is one shared document scaffold and one shared editable line grid.

## Accounting and financial boundary

This is a UI/data-entry parity task only.

No changes are allowed to:

- ledger posting
- tax calculation
- AR/AP settlement
- inventory valuation
- COGS
- approval
- period locks
- voucher creation
- audit writes
- backend DTOs or repositories

The allocation area may be displayed for ledger-impacting pages, but it remains an empty/display-only placeholder until the controlled allocation posting contract is implemented. Users must not be able to override GL/tax accounts from this task.

## Implementation slices

### Slice A - Commit checkpoint and plan

**Estimated:** 0.5h

- Commit the existing completed document scaffold parity work after typecheck.
- Create this plan file.
- Add the task lock / current-focus notes.

### Slice B - Shared table behavior

**Estimated:** 3-4h

Update `frontend/src/components/shared/ClassicLineItemsTable.tsx`:

- Row right-click menu:
  - copy
  - paste
  - delete
  - insert row
  - highlight / remove highlight
- Table context menu from the empty `#` header cell:
  - copy table
  - paste table
  - clean
  - export CSV
  - import JSON/CSV
- UI preferences modal:
  - classic/web layout skin
  - alternating row color mode
  - text size
  - number font
  - saved in `localStorage` per table ID
- Edit-mode row behavior:
  - can show at least 25 lines while editing
  - auto-adds one row when the last visible line is filled
  - view/read-only mode shows only filled lines when a row-filled predicate is provided
- Table containment:
  - table scrolls within its section
  - headers/cell content centered by default unless a column explicitly overrides

### Slice C - Page wiring

**Estimated:** 3-4h

Wire all native document pages using `ClassicLineItemsTable` with stable table IDs and row operations. Pages keep their existing business logic and only provide shared-table callbacks.

Target files:

- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `frontend/src/modules/sales/pages/SalesOrderDetailPage.tsx`
- `frontend/src/modules/sales/pages/DeliveryNoteDetailPage.tsx`
- `frontend/src/modules/sales/pages/SalesReturnDetailPage.tsx`
- `frontend/src/modules/sales/pages/QuotationDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseOrderDetailPage.tsx`
- `frontend/src/modules/purchases/pages/GoodsReceiptDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseReturnDetailPage.tsx`

### Slice D - Scaffold section completeness

**Estimated:** 1.5-2h

Update `DocumentDetailScaffold` and document pages so the shared section contract is visible consistently:

- Name and standardize the top icon cluster as **Document action tray** inside the scaffold. The tray holds document actions such as attachment, upload/export, delete/void, history/audit, and page-specific quick tools.
- Rail sections are always present for document pages, even when content is empty.
- Footer totals use the same scaffold-level pattern as Sales Invoice.
- Ledger-impacting pages show the allocation section placeholder.
- Non-ledger pages may preserve empty slots if needed for layout parity, but must not imply posting behavior.

### Slice E - Documentation and verification

**Estimated:** 1.5-2h

- Update `docs/architecture/document-scaffold.md`.
- Update Sales/Purchases user-guide notes.
- Add completion report under `planning/done/200-native-document-table-and-section-parity.md`.
- Append `planning/JOURNAL.md`.
- Update `planning/ACTIVE.md`, `planning/PRIORITIES.md`, and `planning/QA-QUEUE.md`.
- Run:
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run build`

## Acceptance criteria

- All native document/form pages listed in scope use the same shared table behavior.
- Right-clicking a row opens row actions.
- Right-clicking the empty `#` header cell opens table actions.
- Preferences persist per page/table in local storage.
- Editing mode starts from a 25-line working grid where supported and auto-adds when the final visible row becomes filled.
- View/read-only mode does not show phantom empty rows when a row-filled predicate is supplied.
- Table headers and cell data are centered by default and the table stays inside its section with internal scrolling.
- The shared scaffold owns footer totals and persistent rail/section placeholders.
- No backend/accounting/posting behavior changes.

## Risks and mitigations

- **Risk:** Import/paste could corrupt document line shape.
  - **Mitigation:** Paste/import only merges plain row objects through existing page callbacks; backend validation remains authoritative.
- **Risk:** Auto-added blank lines could affect totals/posting.
  - **Mitigation:** Existing pages already filter active lines before payload creation; view/read-only filtering reduces phantom rows.
- **Risk:** Page-specific linked-document lines should not allow arbitrary insert/delete.
  - **Mitigation:** Context actions are disabled when page callbacks are absent or the table is read-only.
- **Risk:** Large visual rollout across many pages.
  - **Mitigation:** Shared component first, narrow page wiring, then typecheck/build.
