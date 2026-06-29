# 278a — Production ledger statement indexes

**Status:** Ready for commit and production deployment  
**Estimated time:** 2–4 hours  
**Actual time:** approximately 0.5 hour

## Technical developer view

Production vendor statements returned HTTP 500 from
`FirestoreLedgerRepository.getAccountStatement`. The query filters the tenant ledger by
account, posted state, and date, but the deployed index manifest did not define the required
`ledger` composite indexes.

Changed:

- `firestore.indexes.json` — added posted and include-unposted ledger query indexes.
- `backend/src/tests/architecture/FirestoreIndexContracts.test.ts` — added a regression
  contract for both indexes.
- `docs/architecture/accounting.md` — documented the Firestore query/index dependency.
- `docs/user-guide/accounting/account-statements.md` — documented user recovery behavior.

Accounting impact: no entries, vouchers, balances, tenant boundaries, or posting rules were
changed. The fix only makes existing tenant-scoped ledger queries executable.

## End-user view

Account, customer, and vendor statements can load existing ledger movements again after the
indexes are deployed. Users must not recreate invoices or vouchers; refreshing and rerunning
the statement is sufficient.

## Verification

- Focused architecture test: 2/2 passed.
- Backend TypeScript build: passed.

## Acceptance criteria

- Posted statements have a matching composite index.
- Include-unposted statements have a matching composite index.
- An automated test blocks accidental index removal.
