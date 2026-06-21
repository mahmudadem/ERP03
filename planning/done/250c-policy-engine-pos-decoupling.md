# 250c - Policy Engine Minimum + POS Decoupling From SalesSettings

**Date:** 2026-06-21  
**Branch:** `feat/system-core-transformation`  
**Worktree:** `D:\DEV2026\ERP03-system-core`  
**Task:** [250c - Phase 1: Policy Engine + POS decoupling from SalesSettings](../tasks/250c-policy-engine-pos-decoupling.md)  
**Status:** Complete, pending CTO audit  
**Actual time:** ~1.8h implementation, focused verification, full-suite gate, and documentation

## Technical Developer View

250c moves POS direct-sale authorization out of Sales Settings and into POS-owned policy behind `IPolicyEngine`. `UpdatePosSettingsUseCase` no longer accepts or writes `ISalesSettingsRepository`; the POS `allowPosDirectSales` toggle now persists to `POSPolicy.allowPosDirectSales` via `IPosPolicyRepository`.

The new minimum POS policy model is `POSPolicy`, `POSTerminalPolicy`, and `CashierRolePolicy`. Firestore and Prisma repositories were added and registered in DI. The new `PolicyEngine` preserves the prior accounting/sales/purchases policy adapter behavior while handling `scope: 'pos', action: 'directSale'` with most-restrictive-wins semantics. A terminal deny overrides a permissive company POS policy, and a cashier role requiring approval blocks the sale unless an approved override is present.

`CompletePosSaleUseCase` now calls `policyEngine.resolve()` before creating the Sales compatibility document. This phase intentionally keeps the Sales invoice compatibility path in place; removing the POS-to-Sales use-case dependency is 250d.

## End-User View

There is no visible UI change. The POS Settings toggle for direct sales still controls whether POS can complete immediate sales. Internally, that control now belongs to POS instead of Sales, so POS can be configured without requiring Sales Settings to exist first.

For future controls, the policy model can also block direct sales on a specific register or require approval for certain cashier roles. Those controls are backend-ready here; the approval workflow is completed in the later 250e phase.

## Files Changed

- `backend/prisma/schema.prisma`
- `backend/src/domain/pos/entities/POSPolicy.ts`
- `backend/src/domain/pos/entities/PosSettings.ts`
- `backend/src/repository/interfaces/pos/IPosPolicyRepository.ts`
- `backend/src/repository/interfaces/pos/index.ts`
- `backend/src/infrastructure/firestore/repositories/pos/FirestorePosPolicyRepository.ts`
- `backend/src/infrastructure/prisma/repositories/pos/PrismaPosPolicyRepository.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `backend/src/application/system-core/PolicyEngine.ts`
- `backend/src/application/system-core/index.ts`
- `backend/src/application/pos/use-cases/PosSettingsUseCases.ts`
- `backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts`
- `backend/src/api/controllers/pos/PosController.ts`
- `backend/src/tests/application/pos/PosSettingsUseCases.test.ts`
- `backend/src/tests/application/pos/PolicyEnginePosPolicy.test.ts`
- `backend/src/tests/application/pos/CompletePosSale.test.ts`
- `docs/architecture/system-core.md`
- `planning/tasks/250c-policy-engine-pos-decoupling.md`
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`

## Verification

- `npm --prefix backend run typecheck` passed.
- `npm --prefix backend test -- --runTestsByPath src/tests/application/pos/PosSettingsUseCases.test.ts src/tests/application/pos/PolicyEnginePosPolicy.test.ts src/tests/application/pos/CompletePosSale.test.ts --runInBand` passed: 3 suites, 19 tests.
- `npm --prefix backend run build` passed.
- `npm --prefix backend test -- --runInBand` passed: 177/179 suites passed, 2 skipped; 1571 tests passed, 19 skipped, 1590 total.

## Accounting / Control Impact

No posting math, voucher balancing, tax calculation, inventory valuation, AR settlement, period lock, or GL account mapping changed. The control change is authorization ownership: POS direct-sale permission is no longer stored as a Sales governance rule. This reduces cross-module control leakage and prevents POS from being blocked merely because Sales Settings has not been initialized.

## Known Notes

250c still posts POS sales through the Sales compatibility path. The System Core boundary test continues to skip the POS-to-Sales import ban until 250d, where POS direct sale should move behind Document Core instead of importing Sales use cases directly.

## Next Step

Proceed to 250d: route POS direct sale through Document Core and remove the POS-to-Sales use-case import dependency.
