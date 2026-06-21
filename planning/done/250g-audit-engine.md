# 250g — Audit Engine Consolidation + POS Audit Hooks

**Date:** 2026-06-21  
**Branch:** `feat/system-core-transformation`  
**Status:** Done, green, hard-stop for CTO audit.  
**Actual time:** ~1.2h

## Technical Developer View

250g standardizes application audit emission behind `IAuditEngine` and wires the missing POS audit events.

### What changed

- Added `backend/src/application/system-core/audit/auditEngineLegacyHelpers.ts` to translate existing Sales/Purchases audit payloads into `IAuditEngine.record(...)`.
- Rewired Sales and Purchases use cases to depend on `IAuditEngine` instead of `RecordChangeService`.
- Rewired Sales/Purchases controllers to pass `diContainer.auditEngine`; controllers no longer construct `RecordChangeService`.
- Added POS audit records for:
  - completed POS receipts (`POS_RECEIPT`, `CREATE`);
  - completed POS returns (`POS_RETURN`, `CREATE`);
  - POS settings updates (`POS_SETTINGS`, `UPDATE`);
  - POS register create/update (`POS_REGISTER`, `CREATE` / `UPDATE`).
- Added a 250g architecture guard that fails if Sales, Purchases, POS, or API controllers import `RecordChangeService` directly.

### Files changed

- `backend/src/application/system-core/audit/auditEngineLegacyHelpers.ts`
- `backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts`
- `backend/src/application/pos/use-cases/CompletePosReturnUseCase.ts`
- `backend/src/application/pos/use-cases/PosSettingsUseCases.ts`
- `backend/src/application/pos/use-cases/PosRegisterUseCases.ts`
- Sales/Purchases use cases and controllers that previously accepted `RecordChangeService`
- POS audit tests and `SystemCoreBoundaries.test.ts`
- `docs/architecture/system-core.md`
- `docs/architecture/pos-independence.md`

### Accounting / ERP impact

Auditability improves without changing posting math. POS sales, returns, settings, and registers now leave record-change audit entries through the same audit engine path used by other modules. No ledger amount, voucher balancing, tax, COGS, AR/AP, inventory movement, approval, period-lock, cash rounding, or tenant-scope behavior changed in this slice.

## End-User View

Managers and auditors now have an audit trail for POS actions that were previously silent: completed receipts, completed returns, POS settings changes, and register setup changes. This makes POS safer for cashier operations because operational changes and completed till activity can be reviewed later.

## Verification

- `npm --prefix backend test -- --runInBand src/tests/application/pos/CompletePosSale.test.ts src/tests/application/pos/CompletePosReturn.test.ts src/tests/application/pos/PosSettingsUseCases.test.ts src/tests/architecture/SystemCoreBoundaries.test.ts` — passed, 4 suites / 30 tests.
- `npm --prefix backend test -- --runInBand src/tests/application/sales/SalesReturnUseCases.test.ts src/tests/application/sales/SalesInvoiceSettlementPosting.test.ts src/tests/application/purchases/PurchaseInvoiceSettlementPosting.test.ts` — passed, 3 suites / 27 tests.
- `npm --prefix backend run typecheck` — passed.
- `npm --prefix backend run build` — passed.
- Grep check: no `RecordChangeService` / `recordCreate` / `recordUpdate` / `recordPost` bypasses remain in Sales, Purchases, POS, or API controllers; direct use remains only inside the legacy adapter and RecordChangeService's own tests.

## Next

Hard-stop for CTO audit. Do not start 250h/250i/250j or any Phase 3/4 task until the owner/CTO explicitly resumes.
