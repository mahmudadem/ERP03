# 250a — System Core Interface Seams + Adapters

**Date:** 2026-06-21  
**Branch:** `feat/system-core-transformation`  
**Worktree:** `D:\DEV2026\ERP03-system-core`  
**Task:** [250a — Phase 0: Interface Seams + Adapters](../tasks/250a-seams-and-interfaces.md)  
**Status:** Complete, pending CTO audit  
**Actual time:** ~1.6h implementation/verification, plus baseline setup

## Technical Developer View

Phase 0 created the System Core namespace and interface seams without changing current module behavior. The new contracts live under `backend/src/application/system-core/contracts/`, the temporary adapters live under `backend/src/application/system-core/adapters/`, and the barrel export is `backend/src/application/system-core/index.ts`.

The adapters are intentionally thin:

- Document Core maps legacy personas into the new seam without rewiring consumers yet.
- Money Core delegates to existing `CurrencyPrecisionHelpers` through `roundMoney.ts`.
- Tax Core delegates line/charge calculation to the existing Sales invoice calculation service; invoice-discount allocation and recoverable tax still fail closed as out-of-scope Phase 0 methods.
- Commercial Core delegates discount math to the existing Sales calculation helper; price resolution is a seam for later wiring.
- Policy/Approval adapters wrap the existing document and accounting policy services.
- Accounting Bridge wraps `SubledgerVoucherPostingService` for current full-voucher posting behavior.
- Audit Engine wraps `RecordChangeService`.
- Inventory Core is a neutral alias over the existing `ISalesInventoryService` contract.

`backend/src/infrastructure/di/bindRepositories.ts` now exposes getters for these System Core seams. No existing application consumers were rewired in this phase.

A new architecture guard exists at `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`. It includes one active assertion that the System Core barrel exports all Phase 0 contracts and one skipped `250d` assertion for the known current POS-to-Sales coupling.

## End-User View

There is no user-facing UI or workflow change in this phase. The system should behave exactly as before. This work creates internal engine boundaries so later POS, Sales, Purchases, Accounting, Inventory, Tax, Approval, and Audit changes can be made with less coupling and better accounting control.

## Files Changed

- `backend/src/application/system-core/contracts/*`
- `backend/src/application/system-core/adapters/*`
- `backend/src/application/system-core/money/roundMoney.ts`
- `backend/src/application/system-core/index.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`
- `docs/architecture/system-core.md`
- `planning/tasks/250a-seams-and-interfaces.md`
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`

## Verification

Baseline before Phase 0:

- `npm --prefix backend run typecheck` passed.
- `npm --prefix backend run build` passed.
- `npm --prefix backend test` passed: 175/177 suites passed, 2 skipped; 1565 tests passed, 18 skipped, 1583 total.

After Phase 0:

- `npm --prefix backend run typecheck` passed.
- `npm --prefix backend run build` passed.
- `npm --prefix backend test -- --runTestsByPath src/tests/architecture/SystemCoreBoundaries.test.ts --runInBand` passed: 1 passed, 1 skipped.
- `npm --prefix backend test` passed: 176/178 suites passed, 2 skipped; 1566 tests passed, 19 skipped, 1585 total.

The count increase is the new architecture guard: one active assertion plus the intentionally skipped POS-to-Sales ban that must be enabled in 250d.

## Known Notes

The isolated worktree initially had no `backend/node_modules`, so validation could not find Prisma. I created a local junction from `D:\DEV2026\ERP03-system-core\backend\node_modules` to the already-installed `D:\DEV2026\ERP03\backend\node_modules` and reran the baseline successfully. This did not change tracked files.

## Next Step

Proceed to 250b: make `POS_DIRECT_SALE` a first-class document persona and invert the current POS persona test, without starting policy or posting decoupling until 250b is green and committed.
