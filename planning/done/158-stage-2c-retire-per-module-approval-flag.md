# Task 158 — Posting Authority Stage 2c: Retire Per-Module Approval Flag

**Status:** ✅ Complete
**Date completed:** 2026-06-03
**Branch:** main (worktree `D:/DEV2026/ERP03-posting-authority`)
**Time spent:** ~0.5h (continuation of prior agent's WIP)
**Linked plan:** [`planning/briefs/20260603-posting-authority-fix-plan.md`](../briefs/20260603-posting-authority-fix-plan.md) — Stage 2c
**Linked architecture doc:** [`docs/architecture/posting-authority.md`](../../docs/architecture/posting-authority.md)
**Linked user guide:** [`docs/user-guide/accounting/posting-approvals.md`](../../docs/user-guide/accounting/posting-approvals.md)

---

## Definition of Done — Checklist

- [x] Code merged (this commit)
- [x] `docs/architecture/posting-authority.md` already describes the central policy as the single source of truth (no change needed for Stage 2c — only the per-module flag mention had to disappear from code; the doc never blessed it).
- [x] `docs/user-guide/accounting/posting-approvals.md` already covers the central approval policy (written in Stage 2b — Stage 2c is invisible to users beyond the removed Sales/Purchases settings toggle).
- [x] This completion report linked above
- [x] `planning/JOURNAL.md` appended
- [x] `planning/ACTIVE.md` updated

---

## 1. Technical Developer View

### What Was Built

Stage 2b already migrated `PostSalesInvoiceUseCase` / `PostPurchaseInvoiceUseCase` to read approval requirement from `AccountingPolicyRegistry.isApprovalRequiredForVoucherType` instead of `SalesSettings.requireApprovalBeforePosting` / `PurchaseSettings.requireApprovalBeforePosting`. Stage 2c is the cleanup: the per-module flag is now gone from the domain entities, application-layer use cases, DTOs, frontend API contracts, and the two Sales/Purchases Settings UIs. Approval enforcement is now driven entirely by the central `AccountingPolicyConfig.approvalRequired` + `approvalExemptVoucherTypes`.

### Files Changed

**Backend**
- `backend/src/domain/sales/entities/SalesSettings.ts` — removed `requireApprovalBeforePosting` field, constructor, `toFirestore`/`fromFirestore`, defaults.
- `backend/src/domain/purchases/entities/PurchaseSettings.ts` — same.
- `backend/src/api/dtos/SalesDTOs.ts` — removed from `SalesSettingsDTO` and the mapper.
- `backend/src/api/dtos/PurchaseDTOs.ts` — same.
- `backend/src/application/sales/use-cases/SalesSettingsUseCases.ts` — removed from `InitializeSalesInput`, `UpdateSalesSettingsInput`, and the use-case bodies.
- `backend/src/application/purchases/use-cases/PurchaseSettingsUseCases.ts` — same.
- `backend/src/tests/application/sales/SalesPostingUseCases.test.ts` — renamed test case A1 to reflect central-policy driver (no logic change).
- `backend/src/tests/application/purchases/PurchasePostingUseCases.test.ts` — same.

**Frontend**
- `frontend/src/api/salesApi.ts` — removed `requireApprovalBeforePosting` from `SalesSettingsDTO` and `UpdateSalesSettingsRequest`.
- `frontend/src/api/purchasesApi.ts` — same.
- `frontend/src/modules/sales/pages/SalesSettingsPage.tsx` — removed the "Require Approval Before Posting" toggle and payload field.
- `frontend/src/modules/purchases/pages/PurchaseSettingsPage.tsx` — same.

**Docs / Planning**
- `planning/done/158-stage-2c-retire-per-module-approval-flag.md` (this report).
- `planning/ACTIVE.md`, `planning/JOURNAL.md` updated.

### Architecture / Behavior

- The "is approval required for this voucher type?" decision lives in **one place**: `AccountingPolicyRegistry.isApprovalRequiredForVoucherType(companyId, voucherType)`.
- `PostSalesInvoiceUseCase` and `PostPurchaseInvoiceUseCase` consult it; if true and the document is not approved, they park as `PENDING_APPROVAL` via the same machinery introduced in 133/134.
- `SubledgerVoucherPostingService` receives the real `approved` boolean (Stage 1 hook) and passes the honest state into the policy context — `ApprovalRequiredPolicy` rejects unapproved postings centrally.
- Admins now toggle approval requirement on the central **Accounting policy config**, not on each Sales/Purchases settings page. Per-type exemptions are supported via `approvalExemptVoucherTypes` (Stage 2a).
- `tests/architecture/PostingAuthority.test.ts` Stage 2 assertion is **active** and green: `SalesInvoiceUseCases.ts`/`PurchaseInvoiceUseCases.ts` contain no `settings.requireApprovalBeforePosting` references.

### Verification

- [x] `cd backend && npx tsc --noEmit` — clean.
- [x] `cd frontend && npx tsc --noEmit` — clean.
- [x] `npx jest --testPathPatterns="(SalesPostingUseCases|PurchasePostingUseCases|PostingAuthority|SalesSettingsUseCases|PurchaseSettingsUseCases)"` — 5 suites, 47 passed, 1 todo (Stage 4 placeholder).
- [ ] Manual UI walkthrough deferred — Settings UI removal is mechanical; no behavioral change beyond the disappeared toggle.

### Known Issues / Follow-ups

- **Stage 4 ("guard at the door") is still TODO.** The prior session's WIP attempted to enforce policies inside `FirestoreLedgerRepository.recordForVoucher` / `PrismaLedgerRepository.recordForVoucher` — that approach was reverted because (a) `SubledgerVoucherPostingService.validatePostingPolicies` already runs the full set on the subledger path, (b) the manual `VoucherUseCases` path also runs them, and (c) door-level enforcement reads `voucher.isApproved` (re-introducing the forged-stamp problem Stage 1 fixed). The proper Stage 4 design is a `PostingGateway` that accepts caller-passed approval state and is the only permitted caller of `recordForVoucher`. Deferred to a separate task.
- The architecture test `Stage 4: ledger recordForVoucher is only reached through the posting guard` remains `it.todo`.

---

## 2. End-User View

### What's New

The "Require Approval Before Posting" toggle is no longer on the Sales Settings or Purchase Settings pages. It has moved to the central **Accounting policy** where it belongs. Approval is now controlled in one place instead of two.

### How to Use It

1. Open **Settings → Accounting → Policies**.
2. Enable **Require approval before posting**.
3. Optionally list voucher types that should be exempt (e.g., `journal_entry`) in **Approval-exempt voucher types**.

### Where to Find It

- Menu: **Settings → Accounting → Policies**
- Required permission: company admin / accounting settings.

### Tips

- Once approval is required, posting an unapproved Sales Invoice or Purchase Invoice will park it as **Pending Approval**. Click **Approve** on the document to post.

### Limitations

- Stage 4 (single mandatory choke point in front of the ledger write) is not yet shipped — direct `recordForVoucher` callers still bypass the policy set. This will land in a follow-up.

---

*This report follows the format defined in `AGENTS.md` → Definition of Done.*
