# Feature 03: Sales Orders

## Goal
Implement sales order management with fulfillment tracking, linked to delivery notes and invoices.

---

## Backend

### 1. `SalesOrder` Entity
**File:** `backend/src/domain/sales/entities/SalesOrder.ts` [NEW]

```typescript
export class SalesOrder {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly soNumber: string,          // SO-0001
    public readonly customerId: string,
    public readonly quotationId?: string,      // Source quotation
    public readonly date: string,
    public readonly expectedDeliveryDate?: string,
    public readonly currency: string,
    public readonly exchangeRate: number = 1,
    public readonly lines: SalesOrderLine[],
    public readonly subtotal: number,
    public readonly discountAmount: number = 0,
    public readonly taxAmount: number = 0,
    public readonly total: number,
    public readonly status: SOStatus = 'draft',
    public readonly warehouseId?: string,       // Default delivery warehouse
    public readonly deliveredQuantities?: Record<string, number>,
    public readonly invoicedQuantities?: Record<string, number>,
    public readonly notes?: string,
    public readonly createdBy?: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
    public readonly confirmedBy?: string,
    public readonly confirmedAt?: Date
  ) {}

  get isFullyDelivered(): boolean {
    return this.lines.every(l =>
      (this.deliveredQuantities?.[l.itemId || l.lineNo.toString()] ?? 0) >= l.quantity
    );
  }

  get isFullyInvoiced(): boolean {
    return this.lines.every(l =>
      (this.invoicedQuantities?.[l.itemId || l.lineNo.toString()] ?? 0) >= l.quantity
    );
  }
}

export interface SalesOrderLine {
  lineNo: number;
  itemId?: string;
  itemName?: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountPercent?: number;
  discountAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  lineTotal: number;
}

export type SOStatus = 'draft' | 'confirmed' | 'partially_delivered' | 'delivered' | 'cancelled';
```

### 2. Repository, Use Cases, API

Path: `companies/{companyId}/sales/Data/sales_orders`

| Use Case | Description |
|----------|-------------|
| `CreateSalesOrderUseCase` | Creates SO, optionally from quotation |
| `ConfirmSalesOrderUseCase` | Confirms SO, optionally reserves stock |
| `CancelSalesOrderUseCase` | Only if no deliveries |
| `ListSalesOrdersUseCase` | Paginated with filters |

| Method | Path |
|--------|------|
| GET | `/api/sales/orders` |
| GET | `/api/sales/orders/:id` |
| POST | `/api/sales/orders` |
| PUT | `/api/sales/orders/:id` |
| POST | `/api/sales/orders/:id/confirm` |
| POST | `/api/sales/orders/:id/cancel` |

---

## Frontend

### Pages
- `SalesOrdersPage.tsx` — List with delivery % and invoice % columns
- `SalesOrderFormPage.tsx` — Customer selector, lines table, warehouse, dates

---

## Verification

1. Create SO from quotation → verify lines copied
2. Confirm SO → verify status change
3. Cancel SO with no deliveries → success
4. Cancel SO with deliveries → blocked
