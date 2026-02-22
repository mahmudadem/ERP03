# Feature 04: Delivery Notes

## Goal
Record goods delivered to customers, link to sales orders, and trigger inventory stock movements.

---

## Backend

### 1. `DeliveryNote` Entity
**File:** `backend/src/domain/sales/entities/DeliveryNote.ts` [NEW]

```typescript
export class DeliveryNote {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly deliveryNumber: string,    // DN-0001
    public readonly customerId: string,
    public readonly salesOrderId?: string,
    public readonly warehouseId: string,        // Source warehouse
    public readonly date: string,
    public readonly lines: DeliveryNoteLine[],
    public readonly status: 'draft' | 'posted' = 'draft',
    public readonly shippingAddress?: string,
    public readonly notes?: string,
    public readonly createdBy?: string,
    public readonly createdAt?: Date,
    public readonly postedAt?: Date
  ) {}
}

export interface DeliveryNoteLine {
  lineNo: number;
  itemId: string;
  itemName?: string;
  quantityOrdered?: number;   // From SO
  quantityDelivered: number;
  unit: string;
  unitCost?: number;          // Cost for COGS calculation
}
```

### 2. Post Logic

**`PostDeliveryNoteUseCase` Flow:**
1. Validate stock availability (per line, per warehouse)
2. For each line:
   - Call `RecordStockMovementUseCase`:
     - Direction: `out`
     - Type: `sales_delivery`
     - Reference: Delivery Note ID
3. If linked to SO, update SO's `deliveredQuantities`
4. Optionally generate COGS journal entry:
   - Debit: COGS Account
   - Credit: Inventory Asset Account
   - Amount: quantity × average cost (from stock level)
5. Set DN status to `posted`

### 3. API Routes

| Method | Path |
|--------|------|
| GET | `/api/sales/delivery-notes` |
| POST | `/api/sales/delivery-notes` |
| POST | `/api/sales/delivery-notes/from-so/:soId` |
| POST | `/api/sales/delivery-notes/:id/post` |

---

## Frontend

### Pages
- `DeliveryNotesPage.tsx` — List with status
- `DeliveryNoteFormPage.tsx` — Customer, SO reference (auto-populate), warehouse, lines
- Create from SO: show outstanding quantities

---

## Verification

1. Create DN from SO → lines pre-filled with undelivered quantities
2. Post DN → stock decreases in warehouse
3. Post DN → SO deliveredQuantities updated
4. Try to post DN when stock insufficient → verify error
5. Verify COGS journal entry created (if accounting integration enabled)
