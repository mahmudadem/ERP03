# Phase 6 (Epic 240) — Mode selection at creation, COA linkage, and lock-after-first-transaction

**Parent epic:** [240](./240-simple-periodic-mode-and-item-costing-epic.md) · **Depends on:** Phase 4 (PERIODIC exists + periodic COA template).

## Objective (owner-confirmed policy — epic §7)
Ask the inventory mode **once, at company creation, before COA selection**; that one answer seeds the COA **and** the inventory `accountingMode` consistently; allow changing the mode (re-seeding the COA) **until the first posted transaction**, then **lock** it.

## 1. When/where we ask
- Add a **mode-selection** control to the **Company Setup** wizard step (added by `planning/done/232-*.md`), positioned **before** COA selection. Three plain-language choices:
  1. "Simple — I just track sales, purchases, and stock value" → `PERIODIC`
  2. "Standard — keep inventory value live, one invoice per transaction" → `INVOICE_DRIVEN`
  3. "Advanced — separate receiving/delivery, full control" → `PERPETUAL`
- Today: `CompleteCompanyCreationUseCase` does NOT seed COA; `InitializeAccountingUseCase` seeds it from a `coaTemplate` id; `InitializeInventoryUseCase` sets inventory settings. Wire the single mode answer through all three.

## 2. COA linkage
- The mode selects the COA template / required accounts:
  - `PERIODIC` → the periodic trading COA (Purchases/Sales/Goods/Trading; **no** Inventory-Asset/COGS/GRNI).
  - `INVOICE_DRIVEN` / `PERPETUAL` → inventory-asset/COGS COA (+ GRNI for PERPETUAL); **no** Purchases/Trading accounts.
- Filter the COA template options by mode (or annotate a shared template with `requiredForMode`); validate required accounts exist before module init completes.

## 3. Lock policy
- **Before the first posted transaction:** changing the mode is allowed and **re-seeds the COA template** + resets inventory settings (no history to corrupt).
- **After the first posted transaction:** locked. `InventoryController.updateSettings` is immutable post-init today — extend it to **post-first-transaction** semantics (add a "company has any posted voucher/stock movement?" check) and return a readable blocked error.
- Migration tooling between periodic↔perpetual is **out of scope**.

## Tests
- Pre-transaction mode change re-seeds the matching COA and updates inventory mode.
- Post-transaction mode change is blocked with a readable error.
- Each mode seeds the correct COA shape and validates required accounts.
- `npm run build`; emulator round-trip + a browser pass on the wizard.

## Acceptance
- New company: pick mode once → correct COA + inventory mode, consistent. Change freely until first posting, locked after.

## Definition of Done
- `planning/done/240f-phase6-mode-lock-wizard-coa.md` (QA script), `docs/architecture/onboarding.md` + `docs/architecture/inventory.md` + user-guide (company-starter-template), JOURNAL, ACTIVE.
