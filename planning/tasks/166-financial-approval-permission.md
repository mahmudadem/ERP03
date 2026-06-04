# Task 166 — `accounting.financialApproval.approve` permission + route guards

**Status:** Open (Phase 2 of session fixes — landing tonight)
**Driver:** SoD architectural decision recorded in [docs/architecture/posting-authority.md §4.1](../../docs/architecture/posting-authority.md). The approval right belongs to Accounting, not Sales/Purchases. Approve endpoints currently have no permission guard at all (finding F5 in Task 162 QA).

## Problem

The Stage 2b approve endpoints were added without permission guards:

- [backend/src/api/routes/sales.routes.ts:72](../../backend/src/api/routes/sales.routes.ts) — `POST /invoices/:id/approve`
- [backend/src/api/routes/purchases.routes.ts:84](../../backend/src/api/routes/purchases.routes.ts) — `POST /invoices/:id/approve`

Any authenticated tenant user can approve any SI or PI. This is a critical SoD breach.

## Scope

### Permission definition

Create a single permission key — **NOT** split per module:

- `accounting.financialApproval.approve` — holder may approve OR reject any source document in `PENDING_APPROVAL` for the company. Same right for approval and rejection because they're the same authority over the same control.

Per §4.1: split-per-module permissions (`sales.invoices.approve`, etc.) MUST NOT exist. They would violate SoD by giving the source side the right to clear its own postings.

### Default role grants

- **Company Admin** — granted by default (every company has admins; they need to be unblocked on day one).
- **Accountant / Controller / CFO** roles — if they exist in the seeder, grant by default.
- All other roles — not granted.

### Route guards

Add `permissionGuard('accounting.financialApproval.approve')` to:

- `POST /tenant/sales/invoices/:id/approve` (Stage 2b endpoint)
- `POST /tenant/purchases/invoices/:id/approve` (Stage 2b endpoint)
- `POST /tenant/sales/invoices/:id/reject` (new in Task 165)
- `POST /tenant/purchases/invoices/:id/reject` (new in Task 165)
- `GET /tenant/accounting/pending-approvals/source-documents` (new in Task 165)

### Frontend gating

- `useHasPermission('accounting.financialApproval.approve')` helper (if not already present).
- Approval Center page (Task 165) renders no-access state if the helper returns false.
- Approve buttons in the page disabled / hidden if the helper returns false.

### Audit on approval action

Every successful approve / reject writes a record-change-log entry:

```json
{
  "entityType": "SALES_INVOICE" | "PURCHASE_INVOICE",
  "entityId": "...",
  "action": "approved" | "rejected",
  "actorId": "...",
  "actorEmail": "...",
  "at": "...",
  "reason": "..." // required for reject, optional for approve
}
```

The existing approve route already routes through the post use case which eventually writes posting logs. Make sure the **approval event itself** is logged distinct from the posting event — auditors need to see who pushed the button.

## Acceptance criteria

- [ ] Permission `accounting.financialApproval.approve` is defined and seeded for Company Admin and Accountant roles.
- [ ] Sales user (no permission) → POST `/sales/invoices/:id/approve` → 403 Forbidden.
- [ ] Sales user (no permission) → POST `/purchases/invoices/:id/approve` → 403 Forbidden.
- [ ] Accountant user (with permission) → both endpoints succeed.
- [ ] Frontend permission helper resolves the same answer the backend enforces (no UI hides what the API allows or vice versa).
- [ ] Approve and reject events appear in the source document's audit history.

## Effort estimate

~1.5–2 hours. Permission key + seeder ~30 min; route guards ~15 min; frontend helper + buttons ~30 min; audit wiring ~30 min; smoke tests ~15 min.

## What lands tonight (this session)

A minimal slice: define the permission key, guard the two existing approve endpoints, grant to Company Admin. Frontend helper + buttons defer to Task 165 implementation, since the Approval Center UI doesn't exist yet under the new model.
