# Task 221 — Inventory Deep Stabilization Epic

**Opened:** 2026-06-13
**Driver:** Owner directive after GP02 findings — "inventory was implemented, never tested." Deep-scan
analysis surfaced real financial-integrity defects plus UI inconsistency vs Sales/Purchases.
**Goal:** Make the Inventory module GP02-passable and pilot-safe: fix the money path, give it the same
UI language as Sales/Purchases (scaffold + shared line table), add the costing-policy + transfer modes the
owner asked for.

## Owner decisions (ratified 2026-06-13)
1. **Stock Transfer** has two modes: **flat** (move A→B, dest inherits source cost, no GL) and **valued**
   (ledger-affecting; user may override/uplift cost). A cost uplift is **capitalized into destination
   inventory with the credit going to a configurable Inventory Transfer/Handling Clearing account.**
2. **Stock Adjustments** offset to **dedicated Inventory Gain/Loss accounts** (write-up → gain, write-down →
   loss), with graceful fallback to the item COGS account when not configured.
3. **Costing basis** is a **live selectable mode** in Inventory Settings: `WAREHOUSE` (per item×warehouse WAC,
   current) and `GLOBAL` (one company-wide WAC per item). Build **both** engines with full tests.
   Sequencing: ship WAREHOUSE first (already built), land GLOBAL as an additive, fully-tested mode.

## Deep-scan defect register
- **F1** Adjustment GL valued from user-typed cost, not the engine's real cost → silent GL↔subledger drift. ✅ fixed (Slice 1)
- **F2** Zero-cost adjustments silently skipped the voucher (stock moved, no GL). ✅ fixed (Slice 1)
- **F3** Adjustment account resolution ignored Inventory Settings defaults (item-only). ✅ fixed (Slice 1)
- **F4** No GL↔inventory reconciliation control. ⬜ Slice 6
- **F5** `allowNegativeStock` defaults `true` (unsafe for perpetual pilot). ⬜ Slice 6
- **F6** Adjustments offset to COGS, not a dedicated gain/loss account. ✅ fixed (Slice 1)
- Missing: item sale/purchase price fields. ⬜ Slice 4
- Missing: item-level stock rollup (per-warehouse rows only). ⬜ Slice 4
- UI: Adjustment/Transfer/Opening pages are bare forms, not on the shared scaffold + line table. ⬜ Slice 5
- Dead wiring: stock reservation use-cases + endpoints exist but nothing calls them. ⬜ Slice 6 (wire or hide)
- Stale `docs/architecture/inventory.md` (claims GL posting absent; 5 paths exist). ⬜ Slice 6

## Slices
1. **Adjustment money path + gain/loss accounts** — ✅ DONE 2026-06-13
2. **Costing-basis (WAREHOUSE + GLOBAL)** — ✅ DONE 2026-06-13: `costingBasis` setting end-to-end + UI, **and the
   GLOBAL moving-average engine is now built and tested** (WAREHOUSE byte-for-byte unchanged). See "Costing engine
   decision" below.
3. **Stock Transfer two-mode** (flat vs valued→clearing) — ✅ DONE 2026-06-13
4. **Item price fields + item-level stock rollup** — ✅ DONE 2026-06-13
5. **UI rebuild** — Stock Adjustment + Stock Transfer + Stock Levels rebuilt on shared `ClassicLineItemsTable`;
   Opening Stock left as-is (already mature multi-line). — ✅ DONE 2026-06-13
6. **Guardrails** — 🟡 docs refreshed; both costing engines live; **GL↔stock reconciliation report DONE**;
   negative-stock default intentionally NOT flipped (retest safety); stock-reservation wire-or-hide — ⬜ remaining

## GL↔stock reconciliation report (DONE 2026-06-13, Slice 6 / F4)
- `ReconcileInventoryGLUseCase` (read-only): groups stock value (Σ qty × avg cost) by each item's resolved
  Inventory Asset account (item → settings default) and compares to the GL closing balance of those accounts;
  flags per-account drift + unmapped stock value. This is the period-end control that catches the F1/F2 drift
  class the money-path fixes were about.
- **Accounting boundary respected:** the use-case depends on an inventory-side `IGLAccountBalanceProvider`
  port, NOT `ILedgerRepository` (the `AccountingBoundary` arch test forbids direct ledger deps in
  inventory/sales/purchases use-cases). The ledger-backed provider is wired in the controller (composition root).
- Endpoint `GET /inventory/reports/gl-reconciliation`; report page `InventoryGLReconciliationPage` on
  `ReportContainer`, routed + wired into `moduleMenuMap` Inventory→Reports (passes `check-reports.mjs`: 22 routes).
- Tests: `ReconcileInventoryGLUseCase.test.ts` (matched vs drift with settings-default fallback; unmapped value).
- Verification: backend `tsc` + full `jest` **148 suites / 1371 tests** (incl. `AccountingBoundary` green);
  backend `lib/` rebuilt; frontend `tsc` + production build green.

## Costing engine decision (2026-06-13) — BOTH ENGINES NOW LIVE
Owner chose "build both costing modes as a live engine." The previous slice shipped the `costingBasis` setting
but **deliberately deferred the GLOBAL engine** (it edits the core `RecordStockMovementUseCase` hot path and
couldn't be validated unattended). With the owner awake, the GLOBAL engine is **now built and tested**.

**How GLOBAL works:** one company-wide moving average per item; quantity still per warehouse. The engine
resolves `costingBasis` per movement (default/`null`/error → WAREHOUSE) and branches at the top of each
`process*` method into `processINGlobal` / `processOUTGlobal` / `processTRANSFERGlobal`. The existing WAREHOUSE
bodies are **byte-for-byte unchanged**.

- **Invariant:** after any movement, every warehouse level for the item carries the same company-wide average,
  so all downstream readers (valuation, COGS, GL-reconciliation, stock-levels) are unchanged.
- **IN** re-blends the company average from all of the item's levels (read in-txn via new
  `IStockLevelRepository.getLevelsByItemInTransaction`) and writes it to every level; qty to the receiving
  warehouse. A receipt into one warehouse re-prices the item everywhere.
- **OUT** issues COGS at the company average (`Σ value ÷ Σ qty`); a moving average is unchanged by an issue, so
  only the shipping warehouse's qty is written. The defining property: a warehouse sells at the company cost,
  not the price it personally received. Availability is still checked per-warehouse.
- **TRANSFER**: FLAT leaves the average flat; VALUED capitalizes the uplift into the company average and keeps
  `inMov.totalCostBase − outMov.totalCostBase == uplift`, so the existing clearing-voucher logic is untouched.
- `processOUT` reads settings once up front (drives basis **and** the negative guard — single read).

**Tests:** `GlobalCostingEngine.test.ts` — 7 cases (re-blend across warehouses; cross-warehouse COGS at the
company average; average flat on issue; FLAT transfer; VALUED uplift into the average; third-warehouse
restatement; WAREHOUSE sanity that per-warehouse averages stay independent). Full backend suite **150 suites /
1380 tests** green incl. `AccountingBoundary`. WAREHOUSE remains the default; switching basis after movements
exist is a one-time setup choice (the first GLOBAL movement re-blends any divergent per-warehouse averages).
**Still owner-gated:** an emulator pass on GLOBAL before commit.

## Slices 3 + 5 + costing setting (DONE 2026-06-13)

### Stock Transfer two-mode (Slice 3)
- `StockTransfer` gains `mode: 'FLAT' | 'VALUED'` + `voucherId`. `processTRANSFER` accepts
  `destUnitCostOverrideBase/CCY` — source OUT issues at source cost, destination IN lands at the override.
- `CompleteStockTransferUseCase` posts the VALUED uplift: per inventory account, `Dr inventory / Cr Inventory
  Transfer Clearing` for `qty × (landed − source)`; negative uplift flips sides; zero uplift → no GL. Guards:
  missing inventory account or clearing account → readable error. FLAT unchanged (no GL).
- Threaded through DTO, validator (`mode` + per-line cost override), controller, frontend API.
- Engine test added (`RecordStockMovementUseCase` "Valued transfer…": dest lands at override, source at source
  cost, uplift = (400−320)×5 = 400).

### UI rebuild (Slice 5)
- **Stock Adjustment** rebuilt on `ClassicLineItemsTable`: multi-line, item pickers, **auto-prefilled current
  qty + avg cost** (kills the zero-cost footgun), computed Adj Qty/Value, document footer, status badges.
- **Stock Transfer** rebuilt on `ClassicLineItemsTable`: Flat/Valued mode toggle; valued mode shows Source
  Cost + editable Landed Unit Cost + Uplift columns; list shows Mode badge + GL indicator.
- **Stock Levels** rebuilt: default **By-Item** rollup (total qty, blended avg cost, expandable per-warehouse) +
  By-Warehouse toggle + warehouse dropdown. (Slice 4b, GP02-step6.)
- **Opening Stock** intentionally left as-is — already a mature multi-line page; rebuild would add regression
  risk for no gain.

### Costing-basis setting
- `InventorySettings.costingBasis` (`WAREHOUSE` default) through entity/DTO/validator/controller/init +
  Inventory Settings → Accounting selector. Both engines are live (note updated; "being finalized" removed).
- `ConfigureInventoryFinancialIntegrationUseCase` now preserves `costingBasis`, `allowDeferredCost`, and the
  new gain/loss/clearing accounts (previously wiped on wizard re-run).

### Verification (whole session)
- backend `tsc` + full `jest` **147 suites / 1369 tests pass** (`--maxWorkers=2`); backend `npm run build`
  (lib/) clean so the emulator serves the new code. frontend `tsc` + production build clean.

### Manual QA (owner)
- Stock Adjustment: pick item → current qty + avg cost auto-fill; post a write-down → GL Dr Loss / Cr Inventory
  at avg cost; multi-line works.
- Stock Transfer FLAT: A→B moves stock, no voucher. VALUED: set a higher landed cost → completing posts a
  clearing voucher (GL ✓ in the list) and the destination avg cost rises by the uplift.
- Stock Levels: By-Item rollup + expand; item Default Sale/Purchase price persists.
- Inventory Settings → Accounting: Loss/Gain/Transfer-Clearing accounts + Costing Basis persist.

### Manual QA (owner) — GLOBAL costing engine (emulator pass before commit)
Run on a fresh template-seeded tenant. **Set Inventory Settings → Accounting → Costing Basis = Global first.**
1. **Re-blend across warehouses:** receive 10 of an item @ 5 into Warehouse A, then 10 @ 7 into Warehouse B.
   Open Stock Levels (By-Warehouse): **both A and B should show avg cost 6** (the company-wide average), not 5
   and 7. This is the headline difference from Per-Warehouse.
2. **COGS at the company average (the key test):** sell 3 from **Warehouse B** (which received at 7). The
   posted COGS / inventory credit should be **3 × 6 = 18**, not 3 × 7. Check the GL voucher and the
   Inventory GL Reconciliation report (should tie out).
3. **Receipt re-prices everywhere:** receive more dear stock into A and confirm B's carried avg cost moves too.
4. **FLAT transfer:** move stock A→B with mode Flat — quantities move, avg cost unchanged, no voucher.
   **VALUED transfer:** move A→B with a higher landed cost — the company avg cost rises by the uplift and a
   clearing voucher posts.
5. **Sanity:** switch a different tenant to Per-Warehouse and confirm A=5 / B=7 stay independent (proves the
   default path is untouched).

---

## Slice 4 — Item price fields + item-level stock rollup (DONE 2026-06-13)

### Changes
- **Item prices** (`salePrice`, `purchasePrice`, non-negative, base currency) added end-to-end:
  `domain/inventory/entities/Item.ts` (props/fields/ctor-validation/toJSON/fromJSON),
  `application/inventory/use-cases/ItemUseCases.ts` (`CreateItemInput` + `new Item`; update spreads through),
  `api/dtos/InventoryDTOs.ts` (ItemDTO + mapper), `api/validators/inventory.validators.ts`
  (`ensureOptionalNonNegativeNumber` on create+update), `frontend/src/api/inventoryApi.ts` (DTO),
  `frontend/src/modules/inventory/components/ItemMasterCard.tsx` (new "Default Prices" section on the Pricing tab).
- **Persistence:** Firestore (pilot runtime, `DB_TYPE=FIRESTORE` default) persists automatically via
  `ItemMapper.toPersistence` → `entity.toJSON()`. Prisma/SQL path updated for parity:
  `prisma/schema.prisma` (`salePrice`/`purchasePrice Float?`), `PrismaItemRepository` create+toDomain mappings,
  `prisma generate` run. **SQL note:** a `prisma migrate` is required before the SQL backend is used; the
  Firestore pilot needs none.
- **Item-level stock rollup:** `frontend/src/modules/inventory/pages/StockLevelsPage.tsx` rewritten with a
  default **By Item** grouped view (one row per item: total qty, blended avg cost = Σvalue/Σqty, total value;
  expandable to per-warehouse detail) plus a **By Warehouse** flat toggle and a warehouse **dropdown** (was a
  raw ID text box). Fixes GP02-step6 "duplicates item for each warehouse." Per-warehouse WAC remains the
  source of truth; the blend is display-only.

### Verification
- backend `tsc` + full `jest` (147 suites / 1368 tests pass at `--maxWorkers=2`; default parallelism OOMs the
  Jest worker — environment, not a regression). frontend `tsc` clean.

### Manual QA (owner)
1. Item card → Pricing tab: set Default Sale/Purchase Price, save, reopen — persists (GP02-step2).
2. Stock Levels: default By-Item view shows one row per item with a blended cost; expand to see warehouses;
   switch to By-Warehouse; filter by the warehouse dropdown.

---

## Slice 1 — Adjustment money path + gain/loss accounts (DONE 2026-06-13)

### Changes
- `domain/inventory/entities/InventorySettings.ts` — added `defaultInventoryGainAccountId`,
  `defaultInventoryLossAccountId`, `defaultInventoryTransferClearingAccountId` (props, fields, ctor, toJSON, fromJSON).
- `application/inventory/use-cases/StockAdjustmentUseCases.ts`:
  - **F1:** `PostStockAdjustmentUseCase` now captures the `StockMovement` returned by each `processIN`/`processOUT`
    and values the GL voucher from `movement.totalCostBase` (the engine's real cost — avg cost for OUT, applied
    cost for IN) instead of `Math.abs(adjustmentQty) * line.unitCostBase`.
  - **F3/F6:** offset account resolves dedicated gain/loss → item COGS → settings COGS; asset resolves
    item → settings. Readable blocking error when nothing resolves.
  - Persists the **real** `adjustmentValueBase` from posted movements.
  - New optional `inventorySettingsRepo` ctor dep (keeps existing call sites/tests compiling).
- `api/controllers/inventory/InventoryController.ts` — `postAdjustment` passes `inventorySettingsRepository`;
  `updateSettings` threads the 3 new account fields (preserve-on-undefined).
- `api/dtos/InventoryDTOs.ts`, `api/validators/inventory.validators.ts`,
  `application/inventory/use-cases/InitializeInventoryUseCase.ts` — thread + validate the 3 new fields.
- `frontend/src/api/inventoryApi.ts` — `InventorySettingsDTO` gains the 3 fields.
- `frontend/src/modules/inventory/pages/InventorySettingsPage.tsx` — Loss/Gain/Transfer-Clearing account
  selectors in the Accounting tab; included in the save payload. (Answers GP02-step8 "no place to set accounts".)

### Accounting boundary
Stock movement math unchanged. Only the GL voucher's **valuation source** (now the real movement) and
**offset account selection** (now gain/loss) changed, plus 3 new settings fields. Voucher still balances.

### Verification
- `tsc --noEmit` backend + frontend clean.
- `jest inventory` — 7 suites / 39 tests pass, incl. new `StockAdjustmentGLValuation.test.ts` (3 tests:
  OUT valued from avg not typed cost → Dr Loss; IN → Cr Gain; graceful COGS fallback).

### Manual QA (owner)
1. Inventory → Settings → Accounting: set Inventory Loss + Gain accounts, save, reload — persists.
2. Post a negative adjustment (write-down) on an item with stock at a known avg cost; confirm the GL voucher
   debits the Loss account for **avg cost × qty** (not whatever you typed), credits Inventory Asset.
3. Post a positive adjustment (found); confirm Dr Inventory Asset / Cr Gain.
4. With gain/loss unset, confirm it still posts to COGS (fallback) rather than blocking.
