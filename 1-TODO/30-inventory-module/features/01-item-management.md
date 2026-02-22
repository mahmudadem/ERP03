# Feature 01: Item Management (CRUD + Categories)

## Goal
Expand the existing `Item` entity into a full product/service management system with categories, units of measure, pricing, and COA account mapping.

---

## Backend Changes

### 1. Expand `Item` Entity
**File:** `backend/src/domain/inventory/entities/Item.ts`

Expand the existing entity with:
```typescript
export class Item {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly name: string,
    public readonly code: string,         // SKU / Item Code
    public readonly type: ItemType,       // 'product' | 'service' | 'raw_material'
    public readonly unit: string,         // UoM: 'pcs', 'kg', 'litre', etc.
    public readonly categoryId?: string,  // Reference to ItemCategory
    public readonly description?: string,
    
    // Pricing
    public readonly salesPrice?: number,
    public readonly purchasePrice?: number,
    public readonly costMethod?: CostMethod,  // 'average' | 'fifo' | 'standard'
    
    // Accounting Links (COA account IDs)
    public readonly salesAccountId?: string,      // Revenue account
    public readonly purchaseAccountId?: string,    // Expense/COGS account
    public readonly inventoryAccountId?: string,   // Inventory asset account
    
    // Tracking
    public readonly isTracked: boolean = true,   // Track stock levels?
    public readonly active: boolean = true,
    public readonly taxCategoryId?: string,
    public readonly barcode?: string,
    public readonly minStockLevel?: number,
    public readonly maxStockLevel?: number,
    
    // Metadata
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
    public readonly metadata?: Record<string, any>
  ) {}
}

export type ItemType = 'product' | 'service' | 'raw_material';
export type CostMethod = 'average' | 'fifo' | 'standard';
```

### 2. New `ItemCategory` Entity
**File:** `backend/src/domain/inventory/entities/ItemCategory.ts` [NEW]

```typescript
export class ItemCategory {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly name: string,
    public readonly parentId?: string,     // Hierarchical categories
    public readonly description?: string,
    public readonly active: boolean = true,

    // Default account mappings (inherited by items in this category)
    public readonly defaultSalesAccountId?: string,
    public readonly defaultPurchaseAccountId?: string,
    public readonly defaultInventoryAccountId?: string
  ) {}
}
```

### 3. Expand Repository Interface
**File:** `backend/src/repository/interfaces/inventory/IItemRepository.ts`

Add methods:
```typescript
export interface IItemRepository {
  // Existing
  createItem(item: Item): Promise<void>;
  updateItem(id: string, data: Partial<Item>): Promise<void>;
  setItemActive(id: string, active: boolean): Promise<void>;
  getItem(id: string): Promise<Item | null>;
  getCompanyItems(companyId: string): Promise<Item[]>;
  
  // New
  getItemByCode(companyId: string, code: string): Promise<Item | null>;
  getItemsByCategory(companyId: string, categoryId: string): Promise<Item[]>;
  searchItems(companyId: string, query: string): Promise<Item[]>;
  deleteItem(id: string): Promise<boolean>;
}
```

### 4. New `IItemCategoryRepository`
**File:** `backend/src/repository/interfaces/inventory/IItemCategoryRepository.ts` [NEW]

### 5. Firestore Repository Updates
**File:** `backend/src/infrastructure/firestore/repositories/inventory/FirestoreInventoryRepositories.ts`

- Update `FirestoreItemRepository` to use `SettingsResolver` paths
- Change from flat `items` collection to `companies/{id}/inventory/Data/items`
- Add new `FirestoreItemCategoryRepository`

### 6. Use Cases
**Files:** `backend/src/application/inventory/use-cases/` [NEW]

| Use Case | Description |
|----------|-------------|
| `CreateItemUseCase` | Validates code uniqueness, applies category defaults, saves |
| `UpdateItemUseCase` | Updates item, validates code uniqueness if changed |
| `ListItemsUseCase` | Paginated listing with filters (type, category, active) |
| `DeleteItemUseCase` | Soft-delete (set active=false) or hard-delete if unused |
| `ManageItemCategoriesUseCase` | CRUD for categories |

### 7. API Routes
**File:** `backend/src/api/routes/inventory.routes.ts`

| Method | Path | Use Case |
|--------|------|----------|
| GET | `/api/inventory/items` | List items |
| GET | `/api/inventory/items/:id` | Get item |
| POST | `/api/inventory/items` | Create item |
| PUT | `/api/inventory/items/:id` | Update item |
| DELETE | `/api/inventory/items/:id` | Delete item |
| GET | `/api/inventory/items/search?q=` | Search items |
| GET | `/api/inventory/categories` | List categories |
| POST | `/api/inventory/categories` | Create category |
| PUT | `/api/inventory/categories/:id` | Update category |
| DELETE | `/api/inventory/categories/:id` | Delete category |

### 8. Prisma Schema Update
**File:** `backend/prisma/schema.prisma`

Update the existing `Item` model to include new fields. Add `ItemCategory` model.

---

## Frontend Changes

### 1. Items List Page
**File:** `frontend/src/modules/inventory/pages/ItemsListPage.tsx`

- Table with columns: Code, Name, Type, Category, Unit, Sales Price, Purchase Price, Stock, Status
- Filters: Type (product/service/raw_material), Category, Active status
- Search bar (code + name)
- Bulk actions: Activate/Deactivate

### 2. Item Form / Detail Page
**File:** `frontend/src/modules/inventory/pages/ItemDetailPage.tsx` [NEW]

- Tabbed layout:
  - **General:** Name, Code, Type, Unit, Category, Description, Barcode
  - **Pricing:** Sales Price, Purchase Price, Cost Method
  - **Accounting:** Sales Account (selector), Purchase Account (selector), Inventory Account (selector)
  - **Stock:** Min/Max levels, current stock (read-only), recent movements
- Account selectors should use the existing `AccountSelector` component from accounting module

### 3. Categories Management
**File:** `frontend/src/modules/inventory/pages/CategoriesPage.tsx` [NEW]

- Tree view for hierarchical categories
- Inline editing for category names
- Default account mapping per category

### 4. API Client
**File:** `frontend/src/api/inventoryApi.ts` [NEW]

Standard API client following existing `accountingApi.ts` pattern.

### 5. Routes
Update `frontend/src/router/routes.config.ts` to add inventory routes.

---

## Verification

### Automated Tests
```bash
# Backend entity tests
npx vitest run backend/src/domain/inventory/entities/Item.spec.ts

# Use case tests
npx vitest run backend/src/application/inventory/use-cases/

# API route tests (if integration tests exist)
npx vitest run backend/src/api/routes/inventory.routes.spec.ts
```

### Manual Tests
1. Create item with all fields → verify saved correctly
2. Create category → assign item to category → verify account inheritance
3. Search items by name/code → verify results
4. Deactivate item → verify it's excluded from active lists
5. Verify account selectors work (pull from existing COA)
