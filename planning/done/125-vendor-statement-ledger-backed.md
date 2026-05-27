# 125 — Vendor Statement Ledger-Backed AP Report

**Status:** Complete  
**Branch:** `feat/phase-a-sales-master-data`  
**Agent:** Codex (GPT-5)  
**Date:** 2026-05-27  
**Time spent:** ~1.4h

---

## Scope delivered

This task mirrors the Customer Statement ledger-backed model for Purchases by adding a Vendor Statement report over each vendor's dedicated AP account.

---

## Technical Developer View

### Backend

1. Added `GetLedgerBackedVendorStatementUseCase`:
   - `backend/src/application/purchases/use-cases/PurchasesReportingUseCases.ts`
2. The use case:
   - loads the vendor Party,
   - requires `Party.defaultAPAccountId`,
   - calls Accounting `GetAccountStatementUseCase`,
   - decorates ledger rows from voucher metadata,
   - normalizes AP credit-balance sign into positive amount owed for statement display,
   - returns optional open Purchase Orders as non-balance commitments.
3. Added endpoints:
   - `GET /tenant/purchase/reports/vendor-statement`
   - `GET /tenant/purchase/vendors/:partyId/statement`
4. Added focused tests:
   - `backend/src/tests/application/purchases/LedgerBackedVendorStatement.test.ts`

### Frontend

1. Extended `purchasesApi` with Vendor Statement DTOs and `getVendorStatement`.
2. Added report page:
   - `frontend/src/modules/purchases/pages/VendorStatementPage.tsx`
3. Added route and menu entry:
   - `/purchases/reports/vendor-statement`
   - Purchases -> Reports -> Vendor Statement
4. The page uses shared controls:
   - `ReportContainer`
   - `PartySelector` with `role="VENDOR"`
   - shared `DatePicker`

### Documentation

1. Updated `docs/architecture/purchases.md`.
2. Added `docs/user-guide/purchases/vendor-statement.md`.
3. Updated `docs/user-guide/purchases/README.md`.

---

## End-User View

Users can now run a Vendor Statement from Purchases. The report shows posted AP activity for a selected vendor:

- bills increase what the company owes,
- payments reduce what the company owes,
- purchase returns/debit notes reduce what the company owes,
- adjustments show when a manual voucher affects the vendor AP account.

Open Purchase Orders can be displayed separately as commitments, but they do not change the financial balance.

---

## Verification

- `npm --prefix backend test -- --runInBand backend/src/tests/application/purchases/LedgerBackedVendorStatement.test.ts` passed.
- `npm --prefix backend run build` passed.
- `npm --prefix frontend run typecheck` passed.

---

## Acceptance criteria met

- [x] Vendor Statement resolves the AP account from `Party.defaultAPAccountId`.
- [x] Missing AP account returns a clear 412-compatible domain error.
- [x] Statement balances and rows come from `GetAccountStatementUseCase`.
- [x] AP balances display as positive amount owed.
- [x] Rows are decorated with Purchases source document and voucher context.
- [x] Frontend supports source-document and accounting-voucher drill-down.
- [x] Open Purchase Orders are optional and excluded from financial balances.

---

## Remaining follow-up

- Build AP Aging and Purchases analytics reports later in Phase F if needed.
- Decide whether Purchases should also get a vendor-ledger alias separate from statement mode.
