# Sales Return Cost Fallback — Completion Report

**Date:** 2026-05-04  
**Agent:** Codex (CTO Mode)  
**Estimate:** 1h  
**Actual:** 0.7h  
**Status:** Done

## What Changed

- `backend/src/application/sales/use-cases/SalesReturnUseCases.ts`
  - Sales Return posting now resolves tracked-item return cost from the return/source line first.
  - If that cost is missing or zero, it falls back to the pre-fetched stock level `avgCostBase`, then `lastCostBase`.
  - The existing missing-positive-cost error still fires if no cost source exists.
- `backend/src/tests/application/sales/SalesReturnUseCases.test.ts`
  - Updated test mocks to match the current write-only inventory transaction contract.
  - Added regression coverage for missing source cost with valid stock-level cost.
  - Preserved coverage for the true missing-cost blocker.

## What Was Tested

- `npm test -- --runTestsByPath src/tests/application/sales/SalesReturnUseCases.test.ts`
  - 9/9 tests pass.
- `npm run build` in `backend/`
  - TypeScript build passes.

## Acceptance Criteria Met

- Sales Return posting does not fail just because the stored return/source invoice line has `unitCostBase = 0`.
- Posting uses inventory cost already available in the stock level when possible.
- The system still blocks posting when there is genuinely no positive inventory cost basis.
- Firestore transaction rule remains intact: reads happen before the transaction, transaction callback writes only.

## Technical Developer View

The bug was in `PostSalesReturnUseCase`. During posting, the use case copied `unitCostBase` from the draft return line or source sales invoice line. If both were zero, it immediately failed with `Missing positive inventory cost...`, even when inventory already had a valid average or last known cost for that item and warehouse.

The fix adds a small resolver in the pre-compute phase:

1. Use the return/source line cost if positive.
2. Otherwise use `StockLevel.avgCostBase` if positive.
3. Otherwise use `StockLevel.lastCostBase`.
4. If all are zero, keep throwing the existing error.

This keeps the implementation SQL-migration-ready and does not introduce Firestore-specific logic into application/domain layers.

## End-User View

When posting a Sales Return, the system can now recover the item cost from inventory if the return document shows a zero unit cost. This means valid returns can be posted without the user manually fixing hidden cost fields. If the item has never had a cost recorded, the system will still stop the posting so accounting and inventory values do not become incorrect.

## Known Issues / Follow-Ups

- The Sales Return detail page may still display `0.00` before posting if the draft was created from a source document with missing cost. Posting now repairs the stored return line cost. A future UI improvement could display the fallback cost earlier.
