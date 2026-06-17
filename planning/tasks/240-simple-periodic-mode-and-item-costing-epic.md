# Epic 240 — Simple (Periodic) Inventory Mode + Multi-Method Item Costing + backlog-223 fix

**Status:** Planned (spec complete, not started). Authored 2026-06-18 as the execution plan for other agents.
**Author role:** Senior Financial Systems Manager + Senior SWE (planning + audit).
**Problem brief:** [planning/briefs/20260618-inventory-accounting-mode-periodic-vs-perpetual.md](../briefs/20260618-inventory-accounting-mode-periodic-vs-perpetual.md)
**Related:** [223 inventory revaluation](./223-inventory-revaluation-value-only-correction.md) · [221 inventory deep stabilization](./221-inventory-deep-stabilization-epic.md) · [241 party×item price memory](./241-party-item-price-memory.md) (extends Phase 3's price-capture hook) · audit `docs/audit/inventory-accounting-model-audit.md`

> **How to use this file:** Each phase in §8 is a self-contained task an agent can execute independently in dependency order. Read §1–§7 first (the canonical design), then execute your assigned phase. Do not change the meaning of the three modes without owner sign-off. Definition of Done (CLAUDE.md) applies to every phase: code + architecture doc + user-guide doc + `planning/done/NN-*.md` report + JOURNAL + ACTIVE.

---

## 0. Why this exists (business context)

The target pilot customer is a **small trading company**. The owner estimates **50–60% of target users run a "simple" mental model**: they don't understand a chart of accounts or perpetual costing — *they just need the reports to read correctly* (Balance Sheet, P&L/Trading, stock value). The popular SME accounting app they currently use is a **periodic inventory** system that values stock **at report time** using a selectable pricing policy (Average / Cost), not a continuous inventory ledger.

Our system today only implements **perpetual** accounting under both of its "modes" (see brief). We must add a genuine **periodic** mode, store **richer per-item costing data** that the report-time valuation needs, and fix the one perpetual reconciliation defect (backlog-223) that blocks GP05.

---

## 1. The three modes — canonical definitions (LOCK THIS)

| # | Mode (internal id) | Accounting method | Document flow | Inventory value on Balance Sheet | Target user |
|---|---|---|---|---|---|
| 1 | **Periodic / Simple** (`PERIODIC`) | **Periodic** — purchases → *Purchases* account, sales → *Sales* account. **No inventory-asset or COGS GL posting per transaction.** | One document (invoice-centric) | **Computed at report time** (on-hand qty × pricing policy) + period-end Trading close | Small trader who "just reads reports" (majority) |
| 2 | **Invoice-driven** (`INVOICE_DRIVEN`) | **Perpetual** | One document — the invoice does receipt + AP/AR + COGS | **Live** on the GL | Wants accurate live books, light workflow |
| 3 | **Perpetual / Accurate** (`PERPETUAL`) | **Perpetual** | Two-step (Goods Receipt → Invoice; Delivery → Invoice) with GRNI | **Live** on the GL | Wants full control, GRNI, real-time COGS |

Two independent axes:
- **Modes 2 vs 3** differ only in **workflow** (one document vs two). Both are perpetual.
- **Mode 1 vs 2/3** differ in **accounting method** (periodic vs perpetual).

**Current code reality:** modes 2 and 3 already exist and work (`InventoryAccountingMode = 'INVOICE_DRIVEN' | 'PERPETUAL'`). The legacy enum value `PERIODIC` is currently *remapped to `INVOICE_DRIVEN`* and was never implemented as true periodic. **This epic makes `PERIODIC` a real, distinct third mode** — it does not redefine or remove modes 2 and 3.

---

## 2. Document behavior in PERIODIC mode (the DN / SO / GRN / PO question)

Decision (owner-confirmed direction): **keep all operational documents available; they move quantity but post no accounting in periodic mode; default the simplest ones hidden to keep the UI lean.**

| Document | Moves stock **quantity** in PERIODIC? | Posts **GL** in PERIODIC? | Default visibility (Simple template) |
|---|---|---|---|
| Sales Order / Purchase Order | No | No (pure workflow/intent) | Hidden (toggle to show) |
| Delivery Note / Goods Receipt | **Yes** (logistics + keeps on-hand accurate for report-time valuation) | **No** | Hidden (toggle to show) |
| Sales Invoice / Purchase Invoice | Yes **only if** a DN/GRN didn't already move it | **Yes** — the sole accounting event (Sales / Purchases accounts) | Visible |
| Sales/Purchase Return | Yes | Yes → Sales-returns / Purchases-returns (contra) | Visible |
| Stock Adjustment | Yes | **No GL in periodic** (quantity only; value flows through report-time valuation) | Visible |
| Opening Stock | Yes | Dr Goods/Opening-Inventory / Cr Opening-Balance-Equity (one-time) | Visible |

**Critical rule — no double counting of quantity:** reuse the existing mechanism where the invoice checks "did a DN/GRN already post this line?" (today: SI posts COGS *only if no DN posted*; `goodsAlreadyReceived(line, po)` in `PurchaseInvoiceUseCases.ts`). In periodic, the same gate decides whether the **invoice** moves quantity. The DN/GRN owns quantity when present; otherwise the invoice does.

**Why DN/GRN must still move quantity (not be pure paper):** periodic values inventory from *on-hand quantity* at report time. If goods ship on a DN but the invoice lags, on-hand (and thus Balance-Sheet inventory) would be wrong until invoiced. So DN/GRN move quantity; they just never touch the GL.

---

## 3. Item costing data model (multi-method, extensible, FX-accurate)

### 3.1 Requirement
Store, **per item**, a set of continuously-updated cost/price statistics so reports can value stock by a **selectable policy** (like the popular app's "Goods Pricing Policy: Average / Cost"):
- **Average cost** (moving average)
- **Last known purchase cost**
- **Last known sale price**
- **Extensible** for future methods (e.g. standard cost, FIFO layer cost, highest/lowest) **without schema migration**.
- **FX-accurate**: every stored point keeps base-currency value **and** original transaction currency + rate + date.

### 3.2 Where data lives (do NOT remove existing per-warehouse cost)
- **Keep** per-warehouse `StockLevel.avgCost*`/`lastCost*` — the engine needs them to cost issues. Unchanged.
- **Add** an item-level rollup block used for display/reporting/policy valuation. Recommended shape (store as a sub-object on the Item document, or a sibling `item_costing/{itemId}` doc if write-contention is a concern):

```ts
// New value object — keep additive & forward-compatible.
interface CostPoint {
  base: number;            // value in company base currency
  ccy: number;             // value in the item/transaction cost currency
  currency: string;        // ISO code of `ccy`
  fxRateToBase: number;    // ccy -> base at capture time
  asOf: string;            // YYYY-MM-DD of the source transaction
  source?: { movementId?: string; refType?: string; refId?: string };
}

interface ItemCostingStats {
  avgCost: CostPoint;          // moving-average rollup (per costingBasis: GLOBAL=company-wide; WAREHOUSE=qty-weighted across warehouses)
  lastPurchaseCost?: CostPoint;// updated on every PURCHASE_RECEIPT IN
  lastSalePrice?: CostPoint;   // updated on every sale (unit SELLING price, not COGS)
  // Forward-compatible bag for future named methods — add keys without migration:
  extra?: Record<string, CostPoint>;   // e.g. { standardCost, fifoCost, highestCost, lowestCost }
}
```

- Generalize `ItemCostingMethod` from the single literal `'MOVING_AVG'` to an **open string union** (`'MOVING_AVG' | 'STANDARD' | 'FIFO' | string`) so new methods don't break validation. Keep `'MOVING_AVG'` the only *enforced/working* engine for now; others are reserved.
- Add a report-time **`InventoryPricingPolicy`** enum: `AVERAGE | LAST_PURCHASE | STANDARD | …` (extensible). This drives valuation reads, **not** the posting engine.

### 3.3 Update rules (when each point changes)
| Event | avgCost | lastPurchaseCost | lastSalePrice |
|---|---|---|---|
| Purchase receipt (IN, costSource=PURCHASE) | recompute moving-avg rollup | **set** from movement unit cost (base+ccy+fx+date) | — |
| Sale (SI/DN OUT) | unchanged (issue at avg) | — | **set** from the **document line selling price** (base+ccy+fx+date) — sourced from the sales line, NOT the stock movement (movements carry COGS cost, not revenue) |
| Adjustment/Transfer/Return | recompute avg per existing engine rules | optional (RETURN_IN may refresh lastPurchase if desired — default: leave unchanged) | — |

**FX accuracy:** `StockMovement` already carries `movementCurrency`, `fxRateMovToBase`, `unitCostBase/CCY` → use these directly for purchase points. For sale price, source `unitPriceDoc`, document `currency`, and `exchangeRate` from the sales invoice/delivery line → compute `base` via the doc rate. Always store both sides + the rate so a later FX revaluation can recompute.

---

## 4. Costing engine wiring (where to hook)

- IN cost + avg/last update today: `RecordStockMovementUseCase.ts:152–165` (per-warehouse) and the GLOBAL fan-out (`:786`, `:841`, `:928`). **Add an item-rollup update** alongside these (compute company-wide or qty-weighted avg per `costingBasis`, write `ItemCostingStats.avgCost` + `lastPurchaseCost`).
- Sale price capture: add a hook in the sales posting path (Sales Invoice + Delivery Note use-cases) to write `ItemCostingStats.lastSalePrice` from the line selling price. This is **mode-agnostic** (runs in all 3 modes).
- All updates must be **transactional** with the movement/posting write (same Firestore transaction / SQL tx) and idempotent on re-post.

---

## 5. Report-time valuation & Trading account (periodic reporting)

- New **InventoryValuationService**: given `(companyId, asOfDate, pricingPolicy, warehouse?)`, value on-hand qty using the chosen `ItemCostingStats` point. Returns per-item and total. Reused by:
  - **Balance Sheet** (periodic mode): the Inventory line = valuation at policy (default AVERAGE). In perpetual modes the BS keeps reading the live GL inventory account — **do not change perpetual reporting.**
  - **Trading account / Gross profit** (periodic): `Sales − (Opening Inventory + Net Purchases − Closing Inventory)`, Closing Inventory = valuation at period end.
  - **Inventory Valuation report** (new): the screenshot feature — pick pricing policy, get current stock value.
- Reports must honour `<ReportContainer>` + `moduleMenuMap.ts` Reports parent (enforced by `check-reports.mjs`).

---

## 6. backlog-223 fix (discount cost basis) — perpetual/invoice-driven only

Independent, ships first (unblocks GP05). In `PurchaseInvoiceUseCases.ts` the GL debit uses the **net** line total (`line.lineTotalBase`, ~:1016–1020) while the stock movement cost uses the **gross** unit price (`unitCostBase: line.unitPriceBase`, :705; `:1019`). Fix: in tracked-item perpetual/invoice-driven posting, derive the stock movement unit cost from the **net** discounted line total so stock avg cost == GL inventory debit:
- `unitCostBase = line.lineTotalBase / qtyInBaseUom`; `totalCostBase = line.lineTotalBase`; mirror `…CCY` from `lineTotalDoc`; use net in the `avgCostBaseAfter` blend.
- Verify GRN→PI (perpetual) path doesn't reintroduce the gap.
- **Note:** in PERIODIC mode this defect is moot (no inventory asset posting), but the fix is still required for modes 2 & 3.

---

## 7. Mode selection, COA linkage, and lock policy (owner-CONFIRMED 2026-06-18)

### 7.1 When we ask
Mode is chosen **at company creation, as an early step BEFORE the COA is selected** (it lives in the existing **Company Setup** wizard step added by done/232 — `CompleteCompanyCreationUseCase` does not seed COA; `InitializeAccountingUseCase` does, taking a `coaTemplate`). Present **three plain-language choices** (no jargon):
1. "Simple — I just track sales, purchases, and stock value" → `PERIODIC`
2. "Standard — keep inventory value live, one invoice per transaction" → `INVOICE_DRIVEN`
3. "Advanced — separate receiving/delivery, full control" → `PERPETUAL`

**One answer drives BOTH the COA seeding AND the inventory `accountingMode`** so they can never disagree.

### 7.2 How the mode changes the COA
The mode selects a different COA template / required accounts:
| | PERIODIC | INVOICE_DRIVEN & PERPETUAL |
|---|---|---|
| Buying | **Purchases / Purchases-returns / Purchases-discounts** (P&L trading accts) | **Inventory Asset** (BS) |
| Cost of sales | none per-txn — via **Trading account** at period end | **COGS** (real-time) |
| Receiving clearing | — | **GRNI** (PERPETUAL/two-step only) |
| Stock on BS | **Goods / Opening & Closing Inventory** + Trading | live Inventory Asset account |
| Selling | **Sales / Sales-returns / Sales-discounts** | Sales Revenue |
| Shared | AR, AP, Cash/Bank, Equity, Expenses | (same) |

A PERIODIC company never gets an Inventory-Asset/COGS/GRNI structure; a perpetual company never gets Purchases/Trading accounts. Implement as mode-filtered COA templates (or a shared template annotated with `requiredForMode`).

### 7.3 Lock policy (CONFIRMED)
- **Before the first posted transaction:** mode is freely changeable; changing it **re-seeds the COA template** + resets module settings (no history to corrupt).
- **After the first posted transaction:** **locked** (periodic ↔ perpetual changes COA shape + the meaning of all history) — readable blocked message; migration tooling out of scope.
- Enforce at: company wizard (selection step), module initialization, and `InventoryController.updateSettings` (today immutable post-init — extend to **post-first-transaction** semantics).

---

## 8. Phased execution plan (one task per phase)

> **Each phase below has a standalone, hand-off-ready file** (a cold agent can execute it without reading this whole epic):
> - [240a — Phase 1: canonical spec + docs](./240a-phase1-canonical-spec-and-docs.md)
> - [240b — Phase 2: discount cost-basis fix (backlog-223)](./240b-phase2-discount-cost-basis-fix.md)
> - [240c — Phase 3: item costing stats](./240c-phase3-item-costing-stats.md)
> - [240d — Phase 4: periodic posting mode](./240d-phase4-periodic-posting-mode.md)
> - [240e — Phase 5: report-time valuation + Trading](./240e-phase5-report-time-valuation-and-trading.md)
> - [240f — Phase 6: mode lock + wizard/COA](./240f-phase6-mode-lock-wizard-coa.md)
> - [240g — Phase 7: golden-path periodic QA](./240g-phase7-golden-path-periodic-qa.md)
> - [241 — Party×item price memory](./241-party-item-price-memory.md) (run after Phase 3)
>
> **Dependency / sequencing:**
> - Phase 1 (docs) first — or alongside.
> - **Phase 2 and Phase 3 are independent → run in parallel.**
> - Phase 4 needs Phase 1 (best after Phase 2). Phase 5 needs Phases 3 + 4. Phase 6 needs Phase 4. Phase 7 is the final gate (needs 4,5,6).
> - Task 241 needs Phase 3.

### Phase 1 — Canonical spec + docs (no production code)
- Update `docs/architecture/inventory.md` with §1–§5 (three modes, document behavior, costing data model, valuation). Correct the conflation in `docs/audit/inventory-accounting-model-audit.md` (add a 2026 addendum: SIMPLE≠periodic historically; PERIODIC now real).
- Acceptance: docs reviewed; no behavior change.

### Phase 2 — backlog-223 discount cost-basis fix (modes 2 & 3)
- Implement §6. Tests: new regression (PI with line discount → stock avg == GL inventory debit); rerun purchases + inventory Jest slices; rebuild `lib/`.
- Acceptance: GP05 step-4 reconciliation drift → 0 on a perpetual tenant; all voucher balances unchanged.

### Phase 3 — Item costing stats data model + engine wiring (mode-agnostic)
- Add `ItemCostingStats`/`CostPoint` (§3); generalize `ItemCostingMethod`; add `InventoryPricingPolicy`. Wire updates (§4) into IN movements (incl. GLOBAL fan-out) and the sales posting path. Update Firestore **and** SQL repositories (parity). Backfill is unnecessary (no production data — see memory `project_no_production_data`).
- Tests: purchase updates avg + lastPurchase (incl. foreign-currency item); sale updates lastSale; FX values stored both-sided; idempotent re-post.
- Acceptance: Item card shows live avg cost, last purchase, last sale; values correct in a non-base cost currency.

### Phase 4 — PERIODIC posting mode (core)
- Make `PERIODIC` a real `InventoryAccountingMode`. `DocumentPolicyResolver`: periodic → no inventory/COGS lines; PI → Dr Purchases/Cr AP; SI → Dr AR/Cr Sales; returns → contra accounts; adjustments → quantity only; opening stock → Goods/Opening-Equity. Quantity engine unchanged; invoice/DN double-count gate (§2) applied to quantity.
- New **periodic COA template** (Purchases, Purchases-returns, Purchases-discounts, Sales, Sales-returns, Sales-discounts, Goods/Opening & Closing inventory, Trading). Make the **Simple Trading Company** starter select PERIODIC + this COA + DN/SO hidden by default.
- Tests: full periodic posting per document type; no inventory/COGS GL lines produced; quantity correct with and without DN/GRN.

### Phase 5 — Report-time valuation + Trading account + Valuation report
- Implement §5: `InventoryValuationService`, periodic Balance-Sheet inventory line, Trading/gross-profit computation, P&L integration, new Inventory Valuation report (policy selectable). Perpetual reporting untouched.
- Tests: BS inventory = qty×avg at report time; Trading GP = Sales−(Open+NetPurch−Close); policy switch (Average vs Last-Purchase) changes the figure correctly.

### Phase 6 — Mode lock + wizard/init enforcement
- Implement §7. Wizard mode-selection step (3 options, plain-language); COA filtered/seeded per mode; lock after first posted transaction.
- Tests: switch allowed pre-transaction (re-seeds COA); blocked post-transaction with readable error.

### Phase 7 — Golden-path re-run on a periodic tenant + QA scripts
- Create a fresh PERIODIC "Simple Trading Co" tenant; run GP01–GP05. GP05 step-4 should reconcile by construction. Save QA scripts into each phase's `planning/done/NN-*.md` (memory `feedback_qa_in_task_files`).

---

## 9. Acceptance for the epic (definition of "done")
- Three modes selectable at company creation; PERIODIC produces simple books (no inventory/COGS lines) and a **correct, always-available** Balance Sheet via report-time valuation.
- Per-item avg cost / last purchase / last sale stored, live, FX-accurate, and surfaced in reports + item card; schema is extensible for future methods.
- GP05 step-4 reconciles in perpetual modes (backlog-223 closed) and is non-applicable in periodic.
- Mode locked after first transaction.
- All Definition-of-Done docs updated per phase.

## 10. Risks / out-of-scope / notes
- **Feature freeze:** lifted for this epic — **owner-authorized 2026-06-18.** This is foundational (the pilot's primary customer needs PERIODIC), and the mode-switching policy (§7.3) is confirmed.
- **Out of scope:** FIFO/standard-cost *engines* (only reserve the schema), bulk/CSV revaluation, FX revaluation of historical cost layers, periodic→perpetual *migration* tooling.
- **Backend build:** changes only take effect after `npm run build` (tsc→`lib/`); verify via real round-trip (memory `backend_emulator_serves_compiled_lib`).
- **No production data:** no migrations/backfills needed (memory `project_no_production_data`).
- **Reports contract:** every new report uses `<ReportContainer>` + `moduleMenuMap.ts` (memory `feedback_reports_pattern`).
