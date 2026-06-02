# Posting Approvals and Gatekeeping

This guide explains how document approvals gate postings, how pending approval documents behave, and how managers approve them.

---

## Why Posting Approvals?
In many companies, sales invoices and purchase bills (vendor invoices) must be reviewed by accounting managers or supervisors before they are officially posted. This ensures:
- Accuracy of account selections, tax rates, and prices.
- Compliance with the company's financial controls.
- Prevention of unauthorized ledger or inventory updates.

When approvals are enabled for a document type (e.g., Sales Invoices or Purchase Invoices), clicking **Post** does not immediately affect the General Ledger or inventory stock levels. Instead, the document is safely "parked" to wait for manager approval.

---

## How It Works: Step-by-Step

### 1. Creating and Saving a Draft
* When you create a Sales Invoice or Purchase Invoice, its initial status is **Draft**.
* You can save, edit, and update the lines, prices, and quantities as needed.

### 2. Submitting for Approval (Posting Attempt)
* Click **Post** on the Draft document.
* If your company's accounting policies require approval for this document type, the system will intercept the request, roll back any changes, and park the document.
* The document status changes to **Pending Approval** (indicated by an amber badge).
* **No financial impact occurs:** Stock levels remain unchanged, and no entries are written to the ledger.

### 3. Reviewing and Approving
* An authorized user (e.g., Accounting Manager or Controller) opens the invoice.
* The detail page will display a banner and an **Approve & Post** action button.
* Once the manager clicks **Approve & Post**, the invoice is unlocked, the stock movements are processed, and the General Ledger entries are finalized.
* The document status updates to **Posted**.

---

## Where to Find Document Statuses

* **List Pages:** In **Sales → Invoices** and **Purchases → Invoices**, you can filter documents by **Pending Approval** to quickly see invoices waiting for review.
* **Detail Pages:** Open any invoice to see its status badge in the header action bar.

---

## Tips & Limitations

* **No Half-Posting:** A document is either fully draft/pending or fully posted. The system never generates partial entries.
* **Locked Documents:** Invoices in the **Pending Approval** status are locked to prevent editing by standard operators. Only managers can edit or approve them.
* **Central Policies:** Approval policies are configured centrally under **Accounting → Settings → General Ledger Policies**, rather than in separate module settings, ensuring a single source of truth for compliance.
