# 250d2 — POS Return Posting Entry Point

**Date:** 2026-06-21  
**Branch:** `feat/system-core-transformation`  
**Status:** Complete, pending CTO audit  
**Actual time:** ~1.4h

## Technical Developer View

250d2 decoupled POS returns from the Sales application. `CompletePosReturnUseCase` now delegates reversal posting to POS-owned `PostPosReturnUseCase` instead of constructing `CreateSalesReturnUseCase` and `PostSalesReturnUseCase`.

Files changed:

- `backend/src/application/pos/use-cases/PostPosReturnUseCase.ts`
- `backend/src/application/pos/use-cases/CompletePosReturnUseCase.ts`
- `backend/src/application/pos/use-cases/PreviewPosSaleUseCase.ts`
- `backend/src/domain/pos/entities/PosReceipt.ts`
- `backend/src/application/pos/use-cases/PostPosSaleUseCase.ts`
- `backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts`
- `backend/src/api/controllers/pos/PosController.ts`
- `backend/src/tests/application/pos/CompletePosReturn.test.ts`
- `backend/src/tests/application/pos/PostPosReturn.test.ts`
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`
- `docs/architecture/pos-independence.md`

The return path now uses:

- `IInventoryCore.processIN` for returned tracked stock;
- `IAccountingBridge.recordFinancialEvent` for revenue/tax reversal, COGS reversal, and refund settlement;
- POS receipt line snapshot posting metadata captured from the POS sale path for account/cost reversal context.

The folder-wide architecture guard is now enabled for `backend/src/application/pos/` and has no skip. POS application files no longer import Sales application or Sales domain internals.

## End-User View

Cashiers still process POS returns from the same POS return flow. Internally, the return no longer depends on the Sales Return workflow being available. Returned stock and refund/accounting effects are posted through the shared inventory and accounting engines.

This completes the POS sale/return independence needed for a POS-visible, Sales-hidden bundle model.

## Verification

- `npm --prefix backend test -- --runInBand src/tests/application/pos/CompletePosReturn.test.ts src/tests/application/pos/PostPosReturn.test.ts src/tests/application/pos/CompletePosSale.test.ts src/tests/application/pos/PostPosSale.test.ts src/tests/architecture/SystemCoreBoundaries.test.ts` — passed, 5 suites / 21 tests.
- `npm --prefix backend run typecheck` — passed.
- `npm --prefix backend run build` — passed.

## Accounting / ERP Impact

POS returns now post revenue/tax reversal, COGS reversal when original cost metadata exists, inventory restock, and refund settlement through System Core seams. Voucher metadata identifies `sourceModule: pos`, `sourceType: POS_RETURN`, and `documentPersona: POS_DIRECT_SALE`.

Known CTO-audit point: historical receipts created before 250d2 may not have line-level cost/account metadata, so COGS reversal is available only when that metadata exists or can be resolved from current item/settings defaults.
