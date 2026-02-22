# Feature 01: Customer Management

## Goal
Build customer master data with AR account linking — mirrors Supplier management in Purchases module.

---

## Backend

### 1. `Customer` Entity
**File:** `backend/src/domain/sales/entities/Customer.ts` [NEW]

```typescript
export class Customer {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly name: string,
    public readonly code: string,              // CUST-001
    public readonly contactPerson?: string,
    public readonly email?: string,
    public readonly phone?: string,
    public readonly address?: string,
    public readonly shippingAddress?: string,
    public readonly taxNumber?: string,
    public readonly accountId?: string,         // AR sub-account in COA
    public readonly paymentTerms?: string,
    public readonly creditLimit?: number,
    public readonly currency?: string,
    public readonly priceListId?: string,       // Future: customer-specific pricing
    public readonly active: boolean = true,
    public readonly notes?: string,
    public readonly metadata?: Record<string, any>,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date
  ) {}
}
```

### 2. Repository, Firestore, Use Cases, API Routes
Mirror `Supplier` from Purchases module exactly. Path: `companies/{companyId}/sales/Data/customers`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sales/customers` | List |
| GET | `/api/sales/customers/:id` | Get |
| POST | `/api/sales/customers` | Create |
| PUT | `/api/sales/customers/:id` | Update |
| DELETE | `/api/sales/customers/:id` | Delete |
| GET | `/api/sales/customers/search?q=` | Search |

---

## Frontend

### Customer Pages
Mirror `SuppliersPage.tsx` from Purchases. AR account selector filtered to Asset/AR type.

**Files:** `frontend/src/modules/sales/pages/CustomersPage.tsx`, `CustomerForm.tsx`

---

## Verification

1. Create customer → verify appears in list
2. Auto-create AR sub-account → verify under AR control account
3. Delete customer with open invoices → verify blocked
