# Phase 1 — Sales Orders + Settings — Execution Prompt

> **Work non-stop until all tasks are complete.**

## Context
The Purchase module (Phases 0–3) is complete. The following shared services already exist and should NOT be reimplemented:
- `Party` entity (supports CUSTOMER role), repository, use cases, API
- `TaxCode` entity (supports `SALES`/`BOTH` scope), repository, use cases, API
- `Item` entity with `defaultSalesTaxCodeId`
- All shared API endpoints (`/tenant/shared/parties`, `/tenant/shared/tax-codes`)
- `ISalesInventoryService` interface (in `InventoryIntegrationContracts.ts`)

**Read these spec docs first:**
1. `d:\DEV2026\ERP03\docs\sales\MASTER_PLAN.md` — Business rules S1–S17
2. `d:\DEV2026\ERP03\docs\sales\SCHEMAS.md` — SalesSettings (§SL1), SalesOrder (§SL2)
3. `d:\DEV2026\ERP03\docs\sales\ALGORITHMS.md` — SO status machine (§2), doc numbering (§1)
4. `d:\DEV2026\ERP03\docs\sales\PHASES.md` — Phase 1 section

**Also study the Purchase module implementation for patterns to follow:**
- `backend/src/modules/purchase/PurchaseModule.ts` — module registration pattern
- `backend/src/domain/purchases/entities/PurchaseSettings.ts` — entity pattern
- `backend/src/domain/purchases/entities/PurchaseOrder.ts` — order entity pattern
- `backend/src/application/purchases/use-cases/PurchaseOrderUseCases.ts` — use case pattern
- `backend/src/api/controllers/purchases/PurchaseController.ts` — controller pattern
- `frontend/src/api/purchasesApi.ts` — API client pattern
- `frontend/src/modules/purchases/pages/` — page patterns

**DB-agnostic rule:** Domain entities and use cases must have ZERO imports from `firebase-admin`. All DB access goes through repository interfaces.

---

## TASK 1A: Shared Prerequisites

### Item Entity Extension
Add two optional fields to `backend/src/domain/inventory/entities/Item.ts`:
```typescript
revenueAccountId?: string;    // Override default revenue account
cogsAccountId?: string;       // Override default COGS account
```
Update `toJSON()`, `fromJSON()`, and any relevant DTOs/frontend forms.

### Customer Frontend Pages
Create (mirroring VendorsListPage/VendorDetailPage):
- `frontend/src/modules/sales/pages/CustomersListPage.tsx` — list Parties with CUSTOMER role
- `frontend/src/modules/sales/pages/CustomerDetailPage.tsx` — create/edit customer
Use existing `sharedApi` party endpoints, filter by role='CUSTOMER'.

### SalesInventoryService Implementation
Create `backend/src/application/inventory/services/SalesInventoryService.ts`:
- Implements `ISalesInventoryService` from `InventoryIntegrationContracts.ts`
- `processOUT()` — wraps `RecordStockMovementUseCase` for SALES_DELIVERY OUT movements
- `processIN()` — wraps `RecordStockMovementUseCase` for RETURN_IN movements
- Follow the exact pattern of `PurchasesInventoryService.ts`

### ReferenceType Extensions
Update `backend/src/domain/inventory/entities/StockMovement.ts`:
Add to `ReferenceType`: `'SALES_ORDER'`, `'DELIVERY_NOTE'`, `'SALES_RETURN'` (if not already present).

### Verification
```bash
cd d:\DEV2026\ERP03\backend && npx tsc --noEmit
```

---

## TASK 1B: Domain Entities

### SalesSettings
Create `backend/src/domain/sales/entities/SalesSettings.ts`:
- Use `SalesSettingsProps` from SCHEMAS.md §SL1.
- Constructor: validate `defaultARAccountId` required, `defaultRevenueAccountId` required, `salesControlMode` must be 'SIMPLE' or 'CONTROLLED'.
- When mode is 'CONTROLLED', force `requireSOForStockItems = true`.
- Include numbering fields with defaults (prefix 'SO', 'DN', 'SI', 'SR', seq 1).
- Include `toJSON()` and `static fromJSON()`.

### SalesOrder + SalesOrderLine
Create `backend/src/domain/sales/entities/SalesOrder.ts`:
- Use `SalesOrderProps` and `SalesOrderLine` from SCHEMAS.md §SL2.
- Constructor validates: `customerId` required, `lines` at least 1, `currency` required, `exchangeRate > 0`.
- Each line: `itemId` required, `orderedQty > 0`, `unitPriceDoc >= 0`.
- `deliveredQty`, `invoicedQty`, `returnedQty` default to 0.
- Tax fields: `taxRate` defaults to 0, `taxAmountDoc = lineTotalDoc * taxRate`.
- Computed totals: `subtotalDoc`, `taxTotalDoc`, `grandTotalDoc` + base equivalents.
- Status defaults to `DRAFT`.
- Export `SOStatus` type.
- Include `toJSON()` and `static fromJSON()`.

### Verification
```bash
npx tsc --noEmit
```

---

## TASK 1C: Repository Interfaces + Firestore

### Repository Interfaces
Create under `backend/src/repository/interfaces/sales/`:

| File | Key Methods |
|------|-------------|
| `ISalesSettingsRepository.ts` | `getSettings(companyId)`, `saveSettings(settings)` |
| `ISalesOrderRepository.ts` | `create(so)`, `update(so)`, `getById(companyId, id)`, `getByNumber(companyId, orderNumber)`, `list(companyId, opts: { status?, customerId?, limit?, offset? })`, `delete(companyId, id)` |

### Firestore Implementations
Create under `backend/src/infrastructure/firestore/repositories/sales/`:

| File | Firestore Path |
|------|---------------|
| `FirestoreSalesSettingsRepository.ts` | `companies/{companyId}/sales/settings` (single doc) |
| `FirestoreSalesOrderRepository.ts` | `companies/{companyId}/sales/Data/sales_orders/{id}` |

### Mappers
Create `backend/src/infrastructure/firestore/mappers/SalesMappers.ts`.

### DI Registration
Update `backend/src/infrastructure/di/bindRepositories.ts`.

---

## TASK 1D: Use Cases

### SalesSettings Use Cases
Create `backend/src/application/sales/use-cases/SalesSettingsUseCases.ts`:

```
InitializeSalesUseCase:
  - Accept: companyId, defaultARAccountId, defaultRevenueAccountId, salesControlMode, optional fields
  - Create SalesSettings with defaults
  - If mode is CONTROLLED, force requireSOForStockItems = true
  - Save
  - Return settings

GetSalesSettingsUseCase:
  - Load for companyId, return null if not initialized

UpdateSalesSettingsUseCase:
  - Load existing, validate mode switch rules, save
```

### SalesOrder Use Cases
Create `backend/src/application/sales/use-cases/SalesOrderUseCases.ts`:

```
CreateSalesOrderUseCase:
  - Load SalesSettings
  - Load customer (Party) — validate exists and has 'CUSTOMER' role
  - For each line:
    - Load Item — validate exists
    - Snapshot: itemCode, itemName, itemType, trackInventory
    - Apply tax defaults: if item.defaultSalesTaxCodeId, load TaxCode, set line.taxCodeId + taxRate
    - Compute: lineTotalDoc, lineTotalBase, taxAmountDoc, taxAmountBase
  - Generate orderNumber using generateDocumentNumber(settings, 'SO')
  - Create SalesOrder with status='DRAFT'
  - Save + save settings (incremented seq)
  - Snapshot customerName from Party.displayName

UpdateSalesOrderUseCase:
  - ASSERT status === 'DRAFT'
  - Recalculate totals, save

ConfirmSalesOrderUseCase:
  - ASSERT status === 'DRAFT', lines.length > 0
  - Set status='CONFIRMED', confirmedAt=now()

CancelSalesOrderUseCase:
  - ASSERT status in ['DRAFT', 'CONFIRMED']
  - ASSERT all lines have deliveredQty === 0 && invoicedQty === 0
  - Set status='CANCELLED'

CloseSalesOrderUseCase:
  - ASSERT status in ['CONFIRMED', 'PARTIALLY_DELIVERED', 'FULLY_DELIVERED']
  - Set status='CLOSED', closedAt=now()

GetSalesOrderUseCase / ListSalesOrdersUseCase:
  - Standard get/list
```

---

## TASK 1E: API Controller + Routes + Module Registration

### Module Registration
Create `backend/src/modules/sales/SalesModule.ts` following the `PurchaseModule.ts` pattern.
Register in `backend/src/modules/index.ts`.

### Controller
Create `backend/src/api/controllers/sales/SalesController.ts`:

| Handler | Method | Path |
|---------|--------|------|
| initializeSales | POST | /api/sales/initialize |
| getSettings | GET | /api/sales/settings |
| updateSettings | PUT | /api/sales/settings |
| createSO | POST | /api/sales/orders |
| listSOs | GET | /api/sales/orders |
| getSO | GET | /api/sales/orders/:id |
| updateSO | PUT | /api/sales/orders/:id |
| confirmSO | POST | /api/sales/orders/:id/confirm |
| cancelSO | POST | /api/sales/orders/:id/cancel |
| closeSO | POST | /api/sales/orders/:id/close |

### Routes
Create `backend/src/api/routes/sales.routes.ts`.

### DTOs + Validators
Create `backend/src/api/dtos/SalesDTOs.ts` and `backend/src/api/validators/sales.validators.ts`.

---

## TASK 1F: Frontend

### API Client
Create `frontend/src/api/salesApi.ts`:
```typescript
// Settings
initializeSales(payload): Promise<SalesSettingsDTO>
getSettings(): Promise<SalesSettingsDTO | null>
updateSettings(payload): Promise<SalesSettingsDTO>

// Sales Orders
createSO(payload): Promise<SalesOrderDTO>
updateSO(id, payload): Promise<SalesOrderDTO>
getSO(id): Promise<SalesOrderDTO>
listSOs(opts?): Promise<SalesOrderDTO[]>
confirmSO(id): Promise<SalesOrderDTO>
cancelSO(id): Promise<SalesOrderDTO>
closeSO(id): Promise<SalesOrderDTO>
```

### Sales Home Page
Create `frontend/src/modules/sales/pages/SalesHomePage.tsx`:
- If settings not initialized → show initialization wizard
- Wizard steps: 1) Select sales mode, 2) Set default AR + Revenue accounts, 3) Configure numbering/defaults
- After initialization → show Sales dashboard (placeholder KPIs)

### SO List Page
Create `frontend/src/modules/sales/pages/SalesOrdersListPage.tsx`:
- Table: orderNumber, customerName, orderDate, grandTotalDoc, currency, status
- Status filter, "New SO" button

### SO Detail Page
Create `frontend/src/modules/sales/pages/SalesOrderDetailPage.tsx`:
- Header: order number, customer selector, order date, expected delivery, currency, exchange rate
- Line items: item selector, qty, unit price (selling price), tax code, totals
- Action buttons: Save, Confirm, Cancel, Close (based on status)
- DRAFT: "Deliver Goods" (disabled — Phase 2), "Create Invoice" (disabled — Phase 2)

### Sales Settings Page
Create `frontend/src/modules/sales/pages/SalesSettingsPage.tsx`:
- Sales mode selector, AR/Revenue/COGS account selectors, tolerances, numbering

### Sidebar + Routes
Update `frontend/src/config/moduleMenuMap.ts` — add 'sales' module.
Update `frontend/src/router/routes.config.ts`:
- `/sales` → SalesHomePage
- `/sales/customers` → CustomersListPage
- `/sales/customers/:id` → CustomerDetailPage
- `/sales/orders` → SalesOrdersListPage
- `/sales/orders/:id` → SalesOrderDetailPage
- `/sales/settings` → SalesSettingsPage

---

## Verification

```bash
cd d:\DEV2026\ERP03\backend && npx tsc --noEmit
cd d:\DEV2026\ERP03\frontend && npm run build
```

---

## Audit Report

Write to `d:\DEV2026\ERP03\docs\sales\AUDIT_PHASE_1.md`:

```markdown
# Phase 1 Audit Report — Sales Orders + Settings

## Date: [YYYY-MM-DD HH:MM]

## Shared Prerequisites
- [ ] Item entity extended with revenueAccountId, cogsAccountId
- [ ] SalesInventoryService implemented
- [ ] ReferenceType extended
- [ ] Customer pages created

## Domain Entities
| Entity | File | Fields match SCHEMAS.md? |
|--------|------|------------------------|
| SalesSettings | SalesSettings.ts | ✅/❌ |
| SalesOrder | SalesOrder.ts | ✅/❌ |

- [ ] SO validates lines not empty
- [ ] SO line computes totals correctly
- [ ] Tax defaults applied from Item.defaultSalesTaxCodeId
- [ ] CONTROLLED mode forces requireSOForStockItems = true

## API Endpoints
| Method | Path | Status |
|--------|------|--------|
| POST | /api/sales/initialize | ✅/❌ |
| GET | /api/sales/settings | ✅/❌ |
| PUT | /api/sales/settings | ✅/❌ |
| POST | /api/sales/orders | ✅/❌ |
| GET | /api/sales/orders | ✅/❌ |
| GET | /api/sales/orders/:id | ✅/❌ |
| PUT | /api/sales/orders/:id | ✅/❌ |
| POST | /api/sales/orders/:id/confirm | ✅/❌ |
| POST | /api/sales/orders/:id/cancel | ✅/❌ |
| POST | /api/sales/orders/:id/close | ✅/❌ |

## Frontend
| Page | File | Renders? |
|------|------|---------|
| Customers List | CustomersListPage.tsx | ✅/❌ |
| Customer Detail | CustomerDetailPage.tsx | ✅/❌ |
| Sales Home + Wizard | SalesHomePage.tsx | ✅/❌ |
| SO List | SalesOrdersListPage.tsx | ✅/❌ |
| SO Detail | SalesOrderDetailPage.tsx | ✅/❌ |
| Settings | SalesSettingsPage.tsx | ✅/❌ |

## Compile & Build
- Backend tsc: [PASS/FAIL]
- Frontend build: [PASS/FAIL]

## Deviations from Spec
[List any]
```

---

## FINAL RULES

1. **Read ALL spec docs before writing ANY code.**
2. **Execute tasks in order: 1A → 1B → 1C → 1D → 1E → 1F.**
3. **Study the Purchase module implementation as a reference. Follow the exact same patterns.**
4. **SO has NO inventory or accounting effects. Rule S3.**
5. **Reuse existing Party and TaxCode services. Do NOT recreate them.**
6. **Snapshot customer name and item details on SO creation.**
7. **Document numbering must persist the incremented sequence back to SalesSettings.**
8. **The SalesModule registration must follow the PurchaseModule pattern exactly.**
9. **Do NOT implement DN, SI, or SR. Only SO + Settings + shared prerequisites.**
10. **Run `npx tsc --noEmit` after each task. Fix errors before proceeding.**
