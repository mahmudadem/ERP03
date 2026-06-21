# 250e — Subject-Agnostic Approval Engine

**Date:** 2026-06-21  
**Branch:** `feat/system-core-transformation`  
**Status:** Complete, pending CTO audit  
**Actual time:** ~0.9h

## Technical Developer View

250e added a subject-agnostic System Core approval seam without changing existing voucher approval behavior.

Files changed:

- `backend/src/application/system-core/approval/ApprovalEngine.ts`
- `backend/src/application/system-core/approval/ApprovalSubjectRegistry.ts`
- `backend/src/application/system-core/approval/plugins/LedgerCustodyApprovalPlugin.ts`
- `backend/src/application/system-core/index.ts`
- `backend/src/application/accounting/use-cases/SubmitVoucherUseCase.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `backend/src/tests/application/system-core/ApprovalEngine.test.ts`
- `docs/architecture/system-core.md`

The new engine evaluates `ApprovalSubject` records by type. `LedgerCustodyApprovalPlugin` wraps the existing `ApprovalPolicyService` for `accounting_voucher` subjects, so Smart FA/CC gate logic remains the same implementation. `SubmitVoucherUseCase` now routes voucher gate evaluation through the engine and reads the same `ApprovalGateResult` metadata for status transitions and notifications.

The engine also evaluates non-voucher subjects such as `below_cost_sale` through a generic fallback. Modules can block their own action when the decision is `PENDING`; actual override capture and approval UI are out of scope for 250e.

## End-User View

There is no visible UI change. Existing voucher approval behavior should remain the same. The system now has a shared approval decision point that future POS/Sales/Purchases override flows can use instead of hardcoding approval rules inside each module.

## Verification

- `npm --prefix backend test -- --runInBand src/tests/application/system-core/ApprovalEngine.test.ts src/tests/domain/accounting/policies/ApprovalGateWorkflow.test.ts src/tests/domain/accounting/policies/ApprovalRequiredPolicy.test.ts src/application/accounting/policies/__tests__/AccountingPolicyRegistry.isApprovalRequiredForVoucherType.test.ts src/application/accounting/services/__tests__/SubledgerVoucherPostingServicePolicy.test.ts` — passed, 5 suites / 19 tests.
- `npm --prefix backend run typecheck` — passed.
- `npm --prefix backend run build` — passed.

## Accounting / ERP Impact

Voucher approval gates are still driven by the existing Smart FA/CC policy service and posting is still blocked by `ApprovalRequiredPolicy` until approved. This task changes the dependency shape only: approval is now a System Core engine seam with accounting voucher approval as one plug-in.
