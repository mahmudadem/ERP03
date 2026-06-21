# 250d — POS Posting Entry Point

**Date:** 2026-06-21  
**Branch:** `feat/system-core-transformation`  
**Status:** Complete, pending CTO audit  
**Actual time:** ~1.6h

## Technical Developer View

250d decoupled the POS sale path from Sales application use-cases. `CompletePosSaleUseCase` now depends on a POS-owned `PostPosSaleUseCase` instead of `CreateSalesInvoiceUseCase`, `PostSalesInvoiceUseCase`, `ISalesInvoiceRepository`, or the Sales Invoice domain entity.

Files changed:

- `backend/src/application/pos/use-cases/PostPosSaleUseCase.ts`
- `backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts`
- `backend/src/api/controllers/pos/PosController.ts`
- `backend/src/tests/application/pos/CompletePosSale.test.ts`
- `backend/src/tests/application/pos/PostPosSale.test.ts`
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`
- `docs/architecture/pos-independence.md`

The new POS posting path uses:

- `IInventoryCore.processOUT` for tracked item stock OUT;
- `IAccountingBridge.recordFinancialEvent` for revenue/tax, COGS, and settlement vouchers;
- `IPolicyEngine.resolve({ scope: 'pos', action: 'directSale' })` from 250c before posting.

The active architecture guard is intentionally scoped to `CompletePosSaleUseCase` and `PostPosSaleUseCase`. The folder-wide POS-to-Sales ban remains skipped with a TODO to 250d2 because POS returns are not part of 250d.

## End-User View

Cashiers still complete POS sales from the same screen and receive the same receipt result. The internal posting route changed: POS sales now post through shared accounting and inventory engines instead of requiring the Sales module's invoice workflow to be enabled.

This means POS sale posting is closer to a POS-only bundle model, where Sales can be hidden or unavailable while Accounting and Inventory still record the financial and stock effects.

## Verification

- `npm --prefix backend test -- --runInBand src/tests/application/pos/CompletePosSale.test.ts src/tests/application/pos/PostPosSale.test.ts src/tests/architecture/SystemCoreBoundaries.test.ts` — passed, 3 suites / 15 tests, 1 skipped folder-wide 250d2 guard.
- `npm --prefix backend run typecheck` — passed.
- `npm --prefix backend run build` — passed.

## Accounting / ERP Impact

This is a posting-entry-point change, not a UI change. The POS sale path still posts revenue/tax, COGS/inventory, and settlement effects, and cash change is netted before settlement. Voucher metadata now identifies the source as POS with `documentPersona: POS_DIRECT_SALE`.

Open boundary: POS returns still use Sales return use-cases until 250d2.
