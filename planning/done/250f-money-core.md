# 250f — Money Core

**Date:** 2026-06-21  
**Branch:** `feat/system-core-transformation`  
**Status:** Done, green, committed next.  
**Actual time:** ~1.4h

## Technical Developer View

250f replaced the audited local `roundMoney` copies with the System Core Money helper and made POS cash rounding active.

### What changed

- `backend/src/application/system-core/money/roundMoney.ts`
  - `roundMoney(value, currency = 'USD')` now preserves current 2-decimal behavior by default while supporting currency-specific precision.
  - `roundCash(...)` remains the POS cash-rounding authority.
- Audited local `roundMoney` definitions were removed from Sales, Purchases, POS, shared payment history, and seed scripts.
- `PostPosSaleUseCase` now rounds POS sale lines/tax/buckets in the company base currency and supports a cash-rounding adjustment line.
- `CompletePosSaleUseCase` applies `PosSettings.cashRounding` before validating tender:
  - nearest 0.05 / nearest 1 are supported;
  - positive rounding differences credit `cashOverAccountId`;
  - negative rounding differences debit `cashShortAccountId`;
  - missing required account blocks the sale before posting.
- `SystemCoreBoundaries.test.ts` now rejects new local `roundMoney` definitions outside the System Core helper and the low-level accounting precision primitive.

### Files changed

- `backend/src/application/system-core/money/roundMoney.ts`
- `backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts`
- `backend/src/application/pos/use-cases/PostPosSaleUseCase.ts`
- audited Sales/Purchases/domain/shared rounding call sites
- `backend/src/tests/application/system-core/MoneyCore.test.ts`
- `backend/src/tests/application/pos/CompletePosSale.test.ts`
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`
- `docs/architecture/system-core.md`
- `docs/architecture/pos-independence.md`
- `docs/user-guide/pos/setup.md`
- `docs/user-guide/pos/selling.md`

### Accounting / ERP impact

Cash rounding is now financially posted, not just displayed. The POS sale revenue voucher stays balanced by posting the rounding difference to existing POS over/short accounts. This avoids leaving small AR balances open after rounded cash settlement.

No tax rules, COGS logic, inventory costing policy, approval policy, period-lock policy, tenant scoping, or POS independence boundary changed.

## End-User View

POS cashiers can now use the cash-rounding setting from POS Settings. If the company chooses nearest `0.05` or nearest `1`, the terminal validates payment against the rounded payable total. The receipt total, payment amount, cash drawer movement, and accounting voucher stay aligned.

Administrators must configure Cash over and Cash short accounts before using cash rounding. If the needed account is missing, the terminal blocks the sale with a clear setup error instead of posting an unbalanced or partially-settled sale.

## Verification

- `npm --prefix backend test -- --runInBand src/tests/application/system-core/MoneyCore.test.ts src/tests/application/pos/CompletePosSale.test.ts src/tests/architecture/SystemCoreBoundaries.test.ts` — passed, 3 suites / 19 tests.
- `npm --prefix backend run build` — passed.
- `npm --prefix backend run typecheck` — passed.
- Grep guard: local `roundMoney` definitions remain only in `application/system-core/money/roundMoney.ts` and `domain/accounting/entities/VoucherLineEntity.ts`.

Note: the first parallel typecheck/build attempt hit a Prisma client file rename race in shared `node_modules`; rerunning typecheck alone passed.

## Next

Proceed to 250g Audit Engine. Hard-stop after 250g for CTO audit; do not enter Phase 3.
