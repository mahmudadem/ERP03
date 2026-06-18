# Completion Report — Epic 240 Phase 3: Item costing stats

**Date:** 2026-06-18 · **Branch:** `codex/240c-item-costing-stats` · **Spec:** [tasks/240c](../tasks/240c-phase3-item-costing-stats.md) · **Epic:** [240](../tasks/240-simple-periodic-mode-and-item-costing-epic.md)

## What was built
Per-item, continuously-updated, FX-accurate costing statistics, with an extensible schema:

- **Domain (`Item.ts`):** new `CostPoint` (`base`, `ccy`, `currency`, `fxRateToBase`, `asOf`, `source`) and `ItemCostingStats` (`avgCost`, `lastPurchaseCost?`, `lastSalePrice?`, `extra?: Record<string, CostPoint>`). `Item.costingStats?` field, normalized/cloned in the entity.
- **Service (`application/inventory/services/ItemCostingStatsService.ts`):**
  - `buildPurchaseCostPoint(movement)` — from a purchase IN movement (base + cost-currency split via `fxRateMovToBase`, `asOf` = movement date, source = movement ref).
  - `buildSalePricePoint(input)` — from a sale line's **selling price** (`base = unitPriceDoc × exchangeRate`, `ccy = unitPriceDoc`), not COGS.
  - `buildAverageCostPoint(levels, item, baseCurrency, costingBasis)` — **GLOBAL** = the company-wide average; **WAREHOUSE** = qty-weighted average across the item's stock levels; falls back to prior avg or zero.
  - `buildUpdatedItemCostingStats(...)` — merges the new avg with last-purchase/last-sale, preserving `extra`.
- **Engine + posting hooks (all IN/sale paths):** `RecordStockMovementUseCase` (incl. GLOBAL fan-out), the **inline PI receipt path** in `PurchaseInvoiceUseCases`, `GoodsReceiptUseCases`, and the sale-price capture in `SalesInvoiceUseCases` + `DeliveryNoteUseCases`. Writes persist via `itemRepository.updateItemInTransaction` in the same posting transaction.
- **Repos (parity):** `IItemRepository.updateItemInTransaction` implemented in **both** `PrismaItemRepository` and `FirestoreItemRepository`; `+1` Prisma schema column.
- **Frontend:** `ItemMasterCard.tsx` surfaces avg cost / last purchase / last sale; `inventoryApi.ts` carries the new fields.
- **Extensibility:** `ItemCostingMethod` generalized to an open union; `extra` map reserved for future methods (standard/FIFO/highest/lowest) with no migration.

## Integration work done during landing (audit by reviewer)
The implementation arrived as WIP built on an older base. It was rebased onto the consolidated `main` (**zero conflicts**) and the following integration gaps were closed:
1. **5 stale item-repo test mocks** lacked `updateItemInTransaction` → added no-op stubs.
2. **3 settlement/rule test mocks** lacked `preFetchLevelsByItem` (the posting path now prefetches item levels) → added.
3. **`PostingAuthority` architecture guard** — a **pre-existing** failure from the week's approval-leak hotfix (`SubledgerVoucherPostingService` moved to `resolveApproved(input)`); the guard's source assertion was updated to the new pattern **without weakening** the "approval from caller, not self-stamped" control. (Not a Phase-3 change.)

## Verification
- **Full backend suite:** 159 suites passed (2 skipped), **1,436 tests passed, 0 failures**.
- **`npm run build` (tsc):** clean. Backend emulator serves compiled `lib/`.
- Focused: `src/tests/application/{purchases,inventory,sales}` 46 suites / 415 tests green, incl. the WIP's purchase/sales costing-stats tests and a foreign-currency case.

## Manual QA script (owner)
1. On a fresh tenant, create item ITEM-A (cost currency = base).
2. **Purchase** 10 @ 5 → Item card: avg cost 5, **last purchase 5**.
3. Purchase 10 @ 7 → avg cost 6 (WAREHOUSE: per-wh; GLOBAL: company-wide), last purchase 7.
4. **Sell** 3 @ 15 → **last sale price 15** (selling price, not COGS); avg cost unchanged.
5. **Foreign-currency item** (cost currency ≠ base): repeat a purchase + sale; confirm both `base` and `ccy` values are correct on the card and the FX rate/date are stored.
6. Re-post a document (idempotency): stats must not double-apply.

## Remaining for Phase 3 closure
- This report ✅, `docs/architecture/inventory.md` costing-stats section ✅, user guide ✅, JOURNAL ✅, ACTIVE ✅ (this commit).
- **Not pushed**; merge to `main` pending owner approval.

## Notes / boundaries
- Posting **GL behaviour unchanged** — this is read/reporting metadata that feeds Phase 5 valuation and Task 241 (party×item prices), which reuse the same posting hook.
- No backfill (no production data).
