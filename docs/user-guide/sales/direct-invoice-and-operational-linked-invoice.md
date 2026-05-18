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
2. Choose the customer
3. Add item or service lines
4. Optionally add:
   - **line discount**
   - **charges / additions** such as delivery fee or service fee
   - **pay now** settlement rows
5. Save as draft or use **Save & Post**

### What the system does

When posted, the system:

- calculates tax after discount
- includes document charges in the invoice total
- keeps discounts and additions visible in the accounting voucher
- records the receivable
- records payment immediately if the user chose pay-now
- moves stock for stock-tracked items
- posts cost of goods sold for stock-tracked items

### Important behavior

- Stock items need a warehouse on the invoice line.
- Service-only lines do not need a warehouse.
- The user chooses a payment method such as `Cash`, `Bank Transfer`, `Check`, or `Credit Card`.
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
6. Select the Sales Order
7. Click **Load Invoiceable Lines**
8. Review the generated invoice lines
9. Save or post the invoice

### What the system does

For linked operational invoicing:

- **stock lines** are loaded from **posted Delivery Notes**
- **service lines** are loaded from remaining uninvoiced Sales Order quantities
- delivered stock quantity is limited to what was delivered and not yet invoiced
- the warehouse for stock lines is taken automatically from the Delivery Note
- the invoice does not move stock again

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

## 3. Discounts and charges

Both invoice styles support commercial terms on the invoice itself.

### Line discount

Each line can use:

- **Percent discount**
- **Amount discount**

The system reduces the taxable base and invoice line total accordingly. In accounting, the discount is posted separately so it can be reported as a discount/expense instead of disappearing inside a final net sales amount.

### Charges / additions

The invoice can include extra rows such as:

- delivery fee
- packaging fee
- service charge
- other additions

These amounts are added to the invoice total and can also carry tax if configured.

In accounting, additions are posted as separate revenue lines so delivery fees, service fees, packaging, and similar gains remain traceable.

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

## 6. Common mistakes

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
