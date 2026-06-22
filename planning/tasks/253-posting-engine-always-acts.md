# Task 253 — Posting engine always acts (gate on `initialized`, not `isEnabled`)

> **Status:** ✅ DONE (2026-06-22). Bridge `shouldUseFullPosting` now gates on `initialized` (engine ready), not `isEnabled` (cosmetic toggle); minimal-mode warnings reworded to "Not linked to accounting (accounting engine not initialized)". Frontend `AccountForm` gained `allowedClassifications` (restricts + locks the classification dropdown for inline creation) and `AccountSelector` passes its own constraint through, so a non-accountant creating an account from a typed picker cannot misclassify it. Verified: focused posting/bridge/POS/inventory tests + full backend suite **1630 green**, backend build clean, frontend typecheck clean. **Open (carried):** decide whether to drop minimal mode entirely once auto-init guarantees `initialized` — kept as the explicit "not linked to accounting" fallback per owner decision.
> **Priority:** HIGH (smallest, highest-leverage of the engines-vs-modules trio).
> **Why:** Realizes the "engines always on" rule for GL posting. Unlocks two owner requirements at once.
> **Principle:** [engines-vs-modules.md](../../docs/architecture/engines-vs-modules.md) — `initialized` gates work; `isEnabled` is access/visibility only and must never gate engine behavior.

## The problem

`LegacyAccountingBridgeAdapter.shouldUseFullPosting()` decides full-vs-minimal posting by
checking the **`isEnabled`** flag of the `accounting` module:

```ts
private async shouldUseFullPosting(companyId: string): Promise<boolean> {
  if (!this.companyModuleRepo) return true;
  const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
  return Boolean(accountingModule?.isEnabled);   // ← WRONG flag
}
```

`isEnabled` is the cosmetic Modules-page toggle. Per
[done/102-pr1-accounting-engine-guard.md](../done/102-pr1-accounting-engine-guard.md) the
Accounting **Engine is mandatory** and posting must depend on **`initialized`** (engine
ready / chart of accounts seeded), **never** on the UI toggle. As written, disabling the
Accounting module silently drops GL posting to minimal mode (a `PostingLog` breadcrumb, no
voucher) — so a POS/Sales-only tenant builds no real ledger, and enabling Accounting a month
later does **not** back-fill the books.

## Owner intent (decided)

- Engines are always on. The posting engine must **always act** when the engine is
  `initialized`. Disabling the Accounting module hides screens only.
- POS-only / Sales-only tenants must post GL under the hood from day one, so flipping the
  Accounting module on later reveals complete books (Trial Balance, JV, etc.) instantly.

## Scope

1. Change `shouldUseFullPosting` to check **`initialized`** (engine ready), not `isEnabled`.
   - Confirm the `accounting` module is auto-`initialized` for every company at creation
     (starter template + `EnsureAccountingEngineInitialized` already do this — verify it
     holds for a POS-only creation path too).
2. Define what **minimal mode** is genuinely for after the change: only the genuinely
   *un-initialized* engine (no COA) — a true fallback, not a normal operating state. Decide
   whether to keep it at all once auto-init guarantees `initialized`.
3. **Account selector check (folded in from the inline-add discussion):** verify the POS /
   Sales account selectors use the **constrained** inline "+ add account" (classification +
   parent pre-set from the selector's role, e.g. `AccountSelectorCombobox` /
   `DocumentChargesAllocation`'s `allowedClassifications`), **not** the raw full `AccountForm`.
   A non-accountant must not be able to create a misclassified account that silently corrupts
   the under-the-hood books. Constrain or hide the unconstrained path for the POS/Sales persona.

## Acceptance criteria

- [ ] Posting full-vs-minimal decision keys on `initialized`, not `isEnabled`.
- [ ] With the Accounting module **disabled** (but engine initialized): SI/PI/POS still post
      full GL vouchers; Trial Balance and customer statements are populated.
- [ ] With the engine **not initialized** (no COA): the defined fallback behavior is explicit
      and tested (minimal log or hard error — decide and document).
- [ ] Auto-init guarantees `initialized=true` for every company creation path, including POS-only.
- [ ] POS/Sales account selectors only offer the constrained inline-add; full COA form not
      reachable by the accounting-disabled persona.
- [ ] Full backend suite green; live emulator round-trip (post with Accounting module OFF →
      balanced voucher exists) verified.

## Guardrails

- Behavior-preserving for tenants that already have Accounting enabled (full mode unchanged).
- Pre-alpha, no production data — the minimal→full shift for app-disabled tenants is intended.
- Do not weaken `SystemCoreBoundaries.test.ts`.
