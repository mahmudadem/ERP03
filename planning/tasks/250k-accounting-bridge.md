# 250k — Phase 4: Accounting Bridge hardening (minimal-journal mode)

**Parent:** [250 epic](./250-system-core-transformation-epic.md) · **Phase:** 4 (long-term) · **Blocking:** no
**Depends on:** [250d](./250d-pos-posting-entry-point.md) · **Agent:** erp-backend-builder · **Estimate:** 2–3 days
**Status:** ✅ Done & CTO-audited green 2026-06-21, commit `0eb5e356` (T7 passes; full-mode payload unchanged). Follow-up FUP-3: route Sales/Purchases/Inventory posters behind the bridge.

## Objective

Make the engine-vs-app separation **contractual**: `IAccountingBridge` records financial events for any enabled module regardless of the Accounting App's activation, with a **minimal-journal mode** when the full Accounting App is disabled. Today the separation holds only by accident (posting has no module gate).

## Current state (proven)

- `PostingGateway` is always-on; there is **no `IAccountingBridge`** and no "accounting-app-off" path ([audit §G](../../docs/audit/platform-architecture-engine-vs-app-audit.md)). The bridge default impl was introduced in [250d](./250d-pos-posting-entry-point.md) as full posting.

## Target

- `IAccountingBridge.recordFinancialEvent(event)` with two strategies:
  - **full** (Accounting App enabled) → current voucher posting via `PostingGateway`.
  - **minimal** (Accounting App disabled) → a lightweight journal record that still persists the financial event, hiding ledger/TB/CoA/statements UI only.
- Activation gates **UI/management visibility only** — never event recording.

## Scope — files

- Extend `application/system-core/AccountingBridge.ts` with strategy selection based on Accounting App activation (read module entitlement, not a Sales/POS flag).
- Ensure all financial-event emitters (Sales, Purchases, Inventory, POS) go through the bridge.

**Delivered scope note:** This contained 250k slice hardens the bridge and removes the remaining POS direct-post bypass. Sales, Purchases, and Inventory still use their established full-posting service workflows; moving every source-module poster behind `IAccountingBridge` is a larger follow-up that must be sliced by module with golden voucher-output checks.

## Tests

- **T7 — Accounting App off, events still recorded:** with the Accounting App UI disabled, an enabled module records a financial event via the bridge; ledger/TB/CoA/statements UI is hidden but the event persists.
- Regression: with Accounting enabled, posting is byte-for-byte the current voucher set.

## Acceptance criteria

- [x] Bridge selects full vs minimal by Accounting App activation.
- [x] T7 passes; full-mode regression unchanged for bridge call payload.
- [x] typecheck + build clean.

## Definition of Done

- [x] Commit: `feat(system-core): accounting bridge minimal-journal mode [250k]`
- [x] `planning/done/250k-accounting-bridge.md` report; update `docs/architecture/accounting.md` + `system-core.md`.

## CTO audit gate

Reject if disabling the Accounting App can block another module's financial event, or if full-mode output changed.
