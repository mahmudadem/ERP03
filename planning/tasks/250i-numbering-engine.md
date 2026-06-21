# 250i — Phase 3: Numbering Engine unification

**Parent:** [250 epic](./250-system-core-transformation-epic.md) · **Phase:** 3 (after POS V1) · **Blocking:** no
**Depends on:** [250a](./250a-seams-and-interfaces.md) · **Agent:** erp-backend-builder · **Estimate:** 2–3 days
**Status:** ✅ Done & CTO-audited green 2026-06-21, commit `6803b21f`

## Objective

Unify the three independent numbering mechanisms behind one `INumberingEngine` with scope keys (company / branch / terminal / voucher-type / document-type).

## Current state (proven)

- Accounting owns voucher sequences (`VoucherSequenceUseCases` + repo + controller); each Sales/Purchase use-case generates its own document numbers; POS receipt numbering is local to `PosSettings.receiptPrefix/receiptNextSeq` ([engines-audit §C-2](../../docs/audit/system-core-shared-engines-audit.md)). No per-branch/per-terminal scheme.

## Target

`INumberingEngine.next({ companyId, docType, scope, branchId?, terminalId? })`. Absorb voucher sequences + document numbers + POS receipts. Scope-keyed so branch/terminal numbering is possible.

## Scope — files

- `application/system-core/numbering/NumberingEngine.ts` + a unified sequence repository (Firestore + Prisma + DI), generalizing the existing `VoucherSequenceRepository`.
- Repoint voucher sequence callers, Sales/Purchase document-number generation, and POS receipt numbering at `INumberingEngine`.
- Migrate existing sequence state into the unified store (pre-alpha: a seed/transform script, not a prod migration).

## Tests

- Per-scope sequence test (company vs branch vs terminal yield independent runs).
- Regression: existing voucher/document/receipt numbers continue from current values (no gaps/resets).

## Acceptance criteria

- [x] One numbering engine serves vouchers, documents, and POS receipts.
- [x] Branch/terminal scope supported + tested.
- [x] typecheck + build clean; suite green.

## Definition of Done

- [x] Commit: `refactor(system-core): unify numbering engine with scope keys [250i]`
- [x] `planning/done/250i-numbering-engine.md` report.

## CTO audit gate

Reject if any module still mints its own numbers, or if existing sequences reset/regress.
