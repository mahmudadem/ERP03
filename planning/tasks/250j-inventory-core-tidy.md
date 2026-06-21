# 250j — Phase 3: Inventory Core tidy (rename + COGS move)

**Parent:** [250 epic](./250-system-core-transformation-epic.md) · **Phase:** 3 (after POS V1) · **Blocking:** no
**Depends on:** [250a](./250a-seams-and-interfaces.md) · **Agent:** erp-backend-builder · **Estimate:** 1–2 days
**Status:** ⬜ Not started

## Objective

Remove the Sales bias from the working inventory engine: rename `ISalesInventoryService` → neutral `IInventoryCore`, and pull COGS accumulation out of Sales into the core.

## Current state (proven)

- Inventory is a genuine shared engine via the `ISalesInventoryService.processIN/processOUT` contract — consumed by Purchases too ([engines-audit §B/§D-8](../../docs/audit/system-core-shared-engines-audit.md)).
- COGS accumulation lives partly inside `SalesInvoiceUseCases` (`AccumulatedCOGS`, inventory-account resolution ~517), and Sales imports inventory domain entities directly ([engines-audit §D-7](../../docs/audit/system-core-shared-engines-audit.md)).

## Target

- Rename the contract to `IInventoryCore` (250a already aliased it — now make it the canonical name; keep a deprecated re-export for one phase).
- Move COGS accumulation + inventory-account resolution into the Inventory Core; Sales calls the core for COGS rather than owning the loop.

## Scope — files

- Rename `ISalesInventoryService` → `IInventoryCore` across `application/inventory/contracts/` + all consumers (mechanical, wide).
- Move `AccumulatedCOGS` logic from `SalesInvoiceUseCases` into an inventory-core service; Sales consumes the result.
- Remove direct inventory-entity imports from Sales where the core now mediates.

## Tests

- Golden COGS regression: SI/SR/PI/PR COGS amounts unchanged after the move.
- Architecture test: Sales no longer imports inventory domain entities for COGS.

## Acceptance criteria

- [ ] `IInventoryCore` is canonical; no Sales-named inventory contract in active use.
- [ ] COGS accumulation owned by the core; Sales COGS output unchanged (golden).
- [ ] typecheck + build clean; suite green.

## Definition of Done

- [ ] Commit: `refactor(system-core): rename inventory core + move COGS accumulation [250j]`
- [ ] `planning/done/250j-inventory-core-tidy.md` report.

## CTO audit gate

Reject if COGS totals changed, or if Sales still owns the COGS accumulation loop.
