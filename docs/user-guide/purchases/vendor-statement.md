# Vendor Statement and Ledger

The Vendor Statement shows what your company owes a vendor based on posted accounting entries in that vendor's AP account.

This report is different from an Account Statement:

- **Account Statement** shows the raw accounting account activity.
- **Vendor Statement** shows the vendor-facing explanation of that activity, with links back to the purchase bill, payment, return, or accounting voucher.

---

## Running a vendor statement

1. Go to **Purchases -> Reports -> Vendor Statement**.
2. Select the **Vendor**.
3. Choose **From Date** and **To Date**.
4. Optional: tick **Include open commitments** to show open Purchase Orders.
5. Click **Generate Report**.

---

## What is included

The statement includes posted ledger activity for the vendor's AP account:

- **Bills** increase what you owe the vendor.
- **Payments** reduce what you owe.
- **Debit notes / purchase returns** reduce what you owe.
- **Adjustments** appear when a manual accounting voucher affects the vendor AP account.

Draft bills, unposted returns, and unposted payments do not appear because they have not affected Accounting yet.

---

## Open commitments

If you tick **Include open commitments**, the report also shows open Purchase Orders that have not been fully invoiced.

These are procurement commitments only. They do not change the opening balance, activity lines, or closing balance because they are not posted to the ledger.

---

## Drill-down

Each statement row can open:

- The original Purchases document, when available
- The Accounting voucher that created the ledger effect

Use the source document for business context and the accounting voucher for GL impact/audit review.

---

## Missing AP account message

If the report says the vendor has no AP account, go to **Purchases -> Settings** and run the vendor AP account backfill, or edit the vendor and assign an AP account.

The report intentionally blocks in this case because a vendor statement without a dedicated AP account can mix balances from multiple vendors and produce an unreliable result.
