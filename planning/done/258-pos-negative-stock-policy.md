# Done — Task 258: POS-specific negative-stock policy

**Date:** 2026-06-22
**Scope:** Backend safety control + settings plumbing + minimal settings UI.

## Summary

POS used to inherit the **company-wide** `InventorySettings.allowNegativeStock` flag for its
stock OUT. If a company allowed negative stock for back-office invoice-driven sales, the
physical till would silently oversell too. POS now has its own `negativeStockPolicy`
(`BLOCK` default | `ALLOW`) enforced in the POS posting path, so the till can be
independently strict.

## Files changed

**Backend**
- `domain/pos/entities/PosSettings.ts` — `PosNegativeStockPolicy` type + `negativeStockPolicy`
  field (default `BLOCK`); constructor/`createDefault`/`toJSON`/`fromJSON`.
- `application/pos/use-cases/PostPosSaleUseCase.ts` — `negativeStockPolicy` input +
  `assertNegativeStockAllowed` pre-check (pre-fetch level, aggregate per item/warehouse,
  throw `NegativeStockError`); runs before writes and on dry-run.
- `application/pos/use-cases/CompletePosSaleUseCase.ts` — threads `settings.negativeStockPolicy`
  into preview + real post.
- `application/pos/use-cases/PosSettingsUseCases.ts` — update input + merge.
- `api/validators/pos.validators.ts` — `negativeStockPolicy` enum validation.
- `api/dtos/PosDTOs.ts` — DTO field + mapper.
- `tests/application/pos/PostPosSale.test.ts` — +5 negative-stock tests, `preFetchStockLevel`
  added to the inventory-core mock.

**Frontend**
- `api/posApi.ts` — `PosNegativeStockPolicy` type + DTO field.
- `modules/pos/pages/PosSettingsPage.tsx` — "Negative stock at the till" selector + default.
- `locales/{en,ar,tr}/pos.json` — `negativeStockPolicy*` + `negativeStock.{block,allow}` keys.

**Docs**
- `docs/architecture/pos.md` — §4a POS-specific negative-stock policy.
- `docs/user-guide/pos/setup.md` — General field + troubleshooting entry.

## Verification

- `npx jest src/tests/application/pos/PostPosSale.test.ts` — 18/18.
- `npx jest src/tests/application/pos` — 14 suites / 97 tests green.
- `npm run typecheck` (backend) + `npm run build` (backend) — clean.
- Frontend POS files typecheck clean; pre-existing unrelated `UserPreferencesContext.tsx`
  errors remain in the dirty working tree (not introduced here).
- en/ar/tr `pos.json` JSON parse-validated.

## Manual QA script (owner-runnable)

Pre-req: a template-seeded tenant with the POS module entitled, one register with an open
shift, and one tracked PRODUCT item. (No production data — see memory `project_no_production_data`.)

1. **Default is safe.** Open **POS → Settings → General**. Confirm **Negative stock at the
   till** shows **Block** by default. (A brand-new company also defaults to Block.)
2. **Block stops an oversell.** Ensure the item has, say, 3 on hand in the register's
   warehouse. On the **Terminal**, add 5 of that item and try to complete the sale.
   → Expect a block naming the item/warehouse ("Stock OUT would drive … negative …"),
   **before** payment posts. No receipt, no voucher, stock unchanged.
3. **Block allows a covered sale.** Reduce the cart to 3 (≤ on hand) and complete.
   → Sale posts normally; on-hand goes to 0.
4. **Switch to Allow.** Set **Negative stock at the till = Allow**, Save. With the company
   inventory flag `allowNegativeStock = true`, repeat step 2 (sell more than on hand).
   → Sale posts and on-hand goes negative (POS deferred to the company flag).
5. **Allow still respects a strict company.** Set company `allowNegativeStock = false`,
   keep POS policy = Allow, oversell again.
   → Sale is blocked by the company-level `NegativeStockError` (POS added no block, but the
   inventory OUT still refuses).
6. **i18n.** Switch UI language to Arabic and Turkish; confirm the selector label, options,
   and help text are translated.

## Follow-up

- "Allow with manager approval" — deferred to [Task 257](../tasks/257-pos-manager-override-via-approval-engine.md)
  (Approval Engine owns *who* approves; Policy Engine owns *whether* approval is required).
