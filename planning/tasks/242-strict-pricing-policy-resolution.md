# Task 242 — Strict pricing-policy resolution (no cross-source fallback)

**Status:** Planned (owner-decided 2026-06-19). **Modifies Task 241.**
**Module:** Sales + Purchases (line price resolution). **Depends on:** [241](./241-party-item-price-memory.md) (merged or on branch `feat/241-party-item-price-memory` / PR #14).
**Source:** owner manual-test [DECISION-A](../qa/241-manual-test-notes.md).

## Problem
Today the line-price resolver **cascades** through all sources:
`PRICE_LIST → LAST_PARTY_PRICE → LAST_EVENT → ITEM_DEFAULT` (`buildSourceOrder`). A brand-new customer with no own price therefore **silently inherits another customer's price** via `LAST_EVENT`. The owner verified this live (PASS-02) and ruled it **bad UX** — the user can't tell where the price came from and gets confused.

## Decision (owner, locked)
Resolution must be **strict to the configured policy** — use **only** the configured source. **No automatic fallback** to other sources. If the configured source yields no value → **leave the line blank** for manual entry. Never borrow from a different source.

Also: **change the default policy** from `PRICE_LIST` to **`LAST_PARTY_PRICE`** so the out-of-box behavior is: returning customer auto-fills their last price; brand-new customer comes up blank.

## Scope / where to change
- **Backend resolver (sales):** `backend/src/application/sales/use-cases/PriceListUseCases.ts` — the `buildSourceOrder` / source-cascade logic.
- **Backend resolver (purchases):** `backend/src/application/purchases/use-cases/PurchasePriceListUseCases.ts` — `buildSourceOrder` (~lines 248, 274–280) currently returns the full 4-source cascade per the configured value. Change it to resolve **only `[configured]`** (single source).
- **Default policy:** `backend/src/application/inventory/use-cases/InitializeInventoryUseCase.ts:98` (`?? 'PRICE_LIST'`) → default to `'LAST_PARTY_PRICE'`. Check the Simple Trading starter initializer too so new trading companies get the same default.
- Keep returning the `source` field on `EffectivePriceDTO` (already `PRICE_LIST | LAST_PARTY_PRICE | LAST_EVENT | ITEM_DEFAULT`, `frontend/src/api/salesMasterDataApi.ts:88`) for transparency — even though only the configured one will ever be returned now.
- Frontend resolvers already treat a null/empty price as "leave blank" (`salesLinePriceResolver.ts` / `purchaseLinePriceResolver.ts` return null on miss) — confirm a strict miss yields blank, not a stale value.

## Acceptance / QA
- Policy = `LAST_PARTY_PRICE`: returning customer/vendor → line auto-fills their last price; **new** customer/vendor → line **blank** (no inheritance from `LAST_EVENT`).
- Policy = `PRICE_LIST`: only the assigned price list fills the line; no list → blank (no fall to party/last/default).
- Policy = `ITEM_DEFAULT`: line fills from item default only.
- `source` field still returned and correct for the single resolved source.
- New trading company (Simple starter) defaults to `LAST_PARTY_PRICE`.
- Update/extend the focused resolver tests (sales `PriceListResolution.test.ts`, purchases `PurchasePriceListUseCases.test.ts`) to assert **no cross-source fallback**.
- Backend `npm run build` (tsc→lib/) + focused suites green; verify via real emulator round-trip (new-customer case = blank).

## Relationship to PR #14
**Recommended: apply this on the `feat/241-party-item-price-memory` branch BEFORE merging PR #14**, so the merged behavior is the one the owner wants. If PR #14 is already merged, ship 242 as a fast-follow PR.

## Out of scope (→ Task 243)
Making the policy user-selectable in the UI, per-party assignment, per-document right-click override, document settings page. This task is **only** the strict-resolution behavior + default change.

## Definition of Done
Code merged · `docs/architecture/pricing.md` updated (resolution now strict) · user-guide note · `planning/done/242-*.md` report (incl. QA script) · JOURNAL + ACTIVE updated.
