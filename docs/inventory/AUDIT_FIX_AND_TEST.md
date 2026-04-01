# Audit Fix & Real-World Test Report
## Date: 2026-03-07 09:22
## Fix 1: Adjustment GL Voucher
- File modified: `backend/src/application/inventory/use-cases/StockAdjustmentUseCases.ts`
- Voucher creation: REAL
- Debit account: `item.cogsAccountId` for `ADJUSTMENT_OUT`; `item.inventoryAssetAccountId` for `ADJUSTMENT_IN`
- Credit account: `item.inventoryAssetAccountId` for `ADJUSTMENT_OUT`; `item.cogsAccountId` for `ADJUSTMENT_IN`
- Fallback when no accounts: voucher creation is skipped and warning is logged (posting does not crash)

## Fix 2: Item.fromJSON costCurrency
- Verified: costCurrency has no hardcoded fallback: YES

## Compile & Test
- `npx tsc --noEmit`: PASS
- `npx vitest run`: 16 passed / 16 total

## Runtime Test
- Server boots: YES (backend restarted via `npm start`; functions served on `http://127.0.0.1:5002/...` because port 5001 was already occupied)
- Create warehouse: SUCCESS (`warehouseId=9998e5b3-9413-416f-8562-c315d1bc4b75`)
- Create item: SUCCESS (`itemId=d6154b5e-b718-41e9-8a18-a811b870a27b`, `costCurrency=USD`)
- Opening stock: SUCCESS (`openingMovementId=sm_1772864523195_mwi31l`, qty=100, unit cost=5)
- Stock levels correct: YES (`qtyOnHand=100`, `avgCostBase=5`)
- Adjustment posted: SUCCESS (`adjustmentId=fac4e07e-298e-4d9a-bcbe-942d6b7f2200`, status=POSTED)
- GL voucher created: YES (`voucherId=80146d30-58d7-447a-ae5e-69d09d27baf9`, voucher lookup succeeded)
- Stock levels after adjustment: `qtyOnHand=90`, `avgCostBase=5`

## Issues Found
- Runtime bug found and fixed: inventory controller static handlers used `this.*`, causing `TypeError: Cannot read properties of undefined (reading 'getCompanyId')` under Express route execution.
- Runtime bug found and fixed: Firestore persistence failed on undefined optional inventory fields; inventory mappers now strip undefined values before writes.
- Non-blocking environment warning: restarted backend functions emulator used port 5002 because 5001 was already in use.
