# Customer Statement and Ledger

The Customer Statement and Customer Ledger give you a complete picture of a customer's account — every invoice raised, every payment received, and how the balance has moved over time.

---

## The two views

The page has two tabs:

- **Statement** — a formal account statement for a chosen date range, showing an opening balance, all activity in the period, and a closing balance. This is what you would send to a customer to confirm their account position.
- **Ledger** — the full transaction history in date order, with a running balance. Use the ledger when you need to trace every entry on the account rather than summarize a period.

---

## Running a statement

1. Go to **Sales → Reports → Customer Statement**
2. Select the **Customer**
3. Set a **From date** and **To date** for the period you want
4. The statement loads automatically

---

## What the statement shows

### Opening balance

The opening balance is how much the customer owed (or had in credit) at the start of the period — that is, the net of all invoices and payments posted before your "From date". If you choose a "From date" of 1 January 2026, the opening balance is everything that happened up to and including 31 December 2025.

### Activity lines

The body of the statement lists every invoice and payment that falls within your chosen date range:

- **Invoices** appear as debits — they increase what the customer owes.
- **Payments** appear as credits — they reduce what the customer owes.

On any day where both an invoice and a payment are posted, the invoice appears first.

### Closing balance

The closing balance is the opening balance adjusted for all activity in the period:

```
Closing balance = Opening balance + Total invoiced − Total paid
```

This is the amount the customer owes at the end of the period.

### Totals summary

Below the activity lines you will see:

- **Total invoiced** — the sum of all invoice debits in the period
- **Total paid** — the sum of all payments received in the period

### Open invoices

At the bottom of the statement you will see a list of all invoices that currently have an outstanding balance, regardless of when they were issued. This tells you what is actually unpaid at the time you ran the statement.

---

## The Ledger view

Switch to the **Ledger tab** to see the customer's full transaction history without a fixed date range. The ledger shows:

- Every invoice ever posted for the customer (oldest first)
- Every payment received against those invoices
- A running balance column that updates after every entry

The running balance starts at zero and increases with each invoice, decreasing with each payment. At any point in the list you can read off what the customer owed at that moment.

You can optionally set a date range on the ledger too, in which case it will show only the activity within that range while still calculating the correct opening balance for the period.

---

## Common questions

**What if the opening balance is zero even though the customer has older invoices?**
This means all invoices issued before the "From date" have been fully paid. A zero opening balance is correct — it means the customer had a clean slate at the start of the period.

**The closing balance does not match what I expected.**
Check whether there are payments recorded in the system that you were not expecting. The Ledger view shows every entry in detail and is the easiest way to trace unexpected movements.

**Can I use this statement to send to the customer?**
Yes. The statement view is designed to be printed or exported and sent to a customer for confirmation of their account balance and activity.

**Does the statement show invoices from other periods if they are still unpaid?**
The activity lines only show transactions within your chosen date range. However, the "Open invoices" section at the bottom shows all currently unpaid invoices regardless of date, so you will not miss an overdue amount just because it falls outside the statement period.
