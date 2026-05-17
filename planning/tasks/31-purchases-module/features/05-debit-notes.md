# Feature 05: Debit Notes (Purchase Returns)

## Goal
Handle returns to suppliers with debit notes that reverse inventory and AP entries.

---

## Backend

### 1. `DebitNote` Entity
**File:** `backend/src/domain/purchases/entities/DebitNote.ts` [NEW]

```typescript
export class DebitNote {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly debitNoteNumber: string,    // DN-0001
    public readonly supplierId: string,
    public readonly purchaseInvoiceId?: string, // Original invoice
    public readonly date: string,
    public readonly currency: string,
    public readonly exchangeRate: number = 1,
    public readonly lines: DebitNoteLine[],
    public readonly subtotal: number,
    public readonly taxAmount: number = 0,
    public readonly total: number,
    public readonly reason: string,
    public readonly status: 'draft' | 'posted' = 'draft',
    public readonly voucherId?: string,
    public readonly createdBy?: string,
    public readonly createdAt?: Date,
    public readonly postedAt?: Date
  ) {}
}

export interface DebitNoteLine {
  lineNo: number;
  itemId?: string;
  itemName?: string;
  description?: string;
  accountId: string;
  quantity: number;
  unitPrice: number;
  taxAmount?: number;
  lineTotal: number;
}
```

### 2. Post Logic

When a debit note is posted:
1. **Reverse AP:** Create voucher (Debit: AP, Credit: Purchase Expense/Inventory)
2. **Reverse Stock:** If items are returned, record stock movements:
   - Direction: `out` (if returned to supplier) or `in` (if credited without return)
   - Type: `return_out`

### 3. API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/purchases/debit-notes` | List |
| POST | `/api/purchases/debit-notes` | Create |
| POST | `/api/purchases/debit-notes/from-invoice/:invoiceId` | Create from invoice |
| POST | `/api/purchases/debit-notes/:id/post` | Post |

---

## Frontend

### Debit Notes Page
**File:** `frontend/src/modules/purchases/pages/DebitNotesPage.tsx` [NEW]

Similar to invoices but with return-specific fields (reason, original invoice reference).

---

## Verification

1. Create debit note from invoice → verify lines pre-filled
2. Post debit note → verify AP reversal voucher created
3. Post debit note with items → verify stock decreases (returned to supplier)
4. Verify supplier balance decreases
