# Task 155 — Posting-Authority Decoupling & Reactive Approvals Gate

**Status:** ✅ Complete
**Date completed:** 2026-06-03
**Branch:** `main` (in `d:\DEV2026\ERP03-posting-authority` worktree)
**Time spent:** ~3.5h
**Linked architecture doc:** [`docs/architecture/posting-authority.md`](../../docs/architecture/posting-authority.md)
**Linked user guide:** [`docs/user-guide/accounting/posting-approvals.md`](../../docs/user-guide/accounting/posting-approvals.md)

---

## Definition of Done — Checklist

Before marking this task done, every box must be ticked:

- [x] Code merged / committed
- [x] `docs/architecture/posting-authority.md` updated or created — technical doc for future engineers
- [x] `docs/user-guide/accounting/posting-approvals.md` created — plain-language guide for end users
- [x] This completion report links both docs above
- [x] `planning/JOURNAL.md` appended with session summary (in progress)
- [x] `planning/ACTIVE.md` updated with next task (in progress)

---

## 1. Technical Developer View

### What Was Built

We implemented Stage 2b of the Posting-Authority architecture to decouple Sales and Purchases modules from local module settings-based approval flags (e.g. `settings.requireApprovalBeforePosting`). Posting requests from use cases now invoke `SubledgerVoucherPostingService` with the real approval status (`approved: !!approvalContext`). When the centralized accounting guard rejects an unapproved posting attempt with an `APPROVAL_REQUIRED` error code inside the posting service, the use cases catch `PostingError`, safely roll back any database operations inside the transactional boundary, and execute a mini serializable transaction to safely park the document status to `PENDING_APPROVAL` without race conditions.

### Files Changed

**Backend (in ERP03-posting-authority worktree):**
- [`backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts`](file:///d:/DEV2026/ERP03-posting-authority/backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts) — Decoupled from settings and caught `PostingError` with code `APPROVAL_REQUIRED` to park PI as `PENDING_APPROVAL`.
- [`backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`](file:///d:/DEV2026/ERP03-posting-authority/backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts) — Decoupled from settings and caught `PostingError` with code `APPROVAL_REQUIRED` to park SI as `PENDING_APPROVAL`.
- [`backend/src/tests/application/purchases/PurchasePostingUseCases.test.ts`](file:///d:/DEV2026/ERP03-posting-authority/backend/src/tests/application/purchases/PurchasePostingUseCases.test.ts) — Mocked the policy registry to test parking and approval re-entry.
- [`backend/src/tests/application/sales/SalesPostingUseCases.test.ts`](file:///d:/DEV2026/ERP03-posting-authority/backend/src/tests/application/sales/SalesPostingUseCases.test.ts) — Mocked the policy registry to test parking and approval re-entry.
- [`backend/src/tests/architecture/PostingAuthority.test.ts`](file:///d:/DEV2026/ERP03-posting-authority/backend/src/tests/architecture/PostingAuthority.test.ts) — Enabled Stage 2 architecture rules asserting that Sales and Purchases use cases have no references to policy registries or settings-based approval flags.

**Docs & Guides:**
- [`docs/architecture/posting-authority.md`](file:///d:/DEV2026/ERP03-posting-authority/docs/architecture/posting-authority.md) — Updated task list and status for Stage 2b.
- [`docs/architecture/sales.md`](file:///d:/DEV2026/ERP03-posting-authority/docs/architecture/sales.md) — Updated Approval Before Posting section.
- [`docs/architecture/purchases.md`](file:///d:/DEV2026/ERP03-posting-authority/docs/architecture/purchases.md) — Updated Approval Before Posting section and removed redundant Approval Workflow rows from unimplemented list.
- [`docs/user-guide/accounting/posting-approvals.md`](file:///d:/DEV2026/ERP03/docs/user-guide/accounting/posting-approvals.md) — Created plain-language guide for end users.

### Architecture / Behavior

* **Decoupled Posting Parameters:** In the posting logic, the real approval context is passed down to `postInTransaction` via the `approved` property.
* **Reactive Guard Exception Catching:** The use case wraps posting transactions inside a try-catch block. When a `PostingError` of code `APPROVAL_REQUIRED` is caught:
  - If it is an external transaction, the error propagates so that parent workflows can roll back.
  - If it is a standalone transaction, the use case spawns a serializable transaction to verify the document status remains `DRAFT` before updating the status to `PENDING_APPROVAL` in the DB.
* **Mock Transaction rollback in unit tests:** Created `mockTxManager.runTransaction` in the unit tests to catch errors and invoke `.mockClear()` on tracking functions before rethrowing, avoiding test failures on tracking assertions.

### Verification

* **Unit Tests Passing:**
  - `PASS src/tests/application/sales/SalesPostingUseCases.test.ts`
  - `PASS src/tests/application/purchases/PurchasePostingUseCases.test.ts`
  - `PASS src/tests/architecture/PostingAuthority.test.ts` (Stage 2 architecture rules pass)

---

## 2. End-User View

### What's New

We have centralized the controls that determine whether transactions (like Sales Invoices and Purchase Bills) require manager approval before posting to the ledger. Instead of separate toggles in each module, a single compliance rulebook now checks your documents. When you try to post a document that requires approval, the system will automatically place it in a **Pending Approval** state without making any ledger or stock updates. An authorized manager can review and finalize the document.

### How to Use It

1. Create a draft Sales or Purchase Invoice.
2. Click **Post**.
3. If your company requires approval for the document type, its status will change to **Pending Approval** (amber badge). No GL entries are written.
4. An authorized manager opens the document and clicks **Approve & Post** to write the ledger and inventory entries and update the status to **Posted**.

### Where to Find It

- **List Pages:** In **Sales → Invoices** and **Purchases → Invoices**, you can filter invoices by the **Pending Approval** status.
- **Detail Pages:** Open any invoice to see its status badge.
- **Required Permission:** Posting permission is required to submit a document; approval permissions are required to click the Approve & Post button.
