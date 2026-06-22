# Task 254 — Items / Stock / Catalog always-on (decouple from the Inventory module)

> **Status:** Not started. **Priority:** MEDIUM (the largest of the engines-vs-modules trio).
> **Principle:** [engines-vs-modules.md](../../docs/architecture/engines-vs-modules.md) — "item" is a shared catalog concept; the Inventory module is the UI/reporting layer on top. Item management is gated by *permission*, not by module-enabled.

## The problem (current coupling)

Two things are bundled inside "the Inventory module" but are in very different states:

| Capability | Today | Always-on? |
|---|---|---|
| Sell/search items (read) | POS has its own route (`/products/search`, `pos.terminal.access`) hitting `itemRepository` directly | ✅ already shared |
| Oversell / negative-stock protection | `RecordStockMovementUseCase` (`allowNegativeStock===false → NegativeStockError`) | ✅ engine, always runs |
| Stock levels / costing | `IInventoryCore` | ✅ always-on |
| **Item management (add item, set sell/buy price)** | `ItemUseCases` exposed only via `inventory.routes` → `moduleInitializedGuard('inventory')` | ❌ **gap** |
| Low-stock / reorder visibility | inventory dashboard + AI proposals only | ⚠️ dashboard-only; not surfaced at POS/Sales |

A POS-only or Sales-only user cannot add items or set prices without the Inventory module
being initialized — even though items are a shared concept every module needs.

## Owner intent (decided)

- Any module that touches items (POS, Sales, Purchase) can **manage items + set sell/buy
  price** without enabling the Inventory module.
- Oversell protection and stock control run under the hood for everyone (already true).
- Stock **signals** (low-stock is just one; see the signal family in the principle doc) are
  engine-owned and surfaced wherever needed — e.g. a low-stock nudge at the POS/Sales line,
  not only an Inventory dashboard.

## Scope (mirror what PR1 did for accounting)

1. **Make the stock/catalog engine mandatory + always-initialized.** Auto-init already seeds
   warehouse/UOM/inventory settings — confirm it runs for every creation path (incl. POS-only)
   so `initialized` is always true and the engine always acts.
2. **Swap the gate on item-management endpoints** from `moduleInitializedGuard('inventory')`
   to a **permission guard** (e.g. `items.manage`). Decide whether to relocate item CRUD
   routes out of `inventory.routes` into a shared catalog route surface, or keep the path and
   change only the guard (lighter — pick during design).
3. **Expose stock signals as engine queries** (availability, projected-after-sale,
   below-reorder, out-of-stock, would-go-negative, cost/valuation) so POS/Sales/dashboards
   consume the same facts. Add a thin always-available low-stock signal at the sell line.
4. Keep the **Inventory module** as UI/reporting only: adjustments, transfers, valuation,
   warehouse admin, reorder dashboards.

## Acceptance criteria

- [ ] A user with `items.manage` but **without** the Inventory module can create/edit items
      and set sell + buy price.
- [ ] Stock/catalog engine is auto-initialized for every company creation path (incl. POS-only).
- [ ] Oversell protection unchanged (still enforced in the engine for all modules).
- [ ] Stock signals available as engine queries and consumed by at least POS + Sales sell paths
      (low-stock surfaced at the line, not just the dashboard).
- [ ] Inventory module toggle controls visibility only — never item existence or stock correctness.
- [ ] Full backend suite green; live verification of item create + sell with Inventory module OFF.

## Guardrails

- Permission model is security-critical — do not blind-patch route guards; design the
  `items.manage`-style permission deliberately and add coverage.
- Behavior-preserving for tenants that have Inventory enabled.
