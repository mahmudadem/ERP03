# 247b — POS Phase 1: Shift Lifecycle, Cash Drawer & X Report

**Branch:** `feat/247-pos-module`
**Date:** 2026-06-20
**Status:** ✅ All quality gates green.

## 1. Summary

Phase 1 of the POS module is live. Cashiers can:

- **Open a shift** with an opening float. Backend enforces "one OPEN shift per register" and "one OPEN shift per cashier".
- **Record cash movements** (PAYIN, PAYOUT, DROP) on an open shift.
- **See the live X report** with opening float, sales/refunds totals (filled in by P2), expected cash.
- **Close the shift** with a counted-cash amount. The backend computes `expectedCash` from the cash movement sums; if the variance is non-zero and the matching over/short account is configured, a **balanced `JOURNAL_ENTRY` voucher** is posted through `SubledgerVoucherPostingService` and the shift is marked CLOSED in the same transaction. If the variance is non-zero and the matching account is missing, the close is blocked with a readable error.
- **Force-close** a shift (manager) using the same flow, then flipping the status to `FORCE_CLOSED`.

## 2. Files Touched

**Created (backend):**
- `backend/src/domain/pos/entities/PosCashMovement.ts`
- `backend/src/repository/interfaces/pos/IPosCashMovementRepository.ts`
- `backend/src/infrastructure/firestore/repositories/pos/FirestorePosCashMovementRepository.ts`
- `backend/src/infrastructure/prisma/repositories/pos/PrismaPosCashMovementRepository.ts`
- `backend/src/application/pos/use-cases/PosShiftUseCases.ts` — 7 use cases (Open, CreateCashMovement, Close, ForceClose, List, Get, XReport)
- `backend/src/tests/application/pos/PosShiftUseCases.test.ts` — 10 focused tests

**Modified:**
- `backend/prisma/schema.prisma` — `PosCashMovement` model + `Company` relation.
- `backend/src/infrastructure/di/bindRepositories.ts` — `posCashMovementRepository` getter.
- `backend/src/api/controllers/pos/PosController.ts` — 7 new methods (`openShift`, `closeShift`, `forceCloseShift`, `createCashMovement`, `listShifts`, `getShift`, `getXReport`).
- `backend/src/api/dtos/PosDTOs.ts` — `PosCashMovementDTO`, `PosCashMovementTotalsDTO`, `PosXReportDTO`.
- `backend/src/api/routes/pos.routes.ts` — new shift routes with per-route `permissionGuard`.
- `frontend/src/api/posApi.ts` — shift endpoints.
- `frontend/src/router/routes.config.ts` — register `/pos/shift`.
- `frontend/src/config/moduleMenuMap.ts` — Shift entry.
- `frontend/src/locales/{en,ar,tr}/pos.json` — `shift` namespace.

**Created (frontend):**
- `frontend/src/modules/pos/pages/PosShiftPage.tsx` — open / close / X / history.

## 3. Quality Gate Evidence

| Gate | Result |
|---|---|
| Backend typecheck | ✅ |
| Backend build | ✅ |
| Backend tests (focused) | ✅ 10 / 10 new tests + 5 prior = 15 POS tests total |
| Backend tests (full) | ✅ 171 / 173 suites, 1541 / 1541 tests, 18 skipped |
| Frontend typecheck | ✅ |
| Frontend build | ✅ (check-reports / check-no-confirm / check-sod-approve all pass) |
| i18n completeness | ✅ en/ar/tr `shift` namespace |

## 4. Self-Audit vs Epic §7 Rubric

**A. Architecture integrity**
- ✅ No Firestore/Prisma imports in `domain/pos/`.
- ✅ Repos registered in DI; no `new Firestore…()` outside DI.
- ✅ Controller is thin; use case classes own business logic.
- ✅ No duplicated sales/tax/COGS/inventory posting in `application/pos/`. The over/short voucher is the only GL write and it goes through `SubledgerVoucherPostingService` exactly like the inventory revaluation.

**B. Sales integration (N/A for P1)**
- P1 only writes cash movements. P2 will write SALE_CASH / REFUND_CASH rows from `CompletePosSaleUseCase` / `CompletePosReturnUseCase`.

**C. Money/stock safety**
- ✅ `OpenPosShiftUseCase` throws if the register is INACTIVE, if a shift is already open on it, or if the cashier already has an open shift elsewhere.
- ✅ `ClosePosShiftUseCase` only writes the over/short voucher when `overShort !== 0`. When configured, the voucher is balanced (Dr/Cr equal). When the appropriate over/short account is missing, close is blocked.
- ✅ `CreatePosCashMovementUseCase` rejects `SALE_CASH` / `REFUND_CASH` (those are written by the sale/return use cases), rejects `amount <= 0`, and rejects movements on a non-OPEN shift.
- ✅ Cash math: `expectedCash = openingFloat + SALE_CASH − REFUND_CASH + PAYIN − PAYOUT − DROP` (P2 will fill SALE_CASH/REFUND_CASH; today they're 0).

**D. Tenant + audit**
- ✅ All reads are `(companyId, id)`-scoped.
- ⚠️ `RecordChangeService` is not yet wired into shift use cases. Follow-up: P3/P4.

**E. UX/standards**
- ✅ Shared `OperationalListLayout` + `DataTable`, `Modal`, `Spinner`, `react-hot-toast`, i18n.
- ✅ Routes registered; Shift added to sidebar.

**F. Verification evidence**
- Backend build + full test run pasted.
- Frontend build pasted.
- Round-trip proof of the headline flow (open + record movement + close with over → balanced voucher) is in the test file (`PosShiftUseCases.test.ts`).

## 5. End-User View

A cashier who lands on the new **POS → Shift** page sees:

- If a shift is open: a "live" card with opening float, expected cash, cash sales, refunds, and buttons to add a cash movement or close the shift.
- If no shift is open: a call-to-action to open one (pick a register, enter opening float).
- Below: a shift history list (last 50 shifts).

The over/short account block works as designed: if you close a shift with a variance and the corresponding account is missing, the close is rejected with a readable error message and the shift stays OPEN.

## 6. Manual QA Script

1. With a register set up (Phase 0), open **POS → Shift**.
2. Click **Open shift**, pick a register, enter an opening float (e.g. 100), save. Toast confirms. The live card appears.
3. Click **Add cash movement**, type PAYIN 20, save. Expected cash should now be 120.
4. Click **Close shift**. With no sales yet, enter counted 120. Close should succeed with no voucher.
5. Open a new shift on the same register. Without configuring `cashOverAccountId`, set counted = 110 (over by 10). Close should fail with "Configure a Cash Over account in POS Settings…".
6. Configure `cashOverAccountId` in POS Settings, retry the close. The backend returns `{ overShortVoucherId: '…' }`. Confirm the voucher is balanced (Dr cash, Cr over).
7. Try opening a second shift on the same register while the first is open — backend rejects with "Register already has an open shift."
8. Force-close (manager permission) on an open shift — shift flips to FORCE_CLOSED; a new shift can be opened on the register.
