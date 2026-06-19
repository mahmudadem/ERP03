# Completion Report — Epic 240 Phase 5: Report-time valuation and trading

**Date:** 2026-06-18 · **Branch:** `main` · **Spec:** [tasks/240e](../tasks/240e-phase5-report-time-valuation-and-trading.md) · **Epic:** [240](../tasks/240-simple-periodic-mode-and-item-costing-epic.md)

## Technical developer view

### What changed

Phase 5 adds the missing **report-time close layer** for `PERIODIC` inventory accounting.

- **Inventory valuation service**
  - Added `backend/src/application/inventory/services/InventoryValuationService.ts`
  - Contract: `value(companyId, asOfDate, pricingPolicy, warehouseId?)`
  - Pricing policies implemented:
    - `AVERAGE`
    - `LAST_PURCHASE`
  - Supports both:
    - current valuation from live stock levels + item costing stats
    - historical valuation by replaying stock movements up to the report date

- **Periodic Balance Sheet**
  - `GetBalanceSheetUseCase` now accepts inventory settings + valuation dependencies.
  - In `PERIODIC` only, the inventory asset balance is overridden by report-time valuation at the requested date.
  - Other mapped inventory asset accounts are zeroed so section totals stay mathematically correct.
  - `INVOICE_DRIVEN` and `PERPETUAL` keep the old ledger-driven behavior.

- **Periodic Trading Account**
  - `GetTradingAccountUseCase` now computes:
    - `openingInventory = valuation(day before fromDate)`
    - `netPurchases = periodic purchases bucket from the ledger`
    - `closingInventory = valuation(toDate)`
    - `costOfSales = openingInventory + netPurchases - closingInventory`
    - `grossProfit = netSales - costOfSales`
  - Response now includes a `periodicComputation` breakdown for UI/export transparency.

- **Periodic Profit & Loss**
  - `GetProfitAndLossUseCase` now replaces the raw periodic purchases expense bucket with the computed periodic cost of sales.
  - Structured output includes `periodicTrading` so the frontend/export can show the formula.
  - The flat `expensesByAccount` view now removes purchase lines and injects a synthetic `Periodic Cost of Sales` row so totals still tie.

- **Inventory Valuation report**
  - Reused the existing valuation page/API instead of creating a duplicate report surface.
  - Added pricing-policy selection (`AVERAGE`, `LAST_PURCHASE`) and updated the table payload to show policy cost/value.
  - Trading Account and Profit & Loss frontend pages now surface the periodic formula breakdown in-page and in Excel export.

### Files changed

- Backend valuation/reporting:
  - `backend/src/application/inventory/services/InventoryValuationService.ts`
  - `backend/src/application/accounting/use-cases/LedgerUseCases.ts`
  - `backend/src/application/reporting/use-cases/GetTradingAccountUseCase.ts`
  - `backend/src/application/reporting/use-cases/GetProfitAndLossUseCase.ts`
  - `backend/src/api/controllers/inventory/InventoryController.ts`
  - `backend/src/api/controllers/accounting/AccountingReportsController.ts`
  - `backend/src/api/controllers/accounting/ReportingController.ts`
- Backend tests:
  - `backend/src/tests/application/inventory/services/InventoryValuationService.test.ts`
  - `backend/src/tests/application/reporting/use-cases/GetTradingAccountUseCase.test.ts`
  - `backend/src/tests/application/reporting/use-cases/GetProfitAndLossUseCase.test.ts`
  - `backend/src/tests/application/accounting/use-cases/GetBalanceSheetUseCase.test.ts`
- Frontend:
  - `frontend/src/api/inventoryApi.ts`
  - `frontend/src/modules/inventory/pages/InventoryValuationPage.tsx`
  - `frontend/src/modules/accounting/pages/TradingAccountPage.tsx`
  - `frontend/src/modules/accounting/pages/ProfitAndLossPage.tsx`

### Tests added / updated

- `InventoryValuationService.test.ts`
  - current valuation using `LAST_PURCHASE`
  - historical replay with GLOBAL average restatement propagation
- `GetTradingAccountUseCase.test.ts`
  - periodic trading formula
- `GetProfitAndLossUseCase.test.ts`
  - periodic replacement of ledger purchases with computed cost of sales
- `GetBalanceSheetUseCase.test.ts`
  - periodic inventory override from report-time valuation

### Verification

- Focused backend suites:
  - `backend/src/tests/application/inventory/services/InventoryValuationService.test.ts`
  - `backend/src/tests/application/reporting/use-cases/GetTradingAccountUseCase.test.ts`
  - `backend/src/tests/application/reporting/use-cases/GetProfitAndLossUseCase.test.ts`
  - `backend/src/tests/application/accounting/use-cases/GetBalanceSheetUseCase.test.ts`
  - Result: **4 suites / 8 tests passed**
- Backend compiled build:
  - `npm --prefix backend run build` ✅
- Frontend typecheck:
  - `npm --prefix frontend run typecheck` ✅
- Frontend production build:
  - `npm --prefix frontend run build` ✅
- Not completed in this slice:
  - fresh-tenant emulator/live-flow proof of the report outputs

### Post-implementation audit fixes (review pass)

A review of the first cut found a blocking correctness bug plus two consistency gaps, all fixed before merge:

1. **🔴 Balance Sheet did not balance (fixed).** The first cut overrode the inventory *asset* with report-time valuation but left retained earnings on the raw GL (purchases fully expensed), so the asset side rose while equity stayed flat — the BS was out of balance by `(closing valuation − GL inventory balance)` for any periodic company that had traded since opening. Fix: `GetBalanceSheetUseCase` now books that same delta into **Current Year Earnings** (the virtual-close equity counterpart), so the statement ties by construction and retained earnings equals periodic net profit. The original unit test had a rigged trial balance (pre-imbalanced by exactly the override) — replaced with a realistic, genuinely-balanced periodic GL, plus a regression test proving non-periodic companies are untouched.
2. **🟠 `ReportRunner` bypassed the periodic treatment (fixed).** It built the P&L and Balance Sheet use cases without the valuation service, so the AI-assistant report tools returned raw periodic numbers. Now wired with the valuation deps (via `bindRepositories.ts`), matching the dedicated controllers.
3. **🟡 Pricing-policy basis made explicit (documented + commented).** The statements (BS / Trading / P&L) are always valued at `AVERAGE` — the costing method of record — so they agree; only the standalone Inventory Valuation report exposes `LAST_PURCHASE`, for analysis. Now stated in code comments and `docs/architecture/accounting.md`.

### Architectural note

This phase intentionally does a **virtual close at report time**. It does **not**:

- post an automatic closing-inventory journal
- mutate historical ledger balances
- replace perpetual or invoice-driven report logic

That keeps the accounting behavior explicit: periodic companies get report-time carrying value and gross profit, but a future posted-closing workflow remains a separate decision.

## End-user view

ERP03 periodic companies can now open their reports and see meaningful stock value and gross profit without switching to perpetual accounting.

- The **Inventory Valuation** report now lets the user pick **Average** or **Last Purchase** policy.
- The **Balance Sheet** now shows a real inventory value in periodic mode.
- The **Trading Account** now calculates gross profit using opening inventory, net purchases, and closing inventory.
- The **Profit & Loss** now uses that same periodic cost-of-sales figure instead of showing raw purchases as if they were the final expense.

Users still work normally through Purchase Invoices, Sales Invoices, transfers, adjustments, and opening stock. ERP03 calculates the periodic carrying value when the report is opened; it does not silently post a closing entry.

## QA script

1. Create or open a fresh company using **Periodic** inventory accounting.
2. Post opening stock for at least one tracked item.
3. Post purchases, sales, and at least one return or adjustment.
4. Open `Inventory → Reports → Inventory Valuation`.
   Expected:
   - changing **Pricing Policy** between `Average` and `Last Purchase` changes the displayed value when the two cost points differ
   - totals equal the visible line values
5. Open `Accounting → Reports → Balance Sheet` for the same date.
   Expected:
   - inventory is non-zero and matches the periodic carrying value
   - the figure is coming from report-time valuation, not from live per-transaction inventory postings
6. Open `Accounting → Reports → Trading Account` for a period covering those transactions.
   Expected:
   - the page shows Opening Inventory, Net Purchases, Closing Inventory, and Cost of Sales
   - `Gross Profit = Net Sales − Cost of Sales`
7. Open `Accounting → Reports → Profit & Loss` for the same period.
   Expected:
   - periodic cost of sales is shown instead of the raw purchases bucket
   - totals tie to the Trading Account logic
8. Repeat the same reports on an `INVOICE_DRIVEN` or `PERPETUAL` tenant.
   Expected:
   - prior behavior is unchanged

## Remaining follow-up

- [240f — Phase 6](../tasks/240f-phase6-mode-lock-wizard-coa.md): lock mode/COA choice and make setup safer
- [240g — Phase 7](../tasks/240g-phase7-golden-path-periodic-qa.md): prove the periodic reporting stack end-to-end on a fresh tenant
