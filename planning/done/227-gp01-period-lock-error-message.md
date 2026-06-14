# GP01 Period Lock Error Message Fix

**Date:** 2026-06-14  
**Status:** Fixed and live-tested passed by owner  
**Time spent:** ~0.5h

## Summary

During the fresh-tenant GP01 rerun, step 11 behaved correctly from an accounting-control perspective: the system blocked posting a Journal Voucher dated inside the locked period. The issue was the user-facing message. Instead of showing the structured period-lock reason, the voucher modal showed Axios' generic message: `Request failed with status code 400`.

## Technical Developer View

### What Changed

- `frontend/src/modules/accounting/components/VoucherEntryModal.tsx`
  - Added `getDisplayErrorMessage`, which normalizes caught API errors through the shared `errorHandler.normalizeError` and `errorHandler.translateError`.
  - Replaced raw `err.message` display in save, approval, custody confirmation, reject, and post catches.
  - Reset transient modal state (`error`, dirty flags, pending dialogs, local voucher override, rate-deviation state) whenever a new modal session opens.
- `frontend/src/modules/accounting/pages/VouchersListPage.tsx`
  - Keyed the web-mode voucher modal by voucher type plus voucher id/new state so closing and reopening a voucher does not reuse stale component state.
- `frontend/src/services/errorHandler.ts`
  - Unwrapped Axios/backend error envelopes before falling back to Axios' generic wrapper message.

### Why

The backend already returns a structured policy response for period lock:

- `code: PERIOD_LOCKED`
- `category: POLICY`
- `severity: warning`
- readable message with document date and locked-through date

`VoucherEntryModal` bypassed that structure and displayed the generic Axios error message. This made a correct accounting control look like a technical failure.

The web-mode list page also kept the voucher modal component mounted while closed. React therefore preserved transient UI state after a failed save/post, so a new voucher could reopen with the old error banner still visible.

### Accounting Impact

No accounting rule changed. Period-lock enforcement remains unchanged. The fix only improves how policy-block errors are displayed to the user.

## End-User View

If a user tries to post a voucher dated inside a locked accounting period, the system should now explain that the period is locked instead of showing a technical HTTP error.

Example expected message:

> Cannot post to a locked accounting period. Document date is on or before the locked-through date.

Closing the voucher modal and opening a new voucher should now show a clean form, without the previous voucher's error banner or pending state.

## Verification

Passed:

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

## Acceptance Criteria

- Backdated JV in locked period remains blocked: met by owner QA.
- User sees a readable period-lock message instead of `Request failed with status code 400`: met by owner QA.
- Closing the modal after an error and opening a new voucher starts clean: met by owner QA.
- No posting/accounting behavior changed: met.

## Follow-Up

GP01 passed after live owner retest. Continue packaging the GP01 fixes for review/merge, then continue the next golden-path gate.
