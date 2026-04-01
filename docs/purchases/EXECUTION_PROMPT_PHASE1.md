# Phase 1 — Purchase Orders + Settings — Execution Prompt

> **Work non-stop until all tasks are complete.**

## Context
Phase 0 is complete and audited. The following already exist and should NOT be reimplemented:
- `Party` entity, repository, use cases, API, frontend pages
- `TaxCode` entity, repository, use cases, API, frontend pages
- `Item` entity with `defaultPurchaseTaxCodeId` and `defaultSalesTaxCodeId`
- All shared API endpoints (`/api/shared/parties`, `/api/shared/tax-codes`)

**Read these spec docs first:**
1. `d:\DEV2026\ERP03\docs\purchases\MASTER_PLAN.md` — Business rules R1–R19
2. `d:\DEV2026\ERP03\docs\purchases\SCHEMAS.md` — PurchaseSettings (§P1), PurchaseOrder (§P2)
3. `d:\DEV2026\ERP03\docs\purchases\ALGORITHMS.md` — PO status machine (§1), doc numbering (§6), tax defaults (§9)
4. `d:\DEV2026\ERP03\docs\purchases\PHASES.md` — Phase 1 section

**DB-agnostic rule:** Domain entities and use cases must have ZERO imports from `firebase-admin`. All DB access goes through repository interfaces.

---

## TASK 1A: Domain Entities

### PurchaseSettings
Create `backend/src/domain/purchases/entities/PurchaseSettings.ts`:
- Use `PurchaseSettingsProps` from SCHEMAS.md §P1.
- Constructor: validate `defaultAPAccountId` required, `procurementControlMode` must be 'SIMPLE' or 'CONTROLLED'.
- When mode is 'CONTROLLED', force `requirePOForStockItems = true`.
- Include numbering fields with defaults (prefix 'PO', seq 1, etc.).
- Include `toJSON()` and `static fromJSON()`.

### PurchaseOrder + PurchaseOrderLine
Create `backend/src/domain/purchases/entities/PurchaseOrder.ts`:
- Use `PurchaseOrderProps` and `PurchaseOrderLine` from SCHEMAS.md §P2.
- Constructor validates: `vendorId` required, `lines` must have at least 1 entry, `currency` required, `exchangeRate > 0`.
- Each line: `itemId` required, `orderedQty > 0`, `unitPriceDoc >= 0`.
- `receivedQty`, `invoicedQty`, `returnedQty` default to 0.
- Tax fields: `taxRate` defaults to 0, `taxAmountDoc` computed as `lineTotalDoc * taxRate`.
- Computed totals: `subtotalDoc`, `taxTotalDoc`, `grandTotalDoc` + base equivalents.
- Status defaults to `DRAFT`.
- Export `POStatus` type.
- Include `toJSON()` and `static fromJSON()`.

### Verification
```bash
npx tsc --noEmit
```

---

## TASK 1B: Repository Interfaces + Firestore

### Repository Interfaces
Create under `backend/src/repository/interfaces/purchases/`:

| File | Key Methods |
|------|-------------|
| `IPurchaseSettingsRepository.ts` | `getSettings(companyId)`, `saveSettings(settings)` |
| `IPurchaseOrderRepository.ts` | `create(po)`, `update(po)`, `getById(companyId, id)`, `getByNumber(companyId, orderNumber)`, `list(companyId, opts: { status?, vendorId?, limit?, offset? })`, `delete(companyId, id)` |

### Firestore Implementations
Create under `backend/src/infrastructure/firestore/repositories/purchases/`:

| File | Firestore Path |
|------|---------------|
| `FirestorePurchaseSettingsRepository.ts` | `companies/{companyId}/purchases/settings` (single doc) |
| `FirestorePurchaseOrderRepository.ts` | `companies/{companyId}/purchases/Data/purchase_orders/{id}` |

### DI Registration
Update `backend/src/infrastructure/di/bindRepositories.ts` with both new repos.

---

## TASK 1C: Use Cases

### PurchaseSettings Use Cases
Create `backend/src/application/purchases/use-cases/PurchaseSettingsUseCases.ts`:

```
InitializePurchasesUseCase:
  - Accept: companyId, defaultAPAccountId, procurementControlMode, optional fields
  - Create PurchaseSettings with defaults (per SCHEMAS.md §P1)
  - If mode is CONTROLLED, force requirePOForStockItems = true
  - Save to IPurchaseSettingsRepository
  - Return settings

GetPurchaseSettingsUseCase:
  - Load settings for companyId
  - Return null if not initialized (caller can redirect to wizard)

UpdatePurchaseSettingsUseCase:
  - Load existing settings
  - Validate: if switching to CONTROLLED, force requirePOForStockItems = true
  - Update and save
```

### PurchaseOrder Use Cases
Create `backend/src/application/purchases/use-cases/PurchaseOrderUseCases.ts`:

```
CreatePurchaseOrderUseCase:
  - Load PurchaseSettings for companyId
  - Load vendor (Party) — validate exists and has 'VENDOR' role
  - For each line:
    - Load Item — validate exists
    - Snapshot: itemCode, itemName, itemType, trackInventory
    - Apply tax defaults (ALGORITHMS.md §9): if item.defaultPurchaseTaxCodeId, load TaxCode, set line.taxCodeId + taxRate
    - Compute: lineTotalDoc = orderedQty × unitPriceDoc, lineTotalBase = lineTotalDoc × exchangeRate
    - Compute: taxAmountDoc = lineTotalDoc × taxRate, taxAmountBase = lineTotalBase × taxRate
  - Generate orderNumber using generateDocumentNumber(settings, 'PO') — see ALGORITHMS.md §6
  - Create PurchaseOrder entity with status='DRAFT'
  - Save to IPurchaseOrderRepository
  - Save updated settings (incremented sequence)
  - Snapshot vendorName from Party.displayName

UpdatePurchaseOrderUseCase:
  - ASSERT status === 'DRAFT'
  - Recalculate totals on line changes
  - Save

ConfirmPurchaseOrderUseCase:
  - ASSERT status === 'DRAFT'
  - ASSERT lines.length > 0
  - Set status = 'CONFIRMED', confirmedAt = now()
  - Save

CancelPurchaseOrderUseCase:
  - ASSERT status in ['DRAFT', 'CONFIRMED']
  - ASSERT all lines have receivedQty === 0 && invoicedQty === 0
  - Set status = 'CANCELLED'
  - Save

ClosePurchaseOrderUseCase:
  - ASSERT status in ['CONFIRMED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED']
  - Set status = 'CLOSED', closedAt = now()
  - Save

GetPurchaseOrderUseCase:
  - Load by ID, throw 404 if not found

ListPurchaseOrdersUseCase:
  - Filter by status, vendorId, date range
  - Paginated
```

---

## TASK 1D: API Controller + Routes

### Controller
Create `backend/src/api/controllers/purchases/PurchaseController.ts`:

| Handler | Method | Path |
|---------|--------|------|
| initializePurchases | POST | /api/purchases/initialize |
| getSettings | GET | /api/purchases/settings |
| updateSettings | PUT | /api/purchases/settings |
| createPO | POST | /api/purchases/orders |
| listPOs | GET | /api/purchases/orders |
| getPO | GET | /api/purchases/orders/:id |
| updatePO | PUT | /api/purchases/orders/:id |
| confirmPO | POST | /api/purchases/orders/:id/confirm |
| cancelPO | POST | /api/purchases/orders/:id/cancel |
| closePO | POST | /api/purchases/orders/:id/close |

### Routes
Create `backend/src/api/routes/purchases.routes.ts` with all routes above.
Register in the main app (same pattern as inventory routes).

### DTOs
Create `backend/src/api/dtos/PurchaseDTOs.ts`:
- `PurchaseSettingsDTO`, `PurchaseOrderDTO`, `PurchaseOrderLineDTO`
- Response wrappers

### Validators
Create `backend/src/api/validators/purchases.validators.ts`:
- Validate create/update inputs for PO

---

## TASK 1E: Frontend — Purchase Module Pages

### API Client
Create `frontend/src/api/purchasesApi.ts`:
```typescript
// Settings
initializePurchases(payload): Promise<PurchaseSettingsDTO>
getSettings(): Promise<PurchaseSettingsDTO | null>
updateSettings(payload): Promise<PurchaseSettingsDTO>

// Purchase Orders
createPO(payload): Promise<PurchaseOrderDTO>
updatePO(id, payload): Promise<PurchaseOrderDTO>
getPO(id): Promise<PurchaseOrderDTO>
listPOs(opts?): Promise<PurchaseOrderDTO[]>
confirmPO(id): Promise<PurchaseOrderDTO>
cancelPO(id): Promise<PurchaseOrderDTO>
closePO(id): Promise<PurchaseOrderDTO>
```

### Purchase Home Page
Rewrite `frontend/src/modules/purchase/pages/PurchaseHomePage.tsx` (or `purchases` — check existing path):
- If settings not initialized → show initialization wizard (same pattern as Inventory: `InventoryInitializationWizard.tsx`)
- Wizard steps: 1) Select procurement mode, 2) Set default AP account, 3) Configure numbering/defaults
- After initialization → show Purchase dashboard (placeholder KPIs for now)

### PO List Page
Create `frontend/src/modules/purchases/pages/PurchaseOrdersListPage.tsx`:
- Table: orderNumber, vendorName, orderDate, grandTotalDoc, currency, status
- Status filter tabs/dropdown
- "New PO" button
- Click row → navigate to detail

### PO Detail Page
Create `frontend/src/modules/purchases/pages/PurchaseOrderDetailPage.tsx`:
- Header: order number, vendor selector, order date, expected delivery, currency, exchange rate
- Line items table: item selector, qty, unit price, tax code selector, totals
- Add/remove lines
- Computed totals: subtotal, tax, grand total (both doc and base currency)
- Action buttons based on status:
  - DRAFT: Save, Confirm, Delete
  - CONFIRMED: Receive Goods (disabled — Phase 2), Create Invoice (disabled — Phase 2), Cancel, Close
  - Others: read-only
- Status badge

### Purchase Settings Page
Create `frontend/src/modules/purchases/pages/PurchaseSettingsPage.tsx`:
- Procurement mode selector (SIMPLE / CONTROLLED)
- AP account selector
- Expense account selector
- Tolerance settings
- Payment terms default
- Numbering configuration

### Sidebar
Update `frontend/src/config/moduleMenuMap.ts`:
- Add 'purchases' module with menu items: Vendors, Purchase Orders, (GRN — Phase 2), (Invoices — Phase 2), (Returns — Phase 3), Settings

### Routes
Update `frontend/src/router/routes.config.ts`:
- `/purchases` → PurchaseHomePage
- `/purchases/orders` → PurchaseOrdersListPage
- `/purchases/orders/:id` → PurchaseOrderDetailPage
- `/purchases/settings` → PurchaseSettingsPage

---

## Verification

```bash
# Backend compile
cd d:\DEV2026\ERP03\backend
npx tsc --noEmit

# Frontend build
cd d:\DEV2026\ERP03\frontend
npm run build
```

---

## Audit Report

Write to `d:\DEV2026\ERP03\docs\purchases\AUDIT_PHASE_1.md`:

```markdown
# Phase 1 Audit Report — Purchase Orders + Settings

## Date: [YYYY-MM-DD HH:MM]

## Domain Entities
| Entity | File | Fields match SCHEMAS.md? |
|--------|------|------------------------|
| PurchaseSettings | PurchaseSettings.ts | ✅/❌ |
| PurchaseOrder | PurchaseOrder.ts | ✅/❌ |

- [ ] PO validates lines not empty
- [ ] PO line computes totals correctly
- [ ] Tax defaults applied from Item.defaultPurchaseTaxCodeId
- [ ] CONTROLLED mode forces requirePOForStockItems = true

## Repositories
- [ ] IPurchaseSettingsRepository created
- [ ] IPurchaseOrderRepository created
- [ ] Firestore implementations created
- [ ] DI container updated

## Use Cases
- [ ] PO CRUD lifecycle works (create → update → confirm → cancel)
- [ ] Close PO works
- [ ] Document numbering generates correct format (PO-00001)
- [ ] Tax defaults applied from item

## API Endpoints
| Method | Path | Status |
|--------|------|--------|
| POST | /api/purchases/initialize | ✅/❌ |
| GET | /api/purchases/settings | ✅/❌ |
| PUT | /api/purchases/settings | ✅/❌ |
| POST | /api/purchases/orders | ✅/❌ |
| GET | /api/purchases/orders | ✅/❌ |
| GET | /api/purchases/orders/:id | ✅/❌ |
| PUT | /api/purchases/orders/:id | ✅/❌ |
| POST | /api/purchases/orders/:id/confirm | ✅/❌ |
| POST | /api/purchases/orders/:id/cancel | ✅/❌ |
| POST | /api/purchases/orders/:id/close | ✅/❌ |

## Frontend
| Page | File | Renders? |
|------|------|---------|
| Purchase Home + Wizard | PurchaseHomePage.tsx | ✅/❌ |
| PO List | PurchaseOrdersListPage.tsx | ✅/❌ |
| PO Detail | PurchaseOrderDetailPage.tsx | ✅/❌ |
| Settings | PurchaseSettingsPage.tsx | ✅/❌ |

- [ ] Sidebar updated with purchases menu
- [ ] Routes registered

## Compile & Build
- Backend tsc: [PASS/FAIL]
- Frontend build: [PASS/FAIL]

## Deviations from Spec
[List any]
```

---

## FINAL RULES

1. **Read ALL spec docs before writing ANY code.**
2. **Execute tasks in order: 1A → 1B → 1C → 1D → 1E.**
3. **After completing ALL tasks, write the audit report.**
4. **Run `npx tsc --noEmit` after each task. Fix errors before proceeding.**
5. **PurchaseOrder entities live under `domain/purchases/`, NOT `domain/shared/`.**
6. **PO has NO inventory or accounting effects. It is a commercial document only. Rule R3.**
7. **Do NOT implement GRN, Purchase Invoice, or Purchase Return. Only PO + Settings.**
8. **Reuse existing Party and TaxCode services from Phase 0. Do NOT recreate them.**
9. **Snapshot vendor name and item details on PO creation. Do NOT use live lookups on read.**
10. **Document numbering must persist the incremented sequence back to PurchaseSettings.**
