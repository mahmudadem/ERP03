# Document Detail Scaffold

## Purpose

`frontend/src/components/shared/DocumentDetailScaffold.tsx` is the shared native document layout for Sales and Purchases operational forms. It owns the static page structure so document pages do not rebuild the same shell independently.

## Fixed Sections

The scaffold exposes named body slots in this order:

1. `control` - source controls, mode selectors, linked-document selectors, and command controls.
2. `header` - party, date, currency, warehouse, salesperson, and document header inputs.
3. `lines` - the shared line-items table region.
4. `secondary` - allocation, settlement, audit preview, warnings, or other secondary workspaces.
5. `attachments` - document evidence and communication entry points when a page needs them.
6. `custom` - compatibility slot for older pages while they are being split into stricter sections.

The right rail exposes named slots in this order:

1. `info`
2. `readiness`
3. `settlement`
4. `totals`
5. `custom`

The footer exposes:

1. `totals`
2. `actions`

The top header exposes the **Document action tray** through `headerTools`. The scaffold wraps these tools in the shared tray chrome automatically. This is the compact icon cluster used for document-level quick actions such as attachments, upload/export, delete/void, history/audit, and page-specific tools. Pages should pass actions into `headerTools`; they should not rebuild a separate action strip.

Each slot uses the same `DocumentScaffoldSection` contract:

```ts
{
  show?: boolean;
  preserveSpace?: boolean;
  title?: string;
  action?: React.ReactNode;
  content?: React.ReactNode;
  className?: string;
}
```

`show: false` hides a section. `preserveSpace: true` keeps an intentionally empty section in the static layout when a page has no content for that slot yet. This allows Delivery Notes, Sales Orders, Purchase Orders, Goods Receipts, Purchase Returns, Sales Returns, Sales Invoices, and Purchase Invoices to keep the same page anatomy while showing different controls and data.

## Compatibility Rule

Older consumers that still pass `children` or `sideRail` are normalized through the same scaffold pipeline as `custom` sections. This keeps the shell, rail behavior, RTL mirroring, drawer behavior, and sticky footer consistent while individual pages are progressively split into strict `control` / `header` / `lines` / `secondary` slots.

New or materially edited native document pages should use `sections`, `railSections`, and `footerSections` directly. Do not add new page-local document shells.

## Header Density Standard

Native document headers use Sales Invoice density as the default:

- Header fields render through `DocumentHeaderGrid`.
- Wide layouts default to five columns, which gives a maximum of ten compact header cells across two rows.
- Controls use `documentHeaderControlClass`: `h-9`, compact `text-xs`, square `rounded`, and low padding.
- Selector wrappers use `documentHeaderSelectorClass` so shared selectors align with normal inputs.
- Labels use `documentHeaderLabelClass`: `text-[10px]`, uppercase, bold, muted.
- Notes, reasons, and other long free-text fields should sit below the compact header grid, not consume one of the two header rows unless there is a strong document-specific reason.

This keeps Sales Invoice, Purchase Invoice, Sales Order, Delivery Note, Quotation, Purchase Order, Goods Receipt, Sales Return, and Purchase Return from drifting into different input sizes.

## Shared Line Items Table

`frontend/src/components/shared/ClassicLineItemsTable.tsx` is the required line-grid surface for native document pages. It owns behavior that must not be reimplemented page-by-page:

- row right-click context menu: copy, paste, delete, insert row, highlight, explicit row color
- table context menu from the empty `#` header cell: copy, paste, clean, export, import, UI selector
- resizable columns saved in `localStorage` per `tableId`
- per-table local preferences for classic/web skin, row coloring, text size, and number font
- blank visual cells until values are entered; input placeholder text is suppressed in the table
- borderless custom selector cells, with callers expected to pass shared selectors using `noBorder`
- optional 25-line edit-mode working grid when the page supplies `createEmptyRow` and `onRowsChange`
- optional read-only/view filtering of blank rows when the page supplies `isRowFilled`

Every native document table must pass a stable `tableId` so local column widths and UI preferences do not leak across document types.

Pages that use `minEditRows` or auto-append must make `isRowFilled` ignore default numeric placeholders such as quantity `1` or price `0`. A blank working line is only filled when it has real business content such as item, description, warehouse, account, tax, or another selected reference. This prevents placeholder rows from triggering endless auto-append loops. This contract is enforced at every native document table consumer, not only the page where a regression is first noticed.

## Accounting Boundary

This scaffold is presentation-only. It must not calculate authoritative totals, post vouchers, mutate settlement state, alter tax behavior, change inventory valuation, bypass approvals, or write ledger records. Document pages may display computed values, but backend use cases and posting services remain the accounting authority.
