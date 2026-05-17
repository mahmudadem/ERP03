# Phase 1 Completion Report — Transaction Atomicity Fixes

## Scope Completed

Implemented the Phase 1 transaction atomicity fixes from:

- `1-TODO/34a-phase1-transaction-atomicity.md`

This was done as a fix-only change set (no frontend changes, no business workflow changes).

## Changes Implemented

### 1) Repository contract updated for transactional save

- Updated `IVoucherRepository.save()` to accept optional transaction:
  - `backend/src/domain/accounting/repositories/IVoucherRepository.ts`
  - New signature: `save(voucher: VoucherEntity, transaction?: any): Promise<VoucherEntity>;`

### 2) Firestore voucher repository now respects transaction object

- Updated `save()` implementation to use transaction-bound write when provided:
  - `backend/src/infrastructure/firestore/repositories/accounting/FirestoreVoucherRepositoryV2.ts`
  - Uses `transaction.set(docRef, data, { merge: true })` if transaction exists.
  - Falls back to `await docRef.set(...)` when no transaction is passed.

### 3) IVoucherRepository implementations aligned to new signature

- `backend/src/infrastructure/prisma/repositories/PrismaVoucherRepository.ts`
  - Updated signature to `save(voucher, transaction?: any)` (still intentionally unimplemented).
- `backend/src/tests/helpers/InMemoryVoucherRepository.ts`
  - Updated signature to `save(voucher, transaction?: any)`.

### 4) Transaction passed through all `voucherRepo.save()` calls inside `runTransaction` callbacks

- `backend/src/application/accounting/use-cases/VoucherUseCases.ts`
  - Create flow:
    - `save(voucher, transaction)`
    - `save(postedVoucher, transaction)`
  - Update posted/non-posted flow:
    - `save(updatedVoucher, transaction)` in both branches
  - Post flow:
    - `save(postedVoucher, transaction)`
    - `save(reversedOriginal, transaction)`
  - Also fixed claim C:
    - `deleteForVoucher(companyId, voucherId, transaction)`

- `backend/src/application/accounting/use-cases/FiscalYearUseCases.ts`
  - All `voucherRepo.save()` calls inside transaction callbacks now pass `tx`.

- `backend/src/application/accounting/use-cases/ReverseAndReplaceVoucherUseCase.ts`
  - All `voucherRepo.save()` calls inside transaction callback now pass `transaction`.

### 5) Checked `delete()` transaction need

- Reviewed `voucherRepo.delete(...)` usage in application layer.
- No `voucherRepo.delete(...)` calls were found inside `runTransaction` callbacks.
- Therefore, `delete` signature was not expanded in this phase.

## Tests Added/Updated

Updated:

- `backend/src/tests/application/accounting/use-cases/VoucherPersistence.test.ts`

Added atomicity assertions:

- Create flow test verifies `voucherRepo.save(..., transaction)` receives transaction arg.
- Posted-update flow test verifies:
  - `ledgerRepo.deleteForVoucher(..., transaction)` receives transaction
  - `voucherRepo.save(..., transaction)` receives transaction

Also adjusted update test payloads to include lines so they exercise current update strategy path without altering test intent.

## Verification Results

### TypeScript compile

Command:

```bash
cd backend && npx tsc --noEmit
```

Result: PASS

### Jest patterns requested by plan

Plan command used deprecated flag in current Jest CLI (`--testPathPattern`), so equivalent modern command was used:

```bash
cd backend && npx jest --testPathPatterns="VoucherPersistence|GovernancePolicy" --no-coverage
```

Result: PASS

- `VoucherPersistence.test.ts` passed
- `GovernancePolicy.test.ts` passed

### Unsafe save-call scan (inside `runTransaction` callbacks)

Ran an application-level scan for `voucherRepo.save(...)` inside `runTransaction` callback blocks that omitted transaction argument.

Result:

```text
NO_UNSAFE_VOUCHER_SAVE_INSIDE_RUNTRANSACTION
```

## Acceptance Criteria Mapping

- [x] `IVoucherRepository.save()` accepts optional transaction parameter
- [x] `FirestoreVoucherRepositoryV2.save()` uses `transaction.set()` when transaction is provided
- [x] All `voucherRepo.save()` calls inside `runTransaction` callbacks now pass transaction
- [x] `deleteForVoucher()` in `UpdateVoucherUseCase` now passes transaction
- [x] `npx tsc --noEmit` passes
- [x] Existing target tests pass (`VoucherPersistence|GovernancePolicy`)
- [x] No `voucherRepo.save(...)` call inside `runTransaction` callback omits transaction
- [x] Completion report created at `1-TODO/done/34-phase1-completion-report.md`
