# Phase 0 — Shared Services (Party + TaxCode) — Execution Prompt

> **Work non-stop until all tasks are complete.**

## YOUR ROLE

You are an executing agent implementing shared ERP services (Party entity and TaxCode entity) and extending the Item entity with tax defaults. You MUST follow the spec documents exactly. Do NOT redesign, do NOT skip fields, do NOT change algorithms.

## SPEC DOCUMENTS (READ ALL BEFORE STARTING)

1. `d:\DEV2026\ERP03\docs\purchases\MASTER_PLAN.md` — System overview, business rules, workflows
2. `d:\DEV2026\ERP03\docs\purchases\SCHEMAS.md` — Complete field-level definitions for Party (§S1), TaxCode (§S2), Item extensions (§S3)
3. `d:\DEV2026\ERP03\docs\purchases\PHASES.md` — Phase 0 section

## CODEBASE PATTERNS (MUST FOLLOW)

Study these existing patterns before implementing:

| Pattern | Example File | What to Learn |
|---------|-------------|---------------|
| Domain entity with validation | `backend/src/domain/inventory/entities/Item.ts` | Constructor validation, `toJSON()`, `static fromJSON()` |
| Repository interface | `backend/src/repository/interfaces/inventory/IItemRepository.ts` | Method signatures, async patterns, pagination |
| Firestore repository | `backend/src/infrastructure/firestore/repositories/inventory/` | `BaseFirestoreRepository`, mappers, Date↔Timestamp |
| DI container binding | `backend/src/infrastructure/di/bindRepositories.ts` | How to register new repos |
| API controller | `backend/src/api/controllers/inventory/InventoryController.ts` | Handler pattern, `req.user.companyId`, error handling |
| Routes file | `backend/src/api/routes/inventory.routes.ts` | Route registration, permission guards |
| Frontend API client | `frontend/src/api/inventoryApi.ts` | axios client pattern, DTO types |
| Frontend page | `frontend/src/modules/inventory/pages/WarehousesPage.tsx` | Page pattern with list + CRUD |
| Route config | `frontend/src/router/routes.config.ts` | Route registration |
| Sidebar menu | `frontend/src/config/moduleMenuMap.ts` | Module menu structure |

**DB-agnostic rule:** Domain entities and use cases must have ZERO imports from `firebase-admin`. All DB access goes through repository interfaces.

---

## TASK 0A: Domain Entities

### Party Entity
Create `backend/src/domain/shared/entities/Party.ts`:
- Use `PartyProps` from SCHEMAS.md §S1.
- Constructor validates: `code` required, `legalName` required, `displayName` required, `roles` must contain at least one valid value ('VENDOR' | 'CUSTOMER').
- Include `toJSON()` and `static fromJSON()`.
- Export `PartyRole` type.

### TaxCode Entity
Create `backend/src/domain/shared/entities/TaxCode.ts`:
- Use `TaxCodeProps` from SCHEMAS.md §S2.
- Constructor validates: `code` required, `name` required, `rate >= 0`, if `taxType` is `EXEMPT` or `ZERO_RATED` then `rate` must be 0.
- Include `toJSON()` and `static fromJSON()`.
- Export `TaxType`, `TaxScope` types.

### Verification
```bash
cd d:\DEV2026\ERP03\backend
npx tsc --noEmit
```

---

## TASK 0B: Repository Interfaces + Firestore Implementations

### Repository Interfaces
Create under `backend/src/repository/interfaces/shared/`:

| File | Key Methods |
|------|-------------|
| `IPartyRepository.ts` | `create(party)`, `update(party)`, `getById(companyId, id)`, `getByCode(companyId, code)`, `list(companyId, opts: { role?, active?, limit?, offset? })`, `delete(companyId, id)` |
| `ITaxCodeRepository.ts` | `create(taxCode)`, `update(taxCode)`, `getById(companyId, id)`, `getByCode(companyId, code)`, `list(companyId, opts: { scope?, active?, limit?, offset? })` |

### Firestore Implementations
Create under `backend/src/infrastructure/firestore/repositories/shared/`:

| File | Firestore Path |
|------|---------------|
| `FirestorePartyRepository.ts` | `companies/{companyId}/shared/Data/parties/{id}` |
| `FirestoreTaxCodeRepository.ts` | `companies/{companyId}/shared/Data/tax_codes/{id}` |

Each implementation must:
- Use the same `BaseFirestoreRepository` pattern as inventory repos
- Handle `Date ↔ Timestamp` conversion in mappers
- Support `companyId` scoping on all queries

### DI Registration
Update `backend/src/infrastructure/di/bindRepositories.ts`:
- Add `IPartyRepository` and `ITaxCodeRepository` bindings.

### Verification
```bash
npx tsc --noEmit
```

---

## TASK 0C: Use Cases

Create `backend/src/application/shared/use-cases/PartyUseCases.ts`:

```
CreatePartyUseCase:
  - Validate code uniqueness within company
  - Validate roles array is not empty
  - If defaultCurrency set, validate it's in company's enabled currencies
  - Generate UUID, set createdAt/updatedAt, active=true
  - Save to IPartyRepository

UpdatePartyUseCase:
  - Load existing party
  - Validate code uniqueness if changed
  - Update fields, set updatedAt
  - Save

ListPartiesUseCase:
  - Accept filters: role ('VENDOR' | 'CUSTOMER'), active, search query
  - Delegate to IPartyRepository.list()

GetPartyUseCase:
  - Load by ID, throw if not found
```

Create `backend/src/application/shared/use-cases/TaxCodeUseCases.ts`:

```
CreateTaxCodeUseCase:
  - Validate code uniqueness within company
  - Validate rate consistency (EXEMPT/ZERO_RATED must have rate=0)
  - Validate purchase/sales tax account IDs if provided
  - Generate UUID, set createdAt/updatedAt, active=true
  - Save to ITaxCodeRepository

UpdateTaxCodeUseCase:
  - Load existing
  - Validate rate consistency
  - Update fields, set updatedAt
  - Save

ListTaxCodesUseCase:
  - Accept filters: scope ('PURCHASE' | 'SALES' | 'BOTH'), active
  - If scope filter is 'PURCHASE', return codes where scope is 'PURCHASE' or 'BOTH'
  - If scope filter is 'SALES', return codes where scope is 'SALES' or 'BOTH'
```

---

## TASK 0D: API Controller + Routes

### Controller
Create `backend/src/api/controllers/shared/SharedController.ts`:

Handlers:
```
// Parties
createParty(req, res, next)      — POST body → CreatePartyUseCase
updateParty(req, res, next)      — PUT body + params.id → UpdatePartyUseCase
getParty(req, res, next)         — params.id → GetPartyUseCase
listParties(req, res, next)      — query params → ListPartiesUseCase

// Tax Codes
createTaxCode(req, res, next)    — POST body → CreateTaxCodeUseCase
updateTaxCode(req, res, next)    — PUT body + params.id → UpdateTaxCodeUseCase
getTaxCode(req, res, next)       — params.id → GetTaxCodeUseCase (load by ID)
listTaxCodes(req, res, next)     — query params → ListTaxCodesUseCase
```

### Routes
Create `backend/src/api/routes/shared.routes.ts`:

```
POST   /api/shared/parties           → createParty
GET    /api/shared/parties           → listParties
GET    /api/shared/parties/:id       → getParty
PUT    /api/shared/parties/:id       → updateParty

POST   /api/shared/tax-codes         → createTaxCode
GET    /api/shared/tax-codes         → listTaxCodes
GET    /api/shared/tax-codes/:id     → getTaxCode
PUT    /api/shared/tax-codes/:id     → updateTaxCode
```

Register routes in the main app (check how `inventory.routes.ts` is registered and do the same).

---

## TASK 0E: Item Entity Extension

### Backend
Modify `backend/src/domain/inventory/entities/Item.ts`:
- Add `defaultPurchaseTaxCodeId?: string` to `ItemProps` and the class
- Add `defaultSalesTaxCodeId?: string` to `ItemProps` and the class
- Update `toJSON()` and `fromJSON()` to include these fields

Modify the Item API DTOs (`backend/src/api/dtos/InventoryDTOs.ts`) to include the two new fields.

### Frontend
Modify `frontend/src/api/inventoryApi.ts`:
- Add `defaultPurchaseTaxCodeId?: string` and `defaultSalesTaxCodeId?: string` to `InventoryItemDTO`

Modify `frontend/src/modules/inventory/pages/ItemDetailPage.tsx`:
- Add two TaxCode dropdown selectors (Purchase Tax, Sales Tax) to the COST tab
- Fetch available tax codes using `GET /api/shared/tax-codes?scope=PURCHASE` and `GET /api/shared/tax-codes?scope=SALES`

---

## TASK 0F: Frontend — Vendor & TaxCode Pages

### Frontend API Client
Create `frontend/src/api/sharedApi.ts`:
```typescript
// Party endpoints
createParty(payload): Promise<PartyDTO>
updateParty(id, payload): Promise<PartyDTO>
getParty(id): Promise<PartyDTO>
listParties(opts: { role?, active? }): Promise<PartyDTO[]>

// TaxCode endpoints
createTaxCode(payload): Promise<TaxCodeDTO>
updateTaxCode(id, payload): Promise<TaxCodeDTO>
getTaxCode(id): Promise<TaxCodeDTO>
listTaxCodes(opts: { scope?, active? }): Promise<TaxCodeDTO[]>
```

### Vendors List Page
Create `frontend/src/modules/purchases/pages/VendorsListPage.tsx`:
- Table showing vendors (parties with VENDOR role): code, display name, phone, email, status
- "Add Vendor" button opens creation form
- Click row → navigate to detail

### Vendor Detail Page
Create `frontend/src/modules/purchases/pages/VendorDetailPage.tsx`:
- Tabbed form:
  - **General**: code, legalName, displayName, contactPerson, phone, email, address, taxId, active
  - **Commercial**: paymentTermsDays, defaultCurrency (dropdown from company currencies)
  - **Accounting**: defaultAPAccountId (account selector), defaultARAccountId (account selector)
- Save button

### Tax Codes Page
Create `frontend/src/modules/settings/pages/TaxCodesPage.tsx`:
- OR add to an existing settings area — check how the app organizes settings pages
- Table: code, name, rate, type, scope, active
- Inline create/edit or modal form

### Route Registration
Add routes to `frontend/src/router/routes.config.ts`:
- `/purchases/vendors` → VendorsListPage
- `/purchases/vendors/:id` → VendorDetailPage
- `/settings/tax-codes` → TaxCodesPage (or wherever settings live)

---

## Verification

After ALL tasks are done:

```bash
# Backend compile
cd d:\DEV2026\ERP03\backend
npx tsc --noEmit

# Frontend build
cd d:\DEV2026\ERP03\frontend
npm run build
```

ALL must pass with zero errors.

---

## Audit Report

Write to `d:\DEV2026\ERP03\docs\purchases\AUDIT_PHASE_0.md`:

```markdown
# Phase 0 Audit Report — Shared Services (Party + TaxCode)

## Date: [YYYY-MM-DD HH:MM]

## Task 0A: Domain Entities
| Entity | File | Lines | Fields match SCHEMAS.md? |
|--------|------|-------|------------------------|
| Party | domain/shared/entities/Party.ts | ??? | ✅/❌ |
| TaxCode | domain/shared/entities/TaxCode.ts | ??? | ✅/❌ |

- [ ] Party validates roles array not empty
- [ ] TaxCode validates EXEMPT/ZERO_RATED rate = 0
- [ ] Both have toJSON() and fromJSON()

## Task 0B: Repositories
| File | Collection Path | Methods |
|------|----------------|---------|
| FirestorePartyRepository.ts | companies/{cid}/shared/Data/parties/{id} | [list] |
| FirestoreTaxCodeRepository.ts | companies/{cid}/shared/Data/tax_codes/{id} | [list] |

- [ ] DI container updated
- [ ] Date ↔ Timestamp conversion works

## Task 0C: Use Cases
- [ ] CreatePartyUseCase: code uniqueness validated
- [ ] CreateTaxCodeUseCase: rate consistency validated
- [ ] ListTaxCodesUseCase: scope filtering (PURCHASE returns PURCHASE + BOTH)

## Task 0D: API
| Method | Path | Status |
|--------|------|--------|
| POST | /api/shared/parties | ✅/❌ |
| GET | /api/shared/parties | ✅/❌ |
| GET | /api/shared/parties/:id | ✅/❌ |
| PUT | /api/shared/parties/:id | ✅/❌ |
| POST | /api/shared/tax-codes | ✅/❌ |
| GET | /api/shared/tax-codes | ✅/❌ |
| GET | /api/shared/tax-codes/:id | ✅/❌ |
| PUT | /api/shared/tax-codes/:id | ✅/❌ |

## Task 0E: Item Extension
- [ ] defaultPurchaseTaxCodeId added to Item entity
- [ ] defaultSalesTaxCodeId added to Item entity
- [ ] DTOs updated
- [ ] ItemDetailPage has tax code dropdowns

## Task 0F: Frontend
| Page | File | Renders? |
|------|------|---------|
| Vendors List | VendorsListPage.tsx | ✅/❌ |
| Vendor Detail | VendorDetailPage.tsx | ✅/❌ |
| Tax Codes | TaxCodesPage.tsx | ✅/❌ |

- [ ] Routes registered
- [ ] sharedApi.ts created with all endpoints

## Compile & Build
- Backend tsc: [PASS/FAIL]
- Frontend build: [PASS/FAIL]

## Deviations from Spec
[List any]
```

---

## FINAL RULES

1. **Read ALL spec docs before writing ANY code.**
2. **Execute tasks in order: 0A → 0B → 0C → 0D → 0E → 0F.**
3. **After completing ALL tasks, write the audit report.**
4. **Run `npx tsc --noEmit` after each task. Fix errors before proceeding.**
5. **The audit report is NOT optional. It is a deliverable.**
6. **If you deviate from the spec, document it in "Deviations from Spec."**
7. **Do NOT implement Purchase Orders, GRNs, or Invoices. Only shared services + Item extension.**
8. **Follow existing codebase patterns exactly. Study the example files listed above.**
9. **Party and TaxCode are SHARED entities under `domain/shared/`. They do NOT belong to `domain/purchases/`.**
10. **All Firestore collection paths must be under `companies/{companyId}/shared/Data/`.**
