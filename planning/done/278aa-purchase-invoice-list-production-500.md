# 278aa - Purchase Invoice List Production 500 Fix

Date: 2026-06-30
Worktree: `D:\DEV2026\ERP03-unified`
Branch: `codex/unified-firestore-deploy-20260628`
Actual time: ~0.7h

## Technical Developer View

Production Purchases overview failed on `GET /tenant/purchase/invoices?status=POSTED&limit=100` with Firestore `FAILED_PRECONDITION`: the query required a composite index on `purchase_invoices(status ASC, invoiceDate DESC, __name__ DESC)`.

Changes:
- `backend/src/infrastructure/firestore/repositories/purchases/FirestorePurchaseInvoiceRepository.ts`
- `backend/src/infrastructure/firestore/repositories/sales/FirestoreSalesInvoiceRepository.ts`
- `firestore.indexes.json`
- `backend/src/tests/architecture/FirestoreIndexContracts.test.ts`

The Firestore Sales/Purchase invoice list repositories now avoid composite `orderBy` queries when equality filters are present. They read through the equality filters, hydrate domain invoices, sort by `invoiceDate` descending in backend memory, then apply `limit`. This removes the live dependency on the missing composite index for dashboard/list filtered reads while keeping newest-first API behavior.

The Firestore index file and guard test were also updated with the exact `__name__ DESC` tiebreaker requested by production, so a later clean index deployment can still create the composite index.

## End-User View

The Purchases overview should no longer show an HTTP 500 error when loading posted purchase invoices. Recent purchase invoices and KPI cards can load again from the live backend.

## Accounting / ERP Impact

No posting, voucher, tax, inventory costing, AP, AR, settlement, ledger, tenant isolation, or financial report calculation changed. This is a backend read-query reliability fix only. Invoice ordering remains newest first.

## Verification

- Production logs confirmed the original failure: `FAILED_PRECONDITION` on `/api/v1/tenant/purchase/invoices?status=POSTED&limit=100`.
- `npm --prefix backend run typecheck` passed.
- `npm --prefix backend test -- --runTestsByPath src/tests/architecture/FirestoreIndexContracts.test.ts --runInBand` passed.
- `npm --prefix backend run build` passed.
- `firebase deploy --project erp-03 --only functions` completed successfully.
- Post-deploy logs showed startup validation complete and no new `FAILED_PRECONDITION`, purchase invoice error, or 500 in the targeted scan.

## Known Follow-Up

`firebase deploy --project erp-03 --only firestore:indexes` is still blocked on this machine by DNS resolution failure for `firestore.googleapis.com` (`getaddrinfo ENOTFOUND`). The code fix is live, but the exact composite indexes should still be deployed once the local DNS/API path is healthy.
