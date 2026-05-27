# Vendor AP Sub-accounts

This feature gives each vendor their own payable account instead of posting all vendors into one shared AP account.

## Why you should use it

- Clear vendor payable balances
- Easier vendor reconciliation
- Better AP traceability for audits

## Setup

1. Go to `Purchases → Settings`.
2. In **AP Sub-account Generation**:
   - Set **AP Parent Account**.
   - Set **Account Code Format** (for example: `{parent}-{partyCode}`).
3. Save settings.

## Vendor creation behavior

When creating a vendor, in the **Accounting** section pick one:

- **Auto-create AP sub-account**: system creates a child AP account under your configured parent and assigns it to the vendor.
- **Pick existing AP account**: you choose an existing AP posting account for this vendor.

The form requires a strategy selection before save.

## Backfill existing vendors

For vendors created before this setup:

1. Open `Purchases → Settings`.
2. Click **Backfill vendor AP sub-accounts**.
3. Confirm.
4. Review the toast result:
   - **Created**: vendors that got a new dedicated AP account
   - **Skipped**: vendors already on valid child AP accounts
   - **Errors**: vendors needing manual correction

## Notes

- Backfill never re-parents existing accounts.
- Backfill is idempotent and safe to run multiple times.
