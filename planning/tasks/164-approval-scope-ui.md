# Task 164 — Approval Scope UI (per-type exemptions, grouped by module)

**Status:** Open
**Why:** Architecture intent is documented but UI doesn't expose it. QA cannot currently configure per-module/per-type approval scope through the app — must edit Firestore by hand. Discovered during Task 162 posting-authority QA.

## Architecture reference

[docs/architecture/posting-authority.md §4](../../docs/architecture/posting-authority.md) — "Policies, scope, and overrides":

> - **Definition + scope + exemptions all live in Accounting** (the one rulebook).
> - **Scope is by document type** (e.g. `sales_invoice`, `delivery_note`, `stock_adjustment`), **presented grouped by module in the UI**.
> - A policy may be active globally but **exempt** specific types.
> - **Exemptions must be auditable** (who exempted what, when, ideally why).

## Backend status

Already done. `AccountingPolicyConfig` (`backend/src/domain/accounting/policies/PostingPolicyTypes.ts`) has:
- `approvalRequired: boolean` — master switch
- `approvalExemptVoucherTypes?: string[]` — per-type exemption list

The `AccountingPolicyRegistry` passes `approvalExemptVoucherTypes` into `ApprovalRequiredPolicy`. Engine works; only UI is missing.

## Scope

Extend **Accounting → Settings → Approval Workflow** tab.

### Layout

When `Financial Approval (FA)` toggle is ON, show a new section below the existing `Apply To` toggle:

```
[ ] Apply to all voucher types
[x] Apply selectively
    ┌─── Sales ──────────────────────────┐
    │ [x] Require approval — Sales Invoice
    │ [x] Require approval — Sales Return
    └────────────────────────────────────┘
    ┌─── Purchases ──────────────────────┐
    │ [x] Require approval — Purchase Invoice
    │ [x] Require approval — Purchase Return
    └────────────────────────────────────┘
    ┌─── Accounting (manual) ────────────┐
    │ [ ] Require approval — Payment
    │ [ ] Require approval — Receipt
    │ [ ] Require approval — Journal Entry
    └────────────────────────────────────┘
```

### Persistence mapping

Unchecked rows → add the voucher type string to `approvalExemptVoucherTypes`.
Checked rows → not in the exempt list.

### Voucher-type source

Use `backend/src/domain/accounting/types/VoucherTypes.ts` `VoucherType` enum, grouped by sourceModule via a lookup like:
- Sales: `SALES_INVOICE`, `SALES_RETURN`
- Purchases: `PURCHASE_INVOICE`, `PURCHASE_RETURN`
- Accounting (manual): `PAYMENT`, `RECEIPT`, `JOURNAL_ENTRY`, `OPENING_BALANCE`

## Acceptance criteria

- [ ] Operator can set "strict for Purchases, flex for Sales" entirely from the UI — no Firestore edits.
- [ ] Selection persists through page reload.
- [ ] After saving, creating a Sales Invoice posts directly (Sales exempt); creating a Purchase Invoice parks as PENDING_APPROVAL.
- [ ] Both renderings (classic and Windows MDI) honored.
- [ ] An audit entry is written when the exemption list changes — who/what/when. (Architecture §4: "Exemptions are themselves a relaxation of a control and must be auditable.")

## Related

- [Task 162 — Posting Authority Epic Manual QA](162-posting-authority-qa.md) — the QA pass that surfaced this gap
- Backend Stage 2a already implemented `approvalExemptVoucherTypes` — this task wires the UI to it
- "Flexible" label confusion in Vouchers list ([VoucherTable.tsx:1011](../../frontend/src/modules/accounting/components/VoucherTable.tsx:1011)) — file a separate small task to rename the badge to "Editable" (it's about post-lock policy, not approval) and add a distinct approval-status indicator

## Effort estimate

~3–4 hours: backend wiring already exists; this is a frontend-only section in an existing tab + i18n strings + an audit log entry on save.
