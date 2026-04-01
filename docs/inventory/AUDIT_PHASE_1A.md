# Phase 1A Audit Report — Domain Entities

## Date: 2026-03-07 02:42

## Files Created/Modified
| File | Action | Lines | Status |
|------|--------|-------|--------|
| domain/inventory/entities/Item.ts | REWRITE | 183 | ✅ |
| domain/inventory/entities/StockMovement.ts | REWRITE | 358 | ✅ |
| domain/inventory/entities/StockLevel.ts | NEW | 153 | ✅ |
| domain/inventory/entities/ItemCategory.ts | NEW | 62 | ✅ |
| domain/inventory/entities/Warehouse.ts | EXPAND | 68 | ✅ |
| domain/inventory/entities/UomConversion.ts | NEW | 57 | ✅ |
| domain/inventory/entities/InventorySettings.ts | NEW | 72 | ✅ |
| domain/inventory/entities/StockAdjustment.ts | NEW | 124 | ✅ |
| domain/inventory/entities/StockTransfer.ts | NEW | 117 | ✅ |

## Schema Compliance Check
For EACH entity, confirm:
- [x] All [R] (required) fields from SCHEMAS.md are present
- [x] All enums match SCHEMAS.md exactly
- [x] Constructor validates required fields
- [x] toJSON() / fromJSON() round-trip works
- [x] costCurrency immutability guard on Item (if movements exist)

## StockMovement Direction-Specific Field Check
- [x] OUT movements require: settledQty, unsettledQty, costSettled
- [x] IN movements require: settlesNegativeQty, newPositiveQty
- [x] transferPairId only on TRANSFER_IN/TRANSFER_OUT
- [x] reversesMovementId only on RETURN_IN/RETURN_OUT

## TypeScript compilation
- Compile result: PASS
- Command run: `npx tsc --noEmit` (executed in `backend/` workspace)
- Errors (if any): none

## Deviations from Spec
- `Item.assertCostCurrencyChangeAllowed(newCurrency, hasMovements)` is implemented as an explicit domain guard method. The movement-existence check itself remains in use-case/repository flow (Phase 1D), not inside entity constructor.
- `Item.fromJSON()` defaulted missing `costCurrency` to `USD` and missing `trackInventory` to `type !== 'SERVICE'` for backward compatibility with existing legacy records during transition.
- Root-level `npx tsc --noEmit` could not run because the root workspace lacks a local TypeScript toolchain; phase compile check was run in `backend/` where the TypeScript project is defined.