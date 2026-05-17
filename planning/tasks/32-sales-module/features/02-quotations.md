# Feature 02: Quotations

## Goal
Implement sales quotations with validity periods and conversion to sales orders.

---

## Backend

### 1. `Quotation` Entity
**File:** `backend/src/domain/sales/entities/Quotation.ts` [NEW]

```typescript
export class Quotation {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly quotationNumber: string,   // QT-0001
    public readonly customerId: string,
    public readonly date: string,
    public readonly validUntil: string,         // Expiry date
    public readonly currency: string,
    public readonly exchangeRate: number = 1,
    public readonly lines: QuotationLine[],
    public readonly subtotal: number,
    public readonly discountAmount: number = 0,
    public readonly taxAmount: number = 0,
    public readonly total: number,
    public readonly status: QuotationStatus = 'draft',
    public readonly notes?: string,
    public readonly termsAndConditions?: string,
    public readonly salesOrderId?: string,     // Converted SO
    public readonly createdBy?: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date
  ) {}
}

export interface QuotationLine {
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

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';
```

### 2. Repository, Use Cases, API

Path: `companies/{companyId}/sales/Data/quotations`

| Use Case | Description |
|----------|-------------|
| `CreateQuotationUseCase` | Creates quotation, generates number |
| `UpdateQuotationUseCase` | Draft only |
| `ConvertToSOUseCase` | Creates Sales Order from quotation, marks as converted |
| `MarkSentUseCase` | Updates status to sent |

| Method | Path |
|--------|------|
| GET | `/api/sales/quotations` |
| POST | `/api/sales/quotations` |
| PUT | `/api/sales/quotations/:id` |
| POST | `/api/sales/quotations/:id/send` |
| POST | `/api/sales/quotations/:id/convert-to-so` |

---

## Frontend

### Pages
- `QuotationsPage.tsx` — List with status filtering + expiry highlighting
- `QuotationFormPage.tsx` — Item lines, pricing, terms, validity date
- Print/PDF preview for sending to customer

---

## Verification

1. Create quotation → verify totals
2. Mark as sent → verify status change
3. Convert to SO → verify SO created with same lines, quotation marked converted
4. Verify expired quotations highlighted after validUntil date
