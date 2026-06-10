# Task 202 — Document Scaffold: True Template Adoption

**Created:** 2026-06-10 (audit by Claude, decisions by Mahmud)
**Status:** Phases 1–3 DONE (2026-06-10, commits `f6ee6ea4`, `a193ddd4`, `fa683ad8`; report
[done/202-document-scaffold-true-template-adoption-phases-1-3.md](../done/202-document-scaffold-true-template-adoption-phases-1-3.md)).
Phase 4 (Sales Invoice rebuild) pending — precondition: settlement QA (report 194) passes.
**Branch context:** `feat/overpayment-credit-balance`

## Why this task exists (audit result)

Product intent: **one** scaffold/template for all native Sales & Purchases document pages —
control section, header section, lines table, side rail (info / readiness / settlement / totals),
sticky footer — **identical** across pages, with per-section show/hide flags, and only the inputs
differing per document. The Sales Invoice page is the reference design.

Audit on 2026-06-10 found the intent is **not** met, even though Tasks 196/197/198/200 claim
scaffold parity:

1. **The template exists and matches the intent on paper.**
   `frontend/src/components/shared/DocumentDetailScaffold.tsx` defines named body slots
   (`control`, `header`, `lines`, `secondary`, `attachments`), rail slots
   (`info`, `readiness`, `settlement`, `totals`), footer slots (`totals`, `actions`),
   each with `show` / `preserveSpace` flags.

2. **The reference page does not use the template.** `SalesInvoiceDetailPage.tsx` (~2,895 lines)
   is fully bespoke; it uses none of the scaffold/anatomy primitives except
   `ClassicLineItemsTable`, and contains its **own duplicated copy** of the rail/drawer/sticky-footer
   logic. Two parallel implementations exist and have already drifted (example: SI shows footer
   totals only when the rail is hidden; scaffold consumers always show them).

3. **Zero pages use the named slots.** All 8 scaffold consumers pass content through the legacy
   compatibility props (`children` + `sideRail` + `footerSummary` + `footerActions`), which the
   scaffold wraps into a single `custom` slot. No page sets `sections=` / `railSections=` /
   `footerSections=`. The show/hide flag system is currently dead code. (Report 197's own caveat
   admitted this cleanup was pending; it never happened.)

4. **Primitive adoption is uneven** (counted 2026-06-10):

   | Page | Scaffold shell | Named slots | Anatomy primitives |
   |---|---|---|---|
   | SalesInvoiceDetailPage (reference) | no — own copy | no | none (bespoke) |
   | PurchaseInvoiceDetailPage | yes | no | deep (control, header grid, cards, lines region, secondary, rail, footer strip) |
   | SalesOrderDetailPage | yes | no | partial (header grid, rail, footer) |
   | DeliveryNoteDetailPage | yes | no | partial (header grid, rail, footer) |
   | PurchaseOrderDetailPage | yes | no | partial (header grid, rail, footer) |
   | GoodsReceiptDetailPage | yes | no | partial (header grid, rail, footer) |
   | SalesReturnDetailPage | yes | no | shallow (rail + footer; page-local header) |
   | PurchaseReturnDetailPage | yes | no | shallow (rail + footer; page-local header) |
   | QuotationDetailPage | **no shell at all** | no | header grid + table only |

## Product-owner decisions (Mahmud, 2026-06-10)

- **Order of work:** perfect the **template itself first**, then **pilot on Purchase Invoice**,
  then roll out to the remaining pages, and rebuild **Sales Invoice last**.
- **Quotation is excluded** — leave it as-is (page-local lifecycle header stays).
- **Keep the legacy escape hatch** (`children` / `sideRail` props stay). Named sections are the
  standard by convention, not enforced by the type system. Future agents MUST still use named
  slots for document pages — record this in `docs/architecture/document-scaffold.md`.

## Phases

### Phase 1 — Template self-parity (template vs. Sales Invoice design)
Diff `DocumentDetailScaffold` rendering against the bespoke SI page and remove every visual/behavioral
difference, so the mold is an exact replica of the reference design. Known drift to resolve:
- Footer totals visibility rule (SI: only when rail hidden + drawer closed; scaffold: always).
- Verify rail pin/drawer breakpoints, paddings, grid row sizing, RTL behavior match SI exactly.
- Confirm every piece of SI anatomy has a corresponding primitive/slot (control strip, header grid,
  lines region, allocation-grid secondary panel, attachments/audit shortcuts, settlement rail card,
  totals rail card, footer totals strip, action tray).
Deliverable: template is the single source of truth for the design, even before SI consumes it.

### Phase 2 — Pilot: Purchase Invoice on strict named slots
Migrate `PurchaseInvoiceDetailPage` (draft/edit AND posted view) from `children`/`sideRail` to
`sections=` / `railSections=` / `footerSections=` with explicit `show` flags. PI is the deepest
primitive adopter already, so it is the cheapest true pilot.
**QA gate:** Mahmud does a side-by-side visual pass of PI vs SI (Classic + Windows mode, EN + AR/RTL)
before Phase 3 starts.

### Phase 3 — Rollout: SO, DN, SR, PO, GRN, PR
Migrate the six remaining consumers to strict named slots. Each document hides sections it does not
need via flags (e.g. DN/GRN: `settlement: { show: false }`). Returns pages (SR/PR) also adopt
`DocumentHeaderGrid`/`DocumentHeaderField` so their headers stop being page-local markup.

### Phase 4 — Rebuild Sales Invoice on the template (LAST)
Replace SI's bespoke shell/rail/footer with the scaffold + named slots; delete its duplicated
rail/drawer/footer code. Precondition: settlement/over-payment manual QA (report 194 scripts A–D +
canonical over-payment scenario) has passed first, so QA failures are attributable.

## Boundaries

- UI/layout only. No posting, tax, settlement payloads, AP/AR, inventory, approval, period-lock,
  audit, DTO, or ledger behavior changes in any phase.
- Quotation page is out of scope (owner decision).
- Do NOT remove the legacy `children`/`sideRail` props (owner decision).

## Verification per phase

- `npm --prefix frontend run typecheck` and `npm --prefix frontend run build`.
- Add a QA-QUEUE entry per phase; visual QA in Classic + Windows mode, EN + AR.
- Update `docs/architecture/document-scaffold.md` (named slots are the standard; escape hatch is
  legacy-compat only) and the completion report `planning/done/202-*.md`.
