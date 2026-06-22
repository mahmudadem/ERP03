# Task 254 — Items / Stock / Catalog always-on (decouple from the Inventory module)

> **Status:** Not started. **Priority:** MEDIUM (the largest of the engines-vs-modules trio).
> **Principle:** [engines-vs-modules.md](../../docs/architecture/engines-vs-modules.md) — "item" is a shared catalog concept; the Inventory module is the UI/reporting layer on top. Item management is gated by *permission*, not by module-enabled.

## Refined findings (2026-06-22 investigation — read before implementing)

The original framing was too broad. Verified facts:

- **Item management already survives a module *disable*.** The route guard is
  `moduleInitializedGuard('inventory')`, which checks **`initialized`** (not `isEnabled`), and
  `CompanyModule.disable()` only flips `isEnabled` — it never un-initializes. So a tenant with
  the Inventory module toggled OFF (but initialized) can still hit item routes with the right
  permission. The guard already matches the engines-vs-modules rule.
- **Permissions are flexible, not hard-locked.** `RoleModuleBundleDeriver` derives module
  bundles *from* permissions (permission → module), so any role granted `inventory.items.manage`
  gets item access. There is **no code lock** tying item permissions to the Inventory module —
  so "POS user can manage items" is a role-config choice, not a code change.

So the only genuine **code** gaps are:

1. **(a) No guaranteed inventory auto-init.** Accounting has `EnsureAccountingEngineInitialized`
   (auto-invoked by Sales/Purchase init); inventory has **no equivalent** — it's only initialized
   by `SimpleTradingCompanyInitializer` (the starter template). A POS-only / non-template creation
   path can leave inventory un-initialized → item routes 403. **Fix:** add an idempotent
   `EnsureInventoryEngineInitialized` and invoke it from the same places (Sales/Purchase init +
   a POS setup step) so `initialized` is always true. *Design choice: where to invoke.*
2. **(b) Frontend surface.** Item-management UI lives under the Inventory module sidebar, hidden
   when the module is disabled. A POS persona needs an item-management entry that does not depend
   on the Inventory module being visible. *Product/UX choice.*

Permissions (b in the old list) need **no code** — just role configuration.

## The problem (original framing — superseded by the findings above)

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
