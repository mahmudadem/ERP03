# Feature 03: Goods Receipt Notes (GRN)

## Goal
Record goods received from suppliers, link to purchase orders, and trigger inventory stock movements.

---

## Backend

### 1. `GoodsReceipt` Entity
**File:** `backend/src/domain/purchases/entities/GoodsReceipt.ts` [NEW]

```typescript
export class GoodsReceipt {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly grnNumber: string,        // GRN-0001
    public readonly supplierId: string,
    public readonly purchaseOrderId?: string,  // Optional PO reference
    public readonly warehouseId: string,
    public readonly date: string,
    public readonly lines: GoodsReceiptLine[],
    public readonly status: 'draft' | 'posted' = 'draft',
    public readonly notes?: string,
    public readonly createdBy?: string,
    public readonly createdAt?: Date,
    public readonly postedAt?: Date
  ) {}
}

export interface GoodsReceiptLine {
  lineNo: number;
  itemId: string;
  itemName?: string;      // Snapshot
  quantityOrdered?: number;  // From PO
  quantityReceived: number;
  quantityRejected?: number;
  unit: string;
  unitCost: number;         // For stock movement cost tracking
  notes?: string;
}
```

### 2. Repository
**File:** `backend/src/repository/interfaces/purchases/IGoodsReceiptRepository.ts` [NEW]

Firestore path: `companies/{companyId}/purchases/Data/goods_receipts`

### 3. Use Cases

| Use Case | Description |
|----------|-------------|
| `CreateGoodsReceiptUseCase` | Creates GRN, optionally from PO (pre-fills lines) |
| `PostGoodsReceiptUseCase` | **Critical:** Posts the GRN and triggers stock movements |

**`PostGoodsReceiptUseCase` Flow:**
1. Validate all lines have items and quantities
2. For each line:
   - Call `RecordStockMovementUseCase` with:
     - Direction: `in`
     - Type: `purchase_receipt`
     - Reference: GRN ID
     - Quantity: `quantityReceived`
     - Unit cost: `unitCost`
3. If linked to PO, update PO's `receivedQuantities`
4. Set GRN status to `posted`

### 4. API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/purchases/goods-receipts` | List GRNs |
| GET | `/api/purchases/goods-receipts/:id` | Get GRN |
| POST | `/api/purchases/goods-receipts` | Create |
| POST | `/api/purchases/goods-receipts/from-po/:poId` | Create from PO (pre-fills) |
| POST | `/api/purchases/goods-receipts/:id/post` | Post GRN |

---

## Frontend

### GRN List Page
**File:** `frontend/src/modules/purchases/pages/GoodsReceiptsPage.tsx` [NEW]

- Table: GRN#, Date, Supplier, PO#, Warehouse, Status
- Quick actions: View, Post

### GRN Form Page
**File:** `frontend/src/modules/purchases/pages/GoodsReceiptFormPage.tsx` [NEW]

- Header: Supplier, PO reference (selector populates lines), Warehouse, Date
- Lines table: Item, Qty Ordered (from PO), Qty Received (input), Qty Rejected, Unit Cost
- "Post" button → confirms stock is received

### Create From PO
- When creating from PO, auto-populate lines with PO items
- Show ordered vs already received quantities
- Only show unreceived items

---

## Verification

1. Create GRN from PO → verify lines pre-filled with outstanding quantities
2. Post GRN → verify stock levels increase in specified warehouse
3. Post GRN → verify PO receivedQuantities updated
4. Verify stock movement records created with type `purchase_receipt`
5. Create GRN without PO → verify standalone receipt works
