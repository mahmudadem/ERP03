# Feature 01: Supplier Management

## Goal
Build a supplier master data system for managing vendor information, contact details, and AP account linkage.

---

## Backend

### 1. `Supplier` Entity
**File:** `backend/src/domain/purchases/entities/Supplier.ts` [NEW]

```typescript
export class Supplier {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly name: string,
    public readonly code: string,            // Vendor code (e.g., "SUP-001")
    public readonly contactPerson?: string,
    public readonly email?: string,
    public readonly phone?: string,
    public readonly address?: string,
    public readonly taxNumber?: string,       // VAT/Tax ID
    public readonly withholdingTaxSubject?: boolean, // e.g. True if supplier is subject to WHT
    public readonly withholdingTaxRate?: number,    // e.g. 5.0 for 5% WHT
    public readonly accountId?: string,       // AP sub-account in COA
    public readonly paymentTerms?: string,    // e.g., "Net 30"
    public readonly creditLimit?: number,
    public readonly currency?: string,        // Default transaction currency
    public readonly active: boolean = true,
    public readonly notes?: string,
    public readonly metadata?: Record<string, any>,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date
  ) {}
}
```

### 2. Repository Interface
**File:** `backend/src/repository/interfaces/purchases/ISupplierRepository.ts` [NEW]

```typescript
export interface ISupplierRepository {
  create(supplier: Supplier): Promise<void>;
  update(id: string, data: Partial<Supplier>): Promise<void>;
  findById(companyId: string, id: string): Promise<Supplier | null>;
  findByCode(companyId: string, code: string): Promise<Supplier | null>;
  findAll(companyId: string, filters?: { active?: boolean; search?: string }): Promise<Supplier[]>;
  delete(id: string): Promise<boolean>;
}
```

### 3. Firestore Repository
**File:** `backend/src/infrastructure/firestore/repositories/purchases/FirestorePurchaseRepositories.ts` [NEW]

Path: `companies/{companyId}/purchases/Data/suppliers`

### 4. Use Cases
**File:** `backend/src/application/purchases/use-cases/SupplierUseCases.ts` [NEW]

- `CreateSupplierUseCase` — Validates code uniqueness, optionally auto-creates AP sub-account
- `UpdateSupplierUseCase` — Updates supplier
- `ListSuppliersUseCase` — Paginated listing with search
- `DeleteSupplierUseCase` — Soft-delete, block if open invoices exist

### 5. API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/purchases/suppliers` | List suppliers |
| GET | `/api/purchases/suppliers/:id` | Get supplier |
| POST | `/api/purchases/suppliers` | Create |
| PUT | `/api/purchases/suppliers/:id` | Update |
| DELETE | `/api/purchases/suppliers/:id` | Delete |
| GET | `/api/purchases/suppliers/search?q=` | Search |

---

## Frontend

### Supplier List Page
**File:** `frontend/src/modules/purchases/pages/SuppliersPage.tsx` [NEW]

- Table: Code, Name, Contact, Phone, Email, Payment Terms, Status
- Search, filter by active/inactive
- Click row → detail/edit

### Supplier Form
**File:** `frontend/src/modules/purchases/components/SupplierForm.tsx` [NEW]

- Modal or side-panel form
- Fields: Name, Code, Contact Person, Email, Phone, Address, Tax Number, WHT Subject (checkbox), WHT Rate, Payment Terms, Credit Limit, Currency, AP Account (AccountSelector filtered to Liability/AP)
- Save creates both supplier and optionally an AP sub-account

---

## Verification

1. Create supplier → verify appears in list
2. Create supplier with auto AP sub-account → verify account created under AP control
3. Search supplier by name/code → verify results
4. Delete supplier with open invoices → verify blocked
