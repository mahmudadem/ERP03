# Task 159 — Posting Authority Stage 4: PostingGateway (Guard at the Door)

**Status:** ✅ Complete
**Date completed:** 2026-06-03
**Branch:** main (worktree `D:/DEV2026/ERP03-posting-authority`)
**Time spent:** ~2h
**Linked plan:** [`planning/briefs/20260603-posting-authority-fix-plan.md`](../briefs/20260603-posting-authority-fix-plan.md) — Stage 4
**Linked architecture doc:** [`docs/architecture/posting-authority.md`](../../docs/architecture/posting-authority.md) §7

---

## Definition of Done — Checklist

- [x] Code merged (this commit)
- [x] `docs/architecture/posting-authority.md` updated — new §7 documents the `PostingGateway` door + exemption table; conformance table updated
- [x] User guide — N/A (internal architecture; no user-facing surface change)
- [x] This completion report links the architecture doc
- [x] `planning/JOURNAL.md` appended
- [x] `planning/ACTIVE.md` updated

---

## 1. Technical Developer View

### What Was Built

A single, mandatory choke point in front of every ledger write: **`PostingGateway`**. It is now the
**only** code that calls `ILedgerRepository.recordForVoucher`. Every one of the 11 production posting
paths was migrated to call `gateway.record(voucher, ctx, transaction)` instead of the ledger repo
directly. An architecture test fails the build if any other file calls `.recordForVoucher(`.

This closes the "one accounting guard, literally at the ledger write" gap (previously ⚠️: the ledger
write enforced only iron laws, so a direct caller could bypass the policy set).

The prior session's WIP attempted to enforce policies *inside* `recordForVoucher`. That was reverted
(Task 158) because it (a) double-ran policies on paths that already validate, and (b) read
`voucher.isApproved` — re-introducing the forged-stamp bug Stage 1 fixed. The gateway is the correct
design: it receives the caller's **real** approval state and derives the policy context from it.

### Files Changed

**New**
- `backend/src/application/accounting/services/PostingGateway.ts` — the gateway.
- `backend/src/application/accounting/services/__tests__/PostingGateway.test.ts` — 6 behavioural tests.

**Migrated to route through the gateway (11 call sites across 8 files)**
- `application/accounting/services/SubledgerVoucherPostingService.ts` — **enforce mode**: relocated its
  inline policy validation into the gateway; passes `approved: input.approved !== false`.
- `application/accounting/use-cases/VoucherUseCases.ts` (3 sites) — exempt (policies validated inline
  by the caller pre-gateway).
- `application/sales/use-cases/SalesInvoiceUseCases.ts` — exempt (settlement receipt).
- `application/purchases/use-cases/PurchaseInvoiceUseCases.ts` — exempt (settlement payment).
- `application/sales/use-cases/PaymentSyncUseCases.ts` — exempt (settlement receipt).
- `application/purchases/use-cases/PaymentSyncUseCases.ts` — exempt (settlement payment).
- `application/accounting/use-cases/BankReconciliationUseCases.ts` — exempt (bank-rec adjustment).
- `application/accounting/use-cases/FiscalYearUseCases.ts` (2 sites) — exempt (year-end closing + reversal).

**Tests / docs**
- `backend/src/tests/architecture/PostingAuthority.test.ts` — Stage 4 `it.todo` flipped to two active
  assertions (no direct `recordForVoucher` callers; gateway requires an exemption reason). Stage 1 and
  Law 1 assertions updated to reflect that approval-derivation + policy-running now live in/route through
  the gateway.
- `docs/architecture/posting-authority.md` — new §7 + conformance table.

### Architecture / Behavior

- `PostingGateway.record()`: iron laws (always) → policy set (when `enforcePolicies !== false`) → ledger
  write. Approval in the policy context is `ctx.approved`-derived, never the voucher's own stamp (Law 7).
- **Explicit exemptions, no silent skips.** `enforcePolicies: false` requires a non-empty
  `exemptionReason` — the gateway throws otherwise. Every exemption is greppable
  (`grep "enforcePolicies: false"`).
- **Zero behavioural change** for the 10 exempt sites: they were swapped 1:1 (the gateway re-asserts the
  idempotent `validateCore` and records). The subledger path (the heart of this epic) runs the identical
  policy logic it ran before — just relocated into the gateway.
- **Stage 4b** (follow-up, documented): fold the system-voucher exemptions (settlements, closings) into
  the policy set so even those run the full rulebook. Today they pass the door + iron laws only.

### Verification

- [x] `cd backend && npx tsc --noEmit` — clean.
- [x] `npx jest --testPathPatterns="(PostingGateway|PostingAuthority)"` — 2 suites, 13 tests green.
- [x] **Full backend suite** — `npx jest` → **138 suites, 1301 passed, 18 skipped, 0 failed** (baseline
  before Stage 4 was 137 suites / 1293 passed / 1 todo; the todo is now an active passing test and the
  new gateway suite adds the rest). **No regressions.**
- [ ] Frontend — untouched by Stage 4.

### Known Issues / Follow-ups

- **Stage 4b** — system-generated postings (settlements, payment-sync, bank-rec, year-end closing &
  reversal) are policy-exempt. They pass through the gateway + iron laws but skip the policy set. Each is
  flagged with an `exemptionReason` for easy discovery. Folding them in is the next tightening.
- The 3 `VoucherUseCases` exemptions keep their existing inline policy validation; Stage 4b can remove the
  inline blocks and switch them to `enforcePolicies: true` once the structured rejection logging is moved
  into the gateway.

---

## 2. End-User View

No user-facing change. This is an internal safety hardening: it guarantees that **no code path can write
to the accounting ledger without first passing through the single accounting guard**, and that any
deliberate exception is explicitly labelled and visible to reviewers.

---

*This report follows the format defined in `AGENTS.md` → Definition of Done.*
