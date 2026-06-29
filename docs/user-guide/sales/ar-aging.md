# AR Aging Report

The AR Aging report shows how much money customers owe you right now, organized by how old each balance is. It is your primary collections tool — at a glance you can see who is overdue, by how much, and for how long.

The report follows the selected interface language. Filters, aging buckets, totals, empty/loading messages, and the expanded invoice-detail rows are localized without changing the receivables aging logic.

---

## What the report shows

The report lists every customer who has at least one unpaid posted invoice. For each customer you see their total outstanding balance split into five age buckets:

| Bucket | What it means |
|---|---|
| Current | Not yet due — the invoice is within its payment terms |
| 1–30 days | Overdue by up to 30 days |
| 31–60 days | Overdue by 31 to 60 days |
| 61–90 days | Overdue by 61 to 90 days |
| 90+ days | Overdue by more than 90 days |

A totals row at the bottom sums every bucket across all customers.

Fully paid invoices do not appear on the report. An invoice is considered fully paid when its outstanding balance is zero (or less than half a cent).

---

## How the aging buckets are calculated

For each invoice, the system works out how many days old it is as of the report date:

- If the invoice has a **due date**, the system counts from the due date.
- If the invoice has **no due date**, the system counts from the invoice date itself.

"Days overdue" is the number of whole days between the invoice's aging date and the report date. A positive number means the invoice is past due; zero or negative means it is still current.

**Example:**

| Invoice | Due date | Report date | Days overdue | Bucket |
|---------|----------|-------------|--------------|--------|
| INV-001 | 2026-04-01 | 2026-05-20 | 49 days | 31–60 |
| INV-002 | 2026-05-25 | 2026-05-20 | −5 days | Current |
| INV-003 | (none set) | 2026-05-20 | Aged from invoice date | Depends on invoice date |

---

## Running the report

1. Go to **Sales → Reports → AR Aging** (or the AR Aging page in your navigation)
2. Choose an **As of date** — the report calculates aging relative to this date. It defaults to today.
3. Optionally narrow to a single customer using the **Customer** filter.
4. The report loads automatically.

---

## How to read it for collections

**Start with the 90+ column.** These are the oldest debts and the ones most at risk of going bad. Contact those customers first.

**Work left to right.** After 90+, review 61–90, then 31–60. Any balance in these columns is already overdue and should be followed up.

**Current column.** These invoices are not yet due. Review them to plan upcoming collection calls — any invoice moving toward its due date in the next week or two is worth a proactive reminder.

**Drill into a customer row.** The report shows the individual invoices behind each customer's totals, including the invoice number, invoice date, due date, and the exact amount outstanding. Use this when calling the customer so you can reference specific invoice numbers.

---

## Common questions

**Why does an invoice show in Current even though I thought it was overdue?**
Check whether the invoice has a due date set. If it does not, the system ages from the invoice date. If the invoice date is recent, it may still be current.

**A customer has paid but their invoice still shows on the report.**
The payment may not have been recorded in the system yet. Once the payment is posted, the invoice's outstanding balance updates and it drops off the report.

**Can I filter to just one customer?**
Yes — use the Customer filter when running the report. This is useful when you are preparing for a collections call and want to see only that customer's position.
