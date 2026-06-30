# 278c — Purchase invoice query index

**Status:** Ready for commit; deployment deferred until all production fixes finish  
**Estimated time:** 0.5–1 hour  
**Actual time:** approximately 0.3 hour

## Technical developer view

The Purchase dashboard requests posted purchase invoices. The Firestore
repository filters by `status` and orders by `invoiceDate`, but the production
index manifest only contained the equivalent Sales index.

Changed:

- Added `purchase_invoices: status ASC, invoiceDate DESC` to
  `firestore.indexes.json`.
- Extended `FirestoreIndexContracts.test.ts`.
- Documented the Purchases query/deployment contract.

Accounting impact: retrieval only. No invoice, AP balance, ledger entry, tax,
stock valuation, or tenant boundary changes.

## End-user view

Posted purchase invoices can load on the Purchases dashboard and Purchases
analytics after the final index deployment. Existing invoices do not need to
be recreated.

## Verification

- Firestore index contract and System Core boundaries: 32/32 passed.
- Backend TypeScript build: passed.

## Acceptance criteria

- The exact repository query has a deployed-manifest index.
- Automated architecture coverage prevents accidental removal.
- Production deployment remains deferred until the full fix queue is complete.
