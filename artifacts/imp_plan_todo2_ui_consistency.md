# Implementation Plan: Web and Windows Voucher UI Consistency

Align the `VoucherEntryModal` (Web View) with `VoucherWindow` (Windows View) to ensure consistent functionality, labels, and status-based actions.

## 1. Update `VoucherEntryModal` Props and State
- Add optional handlers to `VoucherEntryModalProps`:
  - `onApprove?: (id: string) => Promise<void>`
  - `onReject?: (id: string) => Promise<void>`
  - `onConfirm?: (id: string) => Promise<void>`
  - `onPost?: (id: string) => Promise<void>`
- Implement `isReversal` and `forceStrictMode` using `useMemo`:
  ```tsx
  const isReversal = React.useMemo(() => {
    return !!initialData?.reversalOfVoucherId || initialData?.type?.toLowerCase() === 'reversal';
  }, [initialData]);

  const forceStrictMode = React.useMemo(() => {
    return settings?.strictApprovalMode === true || isReversal;
  }, [settings?.strictApprovalMode, isReversal]);
  ```

## 2. Align Action Buttons in `VoucherEntryModal` Footer
### Save Button
- Update the "Save" button to use `forceStrictMode` instead of just `settings?.strictApprovalMode`.
- Match labels:
  - Flexible: `initialData?.postedAt ? 'Update & Post' : 'Save & Post'`
  - Strict Pending: `Update Pending Voucher`
  - Strict Other: `Save as Draft`
- Match visibility: Hide if `forceStrictMode` and status is not `draft` or `pending`.

### Submit Button
- Update visibility: Show if `forceStrictMode` and status is `draft`, `rejected`, or new.

### Add New Action Buttons
- **Approve**: Only if status is `pending` and `onApprove` is provided.
- **Reject**: Only if status is `pending` and `onReject` is provided.
- **Confirm Custody**: Only if status is `pending`, user is in `pendingCustodyConfirmations`, and `onConfirm` is provided.
- **Post to Ledger**: Only if status is `approved`, not posted, and `onPost` is provided.

## 3. Update `VouchersListPage.tsx` Usage
- Pass handlers to `VoucherEntryModal`:
  - `onApprove`: Use existing `handleApprove` logic.
  - `onReject`: Use existing `handleReject` logic.
  - `onConfirm`: Use existing `handleConfirm` logic.
  - `onPost`: Implement `handlePost` similar to `VoucherTable` usage.

## 4. Verification
- Open a voucher in Web View (modal) and verify the buttons match the Windows View.
- Test "Approve", "Reject", and "Confirm Custody" from within the modal.
- Test "Post to Ledger" from within the modal.
- Verify "Save & Post" vs "Save as Draft" logic based on system mode.
