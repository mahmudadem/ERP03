# Purchase Module — Master Plan

> **Status:** DRAFT v2 — Critical Revisions Applied  
> **Module:** Purchases (single module, policy-driven)  
> **Shared Dependencies:** Party, TaxCode, Inventory, Accounting

---

## 1. Final Recommendation

**One Purchase module with company-level policies.** Not two separate apps.

### Why one module is correct

| Concern | Two-app approach | One-module approach |
|---------|-----------------|-------------------|
| Domain model | Duplicated entities | Single set of entities |
| Upgrade path | Migrate data between apps | Flip a setting |
| Code maintenance | Two codebases, diverging over time | One codebase, branches by policy |
| Reporting | Must aggregate across two apps | Single data source |
| Shared integrations | Each app integrates independently | One integration layer |

The difference between SIMPLE and CONTROLLED is **workflow validation and posting rules**, not a fundamentally different data model.

---

## 2. Business Workflows

### 2.1 SIMPLE Mode

```
                          ┌─────────────────────────┐
                          │  Purchase Invoice (PI)   │
   (optional)             │  ─ records vendor claim  │
  Purchase Order ───────► │  ─ affects Inventory     │
       (PO)               │  ─ affects AP/Ledger     │
                          └──────────┬──────────────┘
                                     │ Post
                                     ▼
                          ┌──────────────────────┐
                          │  Accounting Voucher   │
                          │  + Stock Movement     │
                          └──────────────────────┘
```

**Rules:**
- PO is optional — user may create a PI directly (standalone PI)
- GRN is optional — PI posting handles stock IN for stock items
- PI posting creates: AP entry + Inventory `PURCHASE_RECEIPT` movement + GL voucher
- For non-stock / service items: PI posting creates AP + expense GL entry, no inventory movement
- **Standalone PI (no PO):** No quantity constraints from a PO
- **PO-linked PI:** Quantity constraints apply — `invoicedQty` must respect `orderedQty` (subject to tolerance settings)

### 2.2 CONTROLLED Mode

```
  Purchase Order ──────► Goods Receipt (GRN) ──────► Purchase Invoice (PI)
       (PO)              ─ records received qty       ─ records vendor claim
       │                 ─ affects Inventory ONLY      ─ affects AP/Ledger ONLY
       │                 ─ partial receipts OK         ─ limited to received qty
       │                 ─ NO ledger effect            ─ partial invoicing OK
       │
       └─── PO does NOT affect inventory or accounting
```

**Stock item flow:** PO → GRN → PI is mandatory.  
**Service / non-stock flow:** PO → PI directly (GRN not required for services).

**Accounting model (No GRNI in V1):**
- GRN is an **operational inventory event only** — it updates stock quantities and costing via `PURCHASE_RECEIPT`, but creates **no GL entries**
- The Purchase Invoice is the **sole financial recognition event** — it creates the GL voucher (`Dr Inventory/Expense, Cr AP`)
- This means there is a timing gap between goods receipt and financial recognition. This is acceptable in V1 because the inventory cost engine already tracks costs from the GRN moment. The AP/ledger recognition is deferred until the vendor's invoice arrives.

### 2.3 Purchase Return (both modes)

Returns must be handled differently depending on whether the Purchase Invoice has been posted.

**Case A — Return AFTER Purchase Invoice (most common):**
```
  Purchase Return ──► Stock OUT (PURCHASE_RETURN) ──► GL: Dr AP, Cr Inventory
```
- Reverses inventory via `PURCHASE_RETURN` OUT movement
- Reverses AP via GL voucher (debit AP, credit Inventory/Expense)
- Reduces `invoicedQty` context on the PI for outstanding amount recalculation

**Case B — Return AFTER GRN but BEFORE Purchase Invoice (CONTROLLED only):**
```
  Purchase Return ──► Stock OUT (PURCHASE_RETURN) ──► No GL effect
```
- Reverses inventory via `PURCHASE_RETURN` OUT movement
- **No GL effect** — because no AP was created yet (GRN had no ledger effect in V1)
- Reduces `receivedQty` context on the PO line
- The PI, when later created, will only invoice the net received quantity

---

## 3. Core Documents

### 3.1 Purchase Order (PO)

| Attribute | Detail |
|-----------|--------|
| Purpose | Commercial commitment to buy |
| Required in | CONTROLLED (stock items). Optional in SIMPLE. |
| Affects inventory | ❌ Never |
| Affects accounting | ❌ Never |
| Statuses | `DRAFT` → `CONFIRMED` → `PARTIALLY_RECEIVED` → `FULLY_RECEIVED` → `CLOSED` / `CANCELLED` |
| Editing rules | Editable in DRAFT. After CONFIRMED: only cancel remaining qty or amend commercial terms. Not edited for partial deliveries. |

### 3.2 Goods Receipt Note (GRN)

| Attribute | Detail |
|-----------|--------|
| Purpose | Confirm physical receipt of goods |
| Required in | CONTROLLED (stock items). Optional in SIMPLE. |
| Affects inventory | ✅ Creates `PURCHASE_RECEIPT` (IN) movement |
| Affects accounting | ❌ No GL entries (operational event only in V1) |
| Statuses | `DRAFT` → `POSTED` / `CANCELLED` |
| Links | Must reference a PO in CONTROLLED mode. Standalone allowed in SIMPLE. |

### 3.3 Purchase Invoice (PI)

| Attribute | Detail |
|-----------|--------|
| Purpose | Record vendor's claim for payment (AP liability) |
| Required in | Always — this is the financial document |
| Affects inventory | ✅ Only in SIMPLE mode for stock items (when no prior GRN) |
| Affects accounting | ✅ Always — creates AP + expense/inventory GL entries |
| Statuses | `DRAFT` → `POSTED` / `CANCELLED` |
| Links | References PO/GRN in CONTROLLED. Can be standalone in SIMPLE. |
| Payment tracking | `paymentStatus`: `UNPAID` → `PARTIALLY_PAID` → `PAID` |

### 3.4 Purchase Return (PR)

| Attribute | Detail |
|-----------|--------|
| Purpose | Return goods to vendor |
| Required in | Optional but available in V1 |
| Affects inventory | ✅ Creates `PURCHASE_RETURN` (OUT) movement |
| Affects accounting | ✅ Only when return is **after invoice** (Dr AP, Cr Inventory). No GL effect when return is before invoice. |
| Statuses | `DRAFT` → `POSTED` / `CANCELLED` |
| Links | Should reference original PI (after-invoice return) or original GRN (before-invoice return) |
| Field: `returnContext` | `'AFTER_INVOICE'` or `'BEFORE_INVOICE'` — determines accounting behavior |

---

## 4. Line-Level Quantity Model

Each PO line tracks cumulative fulfillment:

```
┌─────────────────────────────────────────────────────────┐
│  PO Line: Item X, orderedQty = 100                      │
│                                                         │
│  receivedQty    = SUM(GRN lines for this PO line)       │
│                   − SUM(PR lines before invoice)        │
│  invoicedQty    = SUM(PI lines for this PO line)        │
│                   − SUM(PR lines after invoice)         │
│  returnedQty    = SUM(PR lines for this PO line)        │
│                                                         │
│  openReceiveQty = orderedQty − receivedQty              │
│                                                         │
│  openInvoiceQty = (see rules below per item type/mode)  │
└─────────────────────────────────────────────────────────┘
```

### `openInvoiceQty` calculation rules

| Mode | Item Type | Formula | Rationale |
|------|-----------|---------|-----------|
| CONTROLLED | Stock item | `receivedQty − invoicedQty` | Can only invoice what has been received |
| CONTROLLED | Service / non-stock | `orderedQty − invoicedQty` | No GRN concept for services |
| SIMPLE (PO-linked) | Any | `orderedQty − invoicedQty` | PO is source of truth when linked |
| SIMPLE (standalone PI) | Any | No constraint | No PO to enforce against |

### Key invariants

| Rule | Standalone PI (SIMPLE) | PO-linked PI (SIMPLE) | PO-linked PI (CONTROLLED, stock) | PO-linked PI (CONTROLLED, service) |
|------|----------------------|---------------------|--------------------------------|-----------------------------------|
| `invoicedQty ≤ orderedQty` | N/A | ✅ Enforced (tolerance setting) | ✅ Enforced | ✅ Enforced |
| `invoicedQty ≤ receivedQty` | N/A | Not enforced | ✅ Enforced — blocks posting | N/A (no GRN) |
| `receivedQty ≤ orderedQty` | N/A | N/A | ⚠️ Warn (tolerance setting) | N/A |
| `returnedQty ≤ receivedQty` | N/A | ✅ Enforced | ✅ Enforced | N/A |

---

## 5. Validation Rules

### 5.1 Invoice before receipt (CONTROLLED, stock items)
- **Block.** Cannot post a PI for stock items if `receivedQty = 0`.
- For services / non-stock: allowed (no GRN needed).

### 5.2 Partial receipt
- Allowed. GRN may contain a subset of PO line quantities.
- PO status moves to `PARTIALLY_RECEIVED`.
- Multiple GRNs against one PO is normal.

### 5.3 Partial invoice
- Allowed. PI may invoice only part of the billable quantity.
- Outstanding balance tracks `openInvoiceQty`.

### 5.4 Invoice qty > received qty (CONTROLLED, stock items)
- **Block posting.** PI stays in DRAFT until quantities are corrected.
- System message: "Invoiced quantity exceeds received quantity for stock item [name]."
- Does NOT apply to services — services use `orderedQty` as the ceiling.

### 5.5 Invoice qty > ordered qty (PO-linked invoices)
- **CONTROLLED:** Block — cannot invoice more than ordered.
- **SIMPLE (PO-linked):** Block — must respect PO quantity integrity. Over-delivery tolerance setting may allow a configurable %.
- **SIMPLE (standalone PI):** N/A — no PO to enforce against.

### 5.6 Cancel remaining PO quantities
- User action: "Close PO" or "Cancel Remaining."
- Sets `openReceiveQty = 0` for uncompleted lines.
- PO status → `CLOSED`.
- Does NOT delete or modify previously received/invoiced data.

### 5.7 Editing PO after partial receipt
- **Commercial amendments only.** Allowed: change agreed price, cancel remaining qty, update delivery date.
- **Not allowed:** reduce `orderedQty` below `receivedQty`.

### 5.8 Direct invoice in SIMPLE mode (standalone)
- Allowed for all item types.
- For stock items: PI posting creates `PURCHASE_RECEIPT` inventory movement automatically.
- For services: PI posting creates expense GL entry only.
- No PO or GRN is required.

### 5.9 Purchase Return — before invoice (CONTROLLED)
- Allowed after GRN, before PI.
- Creates `PURCHASE_RETURN` OUT movement (reverses inventory).
- **No GL effect** — no AP existed.
- `receivedQty` for the PO line is reduced accordingly.

### 5.10 Purchase Return — after invoice
- Allowed in both modes after PI is posted.
- Creates `PURCHASE_RETURN` OUT movement (reverses inventory).
- Creates GL voucher: Dr AP, Cr Inventory/Expense.
- PI `outstandingAmount` is recalculated.

---

## 6. Inventory and Accounting Effects

### 6.1 Effect Matrix

| Document | Mode | Inventory Effect | GL Effect | AP Effect |
|----------|------|-----------------|-----------|-----------|
| PO | Both | ❌ | ❌ | ❌ |
| GRN (stock) | CONTROLLED | ✅ `PURCHASE_RECEIPT` IN | ❌ Operational only | ❌ |
| GRN (stock) | SIMPLE | ✅ (if used; optional) | ❌ | ❌ |
| PI (stock) | CONTROLLED | ❌ (already received via GRN) | ✅ Dr Inventory*, Cr AP | ✅ |
| PI (stock) | SIMPLE | ✅ `PURCHASE_RECEIPT` IN | ✅ Dr Inventory, Cr AP | ✅ |
| PI (service) | Both | ❌ | ✅ Dr Expense, Cr AP | ✅ |
| PR (before PI) | CONTROLLED | ✅ `PURCHASE_RETURN` OUT | ❌ | ❌ |
| PR (after PI) | Both | ✅ `PURCHASE_RETURN` OUT | ✅ Dr AP, Cr Inventory/Expense | ✅ (reversal) |

> \* In CONTROLLED mode, the PI's `Dr Inventory` recognizes the financial value of goods already physically received via GRN. The inventory *quantity* was already updated by the GRN; the PI's GL entry records the *financial obligation*.

### 6.2 GL Account Resolution (hierarchical)

**Inventory / Expense account (debit side):**
1. Item-level override (`inventoryAssetAccountId` or expense account)
2. Item Category default
3. Company default inventory account

**AP control account (credit side):**
1. Vendor-level override (on Party record)
2. Company default AP account

**Tax account:**
- Comes from `TaxCode.accountId`

### 6.3 Voucher Metadata

Every auto-generated voucher carries:
```
sourceModule  = 'purchases'
sourceType    = 'PURCHASE_INVOICE' | 'PURCHASE_RETURN'
sourceId      = document ID
```

### 6.4 Accounting Model for CONTROLLED Mode — Design Rationale

> [!IMPORTANT]
> **V1 does NOT use GRNI (Goods Received Not Invoiced) accrual.**

In CONTROLLED mode:
- **GRN** updates inventory quantities and costs via the Inventory module's `processIN`. This is an operational/logistical event. No GL entries are created.
- **Purchase Invoice** is the sole financial recognition event. It creates the AP liability and the GL entries.
- The timing gap between receipt and invoice is a known trade-off. It is acceptable because:
  - Inventory costing is already correct from the GRN moment (cost engine runs on receipt)
  - AP is only recognized when the vendor's claim arrives (conservative/cash-basis-like)
  - GRNI accrual adds significant complexity (partial matching, interim account management) better suited for V2

---

## 7. Settings Design

### 7.1 Company-Level Purchase Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `procurementControlMode` | `'SIMPLE' \| 'CONTROLLED'` | `'SIMPLE'` | Core workflow policy |
| `defaultAPAccountId` | string | required | Default Accounts Payable GL account |
| `defaultPurchaseExpenseAccountId` | string | optional | Default expense account for non-stock purchases |
| `requirePOForStockItems` | boolean | `false` (SIMPLE) / `true` (CONTROLLED) | Whether PO is mandatory for stock items |
| `allowOverDelivery` | boolean | `false` | Allow GRN qty > PO qty |
| `overDeliveryTolerancePct` | number | `0` | Allowed over-delivery % (e.g., 5 = 5%) |
| `overInvoiceTolerancePct` | number | `0` | Allowed over-invoice % for PO-linked PIs in SIMPLE mode |
| `defaultPaymentTermsDays` | number | `30` | Default payment terms for new vendors |
| `purchaseVoucherTypeId` | string | auto-detect | Accounting voucher type used for purchase posting |

### 7.2 Setting Behavior by Mode

When `procurementControlMode` changes:
- **To SIMPLE:** `requirePOForStockItems` defaults to `false`, but user can still enable it.
- **To CONTROLLED:** `requirePOForStockItems` forced to `true`. GRN required for stock items.

---

## 8. UI / Workflow Implications

### 8.1 SIMPLE mode user experience

- Sidebar shows: **Vendors**, **Purchase Invoices**, **Purchase Returns**, **Purchase Orders** (visible but not mandatory)
- "New Purchase Invoice" can be created directly — no PO required (standalone PI)
- Alternatively, PI can be created from a PO (PO-linked PI) — quantity constraints apply
- For stock items on a standalone PI: user enters item, qty, unit cost, warehouse — system handles receiving automatically on post
- "Post & Pay" button available to immediately create a linked payment

### 8.2 CONTROLLED mode user experience

- Sidebar shows: **Vendors**, **Purchase Orders**, **Goods Receipts**, **Purchase Invoices**, **Purchase Returns**
- Flow starts with PO creation
- From PO detail: "Receive Goods" button → opens GRN form pre-filled from PO lines (stock items only)
- From PO detail: "Create Invoice" button → opens PI pre-filled from PO lines
  - Stock item lines: qty limited to `receivedQty − invoicedQty`
  - Service lines: qty limited to `orderedQty − invoicedQty`
- Direct PI creation still available for services, but blocked for stock items without GRN
- PI posting validates `invoicedQty ≤ receivedQty` for stock items

### 8.3 Common UI patterns

- **PO Status Badge:** Shows fulfillment progress (e.g., "60% received, 40% invoiced")
- **PI Payment Status:** Shows `UNPAID` / `PARTIALLY_PAID` / `PAID` with outstanding amount
- **"Create Payment" from PI:** Opens Accounting payment form pre-filled with invoice details
- **Document linking:** All related documents visible from any document detail (PO → GRNs → PIs → PRs)
- **Return Flow:** From PI detail: "Create Return" button (after-invoice return). From GRN detail: "Create Return" button (before-invoice return, CONTROLLED only).

---

## 9. V1 Scope Recommendation

### ✅ Definitely V1

| Feature | Rationale |
|---------|-----------|
| **Shared Party entity** | Foundation for vendors AND future customers |
| **Shared TaxCode master** | Required by Purchase Invoice GL posting |
| **Purchase Orders** | Core commercial document |
| **Goods Receipt (GRN)** | Required for CONTROLLED mode |
| **Purchase Invoice** | The financial document — mandatory |
| **Purchase Return** (basic, both contexts) | Before-invoice reversal + after-invoice reversal |
| **SIMPLE / CONTROLLED modes** | The core architectural feature |
| **Multi-currency invoices** | Already supported by inventory dual-currency costing |
| **Auto GL voucher on post** | Non-negotiable for an ERP |
| **Payment status tracking on PI** | Visibility into outstanding payables |
| **"Create Payment" from PI screen** | Convenience — links to existing Accounting payment vouchers |

### ❌ Deferred to V2+

| Feature | Reason |
|---------|--------|
| GRNI accrual (Goods Received Not Invoiced) | Significant complexity; V1 model is coherent without it |
| Vendor price lists | Nice-to-have, not blocking |
| Landed cost allocation | Significant costing complexity |
| Full approval workflow | Needs a generic approval engine |
| Withholding tax | Market-specific, adds AP complexity |
| Three-way matching reports | Useful but not blocking core flow |
| Vendor credit limit enforcement | Low priority for V1 |
| Blanket POs / framework agreements | Advanced procurement feature |

---

## 10. Final Business Rules

These are the official rules for the Purchase module V1.

### R1 — Module Architecture
> The Purchase module is a single module with a company-level `procurementControlMode` setting (`SIMPLE` or `CONTROLLED`).

### R2 — Document Hierarchy
> Purchase Order → Goods Receipt → Purchase Invoice → (Purchase Return). Each document may reference its predecessor via foreign keys.

### R3 — PO Has No Financial Effect
> A Purchase Order never affects inventory or accounting. It records commercial intent only.

### R4 — GRN Is Operational Only (V1)
> A posted GRN creates `PURCHASE_RECEIPT` (IN) stock movements. It does **not** create AP entries or GL vouchers. It is an operational inventory event, not a financial recognition event.

### R5 — PI Is the Financial Recognition Event
> A posted Purchase Invoice creates the AP liability and the Accounting voucher. In CONTROLLED mode, it recognizes the financial value of goods already physically received. In SIMPLE mode for stock items, it also creates the inventory movement.

### R6 — CONTROLLED Invoice Qty Limit (Stock Items)
> In CONTROLLED mode, `invoicedQty` for stock items must not exceed `receivedQty`. Violation blocks posting.

### R7 — CONTROLLED Invoice Qty Limit (Services)
> In CONTROLLED mode, `invoicedQty` for services/non-stock items must not exceed `orderedQty`. Services do not require a GRN.

### R8 — SIMPLE Mode Standalone PI
> In SIMPLE mode, a Purchase Invoice can be created directly without a PO or GRN (standalone PI). No quantity constraints from a PO apply. The system handles receiving automatically for stock items on post.

### R9 — SIMPLE Mode PO-Linked PI
> In SIMPLE mode, when a PI is explicitly linked to a PO, `invoicedQty` must respect `orderedQty` (subject to `overInvoiceTolerancePct`). PO quantity integrity is preserved.

### R10 — GRN Lives in the Domain Model
> Even if SIMPLE mode bypasses GRN operationally, the receiving concept exists in the domain. A SIMPLE-mode PI for stock items implicitly creates an inventory movement with reference type `PURCHASE_INVOICE`.

### R11 — Partial Operations
> Partial receipts, partial invoicing, and partial returns are first-class operations. A PO with partial fulfillment stays open until explicitly closed.

### R12 — PO Immutability After Receipt
> A PO's ordered quantities cannot be reduced below received quantities. Only commercial amendments (price, cancel remaining, dates) are allowed after partial receipt.

### R13 — Tax Snapshot
> Every posted document line stores a frozen copy of `taxCode`, `taxRate`, and `taxAmount`. Changes to the tax master do not affect already-posted documents.

### R14 — Multi-Currency
> Purchase documents support a document currency with an exchange rate. Base-currency amounts are computed and frozen at posting time.

### R15 — Payment Ownership
> Payments are owned by Accounting. The Purchase module tracks `paymentStatus` and `outstandingAmount` on invoices but does not create payment records directly. The PI screen offers a "Create Payment" action that opens the Accounting payment form.

### R16 — GL Account Resolution
> Accounts are resolved hierarchically: item override → category default → company default. AP account: vendor override → company default. Tax account: from TaxCode configuration.

### R17 — Purchase Return After Invoice
> A Purchase Return referencing a posted PI creates a `PURCHASE_RETURN` (OUT) stock movement AND a GL voucher (Dr AP, Cr Inventory/Expense). It reverses both inventory and financial effects.

### R18 — Purchase Return Before Invoice (CONTROLLED)
> A Purchase Return referencing a GRN (before any PI is posted) creates a `PURCHASE_RETURN` (OUT) stock movement ONLY. No GL effect — because no AP or financial recognition existed. The `receivedQty` on the PO line is adjusted downward.

### R19 — Document Statuses Support Future Approval
> All documents include `DRAFT` as their initial status. The status machine is designed so an `APPROVED` / `PENDING_APPROVAL` state can be inserted later without data migration.

---

## Resolved Design Clarifications

### Clarification 1 — CONTROLLED Mode Accounting (No GRNI)

**Decision:** V1 uses **Option B — No GRNI**.

- GRN is an operational inventory event only. It triggers `PURCHASE_RECEIPT` via the Inventory module's cost engine, updating stock quantities and weighted-average costs. It creates **zero GL entries**.
- The Purchase Invoice is the **sole financial recognition event**. It creates `Dr Inventory/Expense, Cr AP` and the Accounting voucher.
- The timing gap between physical receipt (GRN) and financial recognition (PI) is a deliberate V1 trade-off. Inventory costing is correct from the GRN moment; AP is recognized when the vendor's claim arrives.
- GRNI accrual (`Dr Inventory, Cr GRNI` at GRN; `Dr GRNI, Cr AP` at PI) is deferred to V2 as an accounting enhancement.

### Clarification 2 — Purchase Return Before vs After Invoice

**Decision:** Purchase Return has a `returnContext` field that determines its accounting behavior.

| `returnContext` | Inventory Effect | GL Effect | When Used |
|----------------|-----------------|-----------|-----------|
| `AFTER_INVOICE` | ✅ `PURCHASE_RETURN` OUT | ✅ Dr AP, Cr Inventory/Expense | Return after PI posted |
| `BEFORE_INVOICE` | ✅ `PURCHASE_RETURN` OUT | ❌ None | Return after GRN but before PI (CONTROLLED only) |

The system infers `returnContext` based on whether the return references a PI or a GRN. If the return references a PI, it is `AFTER_INVOICE`. If it references only a GRN (no PI linked), it is `BEFORE_INVOICE`.

### Clarification 3 — Service vs Stock `openInvoiceQty`

**Decision:** The invoiceable ceiling depends on item type:

| Mode | Item Type | `openInvoiceQty` Formula |
|------|-----------|-------------------------|
| CONTROLLED | Stock | `receivedQty − invoicedQty` |
| CONTROLLED | Service | `orderedQty − invoicedQty` |
| SIMPLE (PO-linked) | Any | `orderedQty − invoicedQty` |
| SIMPLE (standalone) | Any | No constraint |

Services in CONTROLLED mode bypass GRN entirely; their invoicing ceiling is the ordered quantity, not the received quantity.

### Clarification 4 — Standalone PI vs PO-Linked PI in SIMPLE Mode

**Decision:** PO quantity integrity depends on whether a PO link exists.

- **Standalone PI (no PO):** Full freedom. No quantity enforcement. This is the "quick purchase invoice" workflow for simple businesses.
- **PO-linked PI:** The PO's `orderedQty` is the ceiling for `invoicedQty`, subject to `overInvoiceTolerancePct` setting. This preserves PO fulfillment tracking integrity even in SIMPLE mode.

The PI entity has an optional `purchaseOrderId` field. Validation rules check: if `purchaseOrderId != null`, enforce PO quantity rules. If `purchaseOrderId == null`, skip PO-level validations.

---

## Assumptions (flagged for review)

> [!NOTE]
> These are sensible defaults chosen where the brief was silent. Please review.

1. **Over-delivery tolerance defaults to 0%.** Can be configured per company. No per-PO tolerance in V1.

2. **A Purchase Invoice can reference at most one PO.** Multi-PO consolidation into a single PI is deferred.

3. **Purchase Return references a single PI or GRN.** Cross-document returns are deferred.

4. **The "Post & Pay" shortcut creates one full payment.** Partial immediate payment via this shortcut is deferred; user can do it from Accounting.

5. **Vendor/Party default currency is the currency pre-selected on new documents for that vendor.** User can still change it per document.

6. **In CONTROLLED mode, the PI posts `Dr Inventory` even though physical stock was already received.** This recognizes the financial value; the inventory module already holds the correct quantity from the GRN. The GL debit account is the same inventory asset account. This is standard for a periodic-recognition approach without GRNI.
