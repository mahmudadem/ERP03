# Task 204 — Line Table Feature Sweep + Purchase/SO/SR Line Discount

**Date:** 2026-06-11
**Agent:** Claude (interactive)
**Time spent:** ~3h

## Technical Developer View

### What changed

Two threads woven together in one session:

**A. Shared line-table feature sweep** — improved the experience on every
detail page that uses `ClassicLineItemsTable`:
- Enter advances the focused input to the next editable cell (left-to-right,
  row by row, wraps); the new row is scrolled into view if it would otherwise
  be off-screen.
- Numeric cells show min-2-decimal display when unfocused (25 → "25.00"),
  preserve extra precision (25.575 → "25.575"), and clear to blank when value
  is 0/empty (still 0 in the data model).
- Cell content auto-selects on focus.
- Computed cells gained an optional `solveFromTotal(value, row, index)` API
  on `ColumnDef`. When present, the cell becomes editable and the returned
  patch is merged into the row — used by all detail pages to back-solve unit
  price from Line Total / Net.
- Settings modal grew Column Order (per-table reorder via ↑/↓ buttons),
  table font, and two line-color selectors for alternating rows.
- Row alternating colors and per-row colors switched from Tailwind classes
  to inline RGBA so the JIT can't lose them due to class-ordering.
- Tabular trash-delete column removed; row delete is still available via the
  right-click context menu.

**B. Per-page parity + new selectors**
- `TaxCodeSelector` (typable combobox + modal) — replaces native `<select>`
  in SI / PI / PO / Quotation / SO.
- `DiscountTypeSelector` (typable combobox with three-option modal) — used
  wherever a discount-type column exists.
- All in-cell selectors render borderless and inherit the table's font/size
  preferences via `[font-size:inherit] [font-family:inherit]`.
- Clearing the Item now resets the whole row (qty, price, uom, tax,
  discount, etc.) instead of leaving stale values.
- Default qty is `0` (blank in the cell) instead of `1`.
- Empty rows disable the tax-code / discount selectors so the chevron only
  appears once the row has an item.
- Operational-workflow warning banner became a header-icon + click-to-modal
  pattern on SI.
- Rail Totals expanded to show Subtotal / Discount / Tax with a larger
  Grand Total block that always also shows Grand Total (Base).

**C. Line discount added to Purchases (PI / PO / PR)** — full vertical slice:
- Domain entities, DTOs, validators, use-cases now accept `discountType`
  ('PERCENT' | 'AMOUNT') and `discountValue`; entity recomputes
  `discountAmountDoc/Base`, `grossLineTotalDoc/Base`, and applies the
  discount **before tax** so the taxable base is post-discount — standard
  trade-discount semantics per EU VAT Directive Art. 79(a). PR inherits its
  source PI line's discount when sourced from `AFTER_INVOICE`.
- Frontend API types (`purchasesApi.ts`) updated.
- PI, PO, PR pages display Discount Type + Discount columns, apply
  discount in the local compute, send discount through save / load, and
  back-solve unit cost from Line Total / Net **with discount taken into
  account**.

**D. Line discount added to SO / SR** — same vertical slice mirrored on the
sales side (SI and Quote already had discount). SR inherits discount from
the source SI line by default.

**E. Tests** — 15 domain tests for purchase line discount, covering
PERCENT, AMOUNT, clamp-at-gross, inclusive-tax discount split, round-trip
through `toJSON` / `fromJSON`, and zero-discount equivalence.

### Architecture / workflow effect

The discount math is intentionally **engine-level** (each entity's
`normalizeLine` is the single source of truth). Use-cases forward
`discountType` / `discountValue` only; they never precompute the discount
amount. Frontend pages keep their own forward calc only for live preview;
the server's computed values are what posts to the ledger.

Tax-on-post-discount-net is the standard treatment for on-invoice trade
discounts (EU VAT Art. 79(a), US sales tax majority rule, GCC, UK, IN GST).
Cash/settlement discounts are explicitly not in scope here; they're
post-invoice adjustments and don't change the tax on the original document.

### Files changed

Frontend:
- `frontend/src/components/shared/ClassicLineItemsTable.tsx`
- `frontend/src/components/shared/selectors/TaxCodeSelector.tsx` (new)
- `frontend/src/components/shared/selectors/DiscountTypeSelector.tsx` (new)
- `frontend/src/components/shared/selectors/ItemSelector.tsx`
- `frontend/src/components/shared/selectors/UomSelector.tsx`
- `frontend/src/components/shared/selectors/index.ts`
- `frontend/tailwind.config.js`
- `frontend/src/api/purchasesApi.ts`
- `frontend/src/api/salesApi.ts`
- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/modules/sales/pages/SalesOrderDetailPage.tsx`
- `frontend/src/modules/sales/pages/QuotationDetailPage.tsx`
- `frontend/src/modules/sales/pages/DeliveryNoteDetailPage.tsx`
- `frontend/src/modules/sales/pages/SalesReturnDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseOrderDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseReturnDetailPage.tsx`

Backend:
- `backend/src/domain/purchases/entities/PurchaseInvoice.ts`
- `backend/src/domain/purchases/entities/PurchaseOrder.ts`
- `backend/src/domain/purchases/entities/PurchaseReturn.ts`
- `backend/src/domain/sales/entities/SalesOrder.ts`
- `backend/src/domain/sales/entities/SalesReturn.ts`
- `backend/src/api/dtos/PurchaseDTOs.ts`
- `backend/src/api/dtos/SalesDTOs.ts`
- `backend/src/api/validators/purchases.validators.ts`
- `backend/src/api/validators/sales.validators.ts`
- `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts`
- `backend/src/application/purchases/use-cases/PurchaseOrderUseCases.ts`
- `backend/src/application/purchases/use-cases/PurchaseReturnUseCases.ts`
- `backend/src/application/sales/use-cases/SalesOrderUseCases.ts`
- `backend/src/application/sales/use-cases/SalesReturnUseCases.ts`
- `backend/src/tests/domain/purchases/PurchaseInvoice.test.ts`
- `backend/src/tests/domain/purchases/PurchaseOrder.test.ts` (new)
- `backend/src/tests/domain/purchases/PurchaseReturn.test.ts`

### Out of scope (intentional)

- GoodsReceipt — qty-only document, no pricing/tax/discount math.
- Backend tests on the sales side (SI / Quote already covered; SO / SR
  discount is engine-mirror with the same shape as PI / PO and is exercised
  by the purchase tests).
- Cash/settlement discount.
- Docs in `docs/architecture/*` and `docs/user-guide/*` — separate task
  (this is the planning/done record only, per user direction).

## End-User View

You can now add a per-line **Discount Type** (% or amount) and a
**Discount** value to:
- Sales Invoice (was already there)
- Sales Order
- Sales Return
- Quotation
- Purchase Invoice
- Purchase Order
- Purchase Return

The discount reduces both the net and the tax — that's how on-invoice
trade discounts work in standard accounting. When returning items from an
invoice, the discount is inherited automatically so the return reverses
exactly what was billed.

You can also type a value into **Line Total** or **Net** and the unit
price will be back-solved for you, accounting for qty, discount, and
inclusive/exclusive tax.

## Manual QA

For each of SI / SO / Quotation / SR / PI / PO / PR:

1. Open a new document.
2. Pick a customer/vendor and warehouse.
3. Add a line with item, qty=10, unit price=100, tax code 5% exclusive.
4. Set Discount Type = `%`, Discount = 10.
   - Line Total should be **945**.
   - Net should be **900**.
   - Tax should be **45**.
5. Change Discount Type to `$`, Discount = 200.
   - Line Total should be **840**.
6. Type **500** directly into Line Total.
   - Unit Price should snap to `500 / (10 × 0.9 × 1.05) ≈ 52.91` for SI,
     or the equivalent inclusive-aware value for PI lines with inclusive
     tax codes.
7. For SR: pull from an SI with discount; confirm the SR shows the same
   discount and reverses the same net.

For tab/enter cell navigation: focus item, press Tab; cursor advances cell
by cell, wraps to next row, scrolls into view.

For the empty-state TaxCode picker: open a doc with no tax codes scoped
for that document side; the picker should show an amber "No tax codes set
up — Open Tax Codes settings" CTA.

## What's still open

- `docs/architecture/sales.md` and `docs/architecture/purchases.md` haven't
  been updated to call out the line-discount field. End-user docs
  (`docs/user-guide/sales/line-discount.md`, `docs/user-guide/purchases/line-discount.md`)
  haven't been written.
- JOURNAL.md and ACTIVE.md updates pending (this file is the completion
  record; the index updates are the next step).
