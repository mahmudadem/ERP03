# 09 — Bank Reconciliation (Completed)

## Scope
Implemented full bank reconciliation workflow: bank statement import (CSV/OFX), auto/manual matching to ledger, reconciliation summary with completion, and optional adjustment entries. Added UI for users to upload statements, review matches, and finalize.

## What was built
- **Domain**: New `BankStatement` and `Reconciliation` entities with repository interfaces.
- **Repositories**: Firestore implementations for bank statements and reconciliations; ledger repo gains unreconciled query and mark-as-reconciled helpers.
- **Use Cases**: `BankReconciliationUseCases` handles import/parsing (CSV & OFX), auto-match (amount + date/ref), manual match, and completion (marks ledger entries, records adjustments).
- **API**: Endpoints under `/tenant/accounting/*` for import, listing statements, fetching reconciliation, manual match, and completion.
- **Frontend**: New Bank Reconciliation page (upload + split view + manual match + summary) and route.
- **Tests**: Jest unit test covering auto-match by amount/date.

## How to use (happy path)
1. Go to **Accounting → Reports → Bank Reconciliation**.
2. Pick a bank/cash account.
3. Upload a CSV/OFX bank file (first row headers for CSV). System auto-matches obvious lines.
4. For remaining lines, choose matching ledger entries from the dropdown.
5. Click **Complete Reconciliation** to lock matches and flag ledger entries as reconciled.

## Notes & assumptions
- CSV mapping defaults to columns: `date, description, amount, reference, balance`; custom map keys supported.
- OFX parsing supports core `<STMTTRN>` tags (DTPOSTED, TRNAMT, FITID, NAME/MEMO).
- Adjustment entries: optional; if provided with debit/credit account IDs they create a posted journal voucher and ledger impact.
- Ledger entries are marked reconciled only at completion.

## Verification
- Automated: `npm test -- --runTestsByPath src/tests/application/accounting/use-cases/BankReconciliationUseCases.test.ts`
- Manual (suggested): import sample CSV, review auto-matches, manually match remaining, add a bank fee adjustment, and complete; ensure ledger entries show reconciled.
