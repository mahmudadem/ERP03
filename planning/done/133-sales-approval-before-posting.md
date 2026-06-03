# 133 — Sales: Approval Before Posting (Sales slice)

**Date:** 2026-06-02
**Agent:** Claude (Opus 4.8)
**Branch:** `feat/approval-system` (off `main`, merged to `main`)
**Builds on:** [132 — Posting Authority Policy Guard](./132-posting-authority-policy-guard.md)

## Technical Developer View

### Problem / request

Product owner asked for a per-module **approval system**: when enabled, posting a source
document should **wait for approval** instead of hitting the ledger; when disabled, it
**auto-posts** as today. This is the **Sales slice** of an "all accounting-affecting modules"
rollout (Purchases + Inventory follow the identical pattern next).

### Design — approval is a gate *in front of* the existing post

Posting a Sales Invoice produces ledger + stock + settlement effects in one transaction. To
avoid splitting that, approval is implemented as a **gate**, not a partial post:

- **Off (default):** behaviour is unchanged — the gate block is skipped entirely.
- **On:** a DRAFT invoice that is posted is **parked as `PENDING_APPROVAL`** and produces
  **no financial effect**. `ApproveSalesInvoiceUseCase` re-enters `PostSalesInvoiceUseCase.execute`
  with an `approvalContext`, which bypasses the gate and runs the **exact same** post
  (ledger + stock + settlement). Nothing about posting is duplicated.

The gate sits at the top of `execute`, so all three posting entry points (`post`,
`create-and-post`, `update-and-post`) are covered by one safe-by-default check.

### What changed

**Backend**
- `SalesSettings` (+ props/DTO): new `requireApprovalBeforePosting: boolean` (default `false`).
- `SalesInvoice`: new status `PENDING_APPROVAL` (type + `SI_STATUSES`).
- `PostSalesInvoiceUseCase.execute`: approval gate + optional `approvalContext` param.
- `ApproveSalesInvoiceUseCase`: new use-case — loads a `PENDING_APPROVAL` invoice and re-runs
  the real post.
- `SalesController.approveSI` + route `POST /tenant/sales/invoices/:id/approve`.
- `SalesSettingsUseCases` (init + update) and `SalesDTOs` thread the new flag.

**Frontend**
- `salesApi`: `SIStatus` adds `PENDING_APPROVAL`; settings DTO + update input gain the flag;
  new `approveSI()` method.
- `SalesSettingsPage`: "Require Approval Before Posting" toggle (all workflow modes).
- `SalesInvoiceDetailPage`: routes the post action to `approveSI` when pending; "Approve & Post"
  button; amber **PENDING APPROVAL** badge.
- `SalesInvoicesListPage`: "Pending Approval" filter + readable badge.

### Files changed

- `backend/src/domain/sales/entities/SalesSettings.ts`
- `backend/src/domain/sales/entities/SalesInvoice.ts`
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
- `backend/src/application/sales/use-cases/SalesSettingsUseCases.ts`
- `backend/src/api/controllers/sales/SalesController.ts`
- `backend/src/api/routes/sales.routes.ts`
- `backend/src/api/dtos/SalesDTOs.ts`
- `backend/src/tests/application/sales/SalesPostingUseCases.test.ts` (+2 tests)
- `frontend/src/api/salesApi.ts`
- `frontend/src/modules/sales/pages/SalesSettingsPage.tsx`
- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/modules/sales/pages/SalesInvoicesListPage.tsx`

### Acceptance criteria met

- Flag off (default) → posting behaviour byte-for-byte unchanged (gate skipped).
- Flag on → posting a draft parks it `PENDING_APPROVAL` with **no** ledger/stock/settlement.
- Approve → runs the full real post (2 vouchers + 2 ledger writes in the standalone case).
- Approve only valid from `PENDING_APPROVAL` (throws otherwise).

### Verification

- `npm --prefix backend run typecheck` → clean.
- `npx jest --runInBand src/tests/application/sales/SalesPostingUseCases.test.ts` → **20/20 pass**
  (incl. new A1 park-with-no-effect and A2 approve-runs-real-post).
- `npm --prefix frontend run typecheck` → clean.
- Not run: full `vite build` (check:reports/vite) — typecheck used as the frontend gate.

## End-User View

A new Sales setting, **"Require Approval Before Posting."** When it's **off** (default),
invoices post immediately, exactly as before. When it's **on**, pressing **Post** on an invoice
no longer touches your books — the invoice moves to **Pending Approval** (amber badge) and waits.
An authorised user opens it and clicks **Approve & Post**, which then records it to the ledger,
moves stock, and settles — all in one step. Nothing financial happens until approval.

## Manual QA script

Pre: a company with Sales + Accounting initialised; at least one stock item with cost.

1. **Default off** — Settings → Sales: confirm "Require Approval Before Posting" is **off**.
   Create an invoice, click **Post** → it goes straight to **POSTED** (ledger written). ✅ unchanged.
2. **Turn it on** — toggle the setting on, Save.
3. **Park** — create a new invoice, click **Post** → status becomes **PENDING APPROVAL** (amber);
   open the GL / customer ledger → **no entry** yet; stock unchanged.
4. **List** — Sales → Invoices: filter "Pending Approval" → the invoice appears.
5. **Approve** — open it, click **Approve & Post** → status **POSTED**; GL now shows Revenue + AR
   (and COGS/Inventory for stock items); stock decremented.
6. **Guard** — try `POST /invoices/:id/approve` on an already-POSTED invoice → rejected
   ("Only sales invoices pending approval can be approved").
7. **Period lock interplay** — with a soft period lock active, approving an invoice dated in the
   locked window prompts the same override-reason flow as a normal post.

## Known follow-ups

- **Purchases + Inventory**: replicate the identical gate + Approve action (next slices).
- Approval authority is currently "anyone who can post" (per product decision — payload-only,
  no separate role gate). Audit of the approve action rides on the existing `recordPost`.
- Optional: surface parked invoices in the shared Accounting **Approvals** page (today they are
  approved from the invoice detail screen).
