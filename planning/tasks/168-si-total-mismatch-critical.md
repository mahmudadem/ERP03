# Task 168 — CRITICAL: Sales Invoice grand-total mismatches posted ledger

**Status:** Open
**Severity:** 🔴 Critical (financial correctness — UI lies or ledger lies)
**Discovered:** 2026-06-04 manual QA pass on Task 162.
**Driver:** Reproduce and fix.

## Repro (as reported)

- Sales Invoice with one line: qty `2`, unit price `0.25`. No charges or discounts mentioned.
- Sales Invoice detail page: Grand Total = **1**.
- Approval Center → Source Documents row: total shown = **1**.
- Posted voucher / ledger effect: **0.50**.

So either the displayed total is wrong (UI shows 1 but the books are correctly 0.50), or the posting under-reports (UI shows 1 but the ledger only got 0.50). Either is severe.

## First leads to chase

1. **Tax-inclusive vs tax-exclusive math.** `SalesTaxCode` has a `priceIsInclusive` flag and the SI line has its own `priceIsInclusive` override. If the UI total adds tax to the line subtotal while the post treats the line as already-inclusive, you get exactly this kind of drift.
2. **Doc vs base currency.** The Approval Center row displays `totalDoc` while the ledger writes `totalBase`. If currency ≠ base and `exchangeRate` is wrong (or wired to `1` when it shouldn't be), this gap appears.
3. **Computed totals in the entity vs computed totals in the view.** The SI entity has `recalcInvoiceTotals(si)` called inside the posting transaction. The frontend computes totals independently (`computedLines`, `totals.subtotalDoc/grandTotalDoc`) for display. Two computation paths = drift waiting to happen.
4. **Charges / additions silently included.** The SI has a charges array. If the test invoice somehow has a charge of 0.5 it would explain Grand Total 1.

## What to capture for the fix

Re-create the failing invoice and write down:
- Currency, base currency, exchange rate.
- Line: itemId, qty, unitPrice, taxCodeId, priceIsInclusive flag both on the line and on the tax code.
- Settled SI fields: `subtotalDoc`, `taxTotalDoc`, `grandTotalDoc`, `subtotalBase`, `taxTotalBase`, `grandTotalBase`.
- The posted voucher lines: each account, debitAmount, creditAmount.

Cross-check arithmetic: does `subtotalDoc + taxTotalDoc + chargesTotalDoc = grandTotalDoc`? Does `grandTotalDoc * exchangeRate = grandTotalBase` (with rounding)?

## Likely fix paths

- If UI math diverges from entity math: collapse to one source. Frontend should display whatever the backend returned post-save, not recompute.
- If tax-inclusive flag has two interpretations: nail down the single rule and remove the override path.
- If the issue is base/doc display confusion: clarify column labels and always show both during QA.

## Acceptance criteria

- [ ] Reproduce the failing scenario.
- [ ] Identify which side is wrong (UI display, frontend totals computation, entity totals, posting math).
- [ ] Add a unit test that pins the correct behavior.
- [ ] Verify Approval Center row total uses the same computation path.

## Effort estimate

Investigation 1–2h. Fix may be small if it's a single inclusive-vs-exclusive bug; could be larger if total computation is duplicated across layers.

