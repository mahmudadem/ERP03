# Task 165 — Approval Center as the canonical approver surface

**Status:** Open (partial work landing in this session — Phase 4 of QA fixes)
**Driver:** SoD architectural decision recorded in [docs/architecture/posting-authority.md §4.1](../../docs/architecture/posting-authority.md). Approval right belongs to Accounting; therefore the visibility/queue surface must live in Accounting.
**Discovered during:** [Task 162 — Posting Authority Epic Manual QA](162-posting-authority-qa.md), finding F3.

## Problem

After Stage 2b, source documents (Sales Invoices, Purchase Invoices, future others) park in `PENDING_APPROVAL` **before** any accounting voucher is created. The existing Approval Center calls `voucherRepository.findPendingFinancialApprovals(companyId)` — which finds vouchers, of which there are zero in the parked state. The Approval Center is therefore always empty under the new flow. Accountants have no UI to see what is awaiting their approval.

## Goal

The Approval Center is the **one place** an accountant goes to see every document currently waiting on their decision. It aggregates source documents in `PENDING_APPROVAL` across every module that posts subledger vouchers.

## Scope

### Backend

1. **Repository methods** on source-document repositories:
   - `ISalesInvoiceRepository.findPendingApproval(companyId): Promise<SalesInvoice[]>`
   - `IPurchaseInvoiceRepository.findPendingApproval(companyId): Promise<PurchaseInvoice[]>`
   - Filter is `status === 'PENDING_APPROVAL'`. Order by `updatedAt DESC` so newest pending appears first.

2. **Aggregation use case** in Accounting:
   - `ListPendingApprovalsUseCase(companyId): Promise<PendingApprovalItem[]>`
   - Each item: `{ source: 'SALES_INVOICE' | 'PURCHASE_INVOICE', id, number, partyName, totalBase, currency, date, createdBy, parkedAt }`
   - Future-extensible: add module sources to this union as more module-posting flows adopt Stage 2b.

3. **New endpoint:** `GET /tenant/accounting/pending-approvals/source-documents`
   - Guard: `permissionGuard('accounting.financialApproval.approve')` (defined in Task 166)
   - Response: `{ success: true, data: PendingApprovalItem[] }`

4. **Reject endpoints** (Stage 2b never added these for source documents):
   - `POST /tenant/sales/invoices/:id/reject` — body `{ reason: string }`
   - `POST /tenant/purchases/invoices/:id/reject` — body `{ reason: string }`
   - Both guarded by `accounting.financialApproval.approve` (same permission — same right)
   - Use case: validate document is in `PENDING_APPROVAL`, transition back to `DRAFT`, record audit entry `{ action: 'rejected', by: userId, reason, at: now }`, return updated DTO.
   - Salesperson's UX of the rejection is handled in Task 167 (the source-page render).

### Frontend

1. **Rewrite `frontend/src/modules/accounting/pages/ApprovalsPage.tsx`** to consume the new aggregation endpoint instead of the voucher list.
2. **Each row renders:**
   - Document type chip (SI / PI)
   - Document number + party name
   - Total (currency-formatted)
   - Date + parked-at timestamp
   - **Approve** button → calls existing `POST /tenant/{sales|purchases}/invoices/:id/approve`
   - **Reject** button → opens a reason-required modal, calls the new reject endpoint
   - Click row to open source document detail in a new tab/window for context
3. **GL Impact preview link** per row — opens the existing `GlImpactModal` in "preview" mode (compute the would-be voucher lines without persisting). If the preview mode doesn't exist yet, link to the source document instead.
4. **Permission gating:** if user lacks `accounting.financialApproval.approve`, page renders "You don't have access to the Approval Center" empty state.

### Notifications (deferred)

Not in this task. When notification infrastructure exists, parking a document should notify users with `accounting.financialApproval.approve`. Filed as separate follow-up.

## Acceptance criteria

- [ ] Sales user creates and posts an SI → page reflects `PENDING_APPROVAL`.
- [ ] Accountant opens Approval Center → sees the SI listed, with total and customer name.
- [ ] Accountant clicks Approve → SI status flips to POSTED; ledger entries are written; Approval Center removes the row.
- [ ] Accountant clicks Reject, enters a reason → SI returns to DRAFT with reason in audit; Approval Center removes the row.
- [ ] Same flow works for Purchase Invoice.
- [ ] Sales user (no `accounting.financialApproval.approve`) → 403 on the approve and reject endpoints; Approval Center page shows no-access state.

## Effort estimate

~4–6 hours. Backend repository methods + use case + endpoints ~2h; reject use cases + endpoints ~1h; frontend rewrite ~2h; permission gating + tests ~1h.

## Notes for the implementer

- Do not collapse Approve and Reject into a single endpoint. They're different decisions with different audit semantics.
- The Approve endpoint already exists (`POST /tenant/sales/invoices/:id/approve`). It needs the permission guard added (Task 166) but no other backend change for happy path.
- For the GL Impact preview: if you can't build a true preview today, link to the source document. Don't fake the preview.
