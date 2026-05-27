# GL Impact — User Guide

## What It Does

The **GL Impact** (General Ledger Impact) view shows you exactly how a posted sales document affected your accounting books. It displays the journal entries that were automatically created when the document was posted, along with the account resolution decisions that determined which GL accounts were used.

## How to View GL Impact

1. Open a **posted** Sales Invoice, Delivery Note, or Sales Return.
2. Click the **GL Impact** button (located near the top-right of the detail page).
3. A dialog opens showing the journal entries and account resolution details.

## What You'll See

### Journal Entries

For each voucher created by the posting, you'll see:
- **Voucher number** and date
- **Type** of voucher (e.g., SALES_INVOICE)
- **Line-by-line breakdown** showing:
  - Account ID
  - Debit amount
  - Credit amount
- **Totals** for debit and credit (these should always balance)

### Account Resolution

This section shows how the system decided which GL accounts to use for each line item:

| Field | Description |
|-------|-------------|
| **Line #** | The document line number |
| **Item** | The item ID (if applicable) |
| **Role** | The account role (revenue, COGS, tax, AR, etc.) |
| **Account** | The GL account ID that was used |
| **Resolved via** | How the account was determined (e.g., "item level", "category default", "settings default") |

### Posting Warnings

If there were any warnings during posting (e.g., a fallback account was used because the preferred account wasn't configured), they are displayed in an amber warning box.

## Who Can View GL Impact

Any user who can view a posted document can also view its GL Impact. The button appears only on documents with status **POSTED**.

## Frequently Asked Questions

**Q: Why don't I see a GL Impact button?**
A: The button only appears on documents that have been posted. Draft documents have no GL impact yet.

**Q: What does "Resolved via" mean?**
A: It shows how the system found the right GL account. For example, "item level" means the account was set directly on the item; "settings default" means it fell back to the module-level default.

**Q: Can I change the GL accounts after posting?**
A: No. Once a document is posted, the journal entries are final. If you need to correct them, you would need to create an adjusting journal entry through the Accounting module.
