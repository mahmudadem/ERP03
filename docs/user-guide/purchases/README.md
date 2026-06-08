# Purchases — User Guide

The Purchases module is the mirror image of Sales: it handles everything from "we need to buy something" to "we paid the supplier". Orders, goods receipts, bills, returns, payments.

It is wired into **Accounting** (bills become journal entries) and **Inventory** (receipts increment stock). The wiring is automatic — just use Purchases and the rest follows.

Key guides:

- [Vendor AP Sub-accounts](D:/DEV2026/ERP03/docs/user-guide/purchases/vendor-ap-subaccounts.md)
- [Vendor Statement and Ledger](D:/DEV2026/ERP03/docs/user-guide/purchases/vendor-statement.md)
- [Vendor Groups](D:/DEV2026/ERP03/docs/user-guide/purchases/vendor-groups.md)
- [Purchase Invoice Attachments](D:/DEV2026/ERP03/docs/user-guide/purchases/purchase-invoice-attachments.md)
- [Purchase Price Lists](D:/DEV2026/ERP03/docs/user-guide/purchases/purchase-price-lists.md)

---

## What you can do here

| Area | What it does |
|---|---|
| **Purchase Orders** | Place orders with vendors. Track what's been received and what's still pending. |
| **Goods Receipts (GRN)** | Record the arrival of goods at your warehouse. (Used in OPERATIONAL mode.) |
| **Purchase Invoices** | Record the bill from the vendor. This creates the payable on your books. |
| **Purchase Returns** | Send goods back to the vendor, with or without an invoice already received. |
| **Vendors** | Add and manage vendor records. |
| **Vendor Groups** | Classify suppliers for filtering and reporting. |
| **Price Lists** | Manage currency-specific supplier pricing rules. |
| **Payments** | Track which bills you've paid and which are outstanding. |
| **Settings** | Workflow mode, default AP account, tolerances, numbering. |
| **Dashboard** | Quick view: open POs, pending GRNs, unpaid bills, overdue payments. |

---

## First things to set up

1. **`Purchases → Settings → Initialize Purchases`** (one-time).
2. **Pick a workflow mode:**
   - **SIMPLE** — bill direct, no separate goods-receipt step. Best for service businesses or shops that don't run a warehouse.
   - **OPERATIONAL** — full chain (Order → Goods Receipt → Bill). Best for businesses with a warehouse team separate from accounting.
3. **Set default accounts:** AP account (payables), Inventory or Expense account (defaults; can be overridden per item).
4. **Set bill numbering:** prefix (e.g., `BILL-`) and starting number.
5. **Add your vendors:** `Purchases → Vendors → New Vendor`. Each vendor can have its own AP account override, payment terms, and currency.

In OPERATIONAL mode, direct bills are blocked by default. To allow direct Purchase Invoices, enable **Allow Direct Invoicing** in Purchase Settings or add an explicit governance rule; the system stores this as a company policy exception.

---

## Daily workflow (OPERATIONAL mode)

### 1. Create a Purchase Order

1. `Purchases → Orders → New Order`.
2. Pick a vendor. Add line items: product, quantity, unit price.
3. Save as DRAFT, then **Confirm** when you commit to the order.
4. The PO now shows up in the warehouse's incoming queue.

### 2. Receive the goods (Goods Receipt)

When the vendor delivers:

1. `Purchases → Goods Receipts → New from PO` (or open the PO and click **Create GRN**).
2. Verify what arrived. Partial receipts are fine — the system tracks `receivedQty` vs `orderedQty`.
3. **Post**. Inventory increments. **No journal entry happens yet** — that's by design (the bill is what creates the payable, not the receipt).

### 3. Record the bill (Purchase Invoice)

When the vendor's bill arrives:

1. `Purchases → Invoices → New from GRN` (or open the GRN and click **Create Bill**).
2. The system pre-fills quantities equal to what was received. You can't invoice more than you received.
3. Match the line prices to what the vendor billed (sometimes they differ from the PO — adjust here).
4. Apply tax codes.
5. **Post** the bill. This creates the payable: you now owe the vendor this amount, and your inventory's cost basis is finalized.

You can also attach the vendor's bill scan or supporting documents while entering a new Purchase Invoice or after it is saved. For a new invoice, files are queued and uploaded automatically when you save. Attachments are stored as evidence only; they do not change posting amounts.

### 4. Pay the bill

When you pay:

1. Open the bill and click **Create Payment**.
2. The system jumps to the Accounting Payment Voucher form, pre-filled with the bill details.
3. Pick the bank/cash account you're paying from. Save and post.
4. The bill's payment status updates (UNPAID → PARTIALLY_PAID → PAID).

---

## Simpler workflow (SIMPLE mode)

If you picked SIMPLE in settings, skip the GRN step:

1. `Purchases → Invoices → New Bill`.
2. Pick a vendor, add lines. For stock items, the receipt is implicit — inventory goes up at the moment you post.
3. Tax, post, done.

This is great for service purchases (consultant invoices, software subscriptions, utilities) where there's nothing physical to receive.

---

## Three personas for Purchase Invoices

When you create a bill, the system picks one of three "personas" based on what you link it to:

| Persona | What it means | When |
|---|---|---|
| **Direct** | Standalone bill, no PO/GRN | One-off purchases, service bills, ad-hoc expenses when company governance allows it |
| **Linked** | Bill references a PO and (in OPERATIONAL) a GRN | Standard purchase flow |
| **Service** | Bill for non-stock items | Consulting, subscriptions, utilities — no inventory impact |

The persona drives the validation rules and the GL posting (inventory account vs expense account).

---

## Purchase returns

Two scenarios:

### You return goods after the vendor billed you (AFTER_INVOICE)

Most common.

1. `Purchases → Returns → New Return`.
2. Link to the posted bill. Pick the lines being returned.
3. **Post**. The system:
   - Decreases your payable to the vendor
   - Decreases inventory
   - Reverses the tax

### You return goods before the bill arrived (BEFORE_INVOICE)

Only in OPERATIONAL mode. Less common.

1. `Purchases → Returns → New Return → Before Invoice`.
2. Link to the posted goods receipt (not a bill — there isn't one yet).
3. **Post**. Inventory goes down. No payable impact (since you weren't billed yet).

---

## Reports

Dashboard at `/purchases` shows the headline numbers. Detailed reports now include:

- **Vendor Statement** — ledger-backed AP statement for one vendor, with purchase-document and accounting-voucher drill-down.

For other analysis still use Accounting:
- **AP aging across all vendors** -> `Accounting -> Reports -> Aging` with AP mode
- **Total purchases by period** -> `Accounting -> Reports -> P&L` (expense section)
- **VAT/Tax recoverable** -> `Accounting -> Reports -> Account Statement` filtered by Tax Receivable account

---

## Multi-currency

If you buy in foreign currencies:

1. Enable the currency in `Accounting → Settings → Currencies`.
2. When creating a PO/GRN/bill, pick the currency in the header. The system captures the rate.
3. Your books show the base-currency equivalent. The vendor's bill is preserved in the original currency.

---

## Purchase Order and Bill Page Layout

Purchase Orders and Purchase Invoices use the same document page skeleton as the Sales Invoice page:

- PO and PI totals stay visible in a sticky footer while you scroll long forms.
- A right-side summary rail shows totals and status details on wide screens, and opens from the page edge on smaller windows.
- Save, post, receive, invoice, payment, return, cancel, close, and unpost actions remain reachable at the bottom of the page when they apply to the document status.
- Purchase Invoice PO selection uses real Purchase Orders from the system instead of a raw typed ID. Selecting a PO loads its open lines into the bill.
- Purchase Invoice now follows the same inside-page structure as Sales Invoice: source controls at the top, compact header, line table, allocation grid placeholder, attachments/audit shortcuts, and a right rail for info, posting readiness, settlement, and totals.

This layout does not change AP posting, tax, inventory valuation, approval, segregation-of-duties controls, period lock, or payment voucher behavior.

---

## Vendor-level overrides

`Purchases → Vendors → [Vendor] → Edit`:

- **Vendor Group** — classify suppliers such as local, import, service, or subcontractor vendors.
- **Default Price List** — automatically resolve unit prices for the vendor.
- **Default AP Account** — split AP by vendor type (e.g., separate AP for import vendors)
- **Payment Terms (days)** — drives the bill's due date
- **Default Currency** — pre-fills new POs/bills
- **Tax Number** — appears on documents

---

## Permissions

| Role | Can do |
|---|---|
| `purchases.view` | See purchase documents |
| `purchase.orders.manage` | Create / edit Purchase Orders |
| `purchase.manage` | Create / post GRNs and returns |
| `purchases.invoices.manage` | Create / post bills |
| `purchase.settings.manage` | Configure workflow mode and defaults |

---

## Common questions

**Q: I received fewer items than ordered. What do I do?**
A: Post the GRN for what you actually received. The PO will show as PARTIALLY_RECEIVED. Either receive the rest later, or **Close** the PO if the vendor won't deliver the balance.

**Q: I received more items than ordered (vendor over-shipped).**
A: In OPERATIONAL mode the system blocks this. In SIMPLE mode it depends on your tolerance setting. If the over-shipment is legitimate, you may need to amend the PO first.

**Q: Vendor sent me a credit note for a wrong charge. How do I record it?**
A: Use Purchase Return → AFTER_INVOICE → link to the bill → pick the lines being adjusted. The system reduces what you owe.

**Q: I paid the wrong vendor by accident.**
A: That's an Accounting fix, not Purchases. Go to `Accounting → Vouchers`, find the payment voucher, and use **Reverse & Replace**.

**Q: The system says "received qty must be ≥ invoiced qty". Why?**
A: You're in OPERATIONAL mode. You can't bill for more than you've physically received. Receive the missing quantity first (or reduce the bill quantity).

**Q: I see "Requisitions" mentioned somewhere — is that a feature?**
A: Planned but not yet built. For now, internal approval to purchase happens outside the system.

---

*For technical details (workflow modes, GL posting logic, inventory contract) see [`docs/architecture/purchases.md`](../../architecture/purchases.md). For the canonical posting algorithms see [`docs/modules/purchases/ALGORITHMS.md`](../../modules/purchases/ALGORITHMS.md).*
