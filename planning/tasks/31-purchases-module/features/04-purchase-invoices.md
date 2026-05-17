# Feature 04: Purchase Invoices & AP Posting

## Goal
Implement purchase invoice management with **automatic accounting voucher generation** — the critical integration point between Purchases and Accounting modules.

---

## Overview

This is the most important feature in the Purchases module. When a purchase invoice is **posted**, it must:
1. Create an accounting voucher (Debit: Purchases/Inventory, Credit: AP)
2. Record the voucher via the existing `CreateVoucherUseCase` + auto-post
3. Link the voucher back to the invoice for auditability

---

## Backend

### 1. `PurchaseInvoice` Entity
**File:** `backend/src/domain/purchases/entities/PurchaseInvoice.ts` [NEW]

```typescript
export class PurchaseInvoice {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly invoiceNumber: string,      // PI-0001
    public readonly supplierInvoiceNo?: string, // Vendor's invoice number
    public readonly supplierId: string,
    public readonly purchaseOrderId?: string,
    public readonly goodsReceiptId?: string,
    public readonly date: string,
    public readonly dueDate?: string,
    public readonly currency: string,
    public readonly exchangeRate: number = 1,
    public readonly lines: PurchaseInvoiceLine[],
    public readonly subtotal: number,
    public readonly discountAmount: number = 0,
    public readonly taxAmount: number = 0,
    public readonly total: number,
    public readonly amountPaid: number = 0,
    public readonly status: InvoiceStatus = 'draft',
    public readonly voucherId?: string,          // Generated accounting voucher
    public readonly matchingStatus: 'unmatched' | 'partial' | 'matched' | 'override' = 'unmatched', // Three-way matching
    public readonly notes?: string,
    public readonly paymentTerms?: string,
    public readonly createdBy?: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
    public readonly postedAt?: Date
  ) {}

  get balanceDue(): number {
    return this.total - this.amountPaid;
  }

  get isPaid(): boolean {
    return Math.abs(this.balanceDue) < 0.01;
  }
}

export interface PurchaseInvoiceLine {
  lineNo: number;
  itemId?: string;
  itemName?: string;
  description?: string;
  accountId: string;        // Expense or Inventory account
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountPercent?: number;
  discountAmount?: number;
  taxCategoryId?: string;   // Links to TaxCategory for auto-calculation
  taxAccountId?: string;    // Resolved by TaxCalculationEngine (Input Tax account)
  taxRate?: number;         // Resolved by TaxCalculationEngine
  taxAmount?: number;       // Resolved by TaxCalculationEngine
  lineTotal: number;
}

export type InvoiceStatus = 'draft' | 'posted' | 'partially_paid' | 'paid' | 'cancelled';
```

### 2. New Voucher Strategy: `PurchaseInvoiceStrategy`
**File:** `backend/src/domain/accounting/strategies/implementations/PurchaseInvoiceStrategy.ts` [NEW]

```typescript
import { IVoucherPostingStrategy } from '../IVoucherPostingStrategy';
import { VoucherLineEntity, roundMoney } from '../../entities/VoucherLineEntity';

/**
 * PurchaseInvoiceStrategy
 * 
 * Generates accounting entries for purchase invoices.
 * 
 * Standard posting:
 *   Debit: Purchase Expense / Inventory Asset (per line accountId)
 *   Credit: Accounts Payable (supplier's AP account)
 * 
 * If tax applies:
 *   Debit: Input Tax account (per line tax)
 *   Credit: Accounts Payable (full amount including tax)
 */
export class PurchaseInvoiceStrategy implements IVoucherPostingStrategy {
  async generateLines(header: any, companyId: string, baseCurrency: string): Promise<VoucherLineEntity[]> {
    const lines: VoucherLineEntity[] = [];
    let lineCounter = 1;
    
    // Debit lines (one per invoice line)
    for (const invoiceLine of header.lines) {
      const amount = roundMoney(invoiceLine.lineTotal - (invoiceLine.taxAmount || 0));
      const baseAmount = roundMoney(amount * (header.exchangeRate || 1));
      
      lines.push(new VoucherLineEntity(
        lineCounter++,
        invoiceLine.accountId,
        'Debit',
        baseAmount,
        baseCurrency,
        amount,
        header.currency || baseCurrency,
        header.exchangeRate || 1,
        invoiceLine.description || invoiceLine.itemName,
        undefined, // costCenterId
        {}         // metadata
      ));
      
      // Tax line (if applicable) — uses PER-LINE taxAccountId from TaxCalculationEngine
      if (invoiceLine.taxAmount && invoiceLine.taxAmount > 0 && invoiceLine.taxAccountId) {
        const taxBase = roundMoney(invoiceLine.taxAmount * (header.exchangeRate || 1));
        lines.push(new VoucherLineEntity(
          lineCounter++,
          invoiceLine.taxAccountId,  // Per-line: resolved by TaxCalculationEngine
          'Debit',
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
    
    // Credit line: Accounts Payable (total)
    const totalBase = roundMoney(header.total * (header.exchangeRate || 1));
    lines.push(new VoucherLineEntity(
      lineCounter++,
      header.apAccountId,  // Supplier's AP account
      'Credit',
      totalBase,
      baseCurrency,
      header.total,
      header.currency || baseCurrency,
      header.exchangeRate || 1,
      `AP - ${header.supplierName || ''}`,
      undefined, // costCenterId
      {}         // metadata
    ));
    
    return lines;
  }
}
```

### 3. Register Strategy in Factory
**File:** `backend/src/domain/accounting/factories/VoucherPostingStrategyFactory.ts`

Add case **before** the `default` throw:
```typescript
case 'purchase_invoice':
  return new PurchaseInvoiceStrategy();
```

> [!WARNING]
> The existing `default` case **throws an error** for unknown types. The new cases MUST be added before testing, or change `default` to `return null` and update the return type to `IVoucherPostingStrategy | null`.

### 4. Add VoucherType
**File:** `backend/src/domain/accounting/types/VoucherTypes.ts`

Add to enum:
```typescript
PURCHASE_INVOICE = 'purchase_invoice',
```

### 5. Use Cases

| Use Case | Description |
|----------|-------------|
| `CreatePurchaseInvoiceUseCase` | Creates invoice, validates AP account exists |
| `PostPurchaseInvoiceUseCase` | **Critical:** Posts invoice → generates voucher → posts voucher |

**`PostPurchaseInvoiceUseCase` Flow:**
```
1. Load invoice, validate status is 'draft'
2. Execute `ThreeWayMatchingService(invoice)`:
   - Compares invoice lines against linked PO and GRN.
   - If mismatch (qty/price out of tolerance), block posting unless `override` permission exists.
   - Set `matchingStatus`.
3. For each line with taxCategoryId:
   - Call TaxCalculationEngine.calculateLineTax() → resolves taxRate, taxAmount, taxAccountId
4. Wrap steps 5-8 in transactionManager.runTransaction():
5. Prepare voucher payload:
   - type: 'purchase_invoice'
   - sourceModule: 'purchases'
   - lines from invoice (with resolved tax fields)
   - apAccountId from supplier
6. Call CreateVoucherUseCase.execute()
7. Auto-approve the voucher (skip approval workflow for system-generated)
8. Call PostVoucherUseCase.execute() → ledger entries created
9. Update invoice: voucherId = generated voucher ID, status = 'posted'
```

| `UpdatePurchaseInvoiceUseCase` | Only if draft |
| `CancelPurchaseInvoiceUseCase` | Reverse voucher if posted |
| `RecordPaymentUseCase` | Updates amountPaid, links to payment voucher |

### 6. API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/purchases/invoices` | List invoices |
| GET | `/api/purchases/invoices/:id` | Get invoice |
| POST | `/api/purchases/invoices` | Create |
| PUT | `/api/purchases/invoices/:id` | Update (draft only) |
| POST | `/api/purchases/invoices/:id/post` | Post → generate voucher |
| POST | `/api/purchases/invoices/:id/cancel` | Cancel (reverse voucher) |
| POST | `/api/purchases/invoices/from-grn/:grnId` | Create from GRN |
| POST | `/api/purchases/invoices/from-po/:poId` | Create from PO |

---

## Frontend

### Invoice List
**File:** `frontend/src/modules/purchases/pages/PurchaseInvoicesPage.tsx` [NEW]

- Table: Invoice#, Vendor Invoice#, Supplier, Date, Due Date, Total, Paid, Balance, Status, Match Status
- Status badges: Draft, Posted, Partially Paid, Paid
- Match badges: Unmatched, Matched (Green), Partial (Warning)
- Overdue highlighting (red if past due date)

### Invoice Form
**File:** `frontend/src/modules/purchases/pages/PurchaseInvoiceFormPage.tsx` [NEW]

- Header: Supplier (selector), Date, Due Date, Vendor Invoice No, Currency, Exchange Rate, PO Reference
- Lines table:
  - Item selector (optional — can also select account directly)
  - Description, Account (auto-from item or manual AccountSelector), Qty, Unit Price, Discount %, Tax %, Line Total
- Totals section: Subtotal, Discount, Tax, Total
- Actions: Save Draft, Post (with confirmation modal)

### Invoice Detail View
Show posted invoice with:
- Invoice data (read-only)
- Link to generated accounting voucher
- Payment history
- "Record Payment" button

---

## Verification

1. Create invoice with 3 lines → verify totals calculate correctly
2. Post invoice → verify accounting voucher created
3. Verify voucher lines: Debit expenses match invoice lines, Credit AP matches total
4. Verify voucher is posted in accounting module (visible in voucher list)
5. Verify AP account balance increases after posting
6. Cancel posted invoice → verify reversal voucher created
7. Test multi-currency invoice → verify exchange rate applied correctly
8. Create from GRN → verify lines pre-filled
