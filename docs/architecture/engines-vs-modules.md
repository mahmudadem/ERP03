# Engines vs Modules — the always-on rule

> The binding rule for deciding what lives in an always-on engine and what is owned by a
> module. This is the conceptual foundation behind Epic 250 and every future feature.
> See also: [system-core.md](system-core.md), [module-boundaries.md](module-boundaries.md),
> and the distilled rule in `AGENTS.md` ("Engines vs Modules — the always-on rule").

## The principle

> **Engines own the truth and the rules that keep it true. Modules own the windows into
> that truth and one type of user's way of working with it.**

An **engine** is the **system of record** for some facts (the ledger, stock levels, the item
catalog, document numbers) plus the **invariants** that must always hold for those facts
(books balance, stock never silently oversells, numbers never duplicate). Engines are
**always on** — constructed at boot, available to every tenant, gated only by *permission*,
never by whether a module is enabled.

A **module** is **UI + reports + that user's workflow + config screens + the visibility
toggle**. A module can be switched off for a tenant; that only hides its windows. It must
never change whether the underlying facts stay correct.

## The two flags (never conflate them)

Every module record carries two independent flags:

- **`initialized`** — "the engine has the data it needs to run" (chart of accounts seeded,
  warehouse/UOM seeded). A *readiness fact*, not a gate. We keep it always-true by
  **auto-initializing engines at company creation**. Real work checks this.
- **`isEnabled`** — "this user can see/reach this module's screens." A *security + visibility*
  flag. It must **never** gate engine behavior — only UI/navigation/access.

The original conflation bug (`isAccountingEnabled`) was fixed in
[done/102-pr1-accounting-engine-guard.md](../../planning/done/102-pr1-accounting-engine-guard.md):
posting depends on `initialized` (engine ready), never on `isEnabled` (the cosmetic toggle).

## The four litmus tests

Run any capability through these:

1. **The "turn it off" test.** Turn the module off — must this still be true/correct?
   GL must still balance; stock must still not oversell; items must still exist. → **Engine.**
2. **The "more than one consumer" test.** Do (or will) multiple modules need it?
   Items: POS + Sales + Purchase + Inventory. → **Engine (shared).**
3. **The "system of record" test.** Is this the canonical data others depend on?
   → **Engine owns the data; modules are viewers/editors.**
4. **The "show vs decide" test.** Presentation, navigation, or one user's workflow → **Module.**
   Computation, invariant, or record-keeping → **Engine.**

When a feature has both halves (it usually does), **split it**: the truth/rule/signal goes in
the engine; the presentation/workflow goes in the module.

## Signals are engine-owned (low-stock is just one example)

If a consumer needs to **ask** the engine a question or be **warned** by it, that query/signal
belongs to the engine; *how it is displayed* belongs to the module. The engine owns the
*fact*; the module owns the *widget*.

Stock signals the engine should expose (low-stock is only #3):

1. current availability
2. projected availability after this sale
3. below-reorder-level
4. out-of-stock
5. would-go-negative (the oversell block)
6. current cost / valuation
7. (future) batch / expiry / serial status

POS, Sales, dashboards, and the AI assistant all consume the same facts differently.

## The full classification

| Domain | Engine owns (always-on: record + invariants + signals) | Module owns (UI / reports / workflow / config / visibility) |
|---|---|---|
| **GL / Posting** | Turning any event into balanced vouchers; the ledger; posting invariants (balanced, period-lock, approval-gate, account validation); account resolution from defaults; balance & statement queries | COA management UI; Trial Balance / P&L / Balance Sheet; manual JV screens; fiscal-period config; approval-policy config |
| **Catalog / Items** | Item as system of record (code, name, UOM, **sell price, buy price**, item→account map); create/edit (by *permission*); catalog read/search for everyone | Item list/detail UI; bulk import; category admin |
| **Stock** | Stock levels; movement recording; invariants (no oversell, costing/valuation); the signal family above | Stock reports; valuation report; adjustments/transfers workflows; warehouse admin; reorder dashboards |
| **Pricing / Commercial** | Discount/price/cost math; price-list resolution; margin & below-cost detection | Price-list management UI |
| **Tax** | Tax computation; inclusive/exclusive resolution | Tax-code config UI |
| **Numbering** | Unique sequential numbers (no gaps/dupes) | Number-format config UI |
| **Approval** | The approval decision for any subject; enforcing the gate *before* GL/stock impact; override checks | Approval-policy config; approval inbox/center UI |
| **Currency / FX** (`IFxEngine`) | Rate resolution (exact/recent/inverse); deviation detection — for any module | Rate-entry UI; FX revaluation reports |
| **Parties** *(treat as engine)* | Party identity (customer/vendor/walk-in); party→AR/AP account mapping — shared by Sales/Purchase/POS | Customer/vendor list; CRM screens |
| **Documents / Audit** *(already engines)* | Document identity & state; immutable audit trail of every change | Document list UIs; audit-log viewer |

## Where settings live

Defaults (linked accounts, `allowNegativeStock`, costing method, reorder levels) are
**consumed by the engine but edited via a module/setup screen**. So the **setting data is
engine-adjacent** (the engine must always be able to read it; auto-init seeds it), while the
**editing UI is a module**. This is why a POS-only user gets correct behavior with zero
config — auto-init wrote the defaults the engine reads, and the user never has to make an
accounting/inventory decision.

## The forward rule (for every future feature)

> Before building a feature, ask: *is this a fact-that-must-stay-true, or a window onto
> facts?* If turning a module off would make it wrong, or more than one module needs it →
> it's an **engine** capability (always-on, permission-gated). If it's a screen, a report, or
> one user's workflow → it's a **module**. When a feature has both, **split it**.

This extends the "Where does this logic go?" protocol in `AGENTS.md` with a sharper
always-on/ownership test.

## Current gaps (tracked tasks)

The principle is mostly realized — the engines exist. The remaining work is decoupling the
gates and finishing two extractions:

- **[Task 253](../../planning/tasks/253-posting-engine-always-acts.md)** — posting engine
  always acts (gate on `initialized`, not `isEnabled`) + verify account selectors use the
  *constrained* inline-add, not the full COA form. Small, high-leverage (unlocks always-on
  posting + populated customer statements without the Accounting module).
- **[Task 254](../../planning/tasks/254-items-stock-catalog-always-on.md)** — item/stock/
  catalog always-on: decouple item management from the Inventory module (permission-gated,
  not module-gated); auto-init the stock engine; expose stock signals everywhere.
- **[Task 255](../../planning/tasks/255-currency-fx-shared-engine.md)** — ✅ DONE. `IFxEngine`
  seam added (rate resolution + deviation detection + reference-rate save), wrapping the
  already-centralized `core` exchange-rate logic via `LegacyFxAdapter`. The `accounting` stack
  was already a re-export shim of `core` (no real duplication). Migrating existing Currency
  controllers to consume the engine is an optional phased follow-up.
