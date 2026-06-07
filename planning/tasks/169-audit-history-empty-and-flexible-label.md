# Task 169 — Change History modal shows events but no field diffs; "Flexible" badge confuses approval status

**Status:** Open
**Severity:** 🟠 Significant (audit trail) + ⚠ Minor (label)
**Discovered:** 2026-06-04 manual QA pass on Task 162.

## Finding A — Change History modal: events logged, but Field / Before / After columns are blank

QA captured POST and CREATE entries in Change History for a Sales Invoice. Both events appeared with the correct timestamp and actor email, but every Field / Before / After cell was empty.

Possible causes:
1. The audit writer (`RecordChangeService`) is being called with no `changes` array on these actions — only event-type marker.
2. The renderer is reading the wrong field of the change-log document.
3. The diff capture only runs on `update`-shaped actions and skips create/post.

### Action

- Inspect what `RecordChangeService.write...` is being called with from the post path (`SalesInvoiceUseCases.ts` around line 1478 — the status flip is in scope).
- Inspect the modal renderer (`RecordAuditModal` / `RecordAuditController` response shape) — confirm what it expects vs what the writer puts in.
- The minimum bar: every POST event should record at least `status: DRAFT → POSTED` (or `PENDING_APPROVAL → POSTED` for the Stage 2b path), and ideally also `postedAt`, `voucherId`, `outstandingAmount`.
- Same for CREATE: should record at least the new field values (treating "before" as null).

## Finding B — "Flexible" badge in Vouchers list looks like an approval claim

The All Vouchers list shows a column reading `FLEXIBLE` for posted subledger vouchers. This is `PostingLockPolicy === FLEXIBLE_LOCKED` — meaning the voucher can be edited/reversed after posting. It is **not** about approval. Every subledger voucher created from SI/PI is hardcoded to this policy.

QA misread it as "Flexible Approval" and was confused why approval looked relaxed when the test was meant to be strict. Real architectural label is fine; the column label is the problem.

### Action

- Rename the column to **Edit Policy** or **Post Lock** (i18n key change).
- Optionally add a tooltip explaining what FLEXIBLE / RIGID means in plain terms.
- Add a separate **Approval** column or chip on each voucher row showing `APPROVED` / `OWNER` / `EXEMPT` so QA can see at a glance how a voucher cleared the gate (post-Stage-2b vouchers always come in already-approved; older voucher-flow vouchers may show pending here).

## Effort estimate

A: investigation ~1h, fix ~1–2h depending on whether diff capture is missing or just routing wrong.
B: ~30min for rename, ~1h to add a real approval indicator column.

