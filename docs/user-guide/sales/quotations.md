# Quotations

A quotation is a formal price offer you send to a customer before they commit to buying. The customer can accept it, reject it, or ask for a revised version. Once they accept, you convert it directly into a sales order or invoice — no re-entering the lines.

---

## What a quotation is for

Use quotations when you want to:

- agree a price with a customer before raising an order
- keep a record of what was offered and when the offer expires
- show the customer a professional document they can approve
- convert an accepted offer straight into a sales order or invoice without retyping it

---

## Creating a quotation

1. Go to **Sales → Quotations**
2. Click **New Quotation**
3. Fill in the header:
   - **Customer** — who the quote is for
   - **Quote date** — the date of the offer
   - **Valid until** — optional. After this date the quote is considered expired. Leave blank for an open-ended offer
   - **Currency and exchange rate** — if the quote is in a foreign currency
   - **Salesperson** — optional; links the quote to a team member for commission tracking
   - **Notes** — any terms or conditions you want the customer to see
4. Add line items:
   - Choose an item, enter the quantity and unit price
   - Optionally add a discount (percentage or fixed amount) and a tax code
5. Click **Save** — the quotation is saved as a **Draft**

---

## Quote statuses at a glance

| Status | What it means |
|---|---|
| **Draft** | Saved but not yet sent. You can still edit it |
| **Sent** | Sent to the customer. No further edits |
| **Accepted** | Customer agreed to the terms |
| **Rejected** | Customer declined |
| **Expired** | The valid-until date passed while the quote was Draft or Sent |
| **Converted** | The accepted quote was turned into a sales order or invoice |

---

## Sending a quotation

When the draft is ready to go out:

1. Open the quotation
2. Click **Send**

The status changes to **Sent**. The quote is now locked — you cannot edit the lines or header while it is in Sent status.

---

## Recording the customer's response

When the customer replies, open the quotation and click the appropriate action:

- **Accept** — marks the quote Accepted. You can now convert it
- **Reject** — marks the quote Rejected. No further action needed

---

## Revising a quotation

If the customer wants changes — different pricing, different items — use the **Revise** action instead of editing the original.

1. Open the Sent quotation
2. Click **Revise**

The system:
- marks the current quote as **Rejected** (it is superseded)
- creates a new quote that is a copy of the original, but with a new number and version 2 (or the next version number if this is not the first revision)
- opens the new copy in **Draft** status so you can edit it

The previous version is preserved in the system with its own quote number. You can see the full revision history by looking at quotes with the same chain — the **Version** number tells you the order.

---

## Converting an accepted quotation

Once a customer accepts a quote, you can turn it into a live document in one click.

### Convert to Sales Order

Use this when you want to go through the normal order → delivery → invoice flow.

1. Open the **Accepted** quotation
2. Click **Convert to Sales Order**

The system creates a Sales Order with all the lines, prices, and discounts from the quote. You then confirm, deliver, and invoice the order as normal.

### Convert to Sales Invoice

Use this to skip the order step and invoice the customer directly — for example, for service work or immediate payment.

1. Open the **Accepted** quotation
2. Click **Convert to Invoice**

The system creates a Sales Invoice ready to be posted. Review it, make any final adjustments (the invoice starts as a draft), then post.

After either conversion, the quotation status changes to **Converted** and shows a link to the document it became.

---

## Common questions

**Can I edit a quotation after sending it?**
No. Once a quote is Sent it is locked. If you need to change it, use **Revise** to create an editable copy.

**What if the customer comes back after rejecting?**
You can still create a new quotation from scratch. The rejected quote stays on record.

**The customer accepted but I need to change the price before invoicing.**
Convert to a Sales Order or Invoice first, then edit the resulting document before confirming or posting it.

**Where do I see all quotes for one customer?**
On the Quotations list page, filter by customer name or use the customer's own page if it has a quotes tab.

**What does the Version number mean?**
Version 1 is the original quote. Each revision adds 1 to the version. All revisions in the same negotiation are linked so you can trace the full history.
