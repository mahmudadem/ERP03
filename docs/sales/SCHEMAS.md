# Sales Module — Schema Definitions

> **Status:** DRAFT — Pending Review  
> **Convention:** Fields marked `[R]` are required; `[O]` are optional.  
> **Precision:** Monetary values use `roundMoney()` (2dp). FX rates stored at 6+ dp.  
> **Shared Entities:** Party, TaxCode, Item — already defined in [Purchase SCHEMAS.md](../purchases/SCHEMAS.md).

---

## Shared Entities — Sales Extensions

### S3  Item Extensions (additions for Sales)

```typescript
// ADD to existing ItemProps (in addition to existing purchase tax fields):
  revenueAccountId?: string;                     // [O] Override default revenue account
  cogsAccountId?: string;                        // [O] Override default COGS account
  // existing: defaultSalesTaxCodeId?: string;   // [O] Already implemented in Phase 0
```

---

## Sales Module Entities

These entities live under `domain/sales/`.

---

### SL1  SalesSettings

```typescript
type SalesControlMode = 'SIMPLE' | 'CONTROLLED';

interface SalesSettingsProps {
  companyId: string;                             // [R] Primary key

  // ═══ CORE POLICY ═══
  salesControlMode: SalesControlMode;            // [R] default 'SIMPLE'
  requireSOForStockItems: boolean;               // [R] default false (SIMPLE), forced true (CONTROLLED)

  // ═══ ACCOUNTING DEFAULTS ═══
  defaultARAccountId: string;                    // [R] Default Accounts Receivable GL account
  defaultRevenueAccountId: string;               // [R] Default revenue account
  defaultCOGSAccountId?: string;                 // [O] Default Cost of Goods Sold account
  defaultSalesExpenseAccountId?: string;         // [O] Default expense for services

  // ═══ TOLERANCES ═══
  allowOverDelivery: boolean;                    // [R] default false
  overDeliveryTolerancePct: number;              // [R] default 0
  overInvoiceTolerancePct: number;               // [R] default 0

  // ═══ DEFAULTS ═══
  defaultPaymentTermsDays: number;               // [R] default 30
  salesVoucherTypeId?: string;                   // [O] Accounting voucher type for sales posting
  defaultWarehouseId?: string;                   // [O] Pre-selected warehouse

  // ═══ NUMBERING ═══
  soNumberPrefix: string;                        // [R] default 'SO'
  soNumberNextSeq: number;                       // [R] default 1
  dnNumberPrefix: string;                        // [R] default 'DN'
  dnNumberNextSeq: number;                       // [R] default 1
  siNumberPrefix: string;                        // [R] default 'SI'
  siNumberNextSeq: number;                       // [R] default 1
  srNumberPrefix: string;                        // [R] default 'SR'
  srNumberNextSeq: number;                       // [R] default 1
}
```

#### Constraints
- One record per `companyId`.
- When `salesControlMode = 'CONTROLLED'`, `requireSOForStockItems` forced to `true`.
- `defaultARAccountId` must point to a valid GL account (ASSET classification).
- `defaultRevenueAccountId` must point to a valid GL account (REVENUE classification).

---

### SL2  SalesOrder

```typescript
type SOStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PARTIALLY_DELIVERED'
  | 'FULLY_DELIVERED'
  | 'CLOSED'
  | 'CANCELLED';

interface SalesOrderProps {
  // ═══ IDENTITY ═══
  id: string;                                    // [R] UUID
  companyId: string;                             // [R]
  orderNumber: string;                           // [R] Auto-generated

  // ═══ CUSTOMER ═══
  customerId: string;                            // [R] FK → Party (must have 'CUSTOMER' role)
  customerName: string;                          // [R] Snapshot

  // ═══ DATES ═══
  orderDate: string;                             // [R] ISO date
  expectedDeliveryDate?: string;                 // [O]

  // ═══ CURRENCY ═══
  currency: string;                              // [R] Document currency
  exchangeRate: number;                          // [R]

  // ═══ LINES ═══
  lines: SalesOrderLine[];                       // [R] At least one

  // ═══ TOTALS ═══
  subtotalBase: number;                          // [R]
  taxTotalBase: number;                          // [R]
  grandTotalBase: number;                        // [R]
  subtotalDoc: number;                           // [R]
  taxTotalDoc: number;                           // [R]
  grandTotalDoc: number;                         // [R]

  // ═══ STATUS ═══
  status: SOStatus;                              // [R] default 'DRAFT'

  // ═══ NOTES ═══
  notes?: string;                                // [O]
  internalNotes?: string;                        // [O]

  // ═══ GOVERNANCE ═══
  createdBy: string;                             // [R]
  createdAt: Date;                               // [R]
  updatedAt: Date;                               // [R]
  confirmedAt?: Date;                            // [O]
  closedAt?: Date;                               // [O]
}
```

```typescript
interface SalesOrderLine {
  lineId: string;                                // [R] UUID
  lineNo: number;                                // [R]

  // ═══ ITEM ═══
  itemId: string;                                // [R] FK → Item
  itemCode: string;                              // [R] Snapshot
  itemName: string;                              // [R] Snapshot
  itemType: 'PRODUCT' | 'SERVICE' | 'RAW_MATERIAL'; // [R] Snapshot
  trackInventory: boolean;                       // [R] Snapshot

  // ═══ QUANTITIES ═══
  orderedQty: number;                            // [R]
  uom: string;                                   // [R]
  deliveredQty: number;                          // [R] Accumulated from DNs, default 0
  invoicedQty: number;                           // [R] Accumulated from SIs, default 0
  returnedQty: number;                           // [R] Accumulated from SRs, default 0

  // ═══ PRICING (document currency) ═══
  unitPriceDoc: number;                          // [R] Selling price
  lineTotalDoc: number;                          // [R] orderedQty × unitPriceDoc

  // ═══ PRICING (base currency) ═══
  unitPriceBase: number;                         // [R]
  lineTotalBase: number;                         // [R]

  // ═══ TAX ═══
  taxCodeId?: string;                            // [O]
  taxRate: number;                               // [R] default 0
  taxAmountDoc: number;                          // [R]
  taxAmountBase: number;                         // [R]

  // ═══ WAREHOUSE ═══
  warehouseId?: string;                          // [O]

  // ═══ NOTES ═══
  description?: string;                          // [O]
}
```

#### Computed Fields
```typescript
openDeliverQty  = orderedQty - deliveredQty
openInvoiceQty  = (trackInventory && mode === 'CONTROLLED')
                    ? deliveredQty - invoicedQty
                    : orderedQty - invoicedQty
```

---

### SL3  DeliveryNote (DN)

```typescript
type DNStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

interface DeliveryNoteProps {
  // ═══ IDENTITY ═══
  id: string;                                    // [R] UUID
  companyId: string;                             // [R]
  dnNumber: string;                              // [R] Auto-generated

  // ═══ SOURCE ═══
  salesOrderId?: string;                         // [O] FK → SalesOrder (required in CONTROLLED)
  customerId: string;                            // [R] FK → Party
  customerName: string;                          // [R] Snapshot

  // ═══ DELIVERY INFO ═══
  deliveryDate: string;                          // [R] ISO date
  warehouseId: string;                           // [R] Source warehouse

  // ═══ LINES ═══
  lines: DeliveryNoteLine[];                     // [R]

  // ═══ STATUS ═══
  status: DNStatus;                              // [R] default 'DRAFT'
  notes?: string;                                // [O]

  // ═══ ACCOUNTING RESULT ═══
  cogsVoucherId?: string;                        // [O] COGS voucher (set after posting)

  // ═══ GOVERNANCE ═══
  createdBy: string;                             // [R]
  createdAt: Date;                               // [R]
  updatedAt: Date;                               // [R]
  postedAt?: Date;                               // [O]
}
```

```typescript
interface DeliveryNoteLine {
  lineId: string;                                // [R]
  lineNo: number;                                // [R]

  // ═══ LINK ═══
  soLineId?: string;                             // [O] FK → SalesOrderLine.lineId

  // ═══ ITEM ═══
  itemId: string;                                // [R]
  itemCode: string;                              // [R] Snapshot
  itemName: string;                              // [R] Snapshot

  // ═══ QUANTITY ═══
  deliveredQty: number;                          // [R]
  uom: string;                                   // [R]

  // ═══ COST (from inventory engine on posting) ═══
  unitCostBase: number;                          // [R] WAC at delivery time
  lineCostBase: number;                          // [R] deliveredQty × unitCostBase
  moveCurrency: string;                          // [R]
  fxRateMovToBase: number;                       // [R]
  fxRateCCYToBase: number;                       // [R]

  // ═══ INVENTORY RESULT ═══
  stockMovementId?: string;                      // [O] Set after posting

  // ═══ NOTES ═══
  description?: string;                          // [O]
}
```

#### Posting Effects
- Creates `SALES_DELIVERY` (OUT) movement per line → `ISalesInventoryService.processOUT()`
- Creates COGS GL voucher: `Dr COGS, Cr Inventory` (per line, accumulated)
- Updates SO line `deliveredQty`
- **Does NOT create AR or Revenue entries**

---

### SL4  SalesInvoice

```typescript
type SIStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

interface SalesInvoiceProps {
  // ═══ IDENTITY ═══
  id: string;                                    // [R]
  companyId: string;                             // [R]
  invoiceNumber: string;                         // [R] Auto-generated
  customerInvoiceNumber?: string;                // [O] Customer's PO reference

  // ═══ SOURCE ═══
  salesOrderId?: string;                         // [O] FK → SalesOrder
  customerId: string;                            // [R] FK → Party
  customerName: string;                          // [R] Snapshot

  // ═══ DATES ═══
  invoiceDate: string;                           // [R]
  dueDate?: string;                              // [O]

  // ═══ CURRENCY ═══
  currency: string;                              // [R]
  exchangeRate: number;                          // [R]

  // ═══ LINES ═══
  lines: SalesInvoiceLine[];                     // [R]

  // ═══ TOTALS ═══
  subtotalDoc: number;                           // [R]
  taxTotalDoc: number;                           // [R]
  grandTotalDoc: number;                         // [R]
  subtotalBase: number;                          // [R]
  taxTotalBase: number;                          // [R]
  grandTotalBase: number;                        // [R]

  // ═══ PAYMENT TRACKING ═══
  paymentTermsDays: number;                      // [R]
  paymentStatus: PaymentStatus;                  // [R] default 'UNPAID'
  paidAmountBase: number;                        // [R] default 0
  outstandingAmountBase: number;                 // [R] grandTotalBase − paidAmountBase

  // ═══ STATUS ═══
  status: SIStatus;                              // [R] default 'DRAFT'

  // ═══ ACCOUNTING RESULT ═══
  voucherId?: string;                            // [O] Revenue voucher
  cogsVoucherId?: string;                        // [O] COGS voucher (SIMPLE mode only)

  // ═══ NOTES ═══
  notes?: string;                                // [O]

  // ═══ GOVERNANCE ═══
  createdBy: string;                             // [R]
  createdAt: Date;                               // [R]
  updatedAt: Date;                               // [R]
  postedAt?: Date;                               // [O]
}
```

```typescript
interface SalesInvoiceLine {
  lineId: string;                                // [R]
  lineNo: number;                                // [R]

  // ═══ LINKS ═══
  soLineId?: string;                             // [O]
  dnLineId?: string;                             // [O]

  // ═══ ITEM ═══
  itemId: string;                                // [R]
  itemCode: string;                              // [R]
  itemName: string;                              // [R]
  trackInventory: boolean;                       // [R]

  // ═══ QUANTITY ═══
  invoicedQty: number;                           // [R]
  uom: string;                                   // [R]

  // ═══ PRICING (document currency) ═══
  unitPriceDoc: number;                          // [R] Selling price
  lineTotalDoc: number;                          // [R]

  // ═══ PRICING (base currency) ═══
  unitPriceBase: number;                         // [R]
  lineTotalBase: number;                         // [R]

  // ═══ TAX (frozen at posting) ═══
  taxCodeId?: string;                            // [O]
  taxCode?: string;                              // [O]
  taxRate: number;                               // [R]
  taxAmountDoc: number;                          // [R]
  taxAmountBase: number;                         // [R]

  // ═══ WAREHOUSE (SIMPLE stock items) ═══
  warehouseId?: string;                          // [O]

  // ═══ ACCOUNTING ═══
  revenueAccountId: string;                      // [R] Resolved revenue GL account
  cogsAccountId?: string;                        // [O] Resolved COGS account (stock items only)
  inventoryAccountId?: string;                   // [O] Resolved inventory account (stock items only)

  // ═══ COST (for COGS — populated on post) ═══
  unitCostBase?: number;                         // [O] WAC at posting time (stock items)
  lineCostBase?: number;                         // [O] invoicedQty × unitCostBase

  // ═══ INVENTORY RESULT (SIMPLE stock items) ═══
  stockMovementId?: string;                      // [O]

  // ═══ NOTES ═══
  description?: string;                          // [O]
}
```

#### Posting Effects

**CONTROLLED (stock items — already delivered via DN):**
- Revenue voucher only: `Dr AR, Cr Revenue` + `Dr Tax Output`
- No inventory movement (already done by DN)
- No COGS entry (already done by DN)

**SIMPLE (stock items — no prior DN):**
- Revenue voucher: `Dr AR, Cr Revenue` + `Dr Tax Output`
- COGS entry: `Dr COGS, Cr Inventory`
- Inventory movement: `SALES_DELIVERY` OUT via `ISalesInventoryService.processOUT()`

**Services (both modes):**
- Revenue voucher: `Dr AR, Cr Revenue` + `Dr Tax Output`
- No inventory, no COGS

---

### SL5  SalesReturn

```typescript
type SRStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
type ReturnContext = 'AFTER_INVOICE' | 'BEFORE_INVOICE';

interface SalesReturnProps {
  // ═══ IDENTITY ═══
  id: string;                                    // [R]
  companyId: string;                             // [R]
  returnNumber: string;                          // [R] Auto-generated

  // ═══ SOURCE ═══
  salesInvoiceId?: string;                       // [O] FK → SalesInvoice (AFTER_INVOICE)
  deliveryNoteId?: string;                       // [O] FK → DeliveryNote (BEFORE_INVOICE)
  salesOrderId?: string;                         // [O] FK → SalesOrder
  customerId: string;                            // [R]
  customerName: string;                          // [R] Snapshot

  // ═══ CONTEXT ═══
  returnContext: ReturnContext;                   // [R]

  // ═══ DATES ═══
  returnDate: string;                            // [R]
  warehouseId: string;                           // [R] Receiving warehouse

  // ═══ CURRENCY ═══
  currency: string;                              // [R]
  exchangeRate: number;                          // [R]

  // ═══ LINES ═══
  lines: SalesReturnLine[];                      // [R]

  // ═══ TOTALS ═══
  subtotalDoc: number;                           // [R]
  taxTotalDoc: number;                           // [R]
  grandTotalDoc: number;                         // [R]
  subtotalBase: number;                          // [R]
  taxTotalBase: number;                          // [R]
  grandTotalBase: number;                        // [R]

  // ═══ REASON ═══
  reason: string;                                // [R]
  notes?: string;                                // [O]

  // ═══ STATUS ═══
  status: SRStatus;                              // [R] default 'DRAFT'

  // ═══ ACCOUNTING RESULT ═══
  revenueVoucherId?: string;                     // [O] Revenue reversal (AFTER_INVOICE only)
  cogsVoucherId?: string;                        // [O] COGS reversal (both contexts)

  // ═══ GOVERNANCE ═══
  createdBy: string;                             // [R]
  createdAt: Date;                               // [R]
  updatedAt: Date;                               // [R]
  postedAt?: Date;                               // [O]
}
```

```typescript
interface SalesReturnLine {
  lineId: string;                                // [R]
  lineNo: number;                                // [R]

  // ═══ LINKS ═══
  siLineId?: string;                             // [O]
  dnLineId?: string;                             // [O]
  soLineId?: string;                             // [O]

  // ═══ ITEM ═══
  itemId: string;                                // [R]
  itemCode: string;                              // [R]
  itemName: string;                              // [R]

  // ═══ QUANTITY ═══
  returnQty: number;                             // [R]
  uom: string;                                   // [R]

  // ═══ PRICING (for revenue reversal — AFTER_INVOICE only) ═══
  unitPriceDoc?: number;                         // [O] Original selling price
  unitPriceBase?: number;                        // [O]

  // ═══ COST (for COGS reversal) ═══
  unitCostBase: number;                          // [R] Original COGS cost
  fxRateMovToBase: number;                       // [R]
  fxRateCCYToBase: number;                       // [R]

  // ═══ TAX ═══
  taxCodeId?: string;                            // [O]
  taxRate: number;                               // [R] default 0
  taxAmountDoc: number;                          // [R]
  taxAmountBase: number;                         // [R]

  // ═══ ACCOUNTING ═══
  revenueAccountId?: string;                     // [O] For revenue reversal
  cogsAccountId?: string;                        // [O] For COGS reversal
  inventoryAccountId?: string;                   // [O]

  // ═══ INVENTORY RESULT ═══
  stockMovementId?: string;                      // [O]

  // ═══ NOTES ═══
  description?: string;                          // [O]
}
```

#### Posting Effects by Context

| `returnContext` | Inventory | Revenue GL | COGS GL |
|----------------|-----------|------------|---------|
| `AFTER_INVOICE` | ✅ `RETURN_IN` | ✅ `Dr Revenue, Cr AR` + tax | ✅ `Dr Inventory, Cr COGS` |
| `BEFORE_INVOICE` | ✅ `RETURN_IN` | ❌ None | ✅ `Dr Inventory, Cr COGS` (reverses DN's COGS) |

---

## GL Voucher Line Templates

### Delivery Note Posting (COGS)
```
Dr  COGS Account              lineCostBase      (item → category → company default)
  Cr  Inventory Asset Account  lineCostBase      (item → category → company default)
```

### Sales Invoice Posting — Revenue (CONTROLLED or service)
```
Dr  Accounts Receivable        grandTotalBase    (customer → company default)
  Cr  Revenue Account          lineTotalBase     (item → category → company default)
  Cr  Sales Tax Account        taxAmountBase     (from TaxCode)
```

### Sales Invoice Posting — SIMPLE stock (Revenue + COGS + Delivery)
```
Dr  Accounts Receivable        grandTotalBase
  Cr  Revenue Account          lineTotalBase
  Cr  Sales Tax Account        taxAmountBase

Dr  COGS Account               lineCostBase
  Cr  Inventory Asset Account   lineCostBase
```

### Sales Return Posting (AFTER_INVOICE)
```
Dr  Revenue Account            lineTotalBase     (reverse revenue)
Dr  Sales Tax Account          taxAmountBase     (reverse tax)
  Cr  Accounts Receivable      grandTotalBase    (reverse AR)

Dr  Inventory Asset Account    lineCostBase      (reverse COGS)
  Cr  COGS Account             lineCostBase
```

### Sales Return Posting (BEFORE_INVOICE — COGS reversal only)
```
Dr  Inventory Asset Account    lineCostBase      (reverse DN's COGS)
  Cr  COGS Account             lineCostBase
```

---

## Enum Reference

```typescript
type SOStatus = 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_DELIVERED' | 'FULLY_DELIVERED' | 'CLOSED' | 'CANCELLED';
type DNStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
type SIStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
type SRStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
type SalesControlMode = 'SIMPLE' | 'CONTROLLED';
type ReturnContext = 'AFTER_INVOICE' | 'BEFORE_INVOICE';
```

### MovementType / ReferenceType Extensions

```typescript
// MovementType — already exists:
//   'SALES_DELIVERY' (OUT), 'RETURN_IN' (IN)

// ReferenceType — add:
type ReferenceType =
  | 'SALES_ORDER'            // NEW
  | 'DELIVERY_NOTE'          // NEW
  | 'SALES_INVOICE'          // Already exists
  | 'SALES_RETURN'           // NEW
  // ... existing types
```
