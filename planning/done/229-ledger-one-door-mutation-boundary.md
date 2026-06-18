# Ledger One-Door Mutation Boundary

**Date:** 2026-06-14  
**Status:** Complete in code; live GP01 retest still needed  
**Time spent:** ~1.1h

## Summary

The ledger mutation boundary was tightened from "ledger recording goes through `PostingGateway`" to "all application-layer ledger mutations go through `PostingGateway`." This fixes the architecture gap found during GP01 where a posted-voucher edit/resync could bypass the shared posting guard.

## Technical Developer View

### What changed

- `PostingGateway` now owns:
  - normal ledger recording through `record`
  - posted-voucher ledger replacement through `replaceForVoucher`
  - ledger cleanup through `deleteVoucherLedger`
  - bank reconciliation ledger marking through `markLedgerEntryReconciled`
- Posted-voucher edit/resync now calls `PostingGateway.replaceForVoucher` with policies enforced, instead of deleting ledger rows directly and re-recording with `enforcePolicies: false`.
- Posted voucher cancel/delete cleanup now goes through `PostingGateway.deleteVoucherLedger`.
- Subledger voucher cleanup now loads the voucher context and goes through `PostingGateway.deleteVoucherLedger`.
- Bank reconciliation marking now goes through `PostingGateway.markLedgerEntryReconciled`.
- The old `DeleteVoucherLedgerUseCase` now fails closed because it has no voucher context and cannot safely run the guard.
- The architecture test now blocks future direct production calls to:
  - `ILedgerRepository.recordForVoucher`
  - `ILedgerRepository.deleteForVoucher`
  - `ILedgerRepository.markReconciled`

### Files touched

- `backend/src/application/accounting/services/PostingGateway.ts`
- `backend/src/application/accounting/services/__tests__/PostingGateway.test.ts`
- `backend/src/application/accounting/services/SubledgerVoucherPostingService.ts`
- `backend/src/application/accounting/use-cases/VoucherUseCases.ts`
- `backend/src/application/accounting/use-cases/LedgerUseCases.ts`
- `backend/src/application/accounting/use-cases/BankReconciliationUseCases.ts`
- `backend/src/api/controllers/accounting/VoucherController.ts`
- `backend/src/tests/architecture/PostingAuthority.test.ts`
- `backend/src/tests/application/accounting/use-cases/VoucherPersistence.test.ts`
- `backend/src/application/accounting/use-cases/__tests__/GovernancePolicy.test.ts`
- `docs/architecture/posting-authority.md`
- `docs/architecture/accounting.md`
- `docs/architecture/accounting-policy-configuration.md`
- `docs/user-guide/accounting/README.md`
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`
- `planning/qa/findings.md`

### Verification

- `npm --prefix backend test -- --runInBand backend/src/tests/architecture/PostingAuthority.test.ts`
- `npm --prefix backend test -- --runInBand backend/src/application/accounting/services/__tests__/PostingGateway.test.ts`
- `npm --prefix backend test -- --runInBand backend/src/tests/application/accounting/use-cases/VoucherPersistence.test.ts`
- `npm --prefix backend test -- --runInBand backend/src/application/accounting/use-cases/__tests__/GovernancePolicy.test.ts`
- `npm --prefix backend test -- --runInBand backend/src/application/accounting/use-cases/__tests__/AuditCompliance.test.ts`
- `npm --prefix backend test -- --runInBand backend/src/application/accounting/services/__tests__/SubledgerVoucherPostingServicePolicy.test.ts`
- `npm --prefix backend test -- --runInBand backend/src/tests/application/accounting/use-cases/BankReconciliationUseCases.test.ts`
- `npm --prefix backend test -- --runInBand backend/src/tests/application/purchases/PurchasePostingUseCases.test.ts`
- `npm --prefix backend test -- --runInBand backend/src/tests/application/purchases/PurchaseReturnUseCases.test.ts`
- `npm --prefix backend test -- --runInBand` — 150 suites passed / 2 skipped; 1,392 tests passed / 18 skipped
- `npm --prefix backend run build`

## End-User View

Users should not see a new screen or workflow. The important change is control safety:

- If a fiscal period is locked, ERP03 now blocks not only new postings into that period, but also posted-voucher edit/delete cleanup paths that would change the ledger for that locked period.
- Flexible mode can still allow posted edit/delete where the company deliberately configured it, but it cannot bypass the accounting posting guard.
- Bank reconciliation and automatic subledger cleanup still work, but they now use the same protected ledger door internally.

## Remaining Review

- Live-retest GP01 step 11 in the running app:
  - confirm the `PERIOD_LOCKED` message is readable in the voucher modal
  - confirm a posted voucher in the locked period cannot be edited/resynced through Flexible mode
- Stage 4b remains separate: fold explicit policy exemptions for system-generated postings into the full policy set.
