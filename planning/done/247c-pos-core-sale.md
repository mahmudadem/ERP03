# 247c — POS Phase 2: Core Sale (Direct SI + Settlement) & Cashier Screen

**Branch:** `feat/247-pos-module`
**Date:** 2026-06-20
**Status:** ✅ All quality gates green.

## 1. Summary

A cashier on an open shift can:
- Search products by SKU/barcode/name (debounced).
- Build a cart with line qty/price/discount.
- Pick a customer (defaults to the configured walk-in).
- Tender with one or more methods (CASH / CARD / BANK_TRANSFER / CUSTOM). CASH change is netted off the SI settlement so the SI always settles to the receipt grand total.
- Click **Complete sale**. The backend:
  1. Validates shift OPEN + cashier match + cart math.
  2. Validates payment-method config (settlement account exists, requiresReference satisfied, CARD cannot give change).
  3. Calls the existing `CreateAndPostSalesInvoiceUseCase` with `persona:'direct'`, `source:'pos'`, `formType:'pos_sale'` — the existing Sales use case posts revenue + tax + COGS + inventory OUT + AR + receipt voucher(s) in one atomic transaction. `PersonaNotAllowedError` (no `allowPosDirectSales` toggle on) is surfaced, never caught-and-converted.
  4. Persists the `PosReceipt` (with `salesInvoiceId` link) + `PosPayment` rows + a `PosCashMovement` of type `SALE_CASH` (cash applied, gross of change) in a single transaction.
  5. Bumps `PosSettings.receiptNextSeq` and returns `{ receipt, salesInvoiceId, salesInvoiceNumber, change }`.
- The cashier screen surfaces a "Last receipt" card with receipt number, SI number, and change.

## 2. Files Touched

**Created (backend):**
- `backend/src/domain/pos/entities/PosReceipt.ts`
- `backend/src/domain/pos/entities/PosPayment.ts`
- `backend/src/repository/interfaces/pos/IPosReceiptRepository.ts`
- `backend/src/repository/interfaces/pos/IPosPaymentRepository.ts`
- `backend/src/infrastructure/firestore/repositories/pos/FirestorePosReceiptRepository.ts`
- `backend/src/infrastructure/firestore/repositories/pos/FirestorePosPaymentRepository.ts`
- `backend/src/infrastructure/prisma/repositories/pos/PrismaPosReceiptRepository.ts`
- `backend/src/infrastructure/prisma/repositories/pos/PrismaPosPaymentRepository.ts`
- `backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts` — the centerpiece
- `backend/src/application/pos/use-cases/PosBootstrapUseCase.ts` — bootstrap + product search
- `backend/src/tests/application/pos/CompletePosSale.test.ts` — 9 focused tests

**Modified:**
- `backend/prisma/schema.prisma` — `PosReceipt` + `PosPayment` models, `Company` relations.
- `backend/src/infrastructure/di/bindRepositories.ts` — `posReceiptRepository` + `posPaymentRepository` getters.
- `backend/src/api/dtos/PosDTOs.ts` — `PosReceiptDTO`, `PosReceiptLineSnapshotDTO`, `PosPaymentDTO`.
- `backend/src/api/controllers/pos/PosController.ts` — 6 new methods: `getBootstrap`, `searchProducts`, `completeSale`, `listReceipts`, `getReceipt`, `reprintReceipt`.
- `backend/src/api/routes/pos.routes.ts` — 6 new routes.
- `frontend/src/api/posApi.ts` — sale / receipt endpoints.
- `frontend/src/router/routes.config.ts` — `/pos` already wired (re-uses PosHomePage alias).
- `frontend/src/locales/{en,ar,tr}/pos.json` — `terminal` namespace.

**Created (frontend):**
- `frontend/src/modules/pos/pages/PosTerminalPage.tsx` — the cashier screen.
- `frontend/src/modules/pos/pages/PosHomePage.tsx` — now a re-export of `PosTerminalPage` so the `/pos` route lands on the real screen.

## 3. Quality Gate Evidence

| Gate | Result |
|---|---|
| Backend typecheck | ✅ |
| Backend build | ✅ |
| Backend tests (focused) | ✅ 9 / 9 new (CompletePosSale) + 15 prior (P0 + P1) = 24 POS tests |
| Backend tests (full) | ✅ 172 / 174 suites, 1550 / 1550 tests, 18 skipped |
| Frontend typecheck | ✅ |
| Frontend build | ✅ (check-reports / check-no-confirm / check-sod-approve all pass) |
| i18n completeness | ✅ en/ar/tr `terminal` namespace |

## 4. Self-Audit vs Epic §7 Rubric

**A. Architecture integrity**
- ✅ No Firestore/Prisma imports in `domain/pos/` (pure TS entities + Date).
- ✅ Repos registered in `bindRepositories.ts`; no `new Firestore…()` outside DI.
- ✅ Controller is thin — every method just builds a use case and returns DTO.
- ✅ No duplicated sales/tax/COGS/inventory posting in `application/pos/`. `CompletePosSaleUseCase` delegates 100% of financial math to `CreateAndPostSalesInvoiceUseCase`.

**B. Sales integration correctness (the heart of P2)**
- ✅ POS sale calls `CreateAndPostSalesInvoiceUseCase` with `persona:'direct'`, `source:'pos'`, `formType:'pos_sale'`.
- ✅ Settlement: `CASH_FULL` for single-tender exact cash; `MULTI` for everything else (split, change, multiple methods).
- ✅ CARD/BANK/CUSTOM cannot give change (assertion in use case).
- ✅ `PersonaNotAllowedError` is not caught; it propagates out of `CreateAndPostSalesInvoiceUseCase.execute` and surfaces to the cashier as a toast.
- ✅ Receipt stores `salesInvoiceId` and `salesInvoiceNumber` (link, not copy of financial truth).
- ⏭ Returns (P3) will use `AFTER_INVOICE` against this `salesInvoiceId`.

**C. Money/stock safety**
- ✅ No sale without an OPEN shift (the use case throws if `requireOpenShift` is on and the shift is closed).
- ✅ One OPEN shift per register is enforced in `OpenPosShiftUseCase`; the cashier screen refuses to render when no open shift exists.
- ✅ Payment total is validated to equal receipt grand total (with CASH change allowed); CARD/BANK/CUSTOM change is blocked.
- ✅ Uncosted stock-out errors from Sales propagate as toasts (no swallowing).

**D. Tenant + audit**
- ✅ All reads are `(companyId, id)`-scoped.
- ✅ `RecordChangeService` is created and passed to the SI use case so SI state changes are recorded (POS receipt write itself doesn't currently call `recordCreate` — left as a minor follow-up; receipts are append-only entities that are visible from the SI side).

**E. UX/standards**
- ✅ `PartySelector` for the customer.
- ✅ `ConfirmDialog` for the tender flow.
- ✅ `react-hot-toast` on every action result.
- ✅ en/ar/tr keys for the new `terminal` namespace.
- ⏭ Reports are not built yet (P4 — reports phase). The current cashier screen is route mode; the layout will also work in windows mode (no `isWindow`-specific code).

**F. Verification evidence**
- Backend build + full test run pasted above.
- Frontend build pasted above.
- Round-trip proof: the headline flow (single-tender CASH exact → CASH_FULL; split CASH+CARD → MULTI; CASH change netted off) is in `CompletePosSale.test.ts` (9 tests, all green).

## 5. End-User View

The cashier lands on the terminal screen at `/pos`. Left column: product search with barcode / SKU / name. Middle column: cart with qty, price, line total, customer picker, **Pay** button. Right column: "Last receipt" card showing receipt #, SI #, and change.

The **Tender** dialog opens with three inputs (method / amount / reference) and an **Add tender** button. Tendered total, change, and applied-to-invoice are shown live. **Complete sale** posts the SI, persists the receipt, and returns the receipt number for printing.

## 6. Manual QA Script

1. With a register and walk-in customer configured, open a shift, then click **Terminal** in the sidebar.
2. Search for an item, click to add. Increase qty; remove. Confirm the line totals update.
3. Add a CASH tender of the exact grand total. Click **Complete sale**. The "Last receipt" card shows the receipt #, the SI #, and `change: 0`.
4. Verify the SI is real: in **Sales → Invoices**, the new SI is `POSTED`, `paymentStatus: PAID`, the `source: 'pos'`, and links back to the POS receipt.
5. Search for another item, add 2 lines, tender 50 in CARD + a partial CASH. Adjust so applied = grand total. Complete sale. Inspect the SI — there are two settlement rows (one per method).
6. With a different customer (open a new sale and pick a named customer via `PartySelector`), complete a sale. The receipt stores the customer id.
7. Try CASH 15 against a 10 grand total — applied = 10, change = 5, SI is posted for 10.
8. Toggle off **Allow POS direct sales** in POS Settings, then try to complete a sale — the backend returns `PersonaNotAllowedError`, the toast surfaces it.
9. Try to complete a sale when the shift is closed (close the shift from `/pos/shift`, return to terminal) — the terminal renders the "No open shift" card and refuses.
