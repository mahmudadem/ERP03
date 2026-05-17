# Feature 03: Stock Levels & Movements

## Goal
Build real-time stock tracking with materialized stock levels and a complete movement history log.

---

## Backend Changes

### 1. New `StockLevel` Entity (Materialized View)
**File:** `backend/src/domain/inventory/entities/StockLevel.ts` [NEW]

```typescript
export class StockLevel {
  constructor(
    public readonly id: string,           // Composite: `${itemId}_${warehouseId}`
    public readonly companyId: string,
    public readonly itemId: string,
    public readonly warehouseId: string,
    public readonly quantity: number,      // Current on-hand quantity
    public readonly reservedQuantity: number = 0,  // Reserved for SOs (future)
    public readonly averageCost: number = 0,       // Running average cost
    public readonly lastMovementDate?: string,
    public readonly updatedAt?: Date
  ) {}

  get availableQuantity(): number {
    return this.quantity - this.reservedQuantity;
  }
}
```

### 2. Expand `StockMovement` Entity
**File:** `backend/src/domain/inventory/entities/StockMovement.ts`

```typescript
export class StockMovement {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly itemId: string,
    public readonly warehouseId: string,
    public readonly quantity: number,           // Always positive
    public readonly direction: StockDirection,  // 'in' | 'out'
    public readonly type: MovementType,         // More granular than referenceType
    public readonly referenceType: MovementReferenceType,
    public readonly referenceId?: string,       // Invoice/PO/SO ID
    public readonly unitCost?: number,          // Cost per unit at time of movement
    public readonly totalCost?: number,         // quantity * unitCost
    public readonly notes?: string,
    public readonly date: string,               // ISO date
    public readonly createdBy?: string,
    public readonly createdAt?: Date
  ) {}
}

export type StockDirection = 'in' | 'out';
export type MovementType = 
  | 'purchase_receipt'    // Goods received from supplier
  | 'sales_delivery'     // Goods delivered to customer
  | 'adjustment_in'      // Manual increase
  | 'adjustment_out'     // Manual decrease
  | 'transfer_in'        // Received from another warehouse
  | 'transfer_out'       // Sent to another warehouse
  | 'opening_stock'      // Initial stock
  | 'return_in'          // Customer return
  | 'return_out';        // Supplier return
export type MovementReferenceType = 
  | 'purchase_invoice' | 'sales_invoice' | 'stock_adjustment'
  | 'stock_transfer' | 'manual' | 'opening';
```

### 3. Repository Interfaces
**File:** `backend/src/repository/interfaces/inventory/IStockLevelRepository.ts` [NEW]
```typescript
export interface IStockLevelRepository {
  getLevel(companyId: string, itemId: string, warehouseId: string): Promise<StockLevel | null>;
  getLevelsByItem(companyId: string, itemId: string): Promise<StockLevel[]>;
  getLevelsByWarehouse(companyId: string, warehouseId: string): Promise<StockLevel[]>;
  getAllLevels(companyId: string): Promise<StockLevel[]>;
  upsertLevel(level: StockLevel): Promise<void>;
}
```

Update `IStockMovementRepository`:
```typescript
export interface IStockMovementRepository {
  recordMovement(movement: StockMovement): Promise<void>;
  getItemMovements(itemId: string, companyId: string, limit?: number): Promise<StockMovement[]>;
  getWarehouseMovements(warehouseId: string, companyId: string, limit?: number): Promise<StockMovement[]>;
  getMovementsByReference(companyId: string, referenceType: string, referenceId: string): Promise<StockMovement[]>;
  getMovementsByDateRange(companyId: string, from: string, to: string): Promise<StockMovement[]>;
}
```

### 4. Firestore Paths
```
companies/{companyId}/inventory/Data/stock_levels     → StockLevel collection
companies/{companyId}/inventory/Data/stock_movements   → StockMovement collection
```

### 5. Use Cases

| Use Case | Description |
|----------|-------------|
| `RecordStockMovementUseCase` | Records a movement AND atomically updates `StockLevel` |
| `GetStockLevelUseCase` | Read current stock for item/warehouse |
| `GetStockMovementHistoryUseCase` | Paginated movement history with filters |
| `GetInventoryValuationUseCase` | Calculates total inventory value (qty × avgCost) |

**Critical:** `RecordStockMovementUseCase` must:
1. Create the `StockMovement` document
2. Atomically update the `StockLevel` document (increment/decrement quantity, update avgCost)
3. Both in a Firestore transaction to ensure consistency

### 6. API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/inventory/stock-levels` | All stock levels (with filters) |
| GET | `/api/inventory/stock-levels/:itemId` | Stock by item (across warehouses) |
| GET | `/api/inventory/movements` | Movement history |
| GET | `/api/inventory/movements/:itemId` | Movements for item |
| GET | `/api/inventory/valuation` | Inventory valuation report |

---

## Frontend Changes

### 1. Stock Levels Page
**File:** `frontend/src/modules/inventory/pages/StockLevelsPage.tsx` [NEW]

- Grid: Item Code, Item Name, Warehouse, On Hand, Reserved, Available, Avg Cost, Value
- Filters: Warehouse, Category, Below Minimum toggle
- Color-coded: Red for below minimum, Yellow for at minimum

### 2. Movement History
**File:** `frontend/src/modules/inventory/pages/StockMovementsPage.tsx` [NEW]

- Table: Date, Item, Warehouse, Type, Direction (IN/OUT badges), Quantity, Unit Cost, Reference
- Click reference to navigate to source document

---

## Verification

1. Record an "opening_stock" movement → verify StockLevel created
2. Record "purchase_receipt" → verify level increases
3. Record "sales_delivery" → verify level decreases
4. Verify atomic consistency: no partial updates
5. Verify valuation report sums correctly
