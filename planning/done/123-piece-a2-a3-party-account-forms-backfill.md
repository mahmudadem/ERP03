# 123 — Per-customer / Per-vendor AR/AP Sub-account — Frontend + Backfill (A.2 + A.3)

**Status:** ✅ Complete  
**Branch:** `feat/phase-a-sales-master-data`  
**Agent:** Codex (GPT-5)  
**Date:** 2026-05-27

---

## Scope delivered

This report closes the remaining Piece A subtasks after A.1:

- **A.2:** frontend forms/contracts for party account strategy and account-generation settings.
- **A.3:** idempotent backfill use case + endpoints + settings-page buttons with confirmation and toast feedback.

Piece A is now complete end-to-end.

---

## Technical Developer View

### Backend

1. Added `BackfillPartyAccountsUseCase`:
   - `backend/src/application/shared/use-cases/BackfillPartyAccountsUseCase.ts`
   - Supports `scope: 'AR' | 'AP' | 'BOTH'`
   - Iterates active parties, creates missing sub-accounts under configured parent(s), skips already-correct parties, collects non-fatal per-party errors.

2. Added backfill endpoints:
   - `POST /tenant/sales/settings/backfill-party-accounts`
   - `POST /tenant/purchase/settings/backfill-party-accounts`
   - `POST /super-admin/companies/:companyId/backfill-party-accounts`
   - Files:
     - `backend/src/api/controllers/sales/SalesController.ts`
     - `backend/src/api/controllers/purchases/PurchaseController.ts`
     - `backend/src/api/controllers/super-admin/SuperAdminController.ts`
     - `backend/src/api/routes/sales.routes.ts`
     - `backend/src/api/routes/purchases.routes.ts`
     - `backend/src/api/routes/super-admin.routes.ts`

3. Completed settings DTO round-trip for A.2 fields:
   - `backend/src/api/dtos/SalesDTOs.ts` now exposes `arParentAccountId`, `partyAccountCodeFormat`.
   - `backend/src/api/dtos/PurchaseDTOs.ts` now exposes `apParentAccountId`, `partyAccountCodeFormat`.

4. Added A.3 tests:
   - `backend/src/tests/application/shared/BackfillPartyAccountsUseCase.test.ts`

### Frontend

1. Added backfill API methods/contracts:
   - `frontend/src/api/salesApi.ts`
   - `frontend/src/api/purchasesApi.ts`
   - shared result contract: `PartyAccountsBackfillResult`

2. Added settings-page backfill actions:
   - Sales: `frontend/src/modules/sales/pages/SalesSettingsPage.tsx`
   - Purchases: `frontend/src/modules/purchases/pages/PurchaseSettingsPage.tsx`
   - Pattern used:
     - action button in AR/AP generation card
     - `ConfirmDialog` before state-changing operation
     - success/info/error toast feedback

3. Added i18n keys for backfill controls:
   - `frontend/src/locales/en/common.json`
   - `frontend/src/locales/ar/common.json`
   - `frontend/src/locales/tr/common.json`

---

## End-User View

### What users can do now

1. In **Sales Settings**, users can run **Backfill customer AR sub-accounts** to create dedicated AR accounts for existing customers that are still on shared/default AR behavior.
2. In **Purchases Settings**, users can run **Backfill vendor AP sub-accounts** for existing vendors.
3. Both actions show a confirmation dialog first, then show a result toast with:
   - created count
   - skipped count
   - whether any records had errors

### Why this matters

Per-customer/per-vendor account ownership is now operational for both new records (A.1+A.2) and historical records (A.3). This improves statement accuracy, AR/AP traceability, and auditability.

---

## Verification

- `npm --prefix backend test -- --runInBand backend/src/tests/application/shared/BackfillPartyAccountsUseCase.test.ts` ✅
- `npm --prefix backend test -- --runInBand backend/src/tests/application/shared/PartyAccountStrategy.test.ts` ✅
- `npm --prefix backend run build` ✅
- `npm --prefix frontend run typecheck` ✅

---

## Acceptance criteria met

- [x] A.2 frontend contract/form wiring is complete.
- [x] A.3 tenant and super-admin backfill APIs are implemented.
- [x] Backfill is idempotent and continues on per-party errors.
- [x] Sales/Purchase settings pages provide backfill UX with confirm + toast.
- [x] Documentation and planning files updated for handoff.

---

## Remaining follow-up

- **Piece B** still pending: move Customer Statement computation to `GetAccountStatementUseCase` over customer-specific AR account.
