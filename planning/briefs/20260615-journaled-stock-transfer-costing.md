# Decision Brief — Journaled Stock Transfer Costing

**Date:** 2026-06-15
**Status:** APPROVED costing decision (owner-confirmed). Implementation NOT started — this brief is the single source of truth for the implementing agent.
**Scope:** Stock transfer costing + GL posting only. Sales/Purchase/Adjustment posting unchanged.

---

## 1. Problem this brief closes

A VALUED stock transfer computed a GL "uplift" as `IN value − OUT value` and capitalized it into the inventory control account. When the source warehouse had no cost basis (qtyOnHand 0 / cost 0) but the destination landed at an entered value (e.g. 150), the transfer **fabricated inventory value out of nothing**:

```
OUT leg @ 0   (source empty)        Dr Inventory (Finished Goods)  150
IN  leg @ 150 (entered value)       Cr Inventory Transfer Clearing 150
```

Consequences observed in live QA:
- Inventory GL control inflated by 150 vs the stock subledger → **subledger ↔ GL reconciliation broken**.
- Transfer Clearing left with a **permanent dangling credit** no real bill will clear.
- Source warehouse driven negative (0 → −1) — negative-stock guard did not stop it.
- Trial Balance still balanced (Dr 150 / Cr 150), so the error was invisible at TB level.

Root cause: one document (`VALUED` transfer) tried to be three economically different transactions at once.

---

## 2. Two invariants every transfer must obey

**Invariant 1 — Moving-average integrity.**
Issues (outbound) leave at the **current average cost** and **never change it**. The average changes only on **receipts**. A transfer-out is an issue: it reduces the source quantity and value at the source's current average and leaves the source average unchanged.

**Invariant 2 — Subledger ↔ GL reconciliation.**
For every transaction and every inventory control account:
`Σ(subledger value change) == Σ(GL postings to that control account)`.
Any value that is **not** a genuine inventory-value change (freight awaiting a bill, a deliberate revaluation) must hit a **non-inventory** account (Transfer Clearing, Inventory Revaluation/Variance, P&L) so the inventory-control side still equals the subledger side.

> Note: Invariant 2 can pass at the company **total** while Invariant 1 is violated **per warehouse**. That is the trap. Both must hold.

---

## 3. The four transactions — keep them strictly separate

This separation is the core requirement. Do **not** let one code path infer which transaction it is from "the source cost happened to be 0/different."

### 3.1 Plain / Journaled transfer  (DEFAULT)
Move goods between the company's own warehouses. "Plain" vs "Journaled" is **only** whether a GL voucher is written — the economics are identical.

- OUT value = IN value = `qty × source carrying cost (current average)`.
- Source average **unchanged** (issue at average). Destination average recomputed via moving-average on the incoming value.
- GL: if one shared inventory account → `Dr Inv / Cr Inv` same account, **nets to zero** (may skip the voucher; still record the movement). If per-warehouse inventory accounts → `Dr Inv-Dest / Cr Inv-Source` at source cost.
- Company total inventory value: **unchanged**.
- **No uplift. No clearing. No variance.**

### 3.2 Added-cost transfer  (freight / customs / handling)
Move goods **and capitalize a real cost actually incurred** to move them.

- OUT value = `qty × source cost`.
- IN value = `qty × source cost + addedCost`.
- GL: `Cr Inv-Source (qty×cost)`, `Dr Inv-Dest (qty×cost + addedCost)`, `Cr Transfer Clearing (addedCost)`.
- Transfer Clearing is **cleared later** by the real freight/customs bill (`Dr Transfer Clearing / Cr AP/Cash`).
- Company value rises by `addedCost` — **backed by real money**.
- This is the **only** legitimate "uplift", and it requires an explicit `addedCost` input, never an inferred difference.

### 3.3 Revaluation transfer  (entered value intentionally ≠ source cost)
The user deliberately moves goods at a value different from the source carrying cost, i.e. changes the carrying cost.

- OUT value = `qty × source cost` (Invariant 1 — source still issues at its real average).
- IN value = `qty × entered value`.
- The difference `qty × (enteredValue − sourceCost)` is a **revaluation/variance** → posts to **Inventory Revaluation / Cost Variance**, NOT to inventory-from-nothing and NOT silently into the source's value.
- GL: `Cr Inv-Source (qty×cost)`, `Dr Inv-Dest (qty×enteredValue)`, `Dr/Cr Inventory Revaluation (the difference)`.
- Recognized explicitly so an auditor can see the gain/loss. Reuses the same account as backlog `223-inventory-revaluation-value-only-correction`.

### 3.4 Zero-cost source handling
Source carries the item at **0** (physically present, no system cost).

- A transfer at **0** is **valid and correct** — moving a 0-cost item moves 0 value. Subledger and GL both net to 0. Source average stays 0; destination receives at 0.
- If the user wants the item to move at **150**, that is **not** a normal transfer uplift. It is either:
  - a **Revaluation** (§3.3): revalue source 0 → 150 first (`Dr Inv-Source 150 / Cr Inventory Revaluation 150`), bringing source to a real cost, then transfer symmetrically at 150 — source ends at 0 qty/value (not negative), destination at 150; OR
  - a **provisional cost assignment** that belongs to a goods-receipt / GRNI path, not the transfer (goods entering the system without a bill: `Dr Inventory / Cr GRNI`, later `Dr GRNI / Cr AP`).
- Negative **inventory value** in a warehouse (the "source goes to −150" shortcut) is allowed **only** behind an explicit company flag; default behavior must push the user to revalue first rather than bury an un-recognized gain as negative inventory.

---

## 4. Decision table

For a transfer of qty `q`, source unit average `c`, optional entered unit value `v`, optional real added cost `f`:

| Transaction | OUT value | IN value | Inventory GL | Non-inventory GL | Source avg | Company value |
|---|---|---|---|---|---|---|
| **Plain / Journaled** (default) | `q·c` | `q·c` | `Cr Inv-Src q·c`, `Dr Inv-Dst q·c` (skip if same acct) | — | unchanged | 0 |
| **Added-cost** (freight) | `q·c` | `q·c + f` | `Cr Inv-Src q·c`, `Dr Inv-Dst (q·c+f)` | `Cr Transfer Clearing f` (cleared by bill) | unchanged | +`f` (real) |
| **Revaluation** (`v ≠ c`, explicit) | `q·c` | `q·v` | `Cr Inv-Src q·c`, `Dr Inv-Dst q·v` | `Dr/Cr Inventory Revaluation q·(v−c)` | unchanged | ±`q·(v−c)` (recognized) |
| **Zero-cost source** (`c = 0`) | `0` | `0` | nets to 0 | — | unchanged (0) | 0 |

`v` and `f` are **never** the same input. `v` is "what the goods are worth" (revaluation); `f` is "what I paid to move them" (added cost). A document must declare which, if either, it is.

---

## 5. Guardrails (hard rules for implementation)

1. The symmetric transfer value is **always derived from the source's carrying cost**, never free-typed for a plain/journaled transfer.
2. `uplift = IN − OUT` is **deleted** as an automatic computation. Value beyond source cost is posted only when an **explicit** input says so: `addedCost` → Transfer Clearing; `revaluationValue` → Inventory Revaluation.
3. **Source average must not change on an outbound transfer** (Invariant 1) — in any costing basis.
4. The **negative-stock guard** (`allowNegativeStock`) must fire on the **source OUT leg** for **both** WAREHOUSE and GLOBAL costing. A journaled transfer must not be a back door around it.
5. **GLOBAL costing:** a pure transfer must **never** change the global average. The current `(totals.value + uplift)/totals.qty` recompute, and the `totals.qty <= 0 → newGlobalAvg = destCostBase` fallback, must be removed/neutralized so a transfer with no real added cost leaves the global average flat.
6. **WAREHOUSE costing:** destination average may change only because it receives stock at a valid incoming value; source average stays put on issue.
7. Negative **inventory value** in a warehouse is allowed only behind an explicit company flag; default = push to revaluation.
8. Build the transfer's GL voucher **from the same value deltas applied to the subledger**, never from an independently-typed number, so Invariant 2 holds by construction.

---

## 6. Code touch-points

### 6.1 `StockTransferUseCases.ts` — `CompleteStockTransferUseCase.postUpliftVoucher`
**File:** `backend/src/application/inventory/use-cases/StockTransferUseCases.ts`
- `~L285`: `const uplift = roundMoney(result.inMov.totalCostBase - result.outMov.totalCostBase)` — **remove the automatic IN−OUT uplift.** Replace with explicit `addedCost` (Added-cost transfer) and/or `revaluationDelta` (Revaluation transfer) computed from declared inputs, not from the cost difference.
- `postUpliftVoucher` (`~L332`): split into:
  - **added-cost path** → `Dr Inv-Dest / Cr Transfer Clearing` (uses `defaultInventoryTransferClearingAccountId`).
  - **revaluation path** → `Dr/Cr Inventory Revaluation` (new setting, §6.4).
  - **plain/journaled path** → if per-warehouse inventory accounts: `Dr Inv-Dest / Cr Inv-Source`; if single account: net-zero (optionally skip voucher).
- `CreateStockTransferUseCase.buildDraft` (`~L117-128`): the `hasOverride` branch currently lets a VALUED line carry an arbitrary `unitCostBaseAtTransfer`. Re-interpret: an override is a **revaluation value** (or an added-cost), captured as a distinct, explicitly-typed field — not silently substituted for source cost.

### 6.2 `RecordStockMovementUseCase.processTRANSFER` (WAREHOUSE)
**File:** `backend/src/application/inventory/use-cases/RecordStockMovementUseCase.ts` (`~L374`)
- OUT leg already costs at source average (`transferCostBase = srcLevel.avgCostBase`) — keep. Confirm source average is **not** rewritten on the OUT leg.
- `hasDestOverride` / `destCostBase` (`~L451-464`): the destination override must represent a **declared** revaluation/added-cost, not an automatic landing value that diverges from source cost for a plain transfer.
- Negative-stock guard (`~L426`) — keep; ensure it is reached before any value mutation (it is).

### 6.3 `RecordStockMovementUseCase.processTRANSFERGlobal` (GLOBAL)
**File:** same file (`~L901`)
- `srcCostBase` fallback `totals.qty > 0 ? avg : src.lastCostBase` (`~L925`) — fine, but see below.
- `upliftBase = (destCostBase - srcCostBase) * qty` (`~L946`) — **remove** as an automatic uplift; only an explicit added-cost/revaluation may move value.
- `newGlobalAvgBase = (totals.valueBase + upliftBase) / totals.qty` (`~L951`) — for a pure transfer `uplift` must be 0 so the **global average is unchanged**.
- `totals.qty <= 0 → newGlobalAvg = destCostBase` (`~L952`) — **remove this mint-from-override fallback.** An empty global position cannot acquire a positive average from a transfer override.
- Negative-stock guard (`~L963`) — keep.

### 6.4 `InventorySettings` — required settings
**File:** `backend/src/domain/inventory/entities/InventorySettings.ts`
- `costingBasis: 'WAREHOUSE' | 'GLOBAL'` — existing; rules in §5.5/§5.6.
- `allowNegativeStock` — existing (default `false`); guard must apply to transfer OUT leg in both bases.
- `defaultInventoryTransferClearingAccountId` — existing; **restrict to Added-cost transfers only** (update the doc comment at `~L44-48`).
- **NEW (LOCKED) `defaultInventoryRevaluationAccountId`** — dedicated account for value-only cost corrections (Revaluation transfers, §3.3). See §6.5 for the locked decision and posting rule. Add to `InventorySettingsProps`, constructor, `toJSON`, `fromJSON`, the DTO/validator, and the settings UI.
- **NEW (optional)** `allowNegativeInventoryValue` flag — gates the "source goes negative-value" shortcut (§3.4); default `false`.

### 6.5 LOCKED: dedicated Inventory Revaluation account

**Decision (owner-confirmed 2026-06-15):** Add a new, dedicated inventory setting `defaultInventoryRevaluationAccountId`. **Do not reuse** `defaultInventoryGainAccountId` / `defaultInventoryLossAccountId` as the primary design.

**Why three distinct accounts (do not conflate):**
- **Inventory Gain / Loss** — for **quantity-based** inventory adjustments: stock-count differences, damage, shortages, found stock. (Quantity changes.)
- **Transfer Clearing** — for **real added transfer costs** only (freight, customs, handling); must be cleared by a real AP/Cash bill.
- **Inventory Revaluation** — for **value-only** cost corrections where **quantity does not change**: changing carrying cost 0 → 150, or 10 → 15.

**Posting rule (single account, side depends on the sign of the variance):**

```
If entered value > source carrying cost:     If entered value < source carrying cost:
    Dr Inventory                                 Dr Inventory Revaluation
    Cr Inventory Revaluation                     Cr Inventory
```

(For a Revaluation **transfer** per §3.3, the inventory side is the **destination** inventory account; the variance `q·(v − c)` lands in `defaultInventoryRevaluationAccountId` with the side chosen by the sign above, while the source still issues at `q·c` per Invariant 1.)

**Backward compatibility / migration only:** if `defaultInventoryRevaluationAccountId` is missing, the implementation **may** either (a) fail with a clear configuration error naming the missing setting, or (b) temporarily fall back to the existing Gain/Loss accounts. The **preferred product rule is to require the dedicated revaluation account** — treat the fallback as a migration crutch, not the design. No production data exists yet (pre-alpha), so no backfill is required; new/initialized companies should configure this account at setup.

---

## 7. Test cases (add as regression specs)

Existing suites: `backend/src/tests/application/inventory/NegativeStockEnforcement.test.ts`, transfer valuation tests under `backend/src/tests/application/inventory/`.

1. **Plain transfer, WAREHOUSE** — source 10u @10; transfer 1u to dest. OUT=10, IN=10; source avg stays 10; dest receives @10; single account → no GL or net-zero; per-warehouse accounts → `Dr Inv-Dst 10 / Cr Inv-Src 10`. Subledger total == GL.
2. **Plain transfer, GLOBAL** — global avg 10; transfer between warehouses. Global avg **unchanged**; net company value 0; no uplift posted.
3. **Added-cost transfer** — source 1u @100, addedCost 50. OUT=100, IN=150; `Dr Inv-Dst 150 / Cr Inv-Src 100 / Cr Transfer Clearing 50`; later bill clears Clearing to 0. Source avg unchanged.
4. **Revaluation transfer** (`v ≠ c`) — source 1u @10, entered value 15. OUT=10, IN=15; `Dr Inv-Dst 15 / Cr Inv-Src 10 / Cr Inventory Revaluation 5`; source avg stays 10. Subledger total == GL.
5. **Zero-cost source, transfer at 0** — source 1u @0. OUT=0, IN=0; nets to 0; source avg 0; dest receives @0. No phantom value.
6. **Zero-cost source, want 150 → must revalue** — a transfer that tries to land 150 from a 0-cost source with no explicit revaluation/added-cost input is **rejected** (or routed to revaluation); it must NOT post `Dr Inventory 150 / Cr Clearing 150`.
7. **Negative-stock guard on transfer OUT** — source short of qty with `allowNegativeStock=false`: transfer **rejected** before any mutation, in **both** WAREHOUSE and GLOBAL.
8. **Reconciliation invariant** — after each of the above, assert `sum(subledger value across warehouses for the item) == inventory GL control balance` (and Transfer Clearing nets to 0 once any added-cost bill is posted).

---

## 8. Acceptance

- Stock subledger valuation reconciles to the GL inventory control account after every transfer.
- No transfer can drive a warehouse quantity negative when `allowNegativeStock=false`.
- Pure transfers never change the global (GLOBAL) or source (WAREHOUSE) average cost.
- Transfer Clearing only ever holds a balance for a real added cost, and nets to zero once that cost's bill posts.
- Revaluations are explicit and land in a revaluation/variance account, never minted into inventory or buried in a warehouse's value.

---

## 9. Sequencing note

Backend serves compiled `lib/` — after implementation, run `npm --prefix backend run build` and verify via a real round-trip (emulator), not just `tsc --noEmit`. Cross-link the eventual completion report and update `docs/architecture/inventory.md` (transfer costing section) per Definition of Done. Related backlog: `tasks/223-inventory-revaluation-value-only-correction.md`.
