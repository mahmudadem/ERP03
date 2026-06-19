# Error messages — what they mean and what to do

When the system refuses a request, the toast at the top of the page now shows a clear, localized message that tells you exactly what went wrong. This guide explains the most common ones and what to do about them.

> **Under the hood (2026-06-19):** every business-rule rejection now returns a structured 4xx with a meaningful domain code instead of an opaque "Request failed with status code 500" wall of text. See the [error taxonomy architecture doc](../../architecture/error-taxonomy.md) for the full mapping. The fix is transparent to you — clearer messages, same flows.

## Sales

### "Cannot mark quote as ACCEPTED from status: DRAFT" / "Quote must be ACCEPTED to convert to a Sales Order"
You tried to accept a quote that is still in **Draft**, or you tried to convert a Draft quote to a Sales Order. Quotes move in this order: **DRAFT → SENT → ACCEPTED → CONVERTED**.

**Fix:** open the quote, click **Send** to the customer first, wait for them to accept, then **Accept** the response, then **Convert to Sales Order** (or Sales Invoice).

### "MULTI settlement total (…) exceeds outstanding amount (…). Enable 'allow over-payment' in Sales settings to record the excess as a customer credit."
You tried to settle an invoice for more than the customer owed. By default the system refuses over-payments to prevent typos from creating phantom customer credits.

**Fix:**
- **Recommended:** reduce the settlement amount to match the outstanding balance.
- **Or** if the customer really did overpay and you want to record the excess as a credit on their account, go to **Sales → Settings → Settlement** and turn on **Allow over-payment**. From then on, over-payments are allowed and the excess is held as a credit against the next invoice.

### "Sales invoice cannot be posted from status: …" (e.g. CANCELLED, PENDING_APPROVAL)
The sales invoice is not in **Draft** (or **Pending Approval** with an approval context). Posting is only valid from those states.

**Fix:**
- If the invoice is **Pending Approval**: open the Approval Center, review the invoice, and approve it; then retry Post.
- If the invoice is **Cancelled** or already **Posted**: you can't post it again. Open a new invoice instead.
- **Side benefit:** re-clicking **Post** on a **Posted** invoice is now a no-op (returns the same invoice, doesn't create a duplicate voucher). The system used to throw 500 here; now it just succeeds.

## Purchases

### "Only DRAFT purchase orders can be confirmed" / "Only draft or confirmed purchase orders can be cancelled" / "Only draft or confirmed purchase orders can be closed"
You tried to perform a lifecycle action on a purchase order that is not in the right status.

**Fix:** open the PO, check the status pill (top-right). Use a different action for that status, or open a new PO.

### "MULTI settlement total (…) exceeds outstanding amount (…). Enable 'allow over-payment' in Purchase settings to record the excess as a vendor credit."
Same idea as the sales over-payment guard, but for vendor bills. By default the system refuses over-payments to vendors.

**Fix:** reduce the settlement amount, or turn on **Allow over-payment** under **Purchase → Settings → Settlement** to record the excess as a vendor credit.

### "Only DRAFT purchase invoices can be posted"
The bill is not in Draft. **Posted** bills can't be re-posted (no duplicate voucher) — the second click is a no-op and you can move on. Other statuses (Cancelled, Pending Approval without context) need a different action: open the bill and check the status pill.

## Accounting

### "Cannot submit voucher in status: …"
You tried to submit a voucher for approval that isn't in **Draft** (or **Rejected**). Submitting moves Draft → Pending so it can be approved and posted.

**Fix:**
- If the voucher is **Pending** or **Approved**: don't submit again. The first submit already worked. Open the voucher to check its state.
- If the voucher is **Posted**: you can't submit a posted voucher. If you need to correct it, use **Reverse and Replace** instead.

### "Voucher must be in PENDING status for financial approval gate." / "…for custody confirmation gate."
The voucher is not in Pending. The approval and custody gates are only relevant when a voucher is waiting for sign-off.

**Fix:** submit the voucher first (DRAFT → PENDING), then approve/confirm.

### "Cannot reject a posted voucher. Use reversal instead."
Posted vouchers have financial effect — they affect the ledger. We won't let you reject one because the books would lose the original entry.

**Fix:** use **Reverse and Replace** (Accounting → Vouchers → open the voucher → Reverse and Replace). This creates a reversing entry and (optionally) a corrected replacement, keeping the books balanced.

### "Cannot cancel a posted voucher. Use reversal instead."
Same principle — posted vouchers carry financial effect and must be reversed, not cancelled.

**Fix:** use **Reverse and Replace** instead.

## When the message says "An unexpected error occurred" / "INFRA_999"

That is a **genuine** server-side problem (DB unavailable, transaction conflict that the client can't safely retry, unhandled code path). The team has been alerted via logs. **Try again in a minute** — if the problem persists, capture the request ID from the toast and share it with the team.
