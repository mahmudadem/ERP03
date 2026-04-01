# Purchase Module — Schema Definitions

> **Status:** DRAFT — Pending Review  
> **Convention:** Fields marked `[R]` are required; `[O]` are optional.  
> **Precision:** Monetary values use `roundMoney()` (2dp default). FX rates stored at 6+ decimal places.  
> **References:** Builds on [Inventory SCHEMAS.md](../inventory/SCHEMAS.md) entities (Item, Warehouse, StockMovement).

---

## Shared Entities

These entities are NOT owned by the Purchase module. They live under `domain/shared/` and are used by Purchases, Sales, POS, and Accounting.

---

### S1  Party

```typescript
type PartyRole = 'VENDOR' | 'CUSTOMER';

interface PartyProps {
  // ═══ IDENTITY ═══
  id: string;                                    // [R] UUID
  companyId: string;                             // [R]
  code: string;                                  // [R] Short code, unique per company
  legalName: string;                             // [R] Official registered name
  displayName: string;                           // [R] Name shown in UI / documents

  // ═══ ROLES ═══
  roles: PartyRole[];                            // [R] At least one. e.g. ['VENDOR'] or ['VENDOR','CUSTOMER']

  // ═══ CONTACT ═══
  contactPerson?: string;                        // [O]
  phone?: string;                                // [O]
  email?: string;                                // [O]
  address?: string;                              // [O] Free-text or structured later

  // ═══ TAX ═══
  taxId?: string;                                // [O] VAT / Tax Identification Number

  // ═══ COMMERCIAL TERMS ═══
  paymentTermsDays?: number;                     // [O] Default payment terms (e.g. 30 = Net 30)
  defaultCurrency?: string;                      // [O] Pre-selected currency on new documents

  // ═══ ACCOUNTING LINKS ═══
  defaultAPAccountId?: string;                   // [O] Override default AP account for this vendor
  defaultARAccountId?: string;                   // [O] Override default AR account for this customer

  // ═══ GOVERNANCE ═══
  active: boolean;                               // [R] default true
  createdBy: string;                             // [R]
  createdAt: Date;                               // [R]
  updatedAt: Date;                               // [R]
}
```

#### Constraints
- `code` UNIQUE per `companyId`.
- `roles` must contain at least one value.
- `defaultCurrency` should be from company's enabled currencies.
- A Party can have both `VENDOR` and `CUSTOMER` roles simultaneously.

#### Indexes
- `(companyId, code)` — unique lookup
- `(companyId, roles)` — list vendors / customers
- `(companyId, active)` — active filter
- `(companyId, displayName)` — search / autocomplete

---

### S2  TaxCode

```typescript
type TaxType = 'VAT' | 'GST' | 'EXEMPT' | 'ZERO_RATED';
type TaxScope = 'PURCHASE' | 'SALES' | 'BOTH';

interface TaxCodeProps {
  // ═══ IDENTITY ═══
  id: string;                                    // [R] UUID
  companyId: string;                             // [R]
  code: string;                                  // [R] e.g. 'VAT18', 'EXEMPT', 'ZERO'
  name: string;                                  // [R] e.g. 'VAT 18%', 'Exempt', 'Zero Rated'

  // ═══ TAX DEFINITION ═══
  rate: number;                                  // [R] Decimal: 0.18 = 18%. 0 for exempt/zero.
  taxType: TaxType;                              // [R]
  scope: TaxScope;                               // [R] Which modules can use this code

  // ═══ ACCOUNTING ═══
  purchaseTaxAccountId?: string;                 // [O] GL account for input tax (purchase side)
  salesTaxAccountId?: string;                    // [O] GL account for output tax (sales side)

  // ═══ GOVERNANCE ═══
  active: boolean;                               // [R] default true
  createdBy: string;                             // [R]
  createdAt: Date;                               // [R]
  updatedAt: Date;                               // [R]
}
```

#### Constraints
- `code` UNIQUE per `companyId`.
- `rate` must be >= 0.
- If `taxType = 'EXEMPT'` or `'ZERO_RATED'`, `rate` must be 0.
- `scope` determines visibility: a TaxCode with `scope = 'SALES'` does not appear in purchase dropdowns.

#### Indexes
- `(companyId, code)` — unique
- `(companyId, scope, active)` — dropdown filtering

---

### S3  Item Extensions (additions to existing Item entity)

The existing `Item` entity (defined in Inventory SCHEMAS.md) needs two new optional fields for tax defaults:

```typescript
// ADD to existing ItemProps:
  defaultPurchaseTaxCodeId?: string;             // [O] FK → TaxCode, used as default on PO/PI lines
  defaultSalesTaxCodeId?: string;                // [O] FK → TaxCode, used as default on SO/SI lines
```

These are optional. If not set, document lines have no default tax and the user must select one manually (or leave it tax-exempt).

---

## Purchase Module Entities

These entities live under `domain/purchases/`.

---

### P1  PurchaseSettings

```typescript
type ProcurementControlMode = 'SIMPLE' | 'CONTROLLED';

interface PurchaseSettingsProps {
  companyId: string;                             // [R] Primary key

  // ═══ CORE POLICY ═══
  procurementControlMode: ProcurementControlMode; // [R] default 'SIMPLE'
  requirePOForStockItems: boolean;               // [R] default false (SIMPLE), forced true (CONTROLLED)

  // ═══ ACCOUNTING DEFAULTS ═══
  defaultAPAccountId: string;                    // [R] Default Accounts Payable GL account
  defaultPurchaseExpenseAccountId?: string;       // [O] Default expense account for non-stock items

  // ═══ TOLERANCES ═══
  allowOverDelivery: boolean;                    // [R] default false
  overDeliveryTolerancePct: number;              // [R] default 0
  overInvoiceTolerancePct: number;               // [R] default 0

  // ═══ DEFAULTS ═══
  defaultPaymentTermsDays: number;               // [R] default 30
  purchaseVoucherTypeId?: string;                // [O] Accounting voucher type for purchase postings
  defaultWarehouseId?: string;                   // [O] Pre-selected warehouse on GRN / direct PI

  // ═══ NUMBERING ═══
  poNumberPrefix: string;                        // [R] default 'PO'
  poNumberNextSeq: number;                       // [R] default 1
  grnNumberPrefix: string;                       // [R] default 'GRN'
  grnNumberNextSeq: number;                      // [R] default 1
  piNumberPrefix: string;                        // [R] default 'PI'
  piNumberNextSeq: number;                       // [R] default 1
  prNumberPrefix: string;                        // [R] default 'PR'
  prNumberNextSeq: number;                       // [R] default 1
}
```

#### Constraints
- One record per `companyId`.
- When `procurementControlMode = 'CONTROLLED'`, `requirePOForStockItems` is forced to `true`.
- `defaultAPAccountId` must point to a valid GL account with classification `LIABILITY`.

---

### P2  PurchaseOrder

```typescript
type POStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PARTIALLY_RECEIVED'
  | 'FULLY_RECEIVED'
  | 'CLOSED'
  | 'CANCELLED';

interface PurchaseOrderProps {
  // ═══ IDENTITY ═══
  id: string;                                    // [R] UUID
  companyId: string;                             // [R]
  orderNumber: string;                           // [R] Auto-generated, unique per company

  // ═══ VENDOR ═══
  vendorId: string;                              // [R] FK → Party (must have 'VENDOR' role)
  vendorName: string;                            // [R] Snapshot at creation

  // ═══ DATES ═══
  orderDate: string;                             // [R] ISO date
  expectedDeliveryDate?: string;                 // [O] ISO date

  // ═══ CURRENCY ═══
  currency: string;                              // [R] Document currency
  exchangeRate: number;                          // [R] To base currency. 1.0 if same as base.

  // ═══ LINES ═══
  lines: PurchaseOrderLine[];                    // [R] At least one line

  // ═══ TOTALS (computed) ═══
  subtotalBase: number;                          // [R] Sum of line totals in base currency
  taxTotalBase: number;                          // [R] Sum of line tax in base currency
  grandTotalBase: number;                        // [R] subtotal + tax in base
  subtotalDoc: number;                           // [R] Sum of line totals in document currency
  taxTotalDoc: number;                           // [R] Sum of line tax in document currency
  grandTotalDoc: number;                         // [R] subtotal + tax in document currency

  // ═══ STATUS ═══
  status: POStatus;                              // [R] default 'DRAFT'

  // ═══ NOTES ═══
  notes?: string;                                // [O]
  internalNotes?: string;                        // [O] Not shown to vendor

  // ═══ GOVERNANCE ═══
  createdBy: string;                             // [R]
  createdAt: Date;                               // [R]
  updatedAt: Date;                               // [R]
  confirmedAt?: Date;                            // [O]
  closedAt?: Date;                               // [O]
}
```

```typescript
interface PurchaseOrderLine {
  lineId: string;                                // [R] UUID, unique within the PO
  lineNo: number;                                // [R] Display order (1, 2, 3…)

  // ═══ ITEM ═══
  itemId: string;                                // [R] FK → Item
  itemCode: string;                              // [R] Snapshot
  itemName: string;                              // [R] Snapshot
  itemType: 'PRODUCT' | 'SERVICE' | 'RAW_MATERIAL'; // [R] Snapshot — determines GRN requirement
  trackInventory: boolean;                       // [R] Snapshot from Item — key for CONTROLLED rules

  // ═══ QUANTITIES ═══
  orderedQty: number;                            // [R] Quantity ordered
  uom: string;                                   // [R] Purchase UoM (converted to baseUom on movement)
  receivedQty: number;                           // [R] Accumulated from GRNs, default 0
  invoicedQty: number;                           // [R] Accumulated from PIs, default 0
  returnedQty: number;                           // [R] Accumulated from PRs, default 0

  // ═══ PRICING (document currency) ═══
  unitPriceDoc: number;                          // [R] Unit price in document currency
  lineTotalDoc: number;                          // [R] orderedQty × unitPriceDoc

  // ═══ PRICING (base currency) ═══
  unitPriceBase: number;                         // [R] unitPriceDoc × exchangeRate
  lineTotalBase: number;                         // [R] orderedQty × unitPriceBase

  // ═══ TAX ═══
  taxCodeId?: string;                            // [O] FK → TaxCode
  taxRate: number;                               // [R] Snapshot, default 0
  taxAmountDoc: number;                          // [R] lineTotalDoc × taxRate
  taxAmountBase: number;                         // [R] lineTotalBase × taxRate

  // ═══ WAREHOUSE (for stock items) ═══
  warehouseId?: string;                          // [O] Target warehouse for receipt

  // ═══ NOTES ═══
  description?: string;                          // [O] Line-level note
}
```

#### Computed Fields (read-only, derived)
```typescript
// Per PO line:
openReceiveQty  = orderedQty - receivedQty
openInvoiceQty  = (trackInventory && mode === 'CONTROLLED')
                    ? receivedQty - invoicedQty
                    : orderedQty - invoicedQty
openReturnQty   = receivedQty - returnedQty
```

#### Constraints
- `orderNumber` UNIQUE per `companyId`.
- `vendorId` must reference a Party with `roles` containing `'VENDOR'`.
- `lines` must have at least 1 entry.
- After `CONFIRMED`: `orderedQty` cannot be reduced below `receivedQty`.
- Status transitions: `DRAFT → CONFIRMED → PARTIALLY_RECEIVED → FULLY_RECEIVED → CLOSED`. `CANCELLED` from `DRAFT` or `CONFIRMED` only.
- `receivedQty`, `invoicedQty`, `returnedQty` are updated by GRN/PI/PR posting (not edited directly).

#### Indexes
- `(companyId, orderNumber)` — unique
- `(companyId, vendorId, status)` — vendor PO list
- `(companyId, status)` — open POs
- `(companyId, orderDate)` — date range

---

### P3  GoodsReceipt (GRN)

```typescript
type GRNStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

interface GoodsReceiptProps {
  // ═══ IDENTITY ═══
  id: string;                                    // [R] UUID
  companyId: string;                             // [R]
  grnNumber: string;                             // [R] Auto-generated, unique per company

  // ═══ SOURCE ═══
  purchaseOrderId?: string;                      // [O] FK → PurchaseOrder (required in CONTROLLED)
  vendorId: string;                              // [R] FK → Party
  vendorName: string;                            // [R] Snapshot

  // ═══ RECEIPT INFO ═══
  receiptDate: string;                           // [R] ISO date — business date of receipt
  warehouseId: string;                           // [R] FK → Warehouse — receiving warehouse

  // ═══ LINES ═══
  lines: GoodsReceiptLine[];                     // [R]

  // ═══ STATUS ═══
  status: GRNStatus;                             // [R] default 'DRAFT'

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
interface GoodsReceiptLine {
  lineId: string;                                // [R] UUID
  lineNo: number;                                // [R]

  // ═══ LINK ═══
  poLineId?: string;                             // [O] FK → PurchaseOrderLine.lineId (for qty tracking)

  // ═══ ITEM ═══
  itemId: string;                                // [R]
  itemCode: string;                              // [R] Snapshot
  itemName: string;                              // [R] Snapshot

  // ═══ QUANTITY ═══
  receivedQty: number;                           // [R] Qty received in this GRN
  uom: string;                                   // [R] Must match PO line uom

  // ═══ COST (for inventory movement) ═══
  unitCostDoc: number;                           // [R] From PO line unitPriceDoc (or manual)
  unitCostBase: number;                          // [R] unitCostDoc × exchangeRate
  moveCurrency: string;                          // [R] Document currency of the source PO
  fxRateMovToBase: number;                       // [R] FX rate at receipt time
  fxRateCCYToBase: number;                       // [R] costCurrency→base rate at receipt time

  // ═══ INVENTORY RESULT (populated on post) ═══
  stockMovementId?: string;                      // [O] FK → StockMovement (set after posting)

  // ═══ NOTES ═══
  description?: string;                          // [O]
}
```

#### Constraints
- `grnNumber` UNIQUE per `companyId`.
- In CONTROLLED mode, `purchaseOrderId` is required.
- `receivedQty` must be > 0.
- Each line's `receivedQty` must not cause PO line `receivedQty` to exceed `orderedQty` (unless `allowOverDelivery` + tolerance).
- On posting: creates `PURCHASE_RECEIPT` (IN) movement per line via `IPurchasesInventoryService.processIN()`.
- **No GL entries created** (V1 — GRN is operational only).
- Status: `DRAFT → POSTED`. `CANCELLED` from `DRAFT` only.

#### Indexes
- `(companyId, grnNumber)` — unique
- `(companyId, purchaseOrderId)` — GRNs per PO
- `(companyId, status)` — open GRNs

---

### P4  PurchaseInvoice

```typescript
type PIStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

interface PurchaseInvoiceProps {
  // ═══ IDENTITY ═══
  id: string;                                    // [R] UUID
  companyId: string;                             // [R]
  invoiceNumber: string;                         // [R] Auto-generated, unique per company
  vendorInvoiceNumber?: string;                  // [O] Vendor's own invoice reference

  // ═══ SOURCE ═══
  purchaseOrderId?: string;                      // [O] FK → PurchaseOrder (null for standalone PI)
  vendorId: string;                              // [R] FK → Party
  vendorName: string;                            // [R] Snapshot

  // ═══ DATES ═══
  invoiceDate: string;                           // [R] ISO date — business/posting date
  dueDate?: string;                              // [O] Computed from invoiceDate + paymentTermsDays

  // ═══ CURRENCY ═══
  currency: string;                              // [R] Document currency
  exchangeRate: number;                          // [R] To base currency. Frozen at posting.

  // ═══ LINES ═══
  lines: PurchaseInvoiceLine[];                  // [R]

  // ═══ TOTALS (computed) ═══
  subtotalDoc: number;                           // [R]
  taxTotalDoc: number;                           // [R]
  grandTotalDoc: number;                         // [R]
  subtotalBase: number;                          // [R]
  taxTotalBase: number;                          // [R]
  grandTotalBase: number;                        // [R]

  // ═══ PAYMENT TRACKING ═══
  paymentTermsDays: number;                      // [R] From vendor or company default
  paymentStatus: PaymentStatus;                  // [R] default 'UNPAID'
  paidAmountBase: number;                        // [R] default 0
  outstandingAmountBase: number;                 // [R] grandTotalBase − paidAmountBase

  // ═══ STATUS ═══
  status: PIStatus;                              // [R] default 'DRAFT'

  // ═══ ACCOUNTING RESULT (populated on post) ═══
  voucherId?: string;                            // [O] FK → Accounting voucher (set after posting)

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
interface PurchaseInvoiceLine {
  lineId: string;                                // [R] UUID
  lineNo: number;                                // [R]

  // ═══ LINKS ═══
  poLineId?: string;                             // [O] FK → PurchaseOrderLine.lineId
  grnLineId?: string;                            // [O] FK → GoodsReceiptLine.lineId

  // ═══ ITEM ═══
  itemId: string;                                // [R]
  itemCode: string;                              // [R] Snapshot
  itemName: string;                              // [R] Snapshot
  trackInventory: boolean;                       // [R] Snapshot from Item

  // ═══ QUANTITY ═══
  invoicedQty: number;                           // [R] Qty being invoiced
  uom: string;                                   // [R]

  // ═══ PRICING (document currency) ═══
  unitPriceDoc: number;                          // [R]
  lineTotalDoc: number;                          // [R] invoicedQty × unitPriceDoc

  // ═══ PRICING (base currency) ═══
  unitPriceBase: number;                         // [R]
  lineTotalBase: number;                         // [R] invoicedQty × unitPriceBase

  // ═══ TAX (snapshot — frozen at posting) ═══
  taxCodeId?: string;                            // [O]
  taxCode?: string;                              // [O] Snapshot of TaxCode.code
  taxRate: number;                               // [R] Snapshot, default 0
  taxAmountDoc: number;                          // [R]
  taxAmountBase: number;                         // [R]

  // ═══ WAREHOUSE (for stock items, SIMPLE mode) ═══
  warehouseId?: string;                          // [O] Required for stock items in SIMPLE (no prior GRN)

  // ═══ ACCOUNTING RESOLUTION (frozen at posting) ═══
  accountId: string;                             // [R] Resolved GL account (inventory or expense)

  // ═══ INVENTORY RESULT (populated on post, SIMPLE stock items only) ═══
  stockMovementId?: string;                      // [O] Set when PI creates inventory movement

  // ═══ NOTES ═══
  description?: string;                          // [O]
}
```

#### Posting Validations
- **CONTROLLED, stock items:** `invoicedQty ≤ (PO line receivedQty − PO line invoicedQty)`. Block otherwise.
- **CONTROLLED, services:** `invoicedQty ≤ (PO line orderedQty − PO line invoicedQty)`.
- **SIMPLE, PO-linked:** `invoicedQty ≤ (PO line orderedQty − PO line invoicedQty)` + tolerance.
- **SIMPLE, standalone:** No PO-level quantity constraint.

#### Posting Effects
- **Always:** Creates GL voucher (`Dr account, Cr AP`) + updates `PO.invoicedQty` if linked.
- **SIMPLE, stock items (no prior GRN):** Also creates `PURCHASE_RECEIPT` IN movement via `IPurchasesInventoryService.processIN()`.

#### Constraints
- `invoiceNumber` UNIQUE per `companyId`.
- Status: `DRAFT → POSTED`. `CANCELLED` from `DRAFT` only. Posted PIs are immutable.
- `dueDate` computed as `invoiceDate + paymentTermsDays` (can be overridden).
- `paidAmountBase` and `paymentStatus` updated by the Accounting module when payments are posted.

#### Indexes
- `(companyId, invoiceNumber)` — unique
- `(companyId, vendorId, status)` — vendor invoices
- `(companyId, paymentStatus)` — unpaid/overdue
- `(companyId, purchaseOrderId)` — invoices per PO
- `(companyId, invoiceDate)` — date range

---

### P5  PurchaseReturn

```typescript
type PRStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
type ReturnContext = 'AFTER_INVOICE' | 'BEFORE_INVOICE';

interface PurchaseReturnProps {
  // ═══ IDENTITY ═══
  id: string;                                    // [R] UUID
  companyId: string;                             // [R]
  returnNumber: string;                          // [R] Auto-generated, unique per company

  // ═══ SOURCE ═══
  purchaseInvoiceId?: string;                    // [O] FK → PurchaseInvoice (for AFTER_INVOICE)
  goodsReceiptId?: string;                       // [O] FK → GoodsReceipt (for BEFORE_INVOICE)
  purchaseOrderId?: string;                      // [O] FK → PurchaseOrder (for PO line updates)
  vendorId: string;                              // [R] FK → Party
  vendorName: string;                            // [R] Snapshot

  // ═══ CONTEXT ═══
  returnContext: ReturnContext;                   // [R] Determines accounting behavior

  // ═══ DATES ═══
  returnDate: string;                            // [R] ISO date
  warehouseId: string;                           // [R] Warehouse from which goods are returned

  // ═══ CURRENCY ═══
  currency: string;                              // [R] Document currency
  exchangeRate: number;                          // [R] To base currency

  // ═══ LINES ═══
  lines: PurchaseReturnLine[];                   // [R]

  // ═══ TOTALS ═══
  subtotalDoc: number;                           // [R]
  taxTotalDoc: number;                           // [R]
  grandTotalDoc: number;                         // [R]
  subtotalBase: number;                          // [R]
  taxTotalBase: number;                          // [R]
  grandTotalBase: number;                        // [R]

  // ═══ REASON ═══
  reason: string;                                // [R] Free text or predefined
  notes?: string;                                // [O]

  // ═══ STATUS ═══
  status: PRStatus;                              // [R] default 'DRAFT'

  // ═══ ACCOUNTING RESULT ═══
  voucherId?: string;                            // [O] Set only for AFTER_INVOICE returns

  // ═══ GOVERNANCE ═══
  createdBy: string;                             // [R]
  createdAt: Date;                               // [R]
  updatedAt: Date;                               // [R]
  postedAt?: Date;                               // [O]
}
```

```typescript
interface PurchaseReturnLine {
  lineId: string;                                // [R] UUID
  lineNo: number;                                // [R]

  // ═══ LINKS ═══
  piLineId?: string;                             // [O] FK → PurchaseInvoiceLine.lineId (AFTER_INVOICE)
  grnLineId?: string;                            // [O] FK → GoodsReceiptLine.lineId (BEFORE_INVOICE)
  poLineId?: string;                             // [O] FK → PurchaseOrderLine.lineId

  // ═══ ITEM ═══
  itemId: string;                                // [R]
  itemCode: string;                              // [R] Snapshot
  itemName: string;                              // [R] Snapshot

  // ═══ QUANTITY ═══
  returnQty: number;                             // [R] Qty being returned
  uom: string;                                   // [R]

  // ═══ COST (for inventory reversal) ═══
  unitCostDoc: number;                           // [R] Original purchase cost
  unitCostBase: number;                          // [R]
  fxRateMovToBase: number;                       // [R]
  fxRateCCYToBase: number;                       // [R]

  // ═══ TAX (snapshot) ═══
  taxCodeId?: string;                            // [O]
  taxRate: number;                               // [R] default 0
  taxAmountDoc: number;                          // [R]
  taxAmountBase: number;                         // [R]

  // ═══ ACCOUNTING (AFTER_INVOICE only) ═══
  accountId?: string;                            // [O] GL account for reversal entry

  // ═══ INVENTORY RESULT ═══
  stockMovementId?: string;                      // [O] FK → StockMovement (set after posting)

  // ═══ NOTES ═══
  description?: string;                          // [O]
}
```

#### Posting Effects by Return Context

| `returnContext` | Inventory | GL Voucher | AP Effect |
|----------------|-----------|------------|-----------|
| `AFTER_INVOICE` | ✅ `PURCHASE_RETURN` OUT | ✅ Dr AP, Cr Inventory/Expense + tax reversal | ✅ Reduces vendor liability |
| `BEFORE_INVOICE` | ✅ `PURCHASE_RETURN` OUT | ❌ None | ❌ None |

#### Constraints
- `returnNumber` UNIQUE per `companyId`.
- `returnQty` must be > 0.
- `AFTER_INVOICE`: `returnQty ≤ (PI line invoicedQty − previously returned qty)`.
- `BEFORE_INVOICE`: `returnQty ≤ (GRN line receivedQty − previously returned qty)`.
- Status: `DRAFT → POSTED`. `CANCELLED` from `DRAFT` only.
- `BEFORE_INVOICE` is only valid in `CONTROLLED` mode (SIMPLE mode has no GRN before invoice).
- On post: updates `PO line returnedQty` if linked.

#### Indexes
- `(companyId, returnNumber)` — unique
- `(companyId, purchaseInvoiceId)` — returns per invoice
- `(companyId, goodsReceiptId)` — returns per GRN
- `(companyId, vendorId)` — vendor returns

---

## Enum Reference

Collected enums for the Purchase module:

```typescript
// ── Status Enums ──
type POStatus = 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED' | 'CLOSED' | 'CANCELLED';
type GRNStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
type PIStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
type PRStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

// ── Purchase-specific ──
type ProcurementControlMode = 'SIMPLE' | 'CONTROLLED';
type ReturnContext = 'AFTER_INVOICE' | 'BEFORE_INVOICE';

// ── Shared ──
type PartyRole = 'VENDOR' | 'CUSTOMER';
type TaxType = 'VAT' | 'GST' | 'EXEMPT' | 'ZERO_RATED';
type TaxScope = 'PURCHASE' | 'SALES' | 'BOTH';

// ── From Inventory (extended) ──
// MovementType: add 'PURCHASE_RECEIPT' (already exists), 'PURCHASE_RETURN' (use existing 'RETURN_OUT')
// ReferenceType: add 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'PURCHASE_RETURN'
```

### ReferenceType Extensions

The existing Inventory `ReferenceType` enum needs these additions:

```typescript
type ReferenceType =
  | 'PURCHASE_INVOICE'        // Already exists
  | 'PURCHASE_ORDER'          // NEW — for GRN→PO traceability
  | 'GOODS_RECEIPT'           // NEW — for PI→GRN traceability
  | 'PURCHASE_RETURN'         // NEW — for return movements
  | 'SALES_INVOICE'           // Already exists
  | 'STOCK_ADJUSTMENT'        // Already exists
  | 'STOCK_TRANSFER'          // Already exists
  | 'OPENING'                 // Already exists
  | 'MANUAL';                 // Already exists
```

---

## GL Voucher Line Templates

### Purchase Invoice Posting (stock item)
```
Dr  Inventory Asset Account    lineTotalBase     (item → category → company default)
Dr  Purchase Tax Account       taxAmountBase     (from TaxCode)
  Cr  Accounts Payable         grandTotalBase    (vendor → company default)
```

### Purchase Invoice Posting (service / non-stock)
```
Dr  Expense Account            lineTotalBase     (item → category → company default)
Dr  Purchase Tax Account       taxAmountBase     (from TaxCode)
  Cr  Accounts Payable         grandTotalBase    (vendor → company default)
```

### Purchase Return Posting (AFTER_INVOICE)
```
Dr  Accounts Payable           grandTotalBase    (reverse AP)
  Cr  Inventory / Expense      lineTotalBase     (reverse original debit)
  Cr  Purchase Tax Account     taxAmountBase     (reverse tax)
```
