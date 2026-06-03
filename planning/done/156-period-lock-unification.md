# Task 156 — Period-Lock Unification

**Status:** ✅ Complete
**Date completed:** 2026-06-03
**Branch:** `main` (in `d:\DEV2026\ERP03-posting-authority` worktree)
**Time spent:** ~1.0h
**Linked architecture doc:** [`docs/architecture/posting-authority.md`](../../docs/architecture/posting-authority.md)
**Linked user guide:** [`docs/user-guide/accounting/README.md#period-lock`](../../docs/user-guide/accounting/README.md#period-lock)

---

## Definition of Done — Checklist

Before marking this task done, every box must be ticked:

- [x] Code merged / committed
- [x] `docs/architecture/posting-authority.md` updated or created — technical doc for future engineers
- [x] `docs/user-guide/accounting/` updated / reviewed — plain-language guide for end users
- [x] This completion report links both docs above
- [x] `planning/JOURNAL.md` appended with session summary
- [x] `planning/ACTIVE.md` updated with next task

---

## 1. Technical Developer View

### What Was Built

We implemented Stage 3 of the Posting-Authority architecture to consolidate the two diverging period-lock implementations (`PeriodLockService` and `PeriodLockPolicy`) into a single authoritative implementation in the Accounting module (`PeriodLockPolicy`).

- Refactored `PeriodLockService.ts` to be a thin adapter over `PeriodLockPolicy`. It constructs a `PostingPolicyContext` and executes `PeriodLockPolicy.validate()`, mapping any failures/codes (like `PERIOD_CLOSED` or `PERIOD_LOCKED`) back to the legacy `PeriodLockedError` classes. This ensures complete backwards compatibility.
- Activated the Stage 3 architecture assertion in `PostingAuthority.test.ts` to ensure that `PeriodLockService` always delegates to `PeriodLockPolicy` and has no local period check implementation.

### Files Changed

**Backend (in ERP03-posting-authority worktree):**
- [`backend/src/application/accounting/services/PeriodLockService.ts`](file:///d:/DEV2026/ERP03-posting-authority/backend/src/application/accounting/services/PeriodLockService.ts) — Refactored to delegate to `PeriodLockPolicy`.
- [`backend/src/tests/architecture/PostingAuthority.test.ts`](file:///d:/DEV2026/ERP03-posting-authority/backend/src/tests/architecture/PostingAuthority.test.ts) — Converted the Stage 3 todo to an active architecture guardrail.

**Docs & Guides:**
- [`docs/architecture/posting-authority.md`](file:///d:/DEV2026/ERP03-posting-authority/docs/architecture/posting-authority.md) — Updated conformance status table to mark the period-lock duplication resolved.

---

## 2. End-User View

### What's New

We have consolidated the date and period verification check engines. Previously, different background systems verified document dates for journal entries versus invoices. They now route through the exact same unified Accounting rule engine, ensuring identical locked date comparisons and override validations everywhere across manual vouchers, sales, and purchases modules.
