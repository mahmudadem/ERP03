# Salespersons and Commissions

The salesperson feature lets you track which team member is responsible for each sale and automatically calculate the commission they have earned on each invoice.

---

## Adding a salesperson

1. Go to **Sales → Salespersons**
2. Click **New Salesperson**
3. Fill in:
   - **Code** — a short unique identifier, for example "SP01" or "JANE"
   - **Name** — the salesperson's full name
   - **Email** — optional, for reference
   - **Default Commission %** — the percentage of the invoice total this salesperson earns as commission. Enter a number between 0 and 100
   - **Commission Payable Account** — optional; the accounting account used when commission is paid out (for accountants setting up GL integration)
   - **Status** — Active or Inactive
4. Save

---

## Attaching a salesperson to a sale

On any Sales Order or Sales Invoice, there is a **Salesperson** field. Choose the salesperson from the dropdown.

When the invoice is posted, the system records that this salesperson is responsible for the sale and calculates their commission.

---

## How commissions are calculated

When a sales invoice is posted with a salesperson attached, the system automatically creates a commission entry:

- **Commission amount = Invoice total (including tax) × Commission %**

The commission percentage is frozen at the moment the invoice posts. If you later change the salesperson's default commission rate, past invoices are not affected — their commission entries keep the rate that was in effect when they were invoiced.

**Example:**
- Invoice total: 10,000.00 (base currency)
- Commission rate: 5%
- Commission earned: **500.00**

---

## Where commissions show up

Go to **Sales → Commissions** to see all commission entries. You can filter by:

- salesperson
- status (Accrued, Paid, Cancelled)
- date range

Each entry shows the invoice it came from, the invoice date, the customer, the base amount, the commission rate, and the commission amount.

---

## Marking commissions as paid

When you have paid out a salesperson's commission:

1. Open the commission entry (or find it in the list)
2. Click **Mark as Paid**
3. Enter the payment date and an optional payment reference (such as a bank transfer number)
4. Save

The entry status changes from **Accrued** to **Paid**. Paid commissions cannot be cancelled.

---

## Cancelling a commission

If a commission was accrued by mistake — for example, if the invoice was cancelled — you can cancel the commission entry:

1. Open the commission entry
2. Click **Cancel**

Only **Accrued** entries can be cancelled. Once a commission is marked Paid it cannot be cancelled.

---

## Viewing a salesperson's totals

On the Salespersons list or on an individual salesperson's record, you can see a summary of:

- total commissions accrued
- total commissions paid
- total commissions cancelled

---

## Common questions

**The salesperson field is blank — why was no commission created?**
A commission is only created when a salesperson is selected on the invoice before it is posted. If the field was blank at posting time, no commission entry is created.

**I changed the commission rate. Will past invoices be recalculated?**
No. The rate is frozen when the invoice posts. Only future invoices will use the new rate.

**I posted an invoice but I do not see a commission entry yet.**
Commission entries are created automatically after a successful post. If the entry is missing, you can trigger it manually: go to Sales → Commissions and use the accrue option with the invoice ID. This is safe to run more than once — the system will not create a duplicate if an entry already exists.

**Can I have different commission rates per salesperson?**
Yes. Each salesperson has their own default commission rate. Set it on their record and it will apply to all their future invoices.

**Does marking a commission as Paid create an accounting entry?**
Not yet in the current version. Marking as Paid records the date and reference but does not post a journal entry to the general ledger. Full GL integration for commission payments is planned for a future release.
