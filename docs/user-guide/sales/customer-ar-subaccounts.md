# Customer AR Sub-accounts

This feature gives each customer their own receivable account instead of mixing all customers in one shared AR account.

## Why you should use it

- Cleaner customer balances
- Easier customer statement reconciliation
- Better audit trail for AR activity

## Setup

1. Go to `Sales → Settings`.
2. In **AR Sub-account Generation**:
   - Set **AR Parent Account**.
   - Set **Account Code Format** (for example: `{parent}-{partyCode}`).
3. Save settings.

## Customer creation behavior

When creating a customer, in the **Accounting** section pick one:

- **Auto-create AR sub-account**: system creates a child AR account under your configured parent and assigns it to the customer.
- **Pick existing AR account**: you choose an existing AR posting account for this customer.

The form requires you to choose one strategy before saving.

## Backfill existing customers

If you had customers before enabling this feature:

1. Open `Sales → Settings`.
2. Click **Backfill customer AR sub-accounts**.
3. Confirm.
4. Review the toast result:
   - **Created**: customers that got a new dedicated AR account
   - **Skipped**: customers already using a valid child account
   - **Errors**: customers needing manual cleanup

## Notes

- Backfill does not re-parent existing accounts.
- Backfill is idempotent: running it again only processes missing/invalid cases.
