# Period Lock — User Guide

## What It Does

Period Lock prevents posting sales documents (invoices, delivery notes, returns) to accounting periods that have been locked or closed by your accountant. This ensures that once a period is finalized, no one can accidentally change the numbers.

There are **two levels** of protection:

| Level | What It Means | Can You Override? |
|-------|--------------|-------------------|
| **Soft Lock** | Your accountant set a "locked through" date. Documents dated on or before that date are blocked. | **Yes** — you can override by typing a reason. The override is recorded for audit purposes. |
| **Hard Lock** | A fiscal period has been officially closed or locked. | **No** — this cannot be overridden. You must contact your accountant to reopen the period. |

## How to Set Up Period Lock

1. Go to **Accounting → Settings → Accounting Periods** tab.
2. Toggle **"Enable Period Lock"** to ON.
3. Set the **"Locked Through Date"** — all documents dated on or before this date will be blocked from posting.
4. Click **Save**.

> **Tip:** You can change the locked-through date at any time. Moving it forward locks more dates; moving it back unlocks dates.

## What Happens When You Try to Post a Locked Document

### Soft Lock (Overridable)

1. You click **Post** on a Sales Invoice, Delivery Note, or Sales Return.
2. If the document date falls within the locked period, you'll see an **Override Period Lock** dialog.
3. The dialog shows:
   - The document date
   - The locked-through date
   - A warning message
4. Type a **reason** explaining why this document needs to be posted to a locked period.
5. Click **Override & Post**.
6. The document posts successfully. Your reason is recorded in the audit log.

### Hard Lock (Not Overridable)

1. You click **Post** on a document.
2. If the document date falls within a closed fiscal period, you'll see an error message: *"This accounting period is closed and cannot be overridden."*
3. You **cannot** post the document. Contact your accountant to reopen the period.

## Who Can See Period Lock Settings

Period lock settings are in the **Accounting** module. Only users with Accounting access can view and change them.

## Frequently Asked Questions

**Q: Can I change the locked-through date after setting it?**
A: Yes. Go to Accounting Settings → Accounting Periods and update the date.

**Q: What happens if I override a period lock — is there a record?**
A: Yes. Every override creates an audit record with the reason, who did it, and when. This is visible in the document's "History" tab.

**Q: Does period lock affect existing posted documents?**
A: No. Period lock only blocks new posting attempts. Already-posted documents are not affected.

**Q: Does this apply to all document types?**
A: Yes — Sales Invoices, Delivery Notes, and Sales Returns are all subject to period lock.
