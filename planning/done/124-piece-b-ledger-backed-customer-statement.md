# 124 — Customer Statement Engine Reuse (Piece B)

**Status:** Complete  
**Branch:** `feat/phase-a-sales-master-data`  
**Agent:** Codex (GPT-5)  
**Date:** 2026-05-27  
**Time spent:** ~1.5h

---

## Scope delivered

Piece B moves Customer Statement from Sales-only invoice/payment math to the Accounting ledger statement engine for the customer's dedicated AR account.

---

## Technical Developer View

### Backend

1. Added `GetLedgerBackedCustomerStatementUseCase` in `backend/src/application/sales/use-cases/ReceivablesReportingUseCases.ts`.
2. The use case:
   - loads the customer Party,
   - requires `Party.defaultARAccountId`,
   - delegates balances and lines to `GetAccountStatementUseCase`,
   - enriches each ledger row from accounting voucher metadata,
   - returns `CUSTOMER_AR_ACCOUNT_MISSING` with HTTP 412 when the customer account is missing,
   - keeps open Sales Orders as optional disclosure only.
3. Updated `SalesReportingController` to use the ledger-backed use case.
4. Added route alias:
   - `GET /tenant/sales/customers/:partyId/statement`
5. Added focused tests:
   - `backend/src/tests/application/sales/LedgerBackedCustomerStatement.test.ts`

### Frontend

1. Updated `salesReportingApi` DTOs for ledger-backed statement rows:
   - voucher metadata,
   - source document metadata,
   - credit/refund/adjustment line types,
   - optional open commitments.
2. Updated `CustomerStatementPage`:
   - calls the ledger-backed statement endpoint,
   - supports optional **Include open commitments**,
   - keeps commitments out of balances,
   - adds row actions for source document and accounting voucher drill-down.

### Documentation

1. Updated `docs/architecture/sales.md`.
2. Updated `docs/user-guide/sales/customer-statement.md`.
3. Linked the guide from `docs/user-guide/sales/README.md`.

---

## End-User View

Customer Statement now behaves like a standard ERP statement:

1. The balance comes from posted accounting ledger entries for the customer's AR account.
2. Invoices, payments, credit notes, refunds, and adjustments can all appear when they affected the customer ledger.
3. Draft or unposted documents do not affect the financial statement.
4. Open Sales Orders can be shown separately as commitments, but they do not change the balance.
5. Users can drill down from each line to the original Sales document or to the Accounting voucher.

---

## Verification

- `npm --prefix backend test -- --runInBand backend/src/tests/application/sales/LedgerBackedCustomerStatement.test.ts` passed.
- `npm --prefix backend run build` passed.
- `npm --prefix frontend run typecheck` passed.

---

## Acceptance criteria met

- [x] Customer Statement resolves the customer AR account from `Party.defaultARAccountId`.
- [x] Missing AR account returns a clear 412-compatible domain error.
- [x] Statement balances and rows come from `GetAccountStatementUseCase`.
- [x] Rows are decorated with source document and voucher context.
- [x] Frontend supports business-document and accounting-voucher drill-down.
- [x] Open commitments are optional and excluded from financial balances.

---

## Remaining follow-up

- Mirror the same ledger-backed pattern for Vendor Statement once Purchases parity work starts.
- Decide later whether the legacy `/reports/customer-ledger` invoice/payment event endpoint should be removed or redirected.
