# Feature 05: Sales Invoices & AR Posting

## Goal
Implement sales invoice management with **automatic AR voucher generation** — the critical accounting integration point for the Sales module.

---

## Overview

When a sales invoice is **posted**, it must:
1. Create an accounting voucher (Debit: AR, Credit: Revenue)
2. Post the voucher to the ledger
3. Track customer balances

---

## Backend

### 1. `SalesInvoice` Entity
**File:** `backend/src/domain/sales/entities/SalesInvoice.ts` [NEW]

```typescript
export class SalesInvoice {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly invoiceNumber: string,     // SI-0001
    public readonly customerId: string,
    public readonly salesOrderId?: string,
    public readonly deliveryNoteId?: string,
    public readonly date: string,
    public readonly dueDate?: string,
    public readonly currency: string,
    public readonly exchangeRate: number = 1,
    public readonly lines: SalesInvoiceLine[],
    public readonly subtotal: number,
    public readonly discountAmount: number = 0,
    public readonly taxAmount: number = 0,
    public readonly total: number,
    public readonly amountReceived: number = 0,
    public readonly status: SalesInvoiceStatus = 'draft',
    public readonly voucherId?: string,        // Generated accounting voucher
    public readonly notes?: string,
    public readonly paymentTerms?: string,
    public readonly createdBy?: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
    public readonly postedAt?: Date
  ) {}

  get balanceDue(): number {
    return this.total - this.amountReceived;
  }

  get isPaid(): boolean {
    return Math.abs(this.balanceDue) < 0.01;
  }
}

export interface SalesInvoiceLine {
  lineNo: number;
  itemId?: string;
  itemName?: string;
  description?: string;
  accountId: string;         // Revenue account
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountPercent?: number;
  discountAmount?: number;
  taxCategoryId?: string;    // Links to TaxCategory for auto-calculation
  taxAccountId?: string;     // Resolved by TaxCalculationEngine (Output Tax account)
  taxRate?: number;          // Resolved by TaxCalculationEngine
  taxAmount?: number;        // Resolved by TaxCalculationEngine
  lineTotal: number;
}

export type SalesInvoiceStatus = 'draft' | 'posted' | 'partially_paid' | 'paid' | 'cancelled';
```

### 2. New Voucher Strategy: `SalesInvoiceStrategy`
**File:** `backend/src/domain/accounting/strategies/implementations/SalesInvoiceStrategy.ts` [NEW]

```typescript
/**
 * SalesInvoiceStrategy
 * 
 * Generates accounting entries for sales invoices.
 * 
 * Standard posting:
 *   Debit: Accounts Receivable (customer's AR account) → total
 *   Credit: Sales Revenue (per line accountId)          → net amounts
 *   Credit: Output Tax (if applicable)                 → tax amounts
 */
export class SalesInvoiceStrategy implements IVoucherPostingStrategy {
  async generateLines(header: any, companyId: string, baseCurrency: string): Promise<VoucherLineEntity[]> {
    const lines: VoucherLineEntity[] = [];
    let lineCounter = 1;
    
    // Debit: Accounts Receivable (total)
    const totalBase = roundMoney(header.total * (header.exchangeRate || 1));
    lines.push(new VoucherLineEntity(
      lineCounter++,
      header.arAccountId,
      'Debit',
      totalBase,
      baseCurrency,
      header.total,
      header.currency || baseCurrency,
      header.exchangeRate || 1,
      `AR - ${header.customerName || ''}`,
      undefined, // costCenterId
      {}         // metadata
    ));
    
    // Credit lines (one per invoice line — revenue)
    for (const invoiceLine of header.lines) {
      const amount = roundMoney(invoiceLine.lineTotal - (invoiceLine.taxAmount || 0));
      const baseAmount = roundMoney(amount * (header.exchangeRate || 1));
      
      lines.push(new VoucherLineEntity(
        lineCounter++,
        invoiceLine.accountId,
        'Credit',
        baseAmount,
        baseCurrency,
        amount,
        header.currency || baseCurrency,
        header.exchangeRate || 1,
        invoiceLine.description || invoiceLine.itemName,
        undefined, // costCenterId
        {}         // metadata
      ));
      
      // Tax line — uses PER-LINE taxAccountId from TaxCalculationEngine
      if (invoiceLine.taxAmount && invoiceLine.taxAmount > 0 && invoiceLine.taxAccountId) {
        const taxBase = roundMoney(invoiceLine.taxAmount * (header.exchangeRate || 1));
        lines.push(new VoucherLineEntity(
          lineCounter++,
          invoiceLine.taxAccountId,  // Per-line: resolved by TaxCalculationEngine
          'Credit',
          taxBase,
          baseCurrency,
          invoiceLine.taxAmount,
          header.currency || baseCurrency,
          header.exchangeRate || 1,
          `Tax - ${invoiceLine.itemName || ''}`,
          undefined, // costCenterId
          {}         // metadata
        ));
      }
    }
    
    return lines;
  }
}
```

### 3. Register Strategy
Add to `VoucherPostingStrategyFactory` **before** the `default` throw:
```typescript
case 'sales_invoice':
  return new SalesInvoiceStrategy();
```

> [!WARNING]
> Same as PurchaseInvoice — the `default` case throws. Add this case before testing.

Add to `VoucherType` enum:
```typescript
SALES_INVOICE = 'sales_invoice',
```

### 4. Use Cases

| Use Case | Description |
|----------|-------------|
| `CreateSalesInvoiceUseCase` | Validates AR account, generates number |
| `PostSalesInvoiceUseCase` | Posts → creates AR voucher → posts to ledger |
| `CancelSalesInvoiceUseCase` | Reverses voucher |
| `RecordReceiptUseCase` | Updates amountReceived, links to receipt voucher |

**`PostSalesInvoiceUseCase` Flow:**
Same as PurchaseInvoice but reversed sides (Debit AR, Credit Revenue).
1. Validate invoice status is 'draft'
2. For each line with `taxCategoryId`: call `TaxCalculationEngine` → resolve tax fields
3. Wrap steps 4-7 in `transactionManager.runTransaction()`
4. Prepare voucher payload with type `'sales_invoice'`
5. Call `CreateVoucherUseCase.execute()`
6. Call `PostVoucherUseCase.execute()` → ledger entries created
7. Update invoice: `voucherId`, `status = 'posted'`

> [!NOTE]
> Sales Invoices do **NOT** have three-way matching (by design). Matching is a purchases-only concern.

### 5. API Routes

| Method | Path |
|--------|------|
| GET | `/api/sales/invoices` |
| GET | `/api/sales/invoices/:id` |
| POST | `/api/sales/invoices` |
| PUT | `/api/sales/invoices/:id` |
| POST | `/api/sales/invoices/:id/post` |
| POST | `/api/sales/invoices/:id/cancel` |
| POST | `/api/sales/invoices/from-dn/:dnId` |
| POST | `/api/sales/invoices/from-so/:soId` |

---

## Frontend

### Pages
- `SalesInvoicesPage.tsx` — List with status, amount, balance
- `SalesInvoiceFormPage.tsx` — Customer, lines, pricing, post action
- Invoice detail with voucher link and payment history

---

## Verification

1. Post invoice → verify AR voucher created
2. Verify: Debit AR = total, Credit Revenue = line amounts, Credit Tax = tax amounts
3. Cancel posted invoice → verify reversal voucher
4. Multi-currency invoice → verify exchange rate applied
5. Record receipt → verify amountReceived updated, status transitions to paid
