# 126 — Delete dead GetCustomerLedgerUseCase (QA Finding #3 closed)

**Status:** ✅ DONE
**Date:** 2026-05-28
**Branch:** `feat/phase-a-sales-master-data`
**Resolves:** [Finding #3 in report 121](./121-phase-c-qa-results.md) — Customer Statement + Full Ledger omit sales-return / credit-note events.

## What QA found

Finding #3 reported that the Customer Statement and Full Ledger views did not display sales-return credit-note events, so closing balances overstated what the customer owed by the credit-note amount (30 in SYCO).

## Investigation

QA's diagnosis pinned the bug to `_buildRawEvents` inside `GetCustomerLedgerUseCase`, which only queried invoices + payments. That was accurate for the legacy code path. However, by the time Finding #3 was triaged, that code path was already obsolete:

- **Customer Statement** had been migrated to `GetLedgerBackedCustomerStatementUseCase` (report 124), which reads directly from the accounting ledger via `Party.defaultARAccountId`.
- Sales-return posting writes the AR credit to `customer.defaultARAccountId` through the accounting engine (`SalesReturnUseCases.resolveARAccount`).
- Therefore credit notes already flow into the Customer Statement automatically through real GL entries — no application-layer query needed.
- The "Full Ledger" mentioned in the finding (`GET /tenant/sales/reports/customer-ledger`) was an unused legacy endpoint. Frontend never consumed `salesReportingApi.getCustomerLedger`; no page imported `CustomerLedgerDTO`.

## Decision

Delete the dead path instead of patching it. This matches the Phase F cleanup pattern (report from 2026-05-27 already removed the parallel legacy `GetCustomerStatementUseCase` for the same reason). The ledger-backed Customer Statement is the single source of truth for customer AR history.

An earlier attempt in this session patched `_buildRawEvents` to query sales returns; that patch has been fully reverted in favor of deletion.

## What was removed

- `GetCustomerLedgerUseCase` class
- `CustomerLedger` interface
- `CustomerLedgerInput` interface
- Internal `RawEvent` type
- `SalesReportingController.getCustomerLedger` handler
- `GET /tenant/sales/reports/customer-ledger` route
- `salesReportingApi.getCustomerLedger` frontend client method
- `CustomerLedgerDTO` frontend type
- `GetCustomerLedgerUseCase` test block in `ReceivablesReporting.test.ts` (kept the 6 AR Aging tests)

## Verification

- `cd backend && npx jest src/tests/application/sales/ReceivablesReporting.test.ts` → **6/6 passed**
- Backend `tsc --noEmit` — clean on all touched files (pre-existing unrelated errors remain in `tests/integration/*`, `verify-phase3.ts`, designer-engine, scripts).
- Frontend `tsc --noEmit` — clean on all touched files.

## Files changed

- `backend/src/application/sales/use-cases/ReceivablesReportingUseCases.ts` — removed `GetCustomerLedgerUseCase` and its types.
- `backend/src/api/controllers/sales/SalesReportingController.ts` — removed `getCustomerLedger` handler + import.
- `backend/src/api/routes/sales.routes.ts` — removed `/reports/customer-ledger` route.
- `backend/src/tests/application/sales/ReceivablesReporting.test.ts` — removed `GetCustomerLedgerUseCase` describe block and its helpers.
- `frontend/src/api/salesReportingApi.ts` — removed `CustomerLedgerDTO` + `getCustomerLedger`.

## Manual QA (smoke)

1. Open Sales → Reports → Customer Statement for a customer with a POSTED sales return settled as `CREDIT_NOTE`.
2. Confirm the credit-note row appears in the ledger view (it comes from the accounting ledger directly).
3. Confirm closing balance ties to the "Open Invoices" outstanding total.
