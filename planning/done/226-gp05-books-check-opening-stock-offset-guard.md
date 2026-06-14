# GP05 Books Check and Opening Stock Offset Guard

**Date:** 2026-06-14  
**Status:** Code guard fixed; GP05 remains blocked on current TESTCO data  
**Time spent:** ~1.1h

## Summary

GP05 was run against TESTCO (`cmp_mqblxfqy_zmecyl`) using the local emulator data. The cross-module books are not green on this tenant because inventory and P&L are contaminated by older bad test data. During the check, a real accounting-control gap was found and fixed: Opening Stock allowed users to choose COGS, ordinary liabilities, or even the same Inventory Asset account as the offset account.

The backend now requires Opening Stock accounting-effect vouchers to offset only to an active posting EQUITY account, such as Opening Balance Equity or retained earnings, and rejects inventory self-offsets.

## Technical Developer View

### What Changed

- `backend/src/application/inventory/use-cases/OpeningStockDocumentUseCases.ts`
  - Added an Opening Stock offset validation helper.
  - Draft preparation validates that the selected opening balance account is `EQUITY`.
  - Posting validates that the selected opening balance account is `EQUITY`.
  - Posting rejects any line where the Inventory Asset account equals the opening balance offset account.

- `backend/src/tests/application/inventory/OpeningStockDocumentUseCases.test.ts`
  - Updated existing account mocks to classify the normal opening balance account as `EQUITY`.
  - Added regression coverage for rejecting a COGS / expense offset account.
  - Added regression coverage for rejecting Inventory Asset self-offset.

- `docs/architecture/inventory.md`
  - Documented the Opening Stock accounting-effect rule and why the offset must be equity.

- `docs/user-guide/inventory/README.md`
  - Added plain-language guidance for users choosing the Opening Stock offset account.

- `planning/qa/findings.md`
  - Logged GP05 pass/fail results and the blocking reconciliation failures.

- `planning/ACTIVE.md` and `planning/JOURNAL.md`
  - Updated current status, next gate, and handoff notes.

### Accounting Impact

Opening Stock introduces beginning inventory value. Market-standard ERP behavior posts this against an opening balance equity / retained earnings style account. Posting it to COGS distorts profit; posting it to Inventory itself creates a balanced voucher with no GL control effect while the stock sub-ledger carries value. Both cases produce misleading financial statements.

This fix prevents new bad postings. It does not repair existing TESTCO historical data.

## End-User View

When creating Opening Stock with accounting effect enabled, users must choose an Opening Balance Equity / retained earnings style account as the offset account. They cannot choose Inventory, Cost of Goods Sold, revenue, AP, AR, or other ordinary balance sheet accounts.

This keeps the starting inventory value out of profit and loss and keeps the Inventory GL control account meaningful.

## GP05 Result

Pass:

- Trial Balance balances: Dr 19,498.01 = Cr 19,498.01.
- Balance Sheet equation balances.
- AR ties at 328.00.
- AP ties to the vendor debit-note position: ledger Dr 47.50 equals Vendor Statement / AP Aging -47.50.
- GRNI is zero.
- SI-00001 posting log exists.
- SI-00001 audit trail has create/post entries with user and timestamp.

Fail / blocked:

- P&L is distorted because old Opening Stock vouchers credited COGS. Account 50100 has a credit balance of -164.97.
- Inventory GL reconciliation fails: stock valuation 13,887.43 vs Inventory GL 592.47, drift 13,294.96.
- TESTCO still contains old data residue: legacy item `001` value drift, pre-fix PI-00001 duplicate receipt residue, and historical opening-stock offset mistakes.
- Idempotency replay was not run because the dataset is already blocked by reconciliation failures.

## Verification

Passed:

```powershell
npm --prefix backend test -- --runInBand backend/src/tests/application/inventory/OpeningStockDocumentUseCases.test.ts
npm --prefix backend run build
npm --prefix backend test -- --runInBand backend/src/tests/application/inventory
```

## Acceptance Criteria

- Opening Stock cannot offset to COGS or other P&L accounts: met.
- Opening Stock cannot offset Inventory to itself: met.
- Existing valid equity-offset Opening Stock flow still passes tests: met.
- GP05 can be declared green on TESTCO: not met.

## Known Issues and Follow-Ups

1. Rerun GP01-GP05 on a fresh tenant after PR #9 and this guard are merged.
2. If preserving TESTCO matters, create a controlled data repair / inventory revaluation plan before using it as a ship gate.
3. Backlog 223 remains the right post-pilot path for value-only stock revaluation where quantity is correct but value is wrong.
