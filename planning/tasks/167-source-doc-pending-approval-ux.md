# Task 167 — Sales/Purchase Invoice Detail UX for PENDING_APPROVAL state

**Status:** Open (Phase 3 of session fixes — landing tonight)
**Driver:** SoD architectural decision recorded in [docs/architecture/posting-authority.md §4.1](../../docs/architecture/posting-authority.md). Source-module pages must NOT render an Approve action — the approval right belongs to Accounting. Currently the SI Detail page has no render branch for `PENDING_APPROVAL` at all (finding F4 in Task 162 QA).

## Problem

Once a Sales Invoice or Purchase Invoice parks in `PENDING_APPROVAL`, the detail page:

- Goes read-only (line 246 of [SalesInvoiceDetailPage.tsx](../../frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx): `isReadOnly = !isCreateMode && !(invoice?.status === 'DRAFT')`).
- Renders **zero action buttons** — the right-side button rail has branches for POSTED, DRAFT, and isCreateMode, but no branch for PENDING_APPROVAL.

Result: the salesperson sees a frozen page with no indication of *why* it's frozen or *what to do next*. There is no recall, no resubmit, no contact-accounting affordance.

## Goal

The SI/PI detail page in `PENDING_APPROVAL` state communicates the right model to the salesperson:

> "This invoice is awaiting accounting approval. You cannot edit it while it's pending. The accountant will Approve or Reject it; you'll see the decision here when it's made."

No Approve button. No Reject button. Approval happens in the Accounting Approval Center.

## Scope

### Visual contract

**Banner** — flex-none mx-3 mt-2 amber band, between the info bar and the lines table:

> ⏳ **Awaiting accounting approval.** This invoice was submitted on \<date\>. Accounting will Approve or Reject it from the Approval Center. You will not be able to edit it while it's pending.

(i18n keys: `sales.invoiceDetail.pendingApprovalBanner.title`, `sales.invoiceDetail.pendingApprovalBanner.description`. Same pattern for purchases.)

**Action rail** — under the new `invoice?.status === 'PENDING_APPROVAL'` branch:

- **History** button (existing) — open the audit modal so the salesperson can see when they submitted.
- *(Future)* **Recall** button — pulls the invoice back to DRAFT. Out of scope tonight; document as a follow-up in this task file's "Deferred" section.

**Status chip** — already renders via `StatusChip` with `type="si"` / `type="pi"`. Verify amber color is configured for `PENDING_APPROVAL`.

### Rejected status (cosmetic — back-end work is in Task 165)

When an accountant rejects, the document transitions back to `DRAFT` with the reason in the audit log. The source page will already render the DRAFT form (existing branch). **A one-shot banner shows the most recent rejection** read from the audit log:

> ⚠ **Previous submission rejected.** Reason: *"\<reason from audit\>"*. Make changes and submit again.

This banner appears for any DRAFT document whose audit log's most recent action is `rejected`. (Implementation note: query the existing record-change-log endpoint for the source doc; show the rejection only if it's the most recent action and not yet acknowledged. "Acknowledged" can be tracked via a local component state on first edit — out of scope: a server-side acknowledged flag.)

### Files to touch

- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
  - Add render branch for `PENDING_APPROVAL` in the action rail (around line 2032).
  - Add banner component above the lines table (around line 1790 where existing banners live).
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
  - Mirror the same two changes.
- `frontend/src/locales/en/sales.json` and `frontend/src/locales/en/purchases.json`
  - Add the four banner i18n keys.

## Acceptance criteria

- [ ] Sales user creates and posts an SI → page reflects `PENDING_APPROVAL`.
- [ ] Page shows the amber waiting banner with the submission date.
- [ ] Action rail shows History only — no Approve, no Reject, no Post, no Save & Post.
- [ ] Form fields are read-only (existing `isReadOnly` derivation continues to work — verify it still includes `PENDING_APPROVAL` in the not-DRAFT branch).
- [ ] Same for Purchase Invoice.
- [ ] After accountant rejects and SI returns to DRAFT, page renders editable form + one-shot rejection-reason banner.

## Effort estimate

~1.5 hours. Render branch + banner on SI ~45 min; mirror to PI ~30 min; i18n keys + verification ~15 min.

## Deferred (separate follow-ups)

- **Recall** action for source-module owner (lets the salesperson pull back a pending submission before the accountant acts on it). Architectural question: does recall go via the source module's own permission, or via `accounting.financialApproval.approve`? Likely source module's own — the salesperson should be allowed to retract what they themselves submitted. File when needed.
- **Server-side rejection acknowledgement** so the banner doesn't reappear after navigation. Local state is fine for v1.
