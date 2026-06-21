# 250g — Phase 2: Audit Engine consolidation + wire POS

**Parent:** [250 epic](./250-system-core-transformation-epic.md) · **Phase:** 2 (during V1) · **Blocking:** no
**Depends on:** [250a](./250a-seams-and-interfaces.md) · **Agent:** erp-backend-builder · **Estimate:** 1–2 days
**Status:** ✅ Done & CTO-audited green 2026-06-21, commit `382689a1` — see [250g completion report](../done/250g-audit-engine.md)

## Objective

Standardize audit emission behind one `IAuditEngine`, and **wire POS** (receipts, returns, settings) which currently emits nothing.

## Current state (proven)

- `RecordChangeService` + `IAuditLogRepository` exist; `recordCreate` is emitted by Sales/Purchases use-cases but **not POS** ([engines-audit §C-9](../../docs/audit/system-core-shared-engines-audit.md), [POS §9 I](../../docs/audit/pos-commercial-rules-and-promotions-audit.md)).
- Override/approval/void audit is missing.

## Target

`IAuditEngine.record({ entity, action, before, after, actor, reason, approval })` (adapter created in 250a, default delegates to `RecordChangeService`). All modules call the engine; POS emits for receipts/returns/settings and for any override/approval (when those land).

## Scope — files

- Route existing Sales/Purchases `recordCreate` calls through `IAuditEngine` (mechanical).
- Add audit emission in POS use-cases: `CompletePosSaleUseCase`, `CompletePosReturnUseCase`, `UpdatePosSettingsUseCase` / `PosRegisterUseCases`.
- Add `reason`/`approval` fields to the audit record shape (forward-compatible with override flows from 250e/250l).

## Tests

- POS audit emission test: completing a sale / return / settings change writes an audit record.
- Existing Sales/Purchases audit tests stay green.

## Acceptance criteria

- [x] POS emits audit records for receipts, returns, settings.
- [x] All audit emission goes through `IAuditEngine`.
- [x] typecheck + build clean; suite green.

## Definition of Done

- [x] Commit: `feat(system-core): audit engine consolidation + POS audit hooks [250g]`
- [x] `planning/done/250g-audit-engine.md` report.

## CTO audit gate

Reject if POS still has no audit trail, or if any module bypasses `IAuditEngine` to call `RecordChangeService` directly.
