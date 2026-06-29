# Customer Statement and Ledger

The Customer Statement and Customer Ledger give you a complete picture of a customer's account. The statement balance comes from the posted accounting ledger for that customer's AR account, so it includes invoices, payments, returns, refunds, and manual adjustments that affected the customer balance.

The report follows the selected interface language. Filters, statement/ledger labels, balance rows, action buttons, open invoices, and open commitments are localized without changing the AR ledger source or statement balance logic.

---

## The two views

The page has two tabs:

- **Statement** — a formal account statement for a chosen date range, showing an opening balance, all posted activity in the period, and a closing balance. This is what you would send to a customer to confirm their account position.
- **Ledger** — the same ledger-backed transaction list presented for trace work, with a running balance.

---

## Running a statement

1. Go to **Sales → Reports → Customer Statement**
2. Select the **Customer**
3. Set a **From date** and **To date** for the period you want
4. Optional: tick **Include open commitments** if you want to see open Sales Orders below the financial statement
5. Click **Generate Report**

---

## What the statement shows

### Opening balance

The opening balance is how much the customer owed (or had in credit) at the start of the period — that is, the net of all invoices and payments posted before your "From date". If you choose a "From date" of 1 January 2026, the opening balance is everything that happened up to and including 31 December 2025.

### Activity lines

The body of the statement lists every posted ledger movement that falls within your chosen date range:

- **Invoices** appear as debits — they increase what the customer owes.
- **Payments** appear as credits — they reduce what the customer owes.
- **Credit notes / refunds** appear as credits — they reduce what the customer owes or record money returned.
- **Adjustments** appear when a journal or accounting voucher affects the customer's AR account.

Draft documents and unposted documents are not included because they have not affected Accounting yet.

Each row lets you open:

- The original Sales document, when the statement can identify it
- The Accounting voucher behind the ledger entry

### Closing balance

The closing balance is the opening balance adjusted for all activity in the period:

```
Closing balance = Opening balance + posted debits − posted credits
```

This is the amount the customer owes at the end of the period.

### Totals summary

Below the activity lines you will see:

- **Total invoiced** — the sum of invoice debits in the period
- **Total paid** — the sum of payment credits in the period
- **Credits** — the sum of credit-note/refund credits in the period

### Open invoices

At the bottom of the statement you will see a list of all invoices that currently have an outstanding balance, regardless of when they were issued. This tells you what is actually unpaid at the time you ran the statement.

### Open commitments

If you tick **Include open commitments**, the report also shows open Sales Orders that have not been fully invoiced. These are commercial commitments only. They do not change the opening balance, activity lines, or closing balance because they are not posted to the ledger.

---

## The Ledger view

Switch to the **Ledger** view to trace the customer's posted transaction history. The ledger shows:

- Posted invoices, payments, credit notes, refunds, and adjustments
- A running balance column that updates after every entry

You can set a date range; the report still calculates the correct opening balance from earlier posted ledger activity.

---

## Common questions

**What if the opening balance is zero even though the customer has older invoices?**
This means all invoices issued before the "From date" have been fully paid. A zero opening balance is correct — it means the customer had a clean slate at the start of the period.

**The closing balance does not match what I expected.**
Open the rows from the statement. Start with the original Sales document, then open the Accounting voucher to confirm how the ledger was affected.

**Why does a Sales Order not affect the balance?**
Sales Orders are commitments, not posted accounting events. Use **Include open commitments** to show them below the statement without mixing them into the financial balance.

**Can I use this statement to send to the customer?**
Yes. The statement view is designed to be printed or exported and sent to a customer for confirmation of their account balance and activity.

**Does the statement show invoices from other periods if they are still unpaid?**
The activity lines only show transactions within your chosen date range. However, the "Open invoices" section at the bottom shows all currently unpaid invoices regardless of date, so you will not miss an overdue amount just because it falls outside the statement period.
