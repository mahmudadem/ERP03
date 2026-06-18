# GP01 Posted Voucher Edit Lock Block

## Technical Developer View

### What changed
- Hardened the accounting voucher update path so posted-voucher edits re-run the period-lock policy before any save or ledger resync.
- The guard checks both the original posted date and the edited date, so a voucher already inside a locked period cannot be rewritten even when Flexible mode allows posted edits.

### Files touched
- `backend/src/application/accounting/use-cases/VoucherUseCases.ts`
- `backend/src/tests/application/accounting/use-cases/VoucherPersistence.test.ts`
- `docs/architecture/accounting.md`
- `docs/user-guide/accounting/README.md`
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`
- `planning/qa/findings.md`

### Verification
- `npm --prefix backend test -- --runInBand backend/src/tests/application/accounting/use-cases/VoucherPersistence.test.ts`
- `npm --prefix backend test -- --runInBand backend/src/application/accounting/use-cases/__tests__/GovernancePolicy.test.ts`
- `npm --prefix backend run build`

### Acceptance criteria met
- Posted voucher edits are blocked when the voucher date is locked.
- Flexible posted-edit behavior remains available for unlocked vouchers.
- Regression coverage exists for the locked posted-voucher case.

### Live QA
- Owner retested GP01 after the fix and confirmed the period-lock voucher path passed.

## End-User View

If a voucher is already posted and its date is inside a locked accounting period, the system now refuses to save edits to it. This keeps closed periods protected even when your company normally allows editing posted vouchers in Flexible mode.

The normal fix path is still the same:
1. Open the posted voucher.
2. Use **Correct / Reverse & Replace**.
3. Post the reversal or replacement in an unlocked period if needed.
