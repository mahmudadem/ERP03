# Phase 4 (Epic 240) — PERIODIC posting mode (the core new mode)

**Parent epic:** [240](./240-simple-periodic-mode-and-item-costing-epic.md) · **Depends on:** Phase 1 (spec). Best after Phase 2. · **Blocks:** Phase 5, Phase 6.

## Objective
Make `PERIODIC` a **real, distinct** inventory accounting mode that posts simple trading books — purchases → Purchases account, sales → Sales account, **no inventory-asset or COGS GL lines per transaction** — while the stock **quantity** engine keeps running so report-time valuation (Phase 5) works.

## 1. Make PERIODIC first-class
`backend/src/domain/inventory/entities/InventorySettings.ts`:
- Add `'PERIODIC'` to `InventoryAccountingMode` (currently `'INVOICE_DRIVEN' | 'PERPETUAL'`).
- Stop remapping legacy `PERIODIC` → `INVOICE_DRIVEN` in `normalizeAccountingMode`; `PERIODIC` now maps to itself. Keep `INVOICE_DRIVEN` and `PERPETUAL` behavior **byte-for-byte unchanged**.

## 2. Posting branch (find `DocumentPolicyResolver` — grep; it has the mode-aware methods)
In PERIODIC mode the GL postings are:
| Document | PERIODIC GL posting | Quantity |
|---|---|---|
| Purchase Invoice | Dr **Purchases** / Cr AP (+ tax) | IN, only if no GRN moved it |
| Sales Invoice | Dr AR / Cr **Sales** (+ tax) | OUT, only if no DN moved it |
| Purchase Return | Dr AP / Cr **Purchases-returns** | IN→OUT |
| Sales Return | Dr **Sales-returns** / Cr AR | OUT→IN |
| Goods Receipt / Delivery Note | **none** | IN / OUT (owns the quantity move) |
| Stock Adjustment | **none** (quantity only) | IN/OUT |
| Opening Stock | Dr **Goods/Opening Inventory** / Cr Opening-Balance-Equity | IN |
| Purchase/Sales Order | none | none |

- **No inventory-asset and no COGS lines anywhere in PERIODIC.**
- **No-double-count rule (reuse existing):** the invoice moves **quantity** only if a DN/GRN didn't already (today: `goodsAlreadyReceived(line, po)` in `PurchaseInvoiceUseCases.ts:237`; SI posts COGS "only if no DN posted"). In PERIODIC the same gate decides whether the invoice does the **quantity** movement.
- Discounts: post to Purchases-discounts / Sales-discounts (or net into Purchases/Sales per the periodic COA design — follow `docs/architecture/inventory.md` from Phase 1; default: contra accounts).

Files likely touched: `PurchaseInvoiceUseCases.ts`, `SalesInvoiceUseCases.ts`, `DeliveryNoteUseCases.ts`, goods-receipt use-case, purchase/sales return use-cases, `StockAdjustmentUseCases.ts`, `OpeningStockDocument` posting, and the resolver.

## 3. Periodic COA template + starter wiring
- Add a **periodic COA template** with: Purchases, Purchases-returns, Purchases-discounts, Sales, Sales-returns, Sales-discounts, Goods/Opening & Closing Inventory, Trading account, plus shared AR/AP/Cash/Bank/Equity/Expenses. (COA templates are hardcoded TS arrays — grep `SimplifiedCOA`/`StandardCOA`.)
- Make the **Simple Trading Company** starter (see `planning/done/232-*.md`) select `PERIODIC` + this COA, and default-hide Delivery Note / Sales Order / Purchase Order / Goods Receipt from the sidebar (`moduleMenuMap.ts`) with a toggle to show them.

## Tests
- Each document type in PERIODIC produces the correct GL lines and **zero** inventory/COGS lines.
- Quantity correct **with** and **without** a DN/GRN (no double count).
- Returns hit contra accounts; opening stock hits Goods/Opening-Equity.
- `INVOICE_DRIVEN` / `PERPETUAL` regression suites still green (no behavior drift).
- `npm run build`; emulator round-trip.

## Acceptance
- A PERIODIC tenant posts simple trading books with no inventory/COGS lines; stock quantities stay accurate. (Balance Sheet / Trading reporting comes in Phase 5.)

## Definition of Done
- `planning/done/240d-phase4-periodic-posting-mode.md` (QA script), `docs/architecture/inventory.md` + user-guide, JOURNAL, ACTIVE.
