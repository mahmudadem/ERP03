# Phase 3 — Sales/Purchases Integration Hooks — Execution Prompt

> **Work non-stop until all tasks are complete.**

## Context
Phase 1 and 2 are absolutely complete and audited. We are now preparing the Inventory module to be seamlessly consumed by the upcoming Sales and Purchases modules. 

**Read these spec docs first:**
1. `d:\DEV2026\ERP03\docs\inventory\PHASES.md` — Phase 3 section

**DB-agnostic rule:** Domain entities and use cases must have ZERO imports from `firebase-admin`. All DB access goes through repository interfaces + `ITransactionManager`.

---

## TASK 3A: Integration Contracts

Sales and Purchases will not interact with Inventory repositories directly. They will call your Use Cases. We need to formalize these interfaces.

**File:** Create `backend/src/application/inventory/contracts/InventoryIntegrationContracts.ts`
- Export TypeScript interfaces documenting the strict input/output shapes for `RecordStockMovementUseCase.processIN` and `processOUT`.
- The existing interfaces (`ProcessINInput`, `ProcessOUTInput`) inside `RecordStockMovementUseCase.ts` are fine, but we want a dedicated file that external modules can import to know exactly what to provide when recording a sale or purchase.
- Export an interface `ISalesInventoryService` representing the subset of methods Sales needs.
- Export an interface `IPurchasesInventoryService` representing the subset of methods Purchases needs.

---

## TASK 3B: Reserved Quantity Management

Sales orders (before delivery) will reserve stock.

**Use Cases** — NEW file `backend/src/application/inventory/use-cases/StockReservationUseCases.ts`:
- `ReserveStockUseCase`: Accepts `companyId, itemId, warehouseId, qty`. Increases `reservedQty` on `StockLevel`.
- `ReleaseReservedStockUseCase`: Decreases `reservedQty` on `StockLevel`.
- **Note:** Do NOT allow reservedQty to drop below 0. 

**API Endpoints** — Add to `inventory.routes.ts`:
```
POST /api/inventory/stock-levels/reserve       → reserveStock
POST /api/inventory/stock-levels/release       → releaseStock
```

---

## TASK 3C: Cost Query Service

Sales needs to know the current average cost of an item BEFORE selling it (for margin estimates).

**Use Case** — NEW file `backend/src/application/inventory/use-cases/CostQueryUseCases.ts`:
- `GetCurrentCostUseCase(companyId, itemId, warehouseId)`
  - Re-use the logic from `processOUT` to determine cost basis.
  - Returns: `{ qtyOnHand, avgCostBase, avgCostCCY, lastCostBase, lastCostCCY, costBasis: 'AVG' | 'LAST_KNOWN' | 'MISSING' }`

**API Endpoint** — Add to `inventory.routes.ts`:
```
GET /api/inventory/costs/current     → getCurrentCost (?itemId=...&warehouseId=...)
```

---

## TASK 3D: Reference Query Service

When a Sales Invoice is posted, it needs to find exactly the `StockMovement` it just generated to read the `totalCostBase` and compute the invoice's profit.

**Repository Update:** 
- Add `getMovementByReference(companyId, referenceType, referenceId, referenceLineId): Promise<StockMovement | null>` to `IStockMovementRepository` and implement it in `FirestoreStockMovementRepository`.

**Use Case** — Add to `MovementHistoryUseCases.ts` or a new file `ReferenceQueryUseCases.ts`:
- `GetMovementForReferenceUseCase(companyId, referenceType, referenceId, referenceLineId)`

**API Endpoint** — Add to `inventory.routes.ts`:
```
GET /api/inventory/movements/by-reference    → getMovementByReference
```

---

## TASK 3E: Comprehensive Reconciliation

Expand the placeholder `ReconcileStockUseCase` (or create it if missing up to now) in `backend/src/application/inventory/use-cases/ReconcileStockUseCase.ts`.

- Currently, naive reconciliation just checks `SUM(-out + in) == qtyOnHand`.
- **Upgrade it:** Replay ALL movements for an item/warehouse from the beginning of time.
- Verify NOT JUST `qtyOnHand`, but ALSO `avgCostBase` and `avgCostCCY`.
- Throw or return a detailed mismatch payload if the computed rolling average diverges from the `StockLevel`'s stored average.
- This proves the cost engine is mathematically sound.

---

## Verification

After ALL tasks are done:

```bash
# Backend compile
cd d:\DEV2026\ERP03\backend && npx tsc --noEmit

# Unit tests
npx vitest run backend/src/tests/application/inventory/
```

All must pass.

---

## Audit Report

Write to `d:\DEV2026\ERP03\docs\inventory\AUDIT_PHASE_3.md`:

```markdown
# Phase 3 Audit Report — Integration Hooks

## Date: [YYYY-MM-DD HH:MM]

## Task 3A: Contracts
- Integration contracts file created: [YES/NO]

## Task 3B: Reservations
- Reserve/Release use cases implemented: [YES/NO]
- Endpoints added: [YES/NO]

## Task 3C: Cost Query
- GetCurrentCostUseCase implemented: [YES/NO]

## Task 3D: Reference Query
- getMovementByReference implemented on repo: [YES/NO]

## Task 3E: Comprehensive Reconciliation
- ReconcileStockUseCase expanded to check `avgCostBase/CCY`: [YES/NO]

## Compile & Test
- Backend tsc: [PASS/FAIL]
- vitest: [N passed / N total]
```
