# Document Detail Scaffold

## Purpose

`frontend/src/components/shared/DocumentDetailScaffold.tsx` is the shared native document layout for Sales and Purchases operational forms. It owns the static page structure so document pages do not rebuild the same shell independently.

## Fixed Sections

The scaffold exposes named body slots in this order:

1. `banner` - posted/pending-approval status banners, governance notices, and inline error strips.
2. `control` - source controls, mode selectors, linked-document selectors, and command controls.
3. `header` - party, date, currency, warehouse, salesperson, and document header inputs.
4. `lines` - the shared line-items table region.
5. `secondary` - allocation, settlement, audit preview, warnings, or other secondary workspaces.
6. `attachments` - document evidence and communication entry points when a page needs them.
7. `custom` - trailing document-specific content (for example the editable settlement block on invoices, or linked-document panels).

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
  title?: string;          // when set, body slots render inside DocumentCompactCard, rail slots inside DocumentRailCard
  action?: React.ReactNode;
  content?: React.ReactNode;
  className?: string;      // applied to the slot wrapper
  cardClassName?: string;  // applied to the card rendered for a titled slot (e.g. 'overflow-visible' for dropdown-heavy headers)
}
```

`show: false` hides a section. `preserveSpace: true` keeps an intentionally empty section in the static layout when a page has no content for that slot yet. This allows Delivery Notes, Sales Orders, Purchase Orders, Goods Receipts, Purchase Returns, Sales Returns, Sales Invoices, and Purchase Invoices to keep the same page anatomy while showing different controls and data.

Footer sections additionally accept `content` as a function of the rail state (`{ showInlineRail, railDrawerOpen }`). This is how the Sales Invoice behavior — footer totals strip only when the side rail is hidden, a short status line otherwise — is expressed through the named slots. Purchase Invoice uses this today.

## Standard Rail Card Interiors

The interiors of rail cards are standardized through four content primitives extracted from the
Sales Invoice rail design. Document pages must compose these instead of hand-writing rail markup:

- `DocumentRailFocus` — focused entity box (code / title / subtitle) plus an optional blue help
  note. Used for invoice-style Info cards (SI, PI).
- `DocumentRailKeyValueList` — label/value rows (value may be a `DocumentPill`). Used for status,
  source, and fact cards (SO, DN, SR, GRN, PR Info/Status cards).
- `DocumentRailChecklist` — readiness rows with `ok` (green), `warn` (red), or `info` (slate)
  states. Used for Posting Readiness / Document Status checks (SI, PI, GRN).
- `DocumentRailTotals` — light label/value rows plus the dark Grand Total box with the emerald
  value and optional base-currency footer line. Used for every Totals card; documents without a
  money grand total put their key quantity in the dark box (e.g. DN cost base, GRN received qty).

`DocumentRailStat` remains for dense stat tiles inside document-specific cards (e.g. the PI
settlement card) but is no longer the default rail language.

## Adoption Status (Task 202, 2026-06-10 — COMPLETE)

Every native Sales/Purchases document page now uses the strict named slots, **including Sales
Invoice itself** (Phase 4): SI, PI (draft + view), SO, DN (draft + view), SR (draft + view), PO,
GRN (draft + view), and PR. The Sales Invoice page no longer carries a page-local copy of the
shell — its rail state, drawer, edge button, sticky footer, topbar, and local Pill/Field/
CompactCard components were deleted in favor of the template. The scaffold is the single source
of truth for the document shell.

The only exclusion is **Quotation**, which intentionally stays page-local (owner decision,
2026-06-10).

## Compatibility Rule

The legacy `children` / `sideRail` / `footerSummary` / `footerActions` props still exist by owner decision (2026-06-10: keep the escape hatch), and are normalized through the same scaffold pipeline as `custom` sections. They are **legacy-compat only**: no module page uses them anymore, and new or materially edited native document pages MUST use `sections`, `railSections`, and `footerSections` directly. Do not add new page-local document shells, and do not pass document bodies through `children`.

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
- per-table line color 1 / line color 2 preferences, plus table font selection. The default
  table font is the Apex/app sans font (`Inter` through the app font variable); mono remains
  available for code-like workspaces and number cells can still use a separate number font.
- blank visual cells until values are entered; input placeholder text is suppressed in the table
- numeric zero placeholders render blank on empty working rows. Once a row has real business
  content, zero remains visible as an intentional value.
- borderless custom selector cells, with callers expected to pass shared selectors using `noBorder`
- item UOM cells must use `frontend/src/components/shared/selectors/UomSelector.tsx`. The selector
  can default from the selected item's sales or purchase UOM, but it only offers UOMs defined on
  that item (base, sales, purchase, and active item conversions). It has refresh and item-card
  navigation for maintenance; it must not create global UOMs from document lines.
- optional 25-line edit-mode working grid when the page supplies `createEmptyRow` and `onRowsChange`
- optional read-only/view filtering of blank rows when the page supplies `isRowFilled`

Every native document table must pass a stable `tableId` so local column widths and UI preferences do not leak across document types.

Pages that use `minEditRows` or auto-append must make `isRowFilled` ignore default numeric placeholders such as quantity `1` or price `0`. A blank working line is only filled when it has real business content such as item, description, warehouse, account, tax, or another selected reference. This prevents placeholder rows from triggering endless auto-append loops. This contract is enforced at every native document table consumer, not only the page where a regression is first noticed.

## Accounting Boundary

This scaffold is presentation-only. It must not calculate authoritative totals, post vouchers, mutate settlement state, alter tax behavior, change inventory valuation, bypass approvals, or write ledger records. Document pages may display computed values, but backend use cases and posting services remain the accounting authority.
