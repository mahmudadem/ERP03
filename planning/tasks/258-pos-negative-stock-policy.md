# Task 258 — POS-specific negative-stock policy

**Status:** ✅ IMPLEMENTED (2026-06-22) on the POS readiness working tree.

**Origin:** CTO audit of merged POS work vs the owner's POS requirements spec
([docs/audit/pos-commercial-rules-and-promotions-audit.md](../../docs/audit/pos-commercial-rules-and-promotions-audit.md)
§C rows 70–71, §J answer 6, follow-up list). The audit named this "the remaining
backend safety gap": POS silently inherited the **company-wide**
`InventorySettings.allowNegativeStock` flag, so a company that turns negative stock
on for back-office invoice-driven sales would also let the **physical till** oversell.

## Plain-language problem

A POS sale is a face-to-face hand-over of goods. Selling more than is on the shelf is a
control failure even when the back office is allowed to invoice ahead of a goods receipt.
The till needs its **own** negative-stock rule, independent of (and able to be stricter
than) the company inventory flag.

## What changed

- **`PosSettings.negativeStockPolicy`** (`BLOCK` | `ALLOW`, default **`BLOCK`**) — new
  company-level POS setting. Persisted through the entity (`createDefault`/`toJSON`/`fromJSON`),
  the update use-case, the request validator, and the settings DTO.
- **`PostPosSaleUseCase.assertNegativeStockAllowed`** — when the policy is `BLOCK`, the
  posting path pre-fetches the selling-warehouse stock level via
  `IInventoryCore.preFetchStockLevel`, aggregates requested quantity per (item, warehouse)
  (so a manual line + a promotion free-good of the same item are checked together), and
  throws `NegativeStockError` if the result would fall below zero. Runs **before any stock
  or ledger write** and on the **dry-run preview**, so the terminal blocks before tendering.
  `ALLOW` (or an absent policy) adds no extra block and defers to the company flag inside
  the inventory OUT.
- **`CompletePosSaleUseCase`** threads `settings.negativeStockPolicy` into both the preview
  and the real post.
- **Frontend** — `PosSettingsPage` adds a "Negative stock at the till" selector; `posApi`
  types updated; en/ar/tr i18n keys added.

## Design notes / seam

- POS can only be the **same as or stricter than** the company flag, never looser.
- The safe default (`BLOCK`) lives in the `PosSettings` entity; `PostPosSaleUseCase` treats
  an **absent** policy as `ALLOW` so its use-case contract stays backward compatible (existing
  callers/tests that don't pass a policy are unaffected; production always passes `BLOCK` via
  `CompletePosSaleUseCase`).
- Reuses the inventory-domain `NegativeStockError` (named item/warehouse, structured context)
  so the frontend renders the same translated message as back-office negative-stock blocks.
- **Deferred:** an `ALLOW_WITH_APPROVAL` value is intentionally **not** implemented here — it
  belongs with the Approval-Engine override work in [Task 257](./257-pos-manager-override-via-approval-engine.md)
  (Policy Engine decides *whether* approval is required; Approval Engine decides *who* approves).
  Adding a manager-override flag now would collide with that in-flight path.

## Acceptance criteria

- [x] POS has a negative-stock policy distinct from the global inventory flag, default safe (`BLOCK`).
- [x] `BLOCK` refuses an oversell before any stock/ledger write and on the dry-run preview.
- [x] `BLOCK` allows the sale when on-hand fully covers the request.
- [x] `ALLOW` defers to the company flag (no extra POS block).
- [x] Policy persisted end-to-end (entity, use-case, validator, DTO, API, settings UI, i18n).
- [x] Tests: BLOCK insufficient → throws; BLOCK dry-run → throws; BLOCK sufficient → posts;
      ALLOW → posts without pre-check; absent policy → backward-compatible.
- [x] Architecture + user docs updated; completion report + JOURNAL/ACTIVE.

## Verification

- `PostPosSale.test.ts` 18/18 (incl. 5 new negative-stock cases); full POS suite 14 suites / 97 tests green.
- Backend `tsc --noEmit` and `tsc` build clean.
- Frontend POS files typecheck clean (pre-existing unrelated `UserPreferencesContext.tsx`
  WIP errors remain in the working tree, not from this task).
- en/ar/tr `pos.json` parse-validated.

## Accounting/ERP impact

Control hardening only. No GL posting, tax, COGS, inventory valuation, settlement math,
period-lock, or approval-engine semantics changed — this only governs **whether** a POS line
may draw stock below zero at the till.
