# 04 — Cost Center (Full Implementation)

> **Priority:** P1 (High)
> **Estimated Effort:** 5–7 days
> **Dependencies:** None
> **Source:** TODO item #5

---

## Business Context

A **Cost Center** is an organizational unit (department, project, branch) used to track where costs occur and revenues originate. This enables **management accounting** — answering questions like:
- "How much did the Marketing department spend this quarter?"
- "Which branch is most profitable?"
- "Are we over budget on the IT project?"

This is one of the most requested features by any business with more than one department or location.

---

## Current State

- ✅ `CostCenter.ts` entity exists (stub — 10 lines: id, companyId, name, code, parentId)
- ✅ `VoucherLineEntity` has `costCenterId` field
- ✅ `LedgerEntry` has `costCenterId` field
- ✅ `CostCenterRequiredPolicy` exists (validates cost center is present when required)
- ❌ No CRUD API for cost centers
- ❌ No Firestore repository for cost centers
- ❌ No UI for managing cost centers
- ❌ No cost center selector in voucher entry forms
- ❌ No cost center reporting (P&L by cost center, cost center statement)
- ❌ No cost center hierarchy support in UI
- ❌ No cost allocation (splitting across multiple cost centers)

---

## Requirements

### Phase 1: Basic CRUD + Voucher Integration
1. Full cost center entity with hierarchy (parent/child)
2. CRUD API + UI for managing cost centers
3. Cost center selector in voucher line entry
4. Configure which accounts require cost center (from policy settings)

### Phase 2: Reporting
5. Cost Center Statement (like Account Statement but filtered by cost center)
6. P&L by Cost Center report
7. Cost center filter on existing reports (General Ledger, Trial Balance)

### Phase 3: Advanced (future)
8. Cost allocation (split transactions across centers)
9. Budget per cost center

---

## Implementation Plan

### Step 1: Enhance Domain Entity

**File:** `backend/src/domain/accounting/entities/CostCenter.ts` (MODIFY)

```typescript
export enum CostCenterStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE'
}

export class CostCenter {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public name: string,
    public code: string,
    public description: string | null,
    public parentId: string | null,
    public status: CostCenterStatus,
    public readonly createdAt: Date,
    public readonly createdBy: string,
    public updatedAt: Date,
    public updatedBy: string
  ) {}

  validate(): string[] {
    const errors: string[] = [];
    if (!this.code || this.code.trim().length === 0) errors.push('Code is required');
    if (!this.name || this.name.trim().length === 0) errors.push('Name is required');
    if (this.code && this.code.length > 20) errors.push('Code must be 20 characters or less');
    return errors;
  }

  isActive(): boolean { return this.status === CostCenterStatus.ACTIVE; }

  deactivate(updatedBy: string): void {
    this.status = CostCenterStatus.INACTIVE;
    this.updatedBy = updatedBy;
    this.updatedAt = new Date();
  }
}
```

### Step 2: Create Repository

**File:** `backend/src/repository/interfaces/accounting/ICostCenterRepository.ts` (NEW)

```typescript
export interface ICostCenterRepository {
  findAll(companyId: string): Promise<CostCenter[]>;
  findById(companyId: string, id: string): Promise<CostCenter | null>;
  findByCode(companyId: string, code: string): Promise<CostCenter | null>;
  create(costCenter: CostCenter): Promise<CostCenter>;
  update(costCenter: CostCenter): Promise<CostCenter>;
  delete(companyId: string, id: string): Promise<void>;
}
```

**File:** `backend/src/infrastructure/firestore/repositories/accounting/FirestoreCostCenterRepository.ts` (NEW)

Implement Firestore repository. Collection path: `companies/{companyId}/costCenters`.

### Step 3: Create Use Cases

**File:** `backend/src/application/accounting/use-cases/CostCenterUseCases.ts` (NEW)

```
ListCostCentersUseCase
CreateCostCenterUseCase   — with validation (unique code, valid parent reference)
UpdateCostCenterUseCase   — prevent update if used in posted vouchers (optionally)
DeactivateCostCenterUseCase — soft-delete, check if used in active vouchers
```

### Step 4: Create API Controller + Routes

**File:** `backend/src/api/controllers/accounting/CostCenterController.ts` (NEW)

Methods: `list`, `getById`, `create`, `update`, `deactivate`

**File:** `backend/src/api/routes/accounting.routes.ts` (MODIFY)

```typescript
// Cost Centers
router.get('/cost-centers', permissionGuard('accounting.accounts.view'), CostCenterController.list);
router.get('/cost-centers/:id', permissionGuard('accounting.accounts.view'), CostCenterController.getById);
router.post('/cost-centers', permissionGuard('accounting.settings.write'), CostCenterController.create);
router.put('/cost-centers/:id', permissionGuard('accounting.settings.write'), CostCenterController.update);
router.delete('/cost-centers/:id', permissionGuard('accounting.settings.write'), CostCenterController.deactivate);
```

### Step 5: Frontend — API + Context

**File:** `frontend/src/api/accountingApi.ts` (MODIFY)

Add cost center API functions:
```typescript
listCostCenters(): Promise<CostCenter[]>;
createCostCenter(data: any): Promise<CostCenter>;
updateCostCenter(id: string, data: any): Promise<CostCenter>;
deactivateCostCenter(id: string): Promise<void>;
```

**File:** `frontend/src/context/CostCentersContext.tsx` (NEW)

Context provider that fetches and caches cost centers, similar to `AccountsContext`.

### Step 6: Frontend — Cost Center Management Page

**File:** `frontend/src/modules/accounting/pages/CostCentersPage.tsx` (NEW)

- Tree view similar to Chart of Accounts page
- CRUD operations (add, edit, deactivate)
- Show hierarchy with expand/collapse
- Badge for Active/Inactive status

### Step 7: Frontend — Cost Center Selector Component

**File:** `frontend/src/modules/accounting/components/shared/CostCenterSelector.tsx` (NEW)

Dropdown/searchable selector for cost centers, similar to `AccountSelector`:
- Show code + name
- Hierarchical dropdown with indentation
- Used in voucher line entry

### Step 8: Integrate into Voucher Entry

**File:** `frontend/src/modules/accounting/components/shared/GenericVoucherRenderer.tsx` (MODIFY)

- Add `costCenter` column to voucher lines table (optional column, visible when cost centers are enabled)
- Use `CostCenterSelector` in each line row
- Pass `costCenterId` through to the save payload

### Step 9: Settings Integration

**File:** `frontend/src/modules/accounting/pages/AccountingSettingsPage.tsx` (MODIFY)

The "Cost Center" settings section should:
- Enable/disable cost center tracking for the company
- Configure which account classifications require cost centers
- Link to the Cost Centers management page

### Step 10: Reporting (Phase 2)

**File:** Add cost center filter to existing General Ledger and Trial Balance reports  
**File:** Create `CostCenterStatementPage.tsx` (NEW) — Account Statement filtered by cost center  
**File:** Create `PLByCostCenterPage.tsx` (NEW) — P&L broken down by cost center  

---

## Verification Plan

### Automated
1. **Domain test** — `backend/src/tests/domain/accounting/entities/CostCenter.test.ts`
   - Validation rules (code required, max length)
   - Status transitions
   - Command: `cd backend && npx jest --testPathPattern=CostCenter.test`

2. **Existing test** — `backend/src/tests/domain/accounting/policies/CostCenterRequiredPolicy.test.ts`
   - Already exists, verify it still passes after changes
   - Command: `cd backend && npx jest --testPathPattern=CostCenterRequiredPolicy`

### Manual
1. Navigate to Accounting → Cost Centers
2. Create a parent cost center (e.g., "Operations", code "OPS")
3. Create a child cost center (e.g., "Marketing", code "OPS-MKT", parent: OPS)
4. Create a voucher → verify cost center selector appears on line items
5. Save voucher with cost center → verify it persists
6. Check General Ledger → verify cost center is shown inline

---

## Acceptance Criteria

- [ ] Cost center CRUD works (create, list, update, deactivate)
- [ ] Hierarchy (parent/child) displayed as tree
- [ ] Cost center selector available in voucher line entry
- [ ] Cost center saved to voucher lines and ledger entries
- [ ] CostCenterRequiredPolicy enforces cost center when configured
- [ ] Settings page allows enabling/configuring cost center rules
- [ ] Existing tests still pass
