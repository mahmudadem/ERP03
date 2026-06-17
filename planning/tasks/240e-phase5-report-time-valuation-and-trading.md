# Phase 5 (Epic 240) — Report-time inventory valuation + Trading account + Valuation report

**Parent epic:** [240](./240-simple-periodic-mode-and-item-costing-epic.md) · **Depends on:** Phase 3 (costing stats), Phase 4 (periodic posting).

## Objective
Give PERIODIC mode a **correct, always-available** Balance Sheet and gross-profit view by **valuing stock at report time** (on-hand qty × selectable pricing policy) and computing the Trading account — mirroring the SME app's "Goods Pricing Policy: Average/Cost" report option. **Do not change perpetual reporting.**

## Deliverables
1. **`InventoryValuationService`** (application layer): `value(companyId, asOfDate, pricingPolicy, warehouse?)` → per-item + total, using `ItemCostingStats` (Phase 3) for the chosen `InventoryPricingPolicy` (default `AVERAGE`; also `LAST_PURCHASE`). On-hand qty as of date from stock movements/levels.
2. **Balance Sheet (PERIODIC only):** the Inventory line = valuation at policy. In `INVOICE_DRIVEN`/`PERPETUAL` the BS keeps reading the live GL inventory account — leave that path untouched. (See `backend/src/application/accounting/use-cases/ReportingUseCases.ts`.)
3. **Trading account / Gross profit (PERIODIC):** `Sales − (Opening Inventory + Net Purchases − Closing Inventory)`, Closing Inventory = valuation at period end, Opening Inventory = prior close (or opening-stock posting).
4. **P&L integration:** periodic P&L flows from the Trading result + expenses.
5. **Inventory Valuation report (new):** user picks pricing policy + as-of date → current stock value per item + total.

## Constraints
- Every new report page MUST use `<ReportContainer>` and be wired into `moduleMenuMap.ts` under a Reports parent (enforced by `check-reports.mjs`).
- The valuation must be balanced on the BS: present closing inventory as the period-end balancing figure against the trading result (virtual close), not a posted journal — unless Phase 4's opening/closing posting already books it.

## Tests
- PERIODIC BS inventory == Σ(on-hand qty × avgCost) at the as-of date.
- Trading GP == Sales − (Opening + Net Purchases − Closing).
- Switching pricing policy (AVERAGE vs LAST_PURCHASE) changes the figure correctly.
- Perpetual BS/P&L unchanged (regression).
- `npm run build`; emulator round-trip.

## Acceptance
- A PERIODIC company can open a current, balanced Balance Sheet **any time** without a manual count, and see gross profit via the Trading account; the Valuation report supports policy selection.

## Definition of Done
- `planning/done/240e-phase5-report-time-valuation-and-trading.md` (QA script), `docs/architecture/inventory.md` + `docs/architecture/accounting.md` + user-guide, JOURNAL, ACTIVE.
