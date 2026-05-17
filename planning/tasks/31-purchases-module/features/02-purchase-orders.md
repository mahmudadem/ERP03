# Feature 02: Purchase Orders

## Goal
Implement purchase order management with status tracking, item line details, and conversion to goods receipts and invoices.

---

## Backend

### 1. `PurchaseOrder` Entity
**File:** `backend/src/domain/purchases/entities/PurchaseOrder.ts` [NEW]

```typescript
export class PurchaseOrder {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly poNumber: string,         // Auto-generated: PO-0001
    public readonly supplierId: string,
    public readonly date: string,             // ISO date
    public readonly expectedDeliveryDate?: string,
    public readonly currency: string,
    public readonly exchangeRate: number = 1,
    public readonly lines: PurchaseOrderLine[],
    public readonly subtotal: number,
    public readonly taxAmount: number,
    public readonly total: number,
    public readonly status: POStatus = 'draft',
    public readonly notes?: string,
    public readonly internalNotes?: string,
    public readonly warehouseId?: string,      // Default receiving warehouse
    public readonly receivedQuantities?: Record<string, number>,  // itemId → qty received
    public readonly invoicedQuantities?: Record<string, number>,  // itemId → qty invoiced
    public readonly createdBy?: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
    public readonly approvedBy?: string,
    public readonly approvedAt?: Date
  ) {}

  get isFullyReceived(): boolean {
    return this.lines.every(l => 
      (this.receivedQuantities?.[l.itemId] ?? 0) >= l.quantity
    );
  }

  get isFullyInvoiced(): boolean {
    return this.lines.every(l => 
      (this.invoicedQuantities?.[l.itemId] ?? 0) >= l.quantity
    );
  }
}

export interface PurchaseOrderLine {
  lineNo: number;
  itemId: string;
  itemName?: string;     // Snapshot
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount?: number;      // Percentage
  discountAmount?: number;
  taxRate?: number;        // Percentage
  taxAmount?: number;
  lineTotal: number;       // (quantity × unitPrice) - discount + tax
}

export type POStatus = 'draft' | 'approved' | 'partially_received' | 'received' | 'cancelled';
```

### 2. Repository & Firestore
**File:** `backend/src/repository/interfaces/purchases/IPurchaseOrderRepository.ts` [NEW]

Key methods: CRUD + `findBySupplier`, `findByStatus`, `findByDateRange`, `getNextPONumber`.

Firestore path: `companies/{companyId}/purchases/Data/purchase_orders`

### 3. Use Cases

| Use Case | Description |
|----------|-------------|
| `CreatePurchaseOrderUseCase` | Validates lines, generates PO number, saves |
| `UpdatePurchaseOrderUseCase` | Only if draft |
| `ApprovePurchaseOrderUseCase` | Moves to approved |
| `CancelPurchaseOrderUseCase` | Only if no receipts |
| `ListPurchaseOrdersUseCase` | Paginated with filters |

### 4. API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/purchases/orders` | List POs |
| GET | `/api/purchases/orders/:id` | Get PO |
| POST | `/api/purchases/orders` | Create |
| PUT | `/api/purchases/orders/:id` | Update (draft only) |
| POST | `/api/purchases/orders/:id/approve` | Approve |
| POST | `/api/purchases/orders/:id/cancel` | Cancel |

---

## Frontend

### Purchase Orders List Page
**File:** `frontend/src/modules/purchases/pages/PurchaseOrdersPage.tsx` [NEW]

- Table: PO#, Date, Supplier, Total, Status, Received %, Invoiced %
- Status badges with colors
- Quick actions: View, Edit (if draft), Approve, Cancel
- Filter by status, date range, supplier

### Purchase Order Form
**File:** `frontend/src/modules/purchases/pages/PurchaseOrderFormPage.tsx` [NEW]

- Header: Supplier selector, Date, Expected Delivery, Warehouse, Currency
- Lines table (similar to GenericVoucherRenderer but simpler):
  - Item selector (from inventory items)
  - Quantity, Unit, Unit Price, Discount %, Tax %, Line Total
  - Auto-calculate subtotal, tax, total
- Notes section
- Save as Draft / Approve buttons

---

## Verification

1. Create PO with multiple lines → verify totals calculate correctly
2. Approve PO → verify status change
3. Try to edit approved PO → verify blocked
4. Cancel PO with no receipts → verify success
5. Cancel PO with receipts → verify blocked
