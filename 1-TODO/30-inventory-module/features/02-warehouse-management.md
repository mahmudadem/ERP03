# Feature 02: Warehouse Management

## Goal
Expand the existing `Warehouse` entity and build full CRUD with location tracking and per-warehouse stock visibility.

---

## Backend Changes

### 1. Expand `Warehouse` Entity
**File:** `backend/src/domain/inventory/entities/Warehouse.ts`

```typescript
export class Warehouse {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly name: string,
    public readonly code: string,          // Short code (e.g., "WH-01")
    public readonly location?: string,
    public readonly address?: string,
    public readonly contactPerson?: string,
    public readonly contactPhone?: string,
    public readonly isDefault: boolean = false,  // Default receiving warehouse
    public readonly active: boolean = true,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date
  ) {}
}
```

### 2. Expand Repository Interface
**File:** `backend/src/repository/interfaces/inventory/IWarehouseRepository.ts`

Add: `getWarehouseByCode`, `setDefault`, `deleteWarehouse`, `getDefaultWarehouse`.

### 3. Firestore Repository
Update `FirestoreWarehouseRepository` to use `SettingsResolver`:
- Path: `companies/{companyId}/inventory/Data/warehouses`

### 4. Use Cases
**Files:** `backend/src/application/inventory/use-cases/`

| Use Case | Description |
|----------|-------------|
| `CreateWarehouseUseCase` | Validates code uniqueness, creates warehouse |
| `UpdateWarehouseUseCase` | Updates warehouse, enforces single default |
| `ListWarehousesUseCase` | List with filters (active, search) |
| `DeleteWarehouseUseCase` | Block if warehouse has stock |

### 5. API Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/inventory/warehouses` | List warehouses |
| GET | `/api/inventory/warehouses/:id` | Get warehouse |
| POST | `/api/inventory/warehouses` | Create |
| PUT | `/api/inventory/warehouses/:id` | Update |
| DELETE | `/api/inventory/warehouses/:id` | Delete (if empty) |

---

## Frontend Changes

### 1. Warehouses List Page
**File:** `frontend/src/modules/inventory/pages/WarehousesPage.tsx` [NEW]

- Table: Code, Name, Location, Contact, Default badge, Active
- Mark-as-default action
- Delete blocked if stock exists (show count)

### 2. Warehouse Form
- Modal form for create/edit
- Code, Name, Location, Address, Contact, Phone, Is Default checkbox

---

## Verification

1. Create warehouse → verify in list
2. Set one as default → verify only one default exists
3. Try to delete warehouse with stock → verify blocked
4. Delete empty warehouse → verify success
