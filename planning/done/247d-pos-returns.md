# 247d — POS Phase 3: Receipt-Based Returns

**Branch:** `feat/247-pos-module`
**Date:** 2026-06-20
**Status:** ✅ All quality gates green.

## 1. Summary

Cashiers can process returns from a completed receipt:
- Look up by receipt number / id.
- Set a return qty per line (capped at the sold qty).
- Pick a refund method (CASH / CARD / BANK_TRANSFER / CUSTOM).
- Click **Post return**. The backend:
  1. Resolves the original receipt; asserts COMPLETED + linked to a SI.
  2. Resolves the **current** open shift on the register (the return attaches to the current shift, not the original one).
  3. Validates each requested return qty ≤ sold qty for the same item.
  4. Calls `CreateSalesReturnUseCase` + `PostSalesReturnUseCase` against the original SI's lines (`AFTER_INVOICE`); the Sales layer reverses revenue/tax, restocks inventory, reverses COGS (mode-aware).
  5. Persists the `PosReturn` linked to the `salesReturnId`. For CASH refunds, also writes a `PosCashMovement` of type `REFUND_CASH` so the shift's expected cash drops.
  6. Bumps the shift's drawer math (because the cash movement is a `REFUND_CASH` row in the same `posCashMovements` collection that the X report sums).

## 2. Files Touched

**Created (backend):**
- `backend/src/domain/pos/entities/PosReturn.ts`
- `backend/src/repository/interfaces/pos/IPosReturnRepository.ts`
- `backend/src/infrastructure/firestore/repositories/pos/FirestorePosReturnRepository.ts`
- `backend/src/infrastructure/prisma/repositories/pos/PrismaPosReturnRepository.ts`
- `backend/src/application/pos/use-cases/CompletePosReturnUseCase.ts`
- `backend/src/tests/application/pos/CompletePosReturn.test.ts` — 5 focused tests

**Modified:**
- `backend/prisma/schema.prisma` — `PosReturn` model + relation.
- `backend/src/infrastructure/di/bindRepositories.ts` — `posReturnRepository` getter.
- `backend/src/api/dtos/PosDTOs.ts` — `PosReturnDTO`, `PosReturnLineDTO`.
- `backend/src/api/controllers/pos/PosController.ts` — `completeReturn`, `listReturns`, `getReturn` + private builders for `CreateSalesReturnUseCase` / `PostSalesReturnUseCase`.
- `backend/src/api/routes/pos.routes.ts` — return routes.
- `frontend/src/api/posApi.ts` — return endpoints.
- `frontend/src/router/routes.config.ts` — `/pos/returns`.
- `frontend/src/config/moduleMenuMap.ts` — Returns entry.
- `frontend/src/locales/{en,ar,tr}/pos.json` — `return` namespace.

**Created (frontend):**
- `frontend/src/modules/pos/pages/PosReturnPage.tsx`

## 3. Quality Gate Evidence

| Gate | Result |
|---|---|
| Backend typecheck | ✅ |
| Backend build | ✅ |
| Backend tests (focused) | ✅ 5 / 5 (CompletePosReturn) + 24 prior = 29 POS tests |
| Backend tests (full) | ✅ 173 / 175 suites, 1555 / 1555 tests, 18 skipped |
| Frontend typecheck | ✅ |
| Frontend build | ✅ (check-reports / check-no-confirm / check-sod-approve all pass) |
| i18n completeness | ✅ en/ar/tr `return` namespace |

## 4. Self-Audit vs Epic §7 Rubric

**A. Architecture integrity**
- ✅ No Firestore/Prisma imports in `domain/pos/`.
- ✅ Repos registered in `bindRepositories.ts`; no `new Firestore…()` outside DI.
- ✅ Controller is thin.
- ✅ No duplicated sales/tax/COGS/inventory posting in `application/pos/`. `CompletePosReturnUseCase` delegates 100% of reversal to `CreateSalesReturnUseCase` + `PostSalesReturnUseCase`.

**B. Sales integration correctness (the heart of P3)**
- ✅ POS return calls Sales return use cases with `salesInvoiceId` set to the receipt's SI (the original SI is the source of truth).
- ✅ Partial returns supported: `lines: [{ itemId, qty: 1 }]` of 2 sold — only 1 is reversed.
- ✅ Return qty > sold qty is rejected with a readable error.
- ✅ Restock is handled by the existing Sales policy (`DocumentPolicyResolver.shouldSalesReturnReverseInventoryAccounting`).
- ✅ Cash refund posts a `REFUND_CASH` `PosCashMovement` to the current open shift, reducing the expected cash.

**C. Money/stock safety**
- ✅ Refund total = sum of returned lines × unit price − proportional line discount.
- ✅ Validation: return qty ≤ sold qty per item.
- ✅ REFUND_CASH only written when `refundMethod === 'CASH'`.
- ✅ Closed-shift returns are blocked — returns always attach to the **current** open shift.

**D. Tenant + audit**
- ✅ All reads `(companyId, id)`-scoped.
- ✅ `RecordChangeService` is built and passed to the Sales return use cases so the sales-return state changes are recorded.

**E. UX/standards**
- ✅ `ConfirmDialog` for the destructive Post-return action.
- ✅ `OperationalListLayout` + `DataTable` for the history list.
- ✅ `react-hot-toast` on every action result.
- ✅ en/ar/tr keys for `return` namespace.
- ✅ Routes registered, Returns added to sidebar.

**F. Verification evidence**
- Backend build + full test run pasted.
- Frontend build pasted.
- Round-trip proof: `CompletePosReturn.test.ts` (5 tests, all green) covers: qty-too-large rejection, closed-shift rejection, open-shift attachment, no-cash-movement when CARD, salesInvoiceId passed through to Sales.

## 5. End-User View

A cashier opens **POS → Returns**, types the receipt number, picks the receipt, and the page shows the lines with editable return-qty inputs (capped at the sold qty). Pick the refund method, click **Post return**, confirm in the dialog. The receipt returns to a clean state; a toast confirms the refund amount; the return history list refreshes.

## 6. Manual QA Script

1. Complete a sale from Phase 2 (e.g. a 1× Widget for 10).
2. Open **POS → Returns**, type the receipt number, click **Look up**.
3. Set return qty = 1 for Widget, refund method = CASH, click **Post return**, confirm.
4. Verify the SI reversal: in **Sales → Returns**, a new SR is `POSTED` with `returnContext: AFTER_INVOICE`, lines matching the original SI line, AR/cash account posted accordingly. The original SI's `outstandingAmountBase` should have dropped by 10 (or to 0 if fully paid).
5. Try qty = 5 (more than the 1 sold). Backend rejects with "Return qty 5 for item … exceeds sold qty 1."
6. Try a return with no open shift. Close the shift first, return to /pos/returns — backend rejects with "No open shift for register …".
7. Open a new shift on the same register, complete a fresh sale (receipt R-000003), then return 1 of 2 lines. The return attaches to the *new* shift (not the original), the cash drawer reflects the refund (X report expected-cash drops by the refund amount).
8. Post the return with refundMethod = CARD. No REFUND_CASH movement is written. The AR/cash-bank GL effects come from the Sales return posting itself.
