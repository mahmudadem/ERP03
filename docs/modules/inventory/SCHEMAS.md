# Inventory Module — Schema Definitions

> **Status:** LOCKED  
> **Convention:** Fields marked `[R]` are required; `[O]` are optional.  
> **Precision:** Monetary values use `roundMoney()` (2dp default). FX rates stored at 6+ decimal places.

---

## 1  Item

```typescript
interface ItemProps {
  // ═══ IDENTITY ═══
  id: string;                                    // [R] UUID
  companyId: string;                             // [R]
  code: string;                                  // [R] SKU, unique within company
  name: string;                                  // [R]
  description?: string;                          // [O]
  barcode?: string;                              // [O]

  // ═══ CLASSIFICATION ═══
  type: 'PRODUCT' | 'SERVICE' | 'RAW_MATERIAL';  // [R]
  categoryId?: string;                           // [O] FK → ItemCategory
  brand?: string;                                // [O]
  tags?: string[];                               // [O] Free-form

  // ═══ UNITS OF MEASURE ═══
  baseUom: string;                               // [R] Fundamental unit ('pcs','kg','litre')
  purchaseUom?: string;                          // [O] If different from baseUom
  salesUom?: string;                             // [O] If different from baseUom

  // ═══ COST CONFIGURATION ═══
  costCurrency: string;                          // [R] Management currency. IMMUTABLE after first movement.
  costingMethod: 'MOVING_AVG';                   // [R] Phase 1 only option
  trackInventory: boolean;                       // [R] false for services

  // ═══ ACCOUNTING LINKS ═══
  revenueAccountId?: string;                     // [O] GL revenue account (for Sales, future)
  cogsAccountId?: string;                        // [O] GL COGS/expense account (for Sales, future)
  inventoryAssetAccountId?: string;              // [O] GL inventory asset account

  // ═══ REPLENISHMENT ═══
  minStockLevel?: number;                        // [O]
  maxStockLevel?: number;                        // [O]
  reorderPoint?: number;                         // [O]

  // ═══ GOVERNANCE ═══
  active: boolean;                               // [R] default true
  createdBy: string;                             // [R]
  createdAt: Date;                               // [R]
  updatedAt: Date;                               // [R]
}
```

### Constraints
- `code` UNIQUE per `companyId`.
- `costCurrency` must be in company's enabled currencies list.
- `costCurrency` becomes immutable once any `StockMovement.itemId == this.id` exists.
- `baseUom` is the canonical unit; all movements are stored in `baseUom`.

### Indexes
- `(companyId, code)` — unique
- `(companyId, categoryId)` — category listing
- `(companyId, active)` — active items filter

---

## 2  StockMovement

```typescript
interface StockMovementProps {
  // ═══ IDENTITY ═══
  id: string;                                    // [R] UUID
  companyId: string;                             // [R]

  // ═══ TEMPORAL ═══
  date: string;                                  // [R] ISO date YYYY-MM-DD (business/posting date)
  postingSeq: number;                            // [R] Monotonic within (itemId, warehouseId)
  createdAt: Date;                               // [R] Document creation timestamp
  createdBy: string;                             // [R] User ID
  postedAt: Date;                                // [R] When cost effect was applied (set in txn)

  // ═══ ITEM & LOCATION ═══
  itemId: string;                                // [R]
  warehouseId: string;                           // [R]

  // ═══ MOVEMENT ═══
  direction: 'IN' | 'OUT';                       // [R]
  movementType: MovementType;                    // [R]
  qty: number;                                   // [R] Always POSITIVE. Direction gives sign.
  uom: string;                                   // [R] Always baseUom (converted before storage)

  // ═══ SOURCE DOCUMENT ═══
  referenceType: ReferenceType;                  // [R]
  referenceId?: string;                          // [O] Source document ID
  referenceLineId?: string;                      // [O] Specific line on source document

  // ═══ LINKING ═══
  reversesMovementId?: string;                   // [O] For RETURN_IN/RETURN_OUT: original movement
  transferPairId?: string;                       // [O] For TRANSFER_OUT/TRANSFER_IN: shared UUID

  // ═══ COST (BASE CURRENCY — ACCOUNTING) ═══
  unitCostBase: number;                          // [R] Unit cost in company base currency
  totalCostBase: number;                         // [R] roundMoney(unitCostBase × qty)

  // ═══ COST (COST CURRENCY — MANAGEMENT) ═══
  unitCostCCY: number;                           // [R] Unit cost in item costCurrency
  totalCostCCY: number;                          // [R] roundMoney(unitCostCCY × qty)

  // ═══ FX RATES ═══
  movementCurrency: string;                      // [R] Currency of raw cost input
  fxRateMovToBase: number;                       // [R] movementCurrency → baseCurrency (1.0 if same)
  fxRateCCYToBase: number;                       // [R] costCurrency → baseCurrency (1.0 if same)
  fxRateKind: 'DOCUMENT' | 'EFFECTIVE';          // [R] DOCUMENT=from invoice/bulletin; EFFECTIVE=derived

  // ═══ RUNNING AVERAGES AFTER ═══
  avgCostBaseAfter: number;                      // [R] Running avg in base after this movement
  avgCostCCYAfter: number;                       // [R] Running avg in costCurrency after

  // ═══ QUANTITY CONTEXT ═══
  qtyBefore: number;                             // [R] StockLevel.qtyOnHand before
  qtyAfter: number;                              // [R] StockLevel.qtyOnHand after

  // ═══ SETTLEMENT (OUT-specific) ═══
  settledQty?: number;                           // [O] min(qty, max(qtyBefore,0)). OUT only.
  unsettledQty?: number;                         // [O] qty - settledQty. OUT only.
  unsettledCostBasis?: 'AVG' | 'LAST_KNOWN' | 'MISSING'; // [O] How unsettled units costed. OUT only.

  // ═══ SETTLEMENT (IN-specific) ═══
  settlesNegativeQty?: number;                   // [O] How many units cover prior deficit. IN only.
  newPositiveQty?: number;                       // [O] How many add new positive stock. IN only.

  // ═══ FLAGS ═══
  negativeQtyAtPosting: boolean;                 // [R] qtyAfter < 0
  costSettled: boolean;                          // [R] unsettledQty===0 (OUT); always true (IN)
  isBackdated: boolean;                          // [R] date < StockLevel.maxBusinessDate at posting
  costSource: CostSource;                        // [R] Origin of cost data

  // ═══ NOTES ═══
  notes?: string;                                // [O]
  metadata?: Record<string, any>;                // [O] Extensible
}
```

### Enums

```typescript
type MovementType =
  | 'PURCHASE_RECEIPT'     // Goods received from supplier (future)
  | 'SALES_DELIVERY'      // Goods delivered to customer (future)
  | 'ADJUSTMENT_IN'       // Manual stock increase
  | 'ADJUSTMENT_OUT'      // Manual stock decrease
  | 'TRANSFER_IN'         // Received from another warehouse
  | 'TRANSFER_OUT'        // Sent to another warehouse
  | 'OPENING_STOCK'       // Initial stock entry
  | 'RETURN_IN'           // Customer return → stock comes back
  | 'RETURN_OUT';         // Supplier return → stock goes out

type ReferenceType =
  | 'PURCHASE_INVOICE'
  | 'SALES_INVOICE'
  | 'STOCK_ADJUSTMENT'
  | 'STOCK_TRANSFER'
  | 'OPENING'
  | 'MANUAL';

type CostSource =
  | 'PURCHASE'            // Cost from a purchase document
  | 'OPENING'             // Cost from opening balance entry
  | 'ADJUSTMENT'          // Cost from stock adjustment
  | 'TRANSFER'            // Cost carried from source warehouse
  | 'RETURN'              // Cost from original movement being reversed
  | 'SETTLEMENT';         // Cost from future settlement wizard
```

### Constraints
- **Immutable:** Once created, a StockMovement is never modified or deleted.
- `qty` must be > 0.
- `totalCostBase = roundMoney(unitCostBase × qty)`.
- `totalCostCCY = roundMoney(unitCostCCY × qty)`.
- OUT-specific fields (`settledQty`, `unsettledQty`, `unsettledCostBasis`) are set only when `direction = 'OUT'`.
- IN-specific fields (`settlesNegativeQty`, `newPositiveQty`) are set only when `direction = 'IN'`.

### Indexes
- `(companyId, itemId, warehouseId, postingSeq)` — cost replay
- `(companyId, itemId, date)` — date range queries
- `(companyId, costSettled)` — unsettled cost report
- `(companyId, referenceType, referenceId)` — document lookup

---

## 3  StockLevel

```typescript
interface StockLevelProps {
  id: string;                                    // [R] Composite: `{itemId}_{warehouseId}`
  companyId: string;                             // [R]
  itemId: string;                                // [R]
  warehouseId: string;                           // [R]

  // ═══ QUANTITIES ═══
  qtyOnHand: number;                             // [R] May be negative
  reservedQty: number;                           // [R] Future: reserved by SOs (0 for Phase 1)

  // ═══ DUAL-TRACK COSTING ═══
  avgCostBase: number;                           // [R] Moving average in base currency
  avgCostCCY: number;                            // [R] Moving average in item costCurrency

  // ═══ LAST KNOWN COSTS (negative stock fallback) ═══
  lastCostBase: number;                          // [R] Last IN unit cost in base
  lastCostCCY: number;                           // [R] Last IN unit cost in costCurrency

  // ═══ ORDERING & DETECTION ═══
  postingSeq: number;                            // [R] Monotonic counter (starts 0, +1 per movement)
  maxBusinessDate: string;                       // [R] max(all movement dates) — backdating detection
  totalMovements: number;                        // [R] Count of movements (sanity)
  lastMovementId: string;                        // [R] Most recent movement ID (by postingSeq)

  // ═══ CONCURRENCY ═══
  version: number;                               // [R] Optimistic locking
  updatedAt: Date;                               // [R]
}
```

### Constraints
- `id` = `{itemId}_{warehouseId}` (deterministic composite key).
- Updated ONLY inside a Firestore transaction alongside `StockMovement` creation.
- `postingSeq` increments by exactly 1 per movement.
- `maxBusinessDate` only increases (monotonic max).
- `version` increments by 1 per write (optimistic lock).

### Indexes
- `(companyId, itemId)` — stock by item across warehouses
- `(companyId, warehouseId)` — stock by warehouse
- `(companyId, qtyOnHand)` — low stock / negative stock queries

---

## 4  ItemCategory

```typescript
interface ItemCategoryProps {
  id: string;                                    // [R]
  companyId: string;                             // [R]
  name: string;                                  // [R]
  parentId?: string;                             // [O] For tree structure
  sortOrder: number;                             // [R] default 0
  active: boolean;                               // [R] default true

  // ═══ DEFAULT ACCOUNT INHERITANCE ═══
  defaultRevenueAccountId?: string;              // [O]
  defaultCogsAccountId?: string;                 // [O]
  defaultInventoryAssetAccountId?: string;       // [O]
}
```

---

## 5  Warehouse

```typescript
interface WarehouseProps {
  id: string;                                    // [R]
  companyId: string;                             // [R]
  name: string;                                  // [R]
  code: string;                                  // [R] Short code
  address?: string;                              // [O]
  active: boolean;                               // [R] default true
  isDefault: boolean;                            // [R] One default per company
  createdAt: Date;                               // [R]
  updatedAt: Date;                               // [R]
}
```

---

## 6  UomConversion

```typescript
interface UomConversionProps {
  id: string;                                    // [R]
  companyId: string;                             // [R]
  itemId: string;                                // [R] Conversions are item-specific
  fromUom: string;                               // [R] e.g., 'box'
  toUom: string;                                 // [R] Must be item's baseUom
  factor: number;                                // [R] 1 box = 12 pcs → factor = 12
  active: boolean;                               // [R] default true
}
```

---

## 7  InventorySettings

```typescript
interface InventorySettingsProps {
  companyId: string;                             // [R]
  defaultCostingMethod: 'MOVING_AVG';            // [R] Phase 1 only
  defaultCostCurrency: string;                   // [R] Defaults to company baseCurrency
  allowNegativeStock: boolean;                   // [R] true (per constraint)
  defaultWarehouseId?: string;                   // [O]
  autoGenerateItemCode: boolean;                 // [R] default false
  itemCodePrefix?: string;                       // [O] e.g., 'ITM-'
  itemCodeNextSeq: number;                       // [R] default 1
}
```

---

## 8  StockAdjustment

```typescript
interface StockAdjustmentProps {
  id: string;                                    // [R]
  companyId: string;                             // [R]
  warehouseId: string;                           // [R]
  date: string;                                  // [R] ISO date
  reason: 'DAMAGE' | 'LOSS' | 'CORRECTION' | 'EXPIRED' | 'FOUND' | 'OTHER'; // [R]
  notes?: string;                                // [O]
  lines: StockAdjustmentLine[];                  // [R]
  status: 'DRAFT' | 'POSTED';                   // [R]
  voucherId?: string;                            // [O] Generated GL voucher
  adjustmentValueBase: number;                   // [R] Total value in base currency for GL
  createdBy: string;                             // [R]
  createdAt: Date;                               // [R]
  postedAt?: Date;                               // [O]
}

interface StockAdjustmentLine {
  itemId: string;                                // [R]
  currentQty: number;                            // [R] Snapshot
  newQty: number;                                // [R] Target
  adjustmentQty: number;                         // [R] Computed difference
  unitCostBase: number;                          // [R] In base currency
  unitCostCCY: number;                           // [R] In item costCurrency
}
```

---

## 9  StockTransfer

```typescript
interface StockTransferProps {
  id: string;                                    // [R]
  companyId: string;                             // [R]
  sourceWarehouseId: string;                     // [R]
  destinationWarehouseId: string;                // [R]
  date: string;                                  // [R] ISO date
  notes?: string;                                // [O]
  lines: StockTransferLine[];                    // [R]
  status: 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED'; // [R]
  transferPairId: string;                        // [R] UUID shared across movement pairs
  createdBy: string;                             // [R]
  createdAt: Date;                               // [R]
  completedAt?: Date;                            // [O]
}

interface StockTransferLine {
  itemId: string;                                // [R]
  qty: number;                                   // [R]
  unitCostBaseAtTransfer: number;                // [R] Frozen from source avgCost
  unitCostCCYAtTransfer: number;                 // [R]
}
```
