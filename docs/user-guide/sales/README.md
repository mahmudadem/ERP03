# Sales — User Guide

The Sales module is where you handle everything that happens between "the customer wants something" and "we got paid": orders, deliveries, invoices, returns, and payments.

It works in close coordination with **Accounting** (invoices become journal entries) and **Inventory** (deliveries decrement stock). You don't have to think about that wiring — just use Sales and the rest happens automatically.

Key guides:

- [Direct Invoice and Operational Linked Invoice](D:/DEV2026/ERP03/docs/user-guide/sales/direct-invoice-and-operational-linked-invoice.md)
- [Sales Returns (Credit Note vs Refund)](D:/DEV2026/ERP03/docs/user-guide/sales/sales-returns.md)
- [Invoice Templates](D:/DEV2026/ERP03/docs/user-guide/sales/invoice-templates.md)
- [Communication Sender Accounts](D:/DEV2026/ERP03/docs/user-guide/sales/communication-accounts.md)
- [Send Invoices via WhatsApp](D:/DEV2026/ERP03/docs/user-guide/sales/invoice-whatsapp-sharing.md)
- [Send Invoices via Telegram](D:/DEV2026/ERP03/docs/user-guide/sales/invoice-telegram-sharing.md)
- [Sales Invoice Attachments](D:/DEV2026/ERP03/docs/user-guide/sales/invoice-attachments.md)

---

## What you can do here

| Area | What it does |
|---|---|
| **Sales Orders** | Capture customer orders before you ship. Track what's been delivered and what's still pending. |
| **Delivery Notes** | Record the physical delivery of goods. (Used in OPERATIONAL workflow.) |
| **Sales Invoices** | Bill the customer. This is what creates the receivable on your books. |
| **Sales Returns** | Handle customer returns, with or without an invoice already issued. |
| **Customers** | List, add, and edit customer records. |
| **Payments** | Record payments against invoices; track who owes you what. |
| **Settings** | Pick a workflow mode, set default accounts, configure invoice numbering, and manage sender accounts for outbound messages. |
| **Dashboard** | Quick view: total revenue, outstanding AR, overdue invoices, top customers. |

---

## First things to set up

1. **Go to `Sales → Settings`** and click **Initialize Sales** (one-time, sets defaults).
2. **Pick a workflow mode:**
   - **SIMPLE** — invoice direct, no separate delivery step. Best for service businesses or small retailers who don't run a warehouse.
   - **OPERATIONAL** — full chain (Order → Delivery → Invoice). Best for businesses with physical inventory and a warehouse team separate from accounting.
3. **Set default accounts:** AR account (receivables), Revenue account, COGS account. These can be overridden per customer or per item.
4. **Set invoice numbering:** prefix (e.g., `INV-`) and starting number.
5. **Add your customers:** `Sales → Customers → New Customer`. Each customer can have its own AR account override, payment terms (e.g., Net 30), and default currency.

---

## Daily workflow (OPERATIONAL mode)

The full chain when you have a warehouse:

### 1. Create a Sales Order

1. `Sales → Orders → New Order`.
2. Pick a customer. Add line items: pick the product, quantity, price. (System suggests latest price.)
3. Set tax code if applicable. Save as DRAFT, then **Confirm** when the customer commits.
4. The SO now shows up in the warehouse queue.

### 2. Deliver the goods (Delivery Note)

1. `Sales → Delivery Notes → New from SO` (or open the SO and click **Create Delivery**).
2. Verify quantities being delivered. Partial delivery is fine.
3. **Post** the delivery. This decrements inventory and recognizes the **cost of goods sold** in your books.
4. Repeat as more partial deliveries happen.

### 3. Invoice the customer

1. `Sales → Invoices → New from DN` (or open the DN and click **Create Invoice**).
2. The system pre-fills quantities equal to what was delivered. You can invoice less than delivered, but not more.
3. Apply discounts at the line level if needed.
4. **Post** the invoice. This creates the receivable: customer now owes you this amount.

### 4. Record the payment

When the customer pays:

1. Open the invoice and click **Record Payment**.
2. Pick the bank/cash account that received the money. Enter the amount.
3. Save. The invoice's payment status updates (UNPAID → PARTIALLY_PAID → PAID).

Or — if the customer pays at point of sale — post the invoice and the payment in one shot using the **Cash Sale** mode (see "Settlement modes" below).

---

## Simpler workflow (SIMPLE mode)

If you picked SIMPLE in settings:

1. `Sales → Invoices → New Invoice`.
2. Pick a customer, add lines, apply tax.
3. **Post**. Stock is decremented at the moment of posting (no separate delivery step).
4. Record payment as in step 4 above.

---

## Sales returns

Two scenarios:

### Customer returns goods after you invoiced them (AFTER_INVOICE)

Most common.

1. `Sales → Returns → New Return`.
2. Link to the posted invoice. Pick the lines being returned and their quantities.
3. **Post**. The system:
   - Decreases the customer's outstanding amount
   - Increases stock back
   - Reverses revenue and tax

### Customer returns goods before you invoiced them (BEFORE_INVOICE)

Only in OPERATIONAL mode. Less common.

1. `Sales → Returns → New Return → Before Invoice`.
2. Link to the posted delivery note (not the invoice — there isn't one).
3. **Post**. Stock goes back, COGS is reversed. No revenue/AR impact (since you never invoiced).

---

## Settlement modes (how you record payment)

When posting an invoice, you can choose:

| Mode | When to use |
|---|---|
| **Deferred** | Customer will pay later. Standard credit sale. Record payment separately when they pay. |
| **Cash Full** | Customer pays in full at point of sale. Post invoice and receipt in one click. |
| **Multi** | Customer pays partly cash, partly bank transfer, etc. Add multiple settlement rows. |

---

## Reports

The Sales dashboard at `/sales` shows headline numbers, and the Sales report pages provide:
- AR Aging
- Customer Statement
- Customer Ledger
- Sales by Customer
- Sales by Item
- Sales by Salesperson

For deeper financial tie-out, Accounting reports remain the source of truth for finalized books.

---

## Multi-currency

If you sell in foreign currencies:

1. Make sure the currency is enabled in `Accounting → Settings → Currencies`.
2. When creating an order or invoice, pick the currency in the header. The system captures today's exchange rate and converts the GL amount to your base currency.
3. The customer sees their invoice in their currency; your books see it in base currency. Both numbers are kept.

---

## Customer-level overrides

You can customize behavior per customer in `Sales → Customers → [Customer] → Edit`:

- **Default AR Account** — bills this customer to a specific receivable account (e.g., separate AR for export customers)
- **Payment Terms (days)** — drives the invoice due date
- **Default Currency** — pre-fills the currency on new orders/invoices
- **Tax Number / Withholding Tax Rate** — appears on documents

---

## Permissions

| Role | Can do |
|---|---|
| `sales.view` | See sales documents (read-only) |
| `sales.orders.manage` | Create / edit Sales Orders |
| `sales.deliveries.manage` | Create / post Delivery Notes |
| `sales.invoices.manage` | Create / post Sales Invoices |
| `sales.returns.manage` | Create / post Sales Returns |
| `sales.payments.record` | Record customer payments |
| `sales.customers.manage` | Add / edit customers |
| `sales.settings.manage` | Configure workflow mode and defaults |

---

## Common questions

**Q: Can I invoice more than I delivered?**
A: Not in OPERATIONAL mode (the system blocks it). In SIMPLE mode, yes — invoicing is standalone.

**Q: I made a mistake on a posted invoice. How do I fix it?**
A: Use Sales Return for the wrong lines, then create a new invoice with the right values. Don't try to edit the posted invoice — that's by design.

**Q: A customer paid more than they owe. Where does the extra go?**
A: Record the payment for the full received amount. The system marks the invoice PAID and the extra remains as an unallocated credit on the customer. Apply it to their next invoice manually.

**Q: I see "Quotations" in some docs but there's no menu for them.**
A: Quotations are planned but not yet built. For now, use a Sales Order in DRAFT status as your quotation.

**Q: The dashboard shows my revenue total — but the Accounting P&L shows a different number. Why?**
A: They should match for a closed period. If they don't, check for: unposted invoices (they show in dashboard but not in P&L), refunds/returns posted in a different period, or manual journal entries to revenue accounts outside Sales.

---

*For technical details (workflow modes, GL posting logic, inventory integration contract) see [`docs/architecture/sales.md`](../../architecture/sales.md). For the canonical posting algorithms see [`docs/modules/sales/ALGORITHMS.md`](../../modules/sales/ALGORITHMS.md).*
