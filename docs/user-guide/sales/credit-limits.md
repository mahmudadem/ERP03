# Customer Credit Limits

A credit limit is the maximum amount a customer is allowed to owe your business at any one time. When you try to confirm a sales order, the system checks whether the order would push the customer over their limit — and either warns you or blocks the order, depending on how you have set up their policy.

---

## How the limit works

The system calculates the customer's **current exposure**: the total unpaid balance across all their posted (open) sales invoices.

When you confirm a sales order, the system adds the order value to that balance:

```
Current exposure (unpaid invoices) + This order = Projected exposure
```

If the projected exposure is over the credit limit, the system responds according to the customer's **credit policy**.

---

## Setting a credit limit on a customer

1. Go to **Sales → Customers** and open the customer record
2. Go to the **Commercial** tab
3. Fill in:
   - **Credit Limit** — the maximum they are allowed to owe, in your base currency. Leave this blank if you do not want to apply any credit control to this customer
   - **Credit Hold Policy** — choose what happens when they go over the limit (see below)
4. Save

If you leave **Credit Limit** blank, no check is ever run for this customer, regardless of the policy setting.

---

## The three credit policies

### None

No enforcement. The system runs the check and records the numbers internally, but it never blocks or warns — you will always be able to confirm the order.

Use this for customers you trust completely or for situations where you want to gather data before turning on enforcement.

### Warn

When the customer would go over their limit, the order is still confirmed — but a warning banner appears on the order screen showing you the exposure figures. You can proceed, but the system has flagged it.

Use this for low-risk customers where a human should be aware but should not be stopped.

### Block

When the customer would go over their limit, the system **prevents you from confirming the order**. A dialog appears showing:

- their credit limit
- their current unpaid balance
- the value of this order
- the projected total if this order went through

To proceed, you must enter a **reason** for the override. This reason is recorded in the audit log — who approved the override, when, and why.

Use this for high-risk accounts where you need a deliberate approval step before extending more credit.

---

## Overriding a blocked order

If you have the authority to approve exceptions:

1. When the block dialog appears, read the exposure figures
2. Type a clear reason in the **Override reason** field — for example: "Customer has confirmed payment on account by Friday; approved by Finance Manager"
3. Click **Confirm anyway**

The order is confirmed. The override is permanently recorded and cannot be deleted — it is part of the audit trail.

The reason is mandatory. The system will not allow an empty or blank reason through.

---

## What counts toward the exposure

The check includes all **posted** sales invoices that have an outstanding balance. This means:

- invoices that are fully unpaid
- invoices that are partially paid (only the unpaid portion counts)

It does **not** include:
- draft invoices (not yet posted)
- invoices that are fully paid
- sales orders that have not yet been invoiced

---

## Common questions

**The customer's limit is set but the system is not blocking anything.**
Check that the **Credit Hold Policy** is set to **Block** (or Warn, if you want warnings). If the policy is **None**, no action is taken even if they are over the limit.

**I want to stop the customer from buying until they pay their balance.**
Set the policy to **Block** and set a credit limit of 0. Any order at all will trigger the block dialog.

**Can I see a list of overrides that have been approved?**
Yes — the audit records are stored internally. Ask your system administrator or developer to run a report from the credit overrides collection.

**Does the limit apply to quotations?**
No. The credit check only runs when a sales order is confirmed. Quotations and draft orders do not trigger it.

**Does the limit apply when I create a direct invoice (no sales order)?**
Yes — since Phase E, the credit check also fires when you create a direct Sales Invoice (no linked Sales Order). The same BLOCK/WARN/OVERRIDE flow applies. Linked invoices (from a Sales Order) already had their credit checked at order confirmation time.

**Can I override the credit check on a direct invoice?**
Yes. If the policy is BLOCK and the invoice exceeds the limit, a dialog appears with the same override reason field as Sales Order confirmation. Enter a reason to proceed. The override is recorded in the audit trail.

**The customer paid — why is the exposure still showing the old amount?**
Make sure the payment has been recorded and posted in the system. The exposure calculation reads live outstanding balances from posted invoices, so a payment that has not been posted will not reduce the exposure figure.
