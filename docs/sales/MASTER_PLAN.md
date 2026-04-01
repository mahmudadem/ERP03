# Sales Module — Master Plan

> **Status:** DRAFT v1 — Pending Review  
> **Module:** Sales (single module, policy-driven — mirrors Purchase architecture)  
> **Shared Dependencies:** Party, TaxCode, Inventory, Accounting  
> **Prerequisite:** Purchase module Phases 0–3 complete (shared services exist)

---

## 1. Architecture

**One Sales module with company-level policies.** Same pattern as Purchases.

### Key parallel with Purchases

| Purchases | Sales |
|-----------|-------|
| Vendor (Party role) | Customer (Party role) |
| Purchase Order (PO) | Sales Order (SO) |
| Goods Receipt (GRN) | Delivery Note (DN) |
| Purchase Invoice (PI) | Sales Invoice (SI) |
| Purchase Return (PR) | Sales Return (SR) |
| AP (Accounts Payable) | AR (Accounts Receivable) |
| `Dr Inventory, Cr AP` | `Dr AR, Cr Revenue` + `Dr COGS, Cr Inventory` |
| `PURCHASE_RECEIPT` (IN) | `SALES_DELIVERY` (OUT) |
| `IPurchasesInventoryService` | `ISalesInventoryService` (already defined!) |

### Key Sales-specific concern: **COGS**

Unlike purchases (which record cost), sales must also record **Cost of Goods Sold**:
- When stock items are sold, a second GL entry is generated: `Dr COGS, Cr Inventory`
- COGS unit cost comes from the inventory cost engine (weighted average cost at delivery time)
- Services have no COGS — only revenue

---

## 2. Operating Policies

### 2.1 SIMPLE Mode

```
                          ┌─────────────────────────┐
                          │  Sales Invoice (SI)      │
   (optional)             │  ─ records customer claim│
  Sales Order ──────────► │  ─ affects Inventory OUT │
       (SO)               │  ─ affects AR/Ledger     │
                          │  ─ records COGS          │
                          └──────────┬──────────────┘
                                     │ Post
                                     ▼
                          ┌──────────────────────┐
                          │  Accounting Voucher   │
                          │  + Stock Movement     │
                          └──────────────────────┘
```

**Rules:**
- SO is optional — user may create an SI directly (standalone SI)
- DN is optional — SI posting handles stock OUT for stock items
- SI posting creates: AR entry + `SALES_DELIVERY` movement + COGS entry + Revenue GL voucher
- For services: SI creates AR + Revenue GL, no inventory/COGS
- **Standalone SI (no SO):** No quantity constraints
- **SO-linked SI:** `invoicedQty` must respect `orderedQty` (with tolerance)

### 2.2 CONTROLLED Mode

```
  Sales Order ──────► Delivery Note (DN) ──────► Sales Invoice (SI)
       (SO)           ─ records delivered qty      ─ records customer claim
       │              ─ affects Inventory OUT       ─ affects AR/Ledger ONLY
       │              ─ records COGS at delivery    ─ recognizes revenue
       │              ─ partial deliveries OK        ─ limited to delivered qty
       │
       └─── SO does NOT affect inventory or accounting
```

**Stock item flow:** SO → DN → SI is mandatory.  
**Service flow:** SO → SI directly (DN not required).

**Accounting model (mirrors Purchase No-GRNI):**
- DN is an **operational inventory + COGS event** — creates stock OUT + COGS entry, but **no AR entry**
- SI is the **revenue recognition event** — creates AR + Revenue GL voucher
- Timing gap between delivery and invoicing is a known V1 trade-off

> [!NOTE]
> **DN has GL effect unlike GRN!** This is the key asymmetry with Purchases. In Purchases, GRN creates no GL. In Sales, DN creates COGS entries because cost must be recognized when physical control of goods transfers. Revenue recognition is deferred until SI, but cost recognition happens at delivery.

### 2.3 Sales Return (both modes)

**Case A — Return AFTER Sales Invoice:**
```
  Sales Return ──► Stock IN (RETURN_IN) ──► GL: Dr Revenue, Cr AR  +  Dr Inventory, Cr COGS
```
- Reverses inventory via `RETURN_IN` movement
- Reverses AR + Revenue via GL voucher
- Reverses COGS entry
- Adjusts SI `outstandingAmount`

**Case B — Return AFTER DN but BEFORE Sales Invoice (CONTROLLED only):**
```
  Sales Return ──► Stock IN (RETURN_IN) ──► GL: Dr Inventory, Cr COGS (reverses COGS only)
```
- Reverses inventory via `RETURN_IN` movement
- Reverses the COGS entry from DN (but no AR/Revenue reversal — none existed)
- Reduces `deliveredQty` on SO line

---

## 3. Core Documents

### 3.1 Sales Order (SO)

| Attribute | Detail |
|-----------|--------|
| Purpose | Commercial commitment to sell |
| Required in | CONTROLLED (stock items). Optional in SIMPLE. |
| Affects inventory | ❌ Never |
| Affects accounting | ❌ Never |
| Statuses | `DRAFT` → `CONFIRMED` → `PARTIALLY_DELIVERED` → `FULLY_DELIVERED` → `CLOSED` / `CANCELLED` |
| Editing rules | Editable in DRAFT. After CONFIRMED: only amend terms or cancel remaining. |

### 3.2 Delivery Note (DN)

| Attribute | Detail |
|-----------|--------|
| Purpose | Confirm physical delivery of goods to customer |
| Required in | CONTROLLED (stock items). Optional in SIMPLE. |
| Affects inventory | ✅ Creates `SALES_DELIVERY` (OUT) movement |
| Affects accounting | ✅ Creates COGS entry (`Dr COGS, Cr Inventory`) |
| Statuses | `DRAFT` → `POSTED` / `CANCELLED` |
| Links | Must reference SO in CONTROLLED mode. |

### 3.3 Sales Invoice (SI)

| Attribute | Detail |
|-----------|--------|
| Purpose | Record customer's obligation to pay (AR receivable) |
| Required in | Always — this is the financial/revenue document |
| Affects inventory | ✅ Only in SIMPLE mode for stock items (when no prior DN) |
| Affects accounting | ✅ Always — creates AR + Revenue + COGS GL entries |
| Statuses | `DRAFT` → `POSTED` / `CANCELLED` |
| Payment tracking | `paymentStatus`: `UNPAID` → `PARTIALLY_PAID` → `PAID` |

### 3.4 Sales Return (SR)

| Attribute | Detail |
|-----------|--------|
| Purpose | Accept goods back from customer |
| Affects inventory | ✅ Creates `RETURN_IN` movement |
| Affects accounting | ✅ When after SI: reverses AR + Revenue + COGS. When before SI: reverses COGS only. |
| Field: `returnContext` | `'AFTER_INVOICE'` or `'BEFORE_INVOICE'` |

---

## 4. Line-Level Quantity Model

```
┌─────────────────────────────────────────────────────────┐
│  SO Line: Item X, orderedQty = 100                      │
│                                                         │
│  deliveredQty    = SUM(DN lines for this SO line)       │
│                   − SUM(SR lines before invoice)        │
│  invoicedQty     = SUM(SI lines for this SO line)       │
│                   − SUM(SR lines after invoice)         │
│  returnedQty     = SUM(SR lines for this SO line)       │
│                                                         │
│  openDeliverQty  = orderedQty − deliveredQty            │
│  openInvoiceQty  = (see rules below)                    │
└─────────────────────────────────────────────────────────┘
```

### `openInvoiceQty` calculation rules

| Mode | Item Type | Formula |
|------|-----------|---------|
| CONTROLLED | Stock item | `deliveredQty − invoicedQty` |
| CONTROLLED | Service | `orderedQty − invoicedQty` |
| SIMPLE (SO-linked) | Any | `orderedQty − invoicedQty` |
| SIMPLE (standalone SI) | Any | No constraint |

---

## 5. Inventory and Accounting Effects

### 5.1 Effect Matrix

| Document | Mode | Inventory Effect | GL Effect | AR Effect |
|----------|------|-----------------|-----------|-----------|
| SO | Both | ❌ | ❌ | ❌ |
| DN (stock) | CONTROLLED | ✅ `SALES_DELIVERY` OUT | ✅ `Dr COGS, Cr Inventory` | ❌ |
| SI (stock) | CONTROLLED | ❌ (already delivered via DN) | ✅ `Dr AR, Cr Revenue` | ✅ |
| SI (stock) | SIMPLE | ✅ `SALES_DELIVERY` OUT | ✅ `Dr AR, Cr Revenue` + `Dr COGS, Cr Inventory` | ✅ |
| SI (service) | Both | ❌ | ✅ `Dr AR, Cr Revenue` | ✅ |
| SR (before SI) | CONTROLLED | ✅ `RETURN_IN` | ✅ `Dr Inventory, Cr COGS` (reverse) | ❌ |
| SR (after SI) | Both | ✅ `RETURN_IN` | ✅ `Dr Revenue, Cr AR` + `Dr Inventory, Cr COGS` | ✅ (reversal) |

### 5.2 GL Account Resolution

**Revenue account (credit side):**
1. Item-level override (`revenueAccountId`)
2. Item Category default revenue account
3. Company default revenue account

**COGS account (debit side for cost recognition):**
1. Item-level override (`cogsAccountId`)
2. Item Category default COGS account
3. Company default COGS account

**Inventory account (for stock movements):**
1. Item-level `inventoryAssetAccountId`
2. Category default
3. Company default

**AR control account (debit side for receivable):**
1. Customer-level override (Party.`defaultARAccountId`)
2. Company default AR account

**Tax account:**
- From `TaxCode.salesTaxAccountId`

### 5.3 COGS Calculation

- Unit cost = **weighted average cost from inventory engine** at the time of delivery
- The inventory `processOUT` already returns the cost used — consumed by the posting logic
- COGS per line = `deliveredQty × unitCostAtDelivery`

### 5.4 Voucher Metadata

```
sourceModule  = 'sales'
sourceType    = 'DELIVERY_NOTE' | 'SALES_INVOICE' | 'SALES_RETURN'
sourceId      = document ID
```

---

## 6. Settings Design

### 6.1 Company-Level Sales Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `salesControlMode` | `'SIMPLE' \| 'CONTROLLED'` | `'SIMPLE'` | Core workflow policy |
| `defaultARAccountId` | string | required | Default Accounts Receivable GL account |
| `defaultRevenueAccountId` | string | required | Default revenue account |
| `defaultCOGSAccountId` | string | optional | Default COGS account |
| `defaultSalesExpenseAccountId` | string | optional | Default expense for services |
| `requireSOForStockItems` | boolean | `false` (SIMPLE) / `true` (CONTROLLED) | Whether SO is mandatory |
| `allowOverDelivery` | boolean | `false` | Allow DN qty > SO qty |
| `overDeliveryTolerancePct` | number | `0` | Over-delivery % |
| `overInvoiceTolerancePct` | number | `0` | Over-invoice % for SO-linked SIs |
| `defaultPaymentTermsDays` | number | `30` | Default payment terms |
| `salesVoucherTypeId` | string | optional | Voucher type for sales posting |
| `defaultWarehouseId` | string | optional | Pre-selected warehouse |
| `soNumberPrefix` | string | `'SO'` | |
| `soNumberNextSeq` | number | `1` | |
| `dnNumberPrefix` | string | `'DN'` | |
| `dnNumberNextSeq` | number | `1` | |
| `siNumberPrefix` | string | `'SI'` | |
| `siNumberNextSeq` | number | `1` | |
| `srNumberPrefix` | string | `'SR'` | |
| `srNumberNextSeq` | number | `1` | |

---

## 7. Business Rules

### S1 — Module Architecture
> The Sales module is a single module with a company-level `salesControlMode` setting (`SIMPLE` or `CONTROLLED`).

### S2 — Document Hierarchy
> Sales Order → Delivery Note → Sales Invoice → (Sales Return).

### S3 — SO Has No Financial Effect
> A Sales Order never affects inventory or accounting. Commercial intent only.

### S4 — DN Creates Inventory + COGS (Not Revenue)
> A posted DN creates `SALES_DELIVERY` (OUT) stock movements AND a COGS GL entry (`Dr COGS, Cr Inventory`). It does **not** create AR or revenue entries. Cost is recognized at delivery; revenue at invoice.

### S5 — SI Is the Revenue Recognition Event
> A posted Sales Invoice creates AR + Revenue GL voucher. In CONTROLLED mode it only recognizes revenue. In SIMPLE mode for stock items it also creates inventory OUT + COGS.

### S6 — CONTROLLED Invoice Qty Limit (Stock Items)
> `invoicedQty` for stock items must not exceed `deliveredQty`. Violation blocks posting.

### S7 — CONTROLLED Invoice Qty Limit (Services)
> `invoicedQty` for services must not exceed `orderedQty`. Services do not require DN.

### S8 — SIMPLE Mode Standalone SI
> SI can be created without SO or DN. No quantity constraints. System handles delivery automatically for stock items on post.

### S9 — SIMPLE Mode SO-Linked SI
> When SI is linked to SO, `invoicedQty` must respect `orderedQty` (subject to tolerance).

### S10 — Partial Operations
> Partial deliveries, partial invoicing, and partial returns are first-class.

### S11 — Tax Snapshot
> Every posted document line stores frozen `taxCode`, `taxRate`, `taxAmount`.

### S12 — Multi-Currency
> Sales documents support document currency with exchange rate. Base amounts frozen at posting.

### S13 — Payment Ownership
> Payments owned by Accounting. Sales tracks `paymentStatus` and `outstandingAmount` on SI.

### S14 — GL Account Resolution
> Hierarchical: item override → category default → company default. AR: customer override → company default. Tax: from TaxCode.

### S15 — Sales Return After Invoice
> Creates `RETURN_IN` stock movement + GL reversal (Dr Revenue, Cr AR) + COGS reversal (Dr Inventory, Cr COGS).

### S16 — Sales Return Before Invoice (CONTROLLED)
> Creates `RETURN_IN` stock movement + COGS reversal ONLY (Dr Inventory, Cr COGS). No AR/Revenue reversal.

### S17 — COGS from Inventory Engine
> COGS unit cost is the weighted average cost from the inventory cost engine at delivery time.

---

## 8. Shared Services Reuse

| Service | Status | Notes |
|---------|--------|-------|
| Party (CUSTOMER role) | ✅ Already implemented | Add `CustomersListPage`, `CustomerDetailPage` in frontend |
| TaxCode (`scope: 'SALES' \| 'BOTH'`) | ✅ Already implemented | Filter by `scope` in Sales dropdowns |
| Item (`defaultSalesTaxCodeId`) | ✅ Already implemented | Used as default tax on SO/SI lines |
| `ISalesInventoryService` | ✅ Interface exists | Need implementation (`SalesInventoryService`) |
| `processOUT` contract | ✅ Defined | `SALES_DELIVERY` movement type exists |
| `processIN` contract | ✅ Defined | For `RETURN_IN` movements |

---

## 9. V1 Scope

### ✅ Definitely V1

| Feature | Rationale |
|---------|-----------|
| Sales Orders | Core commercial document |
| Delivery Notes | Required for CONTROLLED mode |
| Sales Invoices | The financial document — mandatory |
| Sales Returns (both contexts) | Before/after invoice |
| SIMPLE / CONTROLLED modes | Core architectural feature |
| COGS posting | Essential for P&L accuracy |
| Multi-currency | Already supported by inventory |
| Auto GL voucher on post | Non-negotiable |
| Payment status tracking | Visibility into receivables |
| Customer management (Party) | Already built, needs frontend pages |

### ❌ Deferred

| Feature | Reason |
|---------|--------|
| Customer price lists | Nice-to-have |
| Discount engine (qty breaks, promotions) | Significant scope |
| Commission tracking | Separate module |
| Credit limit enforcement | Low priority V1 |
| Quotations / Proforma | Pre-sales workflow |

---

## 10. Item Extension for Sales Accounts

The `Item` entity needs optional sales-specific account overrides (similar to how `inventoryAssetAccountId` already exists):

```typescript
// ADD to existing ItemProps:
  revenueAccountId?: string;       // [O] Override default revenue account for this item
  cogsAccountId?: string;          // [O] Override default COGS account for this item
```

These are resolved hierarchically: item → category → company defaults.
