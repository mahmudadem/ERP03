# 182 — Purchases parity: vendor discounts + landed costs/charges

**Status:** Open
**Owner:** TBD (backend + frontend)
**Origin:** Mahmud, 2026-06-07 — observed during Task 178 planning that the Purchase Invoice posting looks "small" mostly because **Purchases was under-built relative to Sales**, not because purchasing is inherently simpler. We poured development into Sales (line discounts, charges, inclusive tax, COGS/inventory) and gave Purchases less.
**Folds in:** [Task 170 Finding A](./170-related-line-math-gaps.md) (PI had no `priceIsInclusive` / discount fields — `priceIsInclusive` shipped; discounts remain open).
**Rides on:** [Task 178](./178-subledger-document-poster-refactor.md) — the new posting entries (discount debits, landed-cost capitalization) should be fed through the shared `SubledgerDocumentPoster` once PI is migrated, not added as more bespoke voucher-line building.

## The gap (what Sales has that Purchases doesn't)

| Capability | Sales Invoice | Purchase Invoice |
|---|---|---|
| Per-line discount (`discountType`, `discountValue`, discount account posting) | ✅ | ❌ none |
| Charges / additions (freight, handling) | ✅ (added to revenue) | ❌ none |
| Inclusive/exclusive tax | ✅ | ✅ (shipped) |
| Cost-into-inventory valuation depth | n/a (sale consumes) | thin — no landed-cost capitalization |

## Scope

### A. Vendor / line discounts on PI
- Add `discountType` / `discountValue` / `discountAmountDoc` to `PurchaseInvoiceLine` (mirror SI).
- Posting: a trade discount on a purchase **reduces the inventory/expense debit** (you capitalized less), so the discount nets against the line's debit rather than posting to a separate "discount income" account by default — confirm the accounting treatment with the owner (purchase discounts can be either a reduction of cost OR "purchase discount income", a policy choice).
- Frontend: discount columns on the PI line table (the shared `ClassicLineItemsTable` already supports extra columns).
- Consider PO / GRN discount carry-forward so the discount flows PO → GRN → PI.

### B. Landed costs / charges on PI
- Add a charges concept to PI (freight, customs, insurance, handling).
- The valuable part: **capitalize** these into the inventory unit cost (landed cost), so COGS later reflects the true acquired cost — not expense them separately. This is the real purchasing feature.
- Allocation method across lines (by value / by weight / by quantity) is a policy choice — start with by-value, make it configurable later.
- Posting: Dr Inventory (capitalized portion) / Cr the charge's payable or a clearing account.

## Explicitly NOT in scope — COGS on purchases

COGS is **sale-side** and must stay there. A purchase **debits Inventory** (an asset goes up); COGS only fires when the goods are **sold** (Dr COGS, Cr Inventory). Do **not** add a "COGS voucher" to the Purchase Invoice — that would be wrong accounting. The purchase's job is to set the **cost basis** that COGS later consumes (that's what landed-cost capitalization in B feeds).

## Relationship to other work

- This is the substance behind the **"Phase G — Purchases-specific"** line in [PRIORITIES.md](../PRIORITIES.md). It can be sequenced as part of Phase G.
- It should land **after** Task 178 PI migration (Stage B), so the new posting entries go through the shared poster from day one.
- Inclusive-tax interplay with discounts on PI must mirror the SI rule (discount applies to the net, tax recomputed) — reuse the SI calculation pattern.

## Definition of done

- PI supports per-line discounts end to end (entity, DTO, use case, posting through the poster, frontend column, tests pinning the math).
- PI supports landed costs/charges capitalized into inventory unit cost, with a configurable allocation method (by-value to start).
- Posting stays balanced; inclusive-tax + discount interaction has a regression test (mirror SI Task 168/170).
- COGS remains sale-side only (architecture/test note so no one adds it to PI).
- Docs (`docs/architecture/purchases.md`, user guide) + done report.
