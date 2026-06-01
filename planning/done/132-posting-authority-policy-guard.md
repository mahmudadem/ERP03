# 132 - Posting Authority Policy Guard

**Date:** 2026-06-01  
**Agent:** Codex  
**Branch:** `codex/posting-authority-policy-guard`  
**Estimated time:** 1.5-2 hours  
**Actual time:** ~1.4 hours

## Technical Developer View

### Problem

Manual Accounting vouchers used `AccountingPolicyRegistry`, but automatic subledger postings from Sales, Purchases, and Inventory used `SubledgerVoucherPostingService` without the full policy registry. That meant controls such as period lock, account access, cost-center requirements, and future posting policies could apply to one posting path but not another.

### What changed

- `SubledgerVoucherPostingService` now accepts `SubledgerAccountingPolicyRegistry`.
- The service now validates:
  1. generated voucher core invariants,
  2. account validity when an account repository is supplied,
  3. enabled accounting policies from `AccountingPolicyRegistry`,
  4. then ledger/voucher persistence.
- Sales, Purchases, and Inventory controllers now pass `diContainer.policyRegistry` into the shared posting service.
- `PeriodLockPolicy` now understands the soft-lock override payload:
  - allowed only when `allowPeriodLockOverride !== false`,
  - requires both override reason and user,
  - still blocks fiscal `LOCKED` / `CLOSED` periods.
- `PeriodLockService` now also rejects soft-lock overrides when `allowPeriodLockOverride === false`.
- The main backend `errorHandler` now returns structured `PostingError` responses instead of falling through to a generic 500.

### Files changed

- `backend/src/application/accounting/services/SubledgerVoucherPostingService.ts`
- `backend/src/application/accounting/services/PeriodLockService.ts`
- `backend/src/application/accounting/policies/AccountingPolicyRegistry.ts`
- `backend/src/domain/accounting/policies/implementations/PeriodLockPolicy.ts`
- `backend/src/api/controllers/sales/SalesController.ts`
- `backend/src/api/controllers/purchases/PurchaseController.ts`
- `backend/src/api/controllers/inventory/InventoryController.ts`
- `backend/src/errors/errorHandler.ts`
- `backend/src/application/accounting/services/__tests__/SubledgerVoucherPostingServicePolicy.test.ts`
- `backend/src/application/accounting/services/__tests__/PeriodLockService.test.ts`
- `backend/src/tests/domain/accounting/policies/PeriodLockPolicy.test.ts`
- `docs/architecture/accounting.md`
- `docs/user-guide/accounting/README.md`

### Acceptance criteria met

- Source-module vouchers are checked by the shared accounting policy registry before ledger write.
- A policy rejection stops before `ledgerRepo.recordForVoucher()` and `voucherRepo.save()`.
- Period-lock override remains a payload/reason, not a separate ticket dependency.
- Soft-lock override is controlled by accounting config and does not bypass fiscal locked/closed periods.
- Sales keeps its existing controller-level role/permission guard before creating override metadata.

### Verification

- `npm --prefix backend test -- --runInBand backend/src/application/accounting/services/__tests__/SubledgerVoucherPostingServicePolicy.test.ts backend/src/tests/domain/accounting/policies/PeriodLockPolicy.test.ts backend/src/application/accounting/services/__tests__/PeriodLockService.test.ts` - passed, 15 tests.
- `npx prisma generate` from `backend/` - passed, needed after fresh `npm ci` in the clean worktree.
- `npm --prefix backend run build` - passed.
- `graphify update .` - not run; `graphify` is not installed/available on PATH in this environment.

## End-User View

Posting controls now behave more consistently. If a company has accounting rules such as period locks, cost-center requirements, or account-access restrictions, automatic postings from Sales, Purchases, and Inventory go through the same control gate before they reach the ledger.

For period locks, an override is still a controlled exception: the user supplies a reason, the backend checks whether the company allows the override, and hard locked/closed fiscal periods remain blocked.

## Known follow-ups

- Purchases and Inventory do not yet have their own period-lock override UI. They now receive the backend policy rejection; a future UI slice should reuse the Sales override pattern if the business wants overrides in those modules.
- Approval workflow for source documents still needs a separate product decision. The shared voucher policy now runs, but source-document approval semantics are not the same as manual voucher approval.
