# Accounting — User Guide

This is the financial heart of ERP03. Everything that involves money — sales, purchases, inventory valuation, salaries, taxes — eventually shows up here as a journal entry in the general ledger.

If you've used accounting software before (QuickBooks, Xero, SAP, etc.) the concepts will be familiar. This guide walks through the features in the order most users discover them.

---

## What you can do here

| Area | What it does |
|---|---|
| **Chart of Accounts** | Set up the list of accounts (Cash, Accounts Receivable, Revenue, etc.) you'll use to classify transactions. |
| **Vouchers** | Record any financial transaction: journal entries, payments, receipts, and specialized voucher types defined by your administrator. |
| **Approvals** | Review and approve vouchers before they post to the ledger (if your company requires it). |
| **Reports** | Trial Balance, Profit & Loss, Balance Sheet, General Ledger, Cash Flow, Account Statement, and more. |
| **Cost Centers** | Tag transactions to departments, projects, or branches so you can analyze costs by area. |
| **Recurring Vouchers** | Set up vouchers that repeat automatically (e.g., monthly rent). |
| **Forms Designer** | Customize voucher layouts without writing code. |
| **Settings** | Fiscal year, base currency, exchange rates, FX revaluation, posting policies. |

---

## First things to set up

Before you record any transactions, do these in order:

1. **Fiscal year and base currency** — `Accounting → Settings`. Once you start posting, these are hard to change.
2. **Chart of Accounts** — `Accounting → Accounts`. Add the accounts your business needs. ERP03 comes with a starter set; you can rename, add, or hide accounts.
3. **Opening balances** — for an existing business, post an "Opening Balances" journal entry to bring your historical balances into the system.
4. *(Optional)* **Cost Centers** — `Accounting → Cost Centers`. Add departments/projects if you want to analyze costs that way.
5. *(Optional)* **Approval Policy** — turn on `Approval Required` in Settings if vouchers must be approved before they post.

### COA templates and default posting accounts

If you initialize Accounting from a built-in template, ERP03 now pre-seeds the main fallback posting accounts used by Sales/Purchases integration. In practice this means you should already have usable defaults for:

- Accounts Payable (AP)
- Sales Revenue
- Cost of Goods Sold (COGS)
- GRNI (Goods Received Not Invoiced) where perpetual inventory flow is enabled

You can still add your own detailed account tree (for example separate domestic/export revenue, or separate vendor AP groups), but these defaults reduce setup friction and prevent early posting failures caused by missing core control accounts.

---

## Daily workflow: Recording a transaction

The most common task. Here's the standard flow:

1. Go to `Accounting → Vouchers → New Voucher` (or pick a specific type like Payment, Receipt, Journal Entry).
2. Choose the voucher type and date.
3. Pick the accounts. Enter debit / credit amounts. The total debits must equal total credits — the system blocks you from posting if they don't balance.
4. Add a description, optionally attach a file (receipt, invoice scan), and optionally tag a cost center.
5. **Save** as DRAFT, or **Post** if you're done.
   - If your company requires approval, the voucher goes to APPROVED status first (visible to approvers under `Accounting → Approvals`), then can be posted.

Once posted, the voucher is **immutable**. To correct it, use **Reverse & Replace** (see below).

---

## Posting account safety

Only real posting accounts can be used on vouchers. Header accounts are grouping rows in the Chart of Accounts, such as "Cash" or "Accounts Receivable" parent headings. They are useful for reports, but they are not valid places to post money.

When you post a voucher, ERP03 now checks this at the Accounting engine boundary. It blocks:

- header / non-posting accounts
- inactive accounts
- accounts that were replaced by another account
- parent accounts that still have child accounts
- missing or invalid account IDs

This protection applies to manual Accounting vouchers and automatic vouchers created from Sales or other modules. If a voucher is rejected, select a child posting account such as a specific cashbox, bank account, customer receivable account, revenue account, or expense account.

**Admin note:** This protects normal ERP03 screens and backend APIs. Direct database access is still a separate security responsibility. Production database permissions must prevent users or external tools from writing directly to ledger data outside the ERP03 backend.

---

## Fixing a mistake after posting: Reverse & Replace

Most posted vouchers are treated as locked for audit reasons. In Flexible mode, if your company enables **Allow Edit/Delete Posted**, you may be able to edit some posted vouchers. Period locks still block the edit if the voucher date is inside a locked period.

When a posted voucher is locked, use Reverse & Replace instead:

1. Open the posted voucher you want to fix.
2. Click **Correct** (or use the menu → Reverse & Replace).
3. The system creates a **reversal voucher** that cancels out the original. The reversal is dated the same as the original by default, so the period balance is restored.
4. You can optionally have the system also create a **replacement DRAFT** copy of the original. Edit it and post it normally.

Both the reversal and the replacement are linked to the original via a correction group ID, so you can see the full chain in the audit trail.

**Important:** If the original voucher is in a closed period and the replacement should land in a new period, manually change the replacement's date. The reversal stays at the original date.

---

## Reports

Available under `Accounting → Reports`. All reports read from the immutable ledger, so what you see is what was actually posted.

| Report | What it shows |
|---|---|
| **Trial Balance** | Balances of every account at a point in time. The first sanity check for any accountant. |
| **Profit & Loss** | Income minus expenses over a period. Tells you if you made or lost money. |
| **Balance Sheet** | Assets, liabilities, and equity at a point in time. Tells you what you own and owe. |
| **General Ledger** | Every entry posted to a single account, with the running balance. |
| **Account Statement** | Like General Ledger but with opening + closing balance shown explicitly. |
| **Cash Flow** | How cash moved in and out over a period. |
| **Aging** | Outstanding receivables/payables by age (current, 30, 60, 90+ days). *Partial — full bucketing under construction.* |
| **Bank Reconciliation** | Match your bank statement to your books. |
| **Budget vs Actual** | Compare planned figures to what actually happened. |
| **Cost Center Summary** | Same as Trial Balance but grouped by cost center. |
| **Consolidated Trial Balance** | If you have multiple companies, see them rolled up in a single reporting currency. |

All reports have date filters and let you export to PDF or Excel.

---

## Multi-currency

If you transact in more than one currency:

1. Set each foreign currency and its exchange rate in `Accounting → Settings → Currencies`.
2. When you create a voucher in a foreign currency, the system captures today's rate and converts the ledger amount to your base currency. The original currency and rate are kept on the line.
3. At month or year end, run **FX Revaluation** (`Accounting → Settings → FX Revaluation`) to compute unrealized gains/losses on foreign-currency balances. The system creates a DRAFT revaluation voucher you review and post.

---

## Period lock

Once a month/year is closed:

1. Go to `Accounting → Settings → Fiscal Year`.
2. Set the **Locked Through** date.
3. The system will reject any new postings to dates on or before that date.
4. If Flexible mode allows editing or deleting posted vouchers, the period lock still applies. A
   posted voucher dated inside the locked period cannot be edited, cancelled, or deleted through the
   ledger cleanup path.
5. To re-open, change the date (admin-only, audited).

If your company allows soft-lock overrides and your role has permission, some posting screens may ask for an override reason instead of blocking immediately. That reason becomes part of the posting control trail. A closed fiscal period cannot be overridden; post the document in an open period or ask an administrator to reopen the period if that is a valid business decision.

---

## Recurring vouchers

For things that repeat — monthly rent, quarterly subscriptions:

1. Create a voucher as usual, then click **Save as recurring template** (or go to `Accounting → Recurring Vouchers → New`).
2. Set the frequency (daily, weekly, monthly), start date, and end date.
3. The system generates a new DRAFT voucher on each scheduled date. Review and post them under `Accounting → Vouchers`.

---

## Forms Designer

For non-standard voucher types your business uses — e.g., a "Petty Cash Disbursement" form with specific required fields:

1. `Accounting → Forms Designer → New Form`.
2. Drag fields, mark required ones, add validation rules.
3. Save and assign to a voucher type.
4. The next time someone creates that voucher type, they'll see your custom layout.

---

## Permissions

| Role | Can do |
|---|---|
| `accounting.vouchers.view` | See vouchers (read-only) |
| `accounting.vouchers.create` | Create vouchers (DRAFT) |
| `accounting.vouchers.edit` | Edit DRAFT vouchers |
| `accounting.vouchers.post` | Post vouchers (write to ledger) |
| `accounting.vouchers.approve` | Approve vouchers awaiting approval |
| `accounting.accounts.view` / `accounting.accounts.edit` | Manage Chart of Accounts and Cost Centers |
| `accounting.settings.view` / `accounting.settings.edit` | Manage fiscal year, currencies, policies |
| `accounting.designer.view` | Use the Forms Designer |

Your administrator assigns these via `Super Admin → Roles` or `Company Admin → Users`.

---

## Common questions

**Q: I tried to post a voucher and the system said "debits don't equal credits". Why?**
A: That's the basic accounting rule — every transaction must balance. Check your line amounts. The system will not let you post an unbalanced voucher.

**Q: I posted a voucher to the wrong account. How do I fix it?**
A: Open the voucher, click **Correct → Reverse & Replace**, and let it create a replacement DRAFT. Fix the account on the replacement and post it.

**Q: The system says "period is locked" — what do I do?**
A: An admin closed that period. Either ask them to unlock it, or post your entry to the current period instead.

**Q: I don't see the "Approval" tab — is that normal?**
A: It's only visible if your company has Approval Required policy turned on AND you have the `accounting.vouchers.approve` permission.

**Q: Can I delete a voucher?**
A: DRAFT vouchers — yes. Posted vouchers are normally locked, so use Reverse & Replace instead. If
your company deliberately enables Flexible mode with posted delete allowed, the delete still cannot
touch a locked accounting period.

---

*For technical details (posting strategies, repository pattern, multi-currency math) see [`docs/architecture/accounting.md`](../../architecture/accounting.md). For the formal rules around voucher correction see [`backend/src/domain/accounting/CORRECTIONS.md`](../../../backend/src/domain/accounting/CORRECTIONS.md).*
