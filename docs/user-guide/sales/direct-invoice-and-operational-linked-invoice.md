# Sales Invoices: Direct and Operational Linked Flow

This guide explains the two invoice behaviors now supported in Sales:

- **Direct invoice** for SIMPLE workflow
- **Linked invoice** for OPERATIONAL workflow

Use this guide when training users or when deciding which Sales setup fits a customer.

---

## Governance exceptions

In **Operational** workflow, direct invoices are blocked by default. This protects businesses that require delivery control before invoicing.

Administrators can allow direct invoicing only through the **Sales -> Settings -> Governance** tab.

Supported invoice governance exceptions today:

- **Company** - allow or block a persona for the whole company.
- **Form** - allow or block a persona for a specific form type, such as `sales_invoice_direct`.

Branch-scoped rules are reserved for a later branch-aware invoice flow. They should not be used for Sales invoice enforcement until invoices carry branch context.

### Allowing a direct invoice form in Operational workflow

1. Open `Sales -> Settings -> Governance`
2. Add a new rule
3. Choose persona: `Direct`
4. Choose action: `Allow`
5. Choose scope: `Form`
6. Enter form type: `sales_invoice_direct`
7. Save settings

After this, users can create that approved direct invoice form even when the company workflow is Operational.

---

## 1. Direct invoice

Use direct invoice when the business wants to create the invoice immediately without a separate warehouse delivery document.

Typical fit:

- small retail
- counter sales
- service businesses
- simple one-warehouse businesses

### What the user does

1. Open `Sales -> Invoices -> New Sales Invoice`
2. In the **Control** section, choose **Direct**
3. In the header, choose the customer, invoice date, currency, exchange rate, main warehouse, salesperson, and optional customer PO/reference
4. Add item or service lines
5. Review tax/allocation information below the line grid
6. At the end of the invoice, choose settlement:
   - leave it on credit
   - record a full payment
   - add multiple payment rows
7. Save as draft or use **Save & Post**

### What the system does

When posted, the system:

- calculates tax after discount
- keeps line discounts visible in the accounting voucher
- records the receivable
- records payment immediately if the user chose pay-now
- moves stock for stock-tracked items
- posts cost of goods sold for stock-tracked items

### Important behavior

- Direct invoices use the **Main Warehouse** in the header for stock lines unless a line was already populated from a source document.
- Service-only lines do not need a warehouse.
- The user chooses a payment method such as `Cash`, `Bank Transfer`, `Check`, or `Credit Card`.
- The invoice totals are always visible in the bottom action bar, even when the side rail is hidden. If the side rail is open, it still shows the full totals card as well.
- While the invoice form opens, the loading panel shows elapsed time, cache status, and API progress. The first open after a hard refresh or deployment can still include one server cold start, but the form now loads its startup reference data through one bundled request instead of many separate requests; later opens in the same company use the in-page cache.
- In standalone Sales, the user does not need to know accounting account IDs.

---

## 2. Operational linked invoice

Use linked invoice when the business works in the full operational chain:

`Sales Order -> Delivery Note -> Sales Invoice`

Typical fit:

- warehouse-driven businesses
- businesses with separate sales and delivery staff
- companies that must invoice only what was actually delivered

### What the user does

1. Create and confirm the Sales Order
2. Create the Delivery Note from the Sales Order
3. Review the loaded Sales Order lines and edit **Delivered Qty** if this is a partial delivery
4. Post the Delivery Note
5. Open `Sales -> Invoices -> New Sales Invoice`
6. In the **Control** section, choose **From SO**
7. In the header, select an open Sales Order
8. Review the generated invoice lines
9. Save or post the invoice

### What the system does

For linked operational invoicing:

- **stock lines** are loaded from **posted Delivery Notes**
- **service lines** are loaded from remaining uninvoiced Sales Order quantities
- delivered stock quantity is limited to what was delivered and not yet invoiced
- the warehouse for stock lines is taken automatically from the Delivery Note
- the invoice does not move stock again

The linked-invoice header is source-aware:

- Customer, currency, and exchange rate are populated from the selected Sales Order.
- The main warehouse control is hidden because warehouse comes from the source lines.
- Fully delivered, closed, and cancelled Sales Orders are not shown as normal invoiceable choices.

### Important behavior

- If goods were not delivered yet, they should not appear as invoiceable stock lines.
- Partial delivery creates partial invoiceable quantity.
- If a Delivery Note line was already fully invoiced, it should not appear again.
- Service lines do not need Delivery Notes.
- Cost validation follows inventory accounting mode:
  - `Perpetual`: posting requires positive stock cost.
  - `Invoice-driven` (`Periodic`): posting can proceed with zero cost; unresolved cost appears in unsettled-cost reporting until receipts establish cost.
- Delivery Note COGS posting uses the default COGS and inventory asset accounts from Inventory Settings when the item or category does not have its own accounts.

---

## 3. Discounts and invoice-level allocation

Both invoice styles support commercial terms on the invoice itself.

### Line discount

Each line can use:

- **Percent discount**
- **Amount discount**

The system reduces the taxable base and invoice line total accordingly. In accounting, the discount is posted separately so it can be reported as a discount/expense instead of disappearing inside a final net sales amount.

### Account Ledger and Financial Taxes Allocation Grid

The invoice page no longer shows mocked ledger allocation rows or the old **Charge / Account Name** entry table. Until the controlled allocation contract is implemented, invoice posting continues to use the backend's validated Sales Invoice posting rules rather than editable allocation rows on the page.

Invoice-level additions and account overrides are planned separately so they can affect totals, posting, audit trail, and tax reporting consistently.

The settlement control appears after this allocation area so the user finishes the invoice lines and tax review before choosing payment handling.

---

## 4. Payments

When the invoice is posted, the user can either:

- leave it unpaid,
- record a full immediate payment,
- or record multiple payment rows.

Supported payment methods:

- Cash
- Bank Transfer
- Check
- Credit Card
- Other

The system maps these methods internally to the right hidden accounting accounts.

Advanced users may override the settlement or AR account, but the system only accepts posting accounts. Header accounts cannot receive a payment voucher.

---

## 5. When to use each mode

| Situation | Recommended flow |
|---|---|
| The business sells and invoices immediately | Direct invoice |
| The business must deliver first, then invoice | Operational linked invoice |
| Service-only work with no warehouse delivery | Direct invoice or linked service line from SO |
| Physical stock with delivery control | Sales Order -> Delivery Note -> Linked Invoice |

---

## 6. Smaller screens and Windows mode

The Sales Invoice page is designed to remain usable when opened in Windows mode or on a smaller screen:

- The main invoice workspace scrolls vertically when the available height is limited.
- On wide screens, the right-side information, posting readiness, settlement, and totals rail is pinned by default. Use the rail button to hide it; a small edge button remains available to bring it back.
- In Windows mode or on smaller screens, the rail hides automatically and opens from the edge button as a drawer so it does not cover or push the invoice fields.
- In Arabic/RTL, the same rail appears on the left side, and its hide/show buttons open from that left edge.
- Wide invoice tables keep their own horizontal scroll, so columns remain reachable without losing the action buttons.
- If a Windows-mode invoice is resized very small, maximize the window for the most comfortable editing experience.

This layout behavior does not change invoice amounts, taxes, posting, payment handling, or accounting entries.

---

## 7. Common mistakes

**Why can’t I invoice my stock line in operational mode?**  
Because the stock item must first be delivered on a posted Delivery Note.

**Why is warehouse not editable on some linked lines?**  
Because those stock lines came from a Delivery Note. The warehouse is already fixed by that document.

**Why did a Delivery Note mention COGS setup?**  
In perpetual inventory accounting, posting a Delivery Note also posts the stock cost to Accounting. The item, item category, or Inventory Settings must provide COGS and inventory asset accounts. In invoice-driven mode, Delivery Notes move stock but do not create the COGS accounting entry.

**Why did the invoice total change after I added a discount?**  
Because tax is recalculated on the discounted amount.

**Where do discounts and additions appear in accounting?**  
Discounts appear as separate debit lines to the configured Sales discount/expense account. Additions appear as separate revenue lines.

**Why was my payment account rejected?**  
The selected account is probably a header account. Choose a posting account such as a cashbox or bank account.

**Why can I still invoice a service line without delivery?**  
Because service lines do not require inventory fulfillment.

**Why do I see a direct-invoice warning in Operational workflow?**  
Because direct invoicing is blocked unless a Company or Form governance exception allows it.

---

For technical details, see [docs/architecture/sales.md](D:/DEV2026/ERP03/docs/architecture/sales.md).
