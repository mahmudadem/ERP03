# Inventory Module — Execution Agent Prompt

> **SAVE THIS FILE. The executing agent should read it in full before starting.**
> **The auditing agent will use the AUDIT REPORT templates at the bottom to verify your work.**

---

## YOUR ROLE

You are an executing agent implementing the ERP Inventory module. You MUST follow the spec documents exactly. Do NOT redesign, do NOT skip fields, do NOT change algorithms. If something is ambiguous, refer to the spec docs (listed below) and make a reasonable default — document it in your audit report.

## SPEC DOCUMENTS (READ ALL BEFORE STARTING)

You MUST read these files completely before writing any code:

1. `d:\DEV2026\ERP03\docs\inventory\MASTER_PLAN.md` — System overview, invariants, ordering rules, negative stock rules, FX conversion, auditability, Firestore collection map, existing code location map.
2. `d:\DEV2026\ERP03\docs\inventory\SCHEMAS.md` — Complete field-level definitions for ALL entities: Item, StockMovement, StockLevel, ItemCategory, Warehouse, UomConversion, InventorySettings, StockAdjustment, StockTransfer. Includes constraints, enums, and index strategy.
3. `d:\DEV2026\ERP03\docs\inventory\ALGORITHMS.md` — Pseudocode for `processIN`, `processOUT`, `processTRANSFER`, `convertCosts`, and helper functions. Includes bug-fix verification checklist (B1–B5).
4. `d:\DEV2026\ERP03\docs\inventory\PHASES.md` — Phased delivery plan with file-level task breakdown, API endpoints, frontend pages, tests, and risks.

## CODEBASE PATTERNS (MUST FOLLOW)

Before implementing, study these existing patterns in the codebase:

| Pattern | Example File | What to Learn |
|---------|-------------|---------------|
| Domain entity with validation | `backend/src/domain/accounting/entities/VoucherLineEntity.ts` | Constructor validation, `roundMoney()`, `moneyEquals()`, immutability |
| FX handling | `backend/src/domain/accounting/entities/CurrencyPrecisionHelpers.ts` | `roundByCurrency()`, `calculateBaseAmount()`, `getDecimalPlaces()` |
| Exchange rate service | `backend/src/application/accounting/services/ExchangeRateService.ts` | `GetSuggestedRateUseCase`, rate lookup with inverse/fallback |
| Repository interface | `backend/src/repository/interfaces/accounting/IVoucherRepository.ts` | Method signatures, async patterns |
| Firestore repository | `backend/src/infrastructure/firestore/repositories/accounting/FirestoreLedgerRepository.ts` | `BaseFirestoreRepository`, transactions, mappers |
| Module registration | `backend/src/modules/inventory/InventoryModule.ts` | Module interface, permissions |
| DI container | `backend/src/infrastructure/di/bindRepositories.ts` | How to register new repos |
| Voucher posting (for GL integration) | `backend/src/application/accounting/use-cases/SubmitVoucherUseCase.ts` | How to create a GL voucher from another module |

## EXECUTION ORDER

Execute phases in strict order. **Do NOT skip phases.**

---

## PHASE 1A: Domain Entities (do this FIRST)

### What to implement
Create/rewrite ALL domain entity files under `backend/src/domain/inventory/entities/`:

| File | Action |
|------|--------|
| `Item.ts` | REWRITE (currently 15-line stub). Use `ItemProps` from SCHEMAS.md §1. Add constructor validation: `code` required, `costCurrency` required, `type` must be valid enum. Add `toJSON()` and `static fromJSON()`. |
| `StockMovement.ts` | REWRITE (currently 18-line stub). Use `StockMovementProps` from SCHEMAS.md §2. Constructor must validate: `qty > 0`, direction-specific fields present (OUT must have `settledQty`/`unsettledQty`; IN must have `settlesNegativeQty`/`newPositiveQty`). Add `toJSON()` and `static fromJSON()`. Include ALL enums (`MovementType`, `ReferenceType`, `CostSource`). |
| `StockLevel.ts` | NEW. Use `StockLevelProps` from SCHEMAS.md §3. Static factory `createNew(companyId, itemId, warehouseId)` with zero defaults. Include `static compositeId(itemId, warehouseId)` helper. |
| `ItemCategory.ts` | NEW. Use SCHEMAS.md §4. |
| `Warehouse.ts` | EXPAND (currently 10-line stub). Add `code`, `isDefault`, `active`, `createdAt`, `updatedAt` per SCHEMAS.md §5. |
| `UomConversion.ts` | NEW. Use SCHEMAS.md §6. |
| `InventorySettings.ts` | NEW. Use SCHEMAS.md §7. |
| `StockAdjustment.ts` | NEW. Use SCHEMAS.md §8. Include embedded `StockAdjustmentLine` interface. |
| `StockTransfer.ts` | NEW. Use SCHEMAS.md §9. Include embedded `StockTransferLine` interface. |

### Verification
After completing Phase 1A, run:
```bash
npx tsc --noEmit
```
All entity files must compile with zero errors.

### Audit Report
Write to `d:\DEV2026\ERP03\docs\inventory\AUDIT_PHASE_1A.md`:

```markdown
# Phase 1A Audit Report — Domain Entities

## Date: [YYYY-MM-DD HH:MM]

## Files Created/Modified
| File | Action | Lines | Status |
|------|--------|-------|--------|
| domain/inventory/entities/Item.ts | REWRITE | ??? | ✅/❌ |
| ... | ... | ... | ... |

## Schema Compliance Check
For EACH entity, confirm:
- [ ] All [R] (required) fields from SCHEMAS.md are present
- [ ] All enums match SCHEMAS.md exactly
- [ ] Constructor validates required fields
- [ ] toJSON() / fromJSON() round-trip works
- [ ] costCurrency immutability guard on Item (if movements exist)

## StockMovement Direction-Specific Field Check
- [ ] OUT movements require: settledQty, unsettledQty, costSettled
- [ ] IN movements require: settlesNegativeQty, newPositiveQty
- [ ] transferPairId only on TRANSFER_IN/TRANSFER_OUT
- [ ] reversesMovementId only on RETURN_IN/RETURN_OUT

## TypeScript compilation
- Compile result: [PASS/FAIL]
- Errors (if any): [list]

## Deviations from Spec
[List ANY field you added, removed, renamed, or made optional that differs from SCHEMAS.md. Explain why.]
```

---

## PHASE 1B: Repository Interfaces + Firestore Implementations

### What to implement

**Repository Interfaces** under `backend/src/repository/interfaces/inventory/`:

| File | Action | Key Methods |
|------|--------|-------------|
| `IItemRepository.ts` | EXPAND | Add: `getItemByCode(companyId, code)`, `getItemsByCategory(companyId, categoryId)`, `searchItems(companyId, query)`, `deleteItem(id)`, `hasMovements(companyId, itemId)` |
| `IWarehouseRepository.ts` | EXPAND | Add: `getWarehouseByCode(companyId, code)` |
| `IStockMovementRepository.ts` | REWRITE | Methods: `recordMovement(movement)`, `getItemMovements(companyId, itemId, opts)`, `getWarehouseMovements(companyId, warehouseId, opts)`, `getMovementsByReference(companyId, referenceType, referenceId)`, `getMovementsByDateRange(companyId, from, to, opts)`, `getUnsettledMovements(companyId)`, `getMovement(id)` |
| `IStockLevelRepository.ts` | NEW | Methods: `getLevel(companyId, itemId, warehouseId)`, `getLevelsByItem(companyId, itemId)`, `getLevelsByWarehouse(companyId, warehouseId)`, `getAllLevels(companyId)`, `upsertLevel(level)`, `getLevelInTransaction(txn, companyId, itemId, warehouseId)`, `upsertLevelInTransaction(txn, level)` |
| `IItemCategoryRepository.ts` | NEW | Standard CRUD + `getCategoriesByParent(companyId, parentId)` |
| `IUomConversionRepository.ts` | NEW | CRUD + `getConversionsForItem(companyId, itemId)` |
| `IInventorySettingsRepository.ts` | NEW | `getSettings(companyId)`, `saveSettings(settings)` |
| `IStockAdjustmentRepository.ts` | NEW | Standard CRUD + `getByStatus(companyId, status)` |
| `IStockTransferRepository.ts` | NEW | Standard CRUD + `getByStatus(companyId, status)` |

Update `backend/src/repository/interfaces/inventory/index.ts` to export ALL.

**Firestore Implementations** — split `FirestoreInventoryRepositories.ts` into individual files under `backend/src/infrastructure/firestore/repositories/inventory/`:

Each implementation must:
- Use `BaseFirestoreRepository` pattern
- Use Firestore paths from MASTER_PLAN.md §8 (`companies/{companyId}/inventory/Data/...`)
- `StockLevelRepository` must support Firestore transactions (accept `txn` parameter)
- `StockMovementRepository.recordMovement` must accept `txn` parameter for atomic writes

**Update** `backend/src/infrastructure/firestore/mappers/InventoryMappers.ts` — add mappers for ALL new entities. Handle `Date` ↔ `Timestamp` conversion.

**Update** `backend/src/infrastructure/di/bindRepositories.ts` — register ALL new repo instances.

### Verification
```bash
npx tsc --noEmit
```

### Audit Report
Write to `d:\DEV2026\ERP03\docs\inventory\AUDIT_PHASE_1B.md`:

```markdown
# Phase 1B Audit Report — Repositories & Infrastructure

## Date: [YYYY-MM-DD HH:MM]

## Files Created/Modified
| File | Action | Status |
|------|--------|--------|
| ... | ... | ... |

## Repository Interface Compliance
For EACH repository:
- [ ] All methods from spec implemented
- [ ] companyId scoping on all queries
- [ ] Pagination support on list methods (limit, offset or cursor)

## Firestore Compliance
- [ ] Collection paths match MASTER_PLAN.md §8
- [ ] StockLevelRepository supports transactions
- [ ] StockMovementRepository.recordMovement supports transactions
- [ ] All mappers handle Date ↔ Timestamp conversion
- [ ] DI container updated with all new repos

## TypeScript compilation
- Compile result: [PASS/FAIL]

## Deviations from Spec
[List any]
```

---

## PHASE 1C: Core Cost Engine — RecordStockMovementUseCase

### What to implement
This is THE critical file: `backend/src/application/inventory/use-cases/RecordStockMovementUseCase.ts`

It MUST implement the EXACT algorithms from `ALGORITHMS.md`:
- `processIN()` — §2
- `processOUT()` — §3
- `processTRANSFER()` — §4
- `convertCosts()` — §1
- `getOrCreateStockLevel()` — §6
- `deriveCostSource()` — §5

**Critical implementation rules:**
1. ALL operations on StockLevel + StockMovement MUST be inside a single Firestore transaction.
2. `postingSeq` is incremented on `StockLevel` inside the transaction and assigned to the movement.
3. `isBackdated` is evaluated using `oldMaxBusinessDate` BEFORE updating `maxBusinessDate` (Bug B1).
4. OUT: FX rate division must guard against zero (Bug B2). Use `fxRateKind = 'EFFECTIVE'`.
5. TRANSFER: source warehouse uses SAME cost-determination rules as OUT (Bug B3).
6. OUT with no prior cost: set `unsettledCostBasis = 'MISSING'`, `costSettled = false` (Bug B4).
7. OUT partial settlement: compute `settledQty`, `unsettledQty` correctly when crossing zero (Bug B5).
8. IN covering negative: compute `settlesNegativeQty`, `newPositiveQty` (Bug B5).
9. Use `roundMoney()` from `VoucherLineEntity.ts` and `roundByCurrency()` from `CurrencyPrecisionHelpers.ts`.

### Unit Tests
Create `backend/src/tests/application/inventory/RecordStockMovementUseCase.test.ts`:

**Required test cases (minimum 15):**

```
IN — Normal positive stock:
  1. IN 10 units at cost 5 → avgCost=5, qty=10
  2. IN 10 more at cost 7 → avgCost=6, qty=20 (weighted average)
  
IN — Covering negative stock:
  3. qtyBefore=-3, IN 10 → settlesNegativeQty=3, newPositiveQty=7, avgCost=incoming
  4. qtyBefore=-10, IN 5 → still negative, avgCost=incoming, settlesNegativeQty=5

OUT — Normal positive:
  5. qtyBefore=20, OUT 5 → settledQty=5, unsettledQty=0, costSettled=true
  6. Avg cost unchanged after OUT

OUT — Crossing zero:
  7. qtyBefore=2, OUT 5 → settledQty=2, unsettledQty=3, costSettled=false, qtyAfter=-3

OUT — Already negative:
  8. qtyBefore=-3, OUT 2 → settledQty=0, unsettledQty=2, uses lastCost, costSettled=false

OUT — No cost at all:
  9. First ever OUT (no IN) → unsettledCostBasis='MISSING', unitCostBase=0

Backdating:
  10. Post movement date=Jan-10 when maxBusinessDate=Jan-15 → isBackdated=true
  11. Post movement date=Jan-20 when maxBusinessDate=Jan-15 → isBackdated=false

Multi-currency:
  12. moveCurrency=USD, baseCurrency=TRY, costCurrency=USD → unitCostCCY=input, unitCostBase=input*rate
  13. moveCurrency=USD, baseCurrency=TRY, costCurrency=EUR → cross-rate through base
  14. moveCurrency=TRY (=baseCurrency), costCurrency=USD → unitCostBase=input, unitCostCCY=input/rate

Transfer:
  15. Transfer 5 from WH-A to WH-B → paired movements same cost, src qty decreases, dst qty increases
  16. Transfer from empty source (qty=0, lastCost=10) → uses lastCost
```

### Verification
```bash
npx vitest run backend/src/tests/application/inventory/RecordStockMovementUseCase.test.ts
```
ALL tests must pass.

### Audit Report
Write to `d:\DEV2026\ERP03\docs\inventory\AUDIT_PHASE_1C.md`:

```markdown
# Phase 1C Audit Report — Core Cost Engine

## Date: [YYYY-MM-DD HH:MM]

## Files Created
| File | Lines | Description |
|------|-------|-------------|
| RecordStockMovementUseCase.ts | ??? | Core cost engine |
| RecordStockMovementUseCase.test.ts | ??? | Unit tests |

## Bug Fix Verification (B1–B5)
| Fix | Test Case # | Expected | Actual | Pass? |
|-----|------------|----------|--------|-------|
| B1: Backdating flag ordering | #10, #11 | isBackdated computed from OLD maxBusinessDate | [result] | ✅/❌ |
| B2: OUT FX div-by-zero | #9 | fxRateCCYToBase=1.0, no crash | [result] | ✅/❌ |
| B3: Transfer uses OUT rules | #16 | Transfer from empty uses lastCost | [result] | ✅/❌ |
| B4: Sell before any IN | #9 | unsettledCostBasis='MISSING' | [result] | ✅/❌ |
| B5: Partial settlement | #7 | settledQty=2, unsettledQty=3 | [result] | ✅/❌ |

## Algorithm Compliance
- [ ] processIN matches ALGORITHMS.md §2 exactly
- [ ] processOUT matches ALGORITHMS.md §3 exactly
- [ ] processTRANSFER matches ALGORITHMS.md §4 exactly
- [ ] convertCosts matches ALGORITHMS.md §1 exactly
- [ ] All Firestore writes in single transaction
- [ ] roundMoney()/roundByCurrency() used (not raw Math.round)

## Test Results
- Total tests: [N]
- Passed: [N]
- Failed: [N]
- Test output: [paste vitest output]

## Deviations from Spec
[List any]
```

---

## PHASE 1D: Remaining Use Cases + API + Controller

### What to implement

**Use Cases** under `backend/src/application/inventory/use-cases/`:

| File | Use Cases Inside |
|------|-----------------|
| `ItemUseCases.ts` | REWRITE: `CreateItemUseCase`, `UpdateItemUseCase`, `GetItemUseCase`, `ListItemsUseCase`, `DeleteItemUseCase` |
| `WarehouseUseCases.ts` | EXPAND: `CreateWarehouseUseCase`, `UpdateWarehouseUseCase`, `ListWarehousesUseCase` |
| `CategoryUseCases.ts` | NEW: `ManageCategoriesUseCase` (CRUD) |
| `UomConversionUseCases.ts` | NEW: CRUD for conversions |
| `StockAdjustmentUseCases.ts` | NEW: `CreateStockAdjustmentUseCase`, `PostStockAdjustmentUseCase` (creates movements + GL voucher) |
| `StockLevelUseCases.ts` | NEW: `GetStockLevelsUseCase`, `GetInventoryValuationUseCase` |
| `MovementHistoryUseCases.ts` | NEW: paginated, filtered movement queries |
| `InitializeInventoryUseCase.ts` | NEW: create InventorySettings + default warehouse |
| `ReconcileStockUseCase.ts` | NEW: verify StockLevel.qtyOnHand == SUM(movements) |

**Controller** — REWRITE `backend/src/api/controllers/inventory/InventoryController.ts`:
- Add handlers for ALL endpoints listed in PHASES.md §1.5 (30 endpoints).
- Use proper error handling with `next(error)`.
- Extract `companyId` from `req.user.companyId`.

**DTOs** — REWRITE `backend/src/api/dtos/InventoryDTOs.ts`:
- Add DTOs for ALL entities.
- Add response wrappers.

**Validators** — EXPAND `backend/src/api/validators/inventory.validators.ts`:
- Add validation for all create/update inputs.

**Routes** — REWRITE `backend/src/api/routes/inventory.routes.ts`:
- Add ALL routes from PHASES.md §1.5.
- Use proper permission guards.

**Module** — UPDATE `backend/src/modules/inventory/InventoryModule.ts`:
- Add all new permissions.

### Verification
```bash
npx tsc --noEmit
npm start  # verify server boots without errors
# Then test 3 critical API endpoints manually:
# POST /api/inventory/items  (create item)
# POST /api/inventory/movements/opening  (opening stock)
# GET /api/inventory/stock-levels  (verify level exists)
```

### Audit Report
Write to `d:\DEV2026\ERP03\docs\inventory\AUDIT_PHASE_1D.md`:

```markdown
# Phase 1D Audit Report — Use Cases, API, Controller

## Date: [YYYY-MM-DD HH:MM]

## Files Created/Modified
| File | Action | Status |
|------|--------|--------|
| ... | ... | ... |

## Endpoint Coverage
For each endpoint in PHASES.md §1.5:
| Method | Path | Implemented? | Tested? |
|--------|------|-------------|---------|
| POST | /api/inventory/items | ✅/❌ | ✅/❌ |
| ... | ... | ... | ... |

## Integration Test: Full Lifecycle
Describe step-by-step what you tested:
1. Initialize module → [result]
2. Create warehouse → [result]
3. Create item (with costCurrency=USD) → [result]
4. Record opening stock (IN, qty=100, cost=5 USD) → [result]
5. GET stock levels → [verify qty=100, avgCostCCY=5] → [result]
6. Record adjustment out (qty=10) → [result]
7. GET stock levels → [verify qty=90] → [result]
8. Run reconciliation → [result: match/mismatch]

## Server Boot Test
- Server starts without errors: [YES/NO]
- Console errors: [list if any]

## Deviations from Spec
[List any]
```

---

## PHASE 1E: Frontend Pages

### What to implement
Follow PHASES.md §1.6 for the list of pages. Follow existing frontend patterns:
- Look at `frontend/src/modules/accounting/` for module structure patterns.
- Use existing `AccountSelector` component for COA field selectors.
- Use existing API client patterns from `frontend/src/api/accountingApi.ts`.

Create `frontend/src/api/inventoryApi.ts` — API client for ALL inventory endpoints.
Update `frontend/src/router/routes.config.ts` — add inventory routes.

### Audit Report
Write to `d:\DEV2026\ERP03\docs\inventory\AUDIT_PHASE_1E.md`:

```markdown
# Phase 1E Audit Report — Frontend

## Date: [YYYY-MM-DD HH:MM]

## Pages Created
| Page | File | Renders? | Key Features |
|------|------|----------|-------------|
| Items List | ItemsListPage.tsx | ✅/❌ | Filters, search, pagination |
| ... | ... | ... | ... |

## API Client
- File: inventoryApi.ts
- Endpoints covered: [N] / [total]

## Routes
- Routes registered: [list]

## Build Test
```bash
npm run build   # frontend build
```
- Build result: [PASS/FAIL]
- Errors: [list if any]
```

---

## FINAL RULES FOR THE EXECUTING AGENT

1. **Read ALL 4 spec docs before writing ANY code.**
2. **Execute phases in order: 1A → 1B → 1C → 1D → 1E.**
3. **After EACH phase, write the audit report BEFORE moving to the next phase.**
4. **Run `npx tsc --noEmit` after EVERY phase. Fix errors before proceeding.**
5. **The audit report is NOT optional. It is a deliverable.**
6. **If you deviate from the spec, you MUST document it in "Deviations from Spec" with justification.**
7. **Do NOT implement Sales, Purchases, or Accounting changes. Only Inventory.**
8. **Use `roundMoney()` and `roundByCurrency()` from the existing accounting module. Do NOT create your own rounding.**
9. **The `RecordStockMovementUseCase` is the MOST CRITICAL file. Spend extra time verifying it against ALGORITHMS.md.**
10. **All Firestore writes for stock movements MUST be in a single transaction (StockLevel + StockMovement atomically).**
