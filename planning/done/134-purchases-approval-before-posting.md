# 134 — Purchases: Approval Before Posting (Purchases slice)

**Date:** 2026-06-02
**Agent:** Claude (Opus 4.8)
**Branch:** `feat/approval-system` (off `main`, merged to `main`)
**Pattern:** identical to [133 — Sales: Approval Before Posting](./133-sales-approval-before-posting.md) (read that for the full design rationale)

## Summary

Replicates the Sales approval gate for **Purchase Invoices**. New
`PurchaseSettings.requireApprovalBeforePosting` (default `false`): when on, posting a Purchase
Invoice parks it as `PENDING_APPROVAL` with **no** financial effect (no ledger, no stock, no
settlement); `ApprovePurchaseInvoiceUseCase` re-enters `PostPurchaseInvoiceUseCase.execute` with
an `approvalContext` to run the exact same real post. **Safe-by-default** (flag off → unchanged).

## Files changed

**Backend**
- `backend/src/domain/purchases/entities/PurchaseSettings.ts` — `requireApprovalBeforePosting`.
- `backend/src/domain/purchases/entities/PurchaseInvoice.ts` — `PENDING_APPROVAL` status.
- `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts` — gate in
  `PostPurchaseInvoiceUseCase.execute` + `ApprovePurchaseInvoiceUseCase` + list-filter widening.
- `backend/src/application/purchases/use-cases/PurchaseSettingsUseCases.ts` — thread flag.
- `backend/src/api/controllers/purchases/PurchaseController.ts` — `approvePI` handler.
- `backend/src/api/routes/purchases.routes.ts` — `POST /invoices/:id/approve`.
- `backend/src/api/dtos/PurchaseDTOs.ts` — settings flag + PI status widening.
- `backend/src/tests/application/purchases/PurchasePostingUseCases.test.ts` — +2 tests.

**Frontend**
- `frontend/src/api/purchasesApi.ts` — `PIStatus` adds `PENDING_APPROVAL`; settings DTO + update
  input gain the flag; new `approvePI()`.
- `frontend/src/modules/purchases/pages/PurchaseSettingsPage.tsx` — toggle.
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx` — Approve & Post action +
  amber badge.
- `frontend/src/modules/purchases/pages/PurchaseInvoicesListPage.tsx` — Pending Approval filter +
  badge.

## Verification

- `npm --prefix backend run typecheck` → clean.
- `npx jest --runInBand src/tests/application/purchases/PurchasePostingUseCases.test.ts` →
  **14/14** (incl. A1 park-no-effect, A2 approve-runs-real-post).
- `npm --prefix frontend run typecheck` → clean.

## Manual QA script

Same as [133](./133-sales-approval-before-posting.md), substituting Purchases settings and
Purchase Invoices (Vendor instead of Customer; GRN-linked vs direct both apply).

## Known follow-ups

- **Inventory** (Stock Adjustments + Opening Stock) is the remaining module — same gate pattern,
  two document types.
- Approval authority is "anyone who can post" (product decision: payload-only).
