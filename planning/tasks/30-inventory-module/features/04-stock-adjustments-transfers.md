# Feature 04: Stock Adjustments & Transfers

## Goal
Allow manual stock adjustments (corrections, damage write-offs) and inter-warehouse transfers with full audit trail and optional accounting integration.

---

## Backend Changes

### 1. New `StockAdjustment` Entity
**File:** `backend/src/domain/inventory/entities/StockAdjustment.ts` [NEW]

```typescript
export class StockAdjustment {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly warehouseId: string,
    public readonly date: string,
    public readonly reason: AdjustmentReason,
    public readonly notes?: string,
    public readonly lines: StockAdjustmentLine[],
    public readonly status: 'draft' | 'posted' = 'draft',
    public readonly voucherId?: string,       // Generated accounting voucher
    public readonly createdBy?: string,
    public readonly createdAt?: Date
  ) {}
}

export interface StockAdjustmentLine {
  itemId: string;
  currentQty: number;     // Snapshot at time of adjustment
  newQty: number;         // Target quantity
  adjustmentQty: number;  // Difference (positive = add, negative = remove)
  unitCost?: number;
}

export type AdjustmentReason = 'damage' | 'loss' | 'correction' | 'expired' | 'found' | 'other';
```

### 2. New `StockTransfer` Entity
**File:** `backend/src/domain/inventory/entities/StockTransfer.ts` [NEW]

```typescript
export class StockTransfer {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly sourceWarehouseId: string,
    public readonly destinationWarehouseId: string,
    public readonly date: string,
    public readonly notes?: string,
    public readonly lines: StockTransferLine[],
    public readonly status: 'draft' | 'in_transit' | 'completed' = 'draft',
    public readonly createdBy?: string,
    public readonly createdAt?: Date,
    public readonly completedAt?: Date
  ) {}
}

export interface StockTransferLine {
  itemId: string;
  quantity: number;
  unitCost?: number;
}
```

### 3. Repository Interfaces

| Interface | File |
|-----------|------|
| `IStockAdjustmentRepository` | `backend/src/repository/interfaces/inventory/IStockAdjustmentRepository.ts` [NEW] |
| `IStockTransferRepository` | `backend/src/repository/interfaces/inventory/IStockTransferRepository.ts` [NEW] |

Firestore paths:
```
companies/{companyId}/inventory/Data/stock_adjustments
companies/{companyId}/inventory/Data/stock_transfers
```

### 4. Use Cases

| Use Case | Description |
|----------|-------------|
| `CreateStockAdjustmentUseCase` | Creates adjustment, records movements, optionally generates accounting voucher |
| `PostStockAdjustmentUseCase` | Posts adjustment: atomically updates stock levels and creates GL voucher |
| `CreateStockTransferUseCase` | Creates transfer in draft |
| `CompleteStockTransferUseCase` | Records OUT movements from source, IN movements to destination |

#### Accounting Integration (Stock Adjustment → Voucher)

When a stock adjustment is posted:
1. Calculate total adjustment value: `Σ(adjustmentQty × unitCost)`
2. Generate a `VoucherEntity` with:
   - **Type:** `journal_entry` (reuse existing type)
   - **Source module:** `inventory`
   - Lines:
     - Debit: Stock Adjustment Expense account → for decreases
     - Credit: Inventory Asset account → for decreases
     - (Reversed for increases)
3. Post the voucher via existing `CreateVoucherUseCase` + `PostVoucherUseCase`

### 5. API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/inventory/adjustments` | List adjustments |
| POST | `/api/inventory/adjustments` | Create adjustment |
| POST | `/api/inventory/adjustments/:id/post` | Post adjustment |
| GET | `/api/inventory/transfers` | List transfers |
| POST | `/api/inventory/transfers` | Create transfer |
| POST | `/api/inventory/transfers/:id/complete` | Complete transfer |

---

## Frontend Changes

### 1. Stock Adjustment Page
**File:** `frontend/src/modules/inventory/pages/StockAdjustmentPage.tsx` [NEW]

- List of adjustments with status badges
- Create adjustment form:
  - Select warehouse
  - Table: Item (selector), Current Qty (auto-filled), New Qty (input), Difference (computed), Cost
  - Reason dropdown
  - Notes
- "Post" action generates accounting entry

### 2. Stock Transfer Page
**File:** `frontend/src/modules/inventory/pages/StockTransferPage.tsx` [NEW]

- List of transfers with status (Draft → In Transit → Completed)
- Create transfer form:
  - Source Warehouse selector
  - Destination Warehouse selector
  - Table: Item, Quantity
- "Complete" action moves stock

---

## Verification

1. Adjust stock down → verify level decreases + accounting voucher created
2. Adjust stock up → verify level increases + voucher credits inventory account
3. Transfer between warehouses → verify source decreases, destination increases
4. Verify total company-wide stock remains constant after transfer
