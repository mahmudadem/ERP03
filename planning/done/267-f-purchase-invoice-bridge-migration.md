# Task 267-F — Purchase Invoice Bridge Migration

**Date:** 2026-06-25
**Branch:** `codex/267-system-core-boundary-audit`
**Slice:** Purchases / Purchase Invoice document voucher path.

## What Changed

`PostPurchaseInvoiceUseCase` no longer holds a direct `SubledgerVoucherPostingService` dependency for document voucher posting. Purchase Invoice document vouchers now route through `IAccountingBridge` only:

- Removed the posting-service import, field, and constructor dependency from `PostPurchaseInvoiceUseCase`.
- Made `accountingBridge` required for posting.
- Changed the document-voucher poster to `new SubledgerDocumentPoster(undefined, this.accountingBridge)`.
- Updated `PurchaseController.postPI` and the shared PI builder to pass `buildAccountingBridge(true)` explicitly.
- Kept settlement payment voucher construction unchanged, but now calls `accountingBridge.recordPreBuiltVoucher(...)` directly. The existing `PostingGateway` remains only inside the full-mode `postFull` closure.
- Kept `UnpostPurchaseInvoiceUseCase` on a narrow local voucher-deletion interface for reversing an already-posted PI; the post path is bridge-only.

## Golden Tests

New `PurchaseInvoiceGoldenVoucher.test.ts` pins:

- Exact service-PI Expense/Tax/AP voucher output sent to the bridge: account ids, sides, base/doc amounts, currency, source metadata, reference, and voucher id linking.
- `createAccountingEffect=false`: no bridge event and no GL voucher link.
- Output stability across repeated runs.

## Files Touched

| File | Change |
|---|---|
| `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts` | Removed posting-service fallback from document voucher path; required bridge; settlement calls `recordPreBuiltVoucher` directly |
| `backend/src/api/controllers/purchases/PurchaseController.ts` | `postPI` and shared builder pass bridge directly |
| `backend/src/tests/application/purchases/PurchaseInvoiceGoldenVoucher.test.ts` | New golden voucher-output tests |
| `backend/src/tests/application/purchases/PurchasePostingUseCases.test.ts` | Existing PI constructions wired with `LegacyAccountingBridgeAdapter` |
| `backend/src/tests/application/purchases/PurchaseInvoiceSettlementPosting.test.ts` | Existing settlement helper wired with `LegacyAccountingBridgeAdapter` |
| `backend/src/tests/architecture/SystemCoreBoundaries.test.ts` | New 267-F PI guard |
| `docs/architecture/accounting.md` | Added PI migration notes |
| `docs/architecture/system-core.md` | Updated bridge-migration scope note |
| `docs/architecture/module-boundaries.md` | Updated FUP-3 migrated/remaining paths |
| `docs/architecture/posting-log.md` | Updated PI row |

## Verification

```
npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchaseInvoiceGoldenVoucher.test.ts
-> 3/3 PASS

npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchaseInvoiceSettlementPosting.test.ts
-> 5/5 PASS

npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchasePostingUseCases.test.ts
-> 22/22 PASS

npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts
-> 22/22 PASS

npm --prefix backend run build
-> tsc clean

git diff --check
-> no whitespace errors (CRLF normalization warnings only)
```

## Accounting / Control Impact

No accounting-output change intended. The Purchase Invoice document voucher remains the same Expense/Inventory/Tax/AP subledger voucher. Settlement payment math and voucher construction are unchanged; the bridge now owns the full-vs-minimal decision. When the Accounting Engine is not initialized, minimal mode records no GL voucher id.

## Technical Developer View

The use case now has a compile-time required bridge dependency for document voucher posting. Existing tests that assert full-mode voucher persistence use `LegacyAccountingBridgeAdapter` so they continue exercising the same `SubledgerVoucherPostingService` behavior through the bridge boundary. `PostingGateway` is intentionally not banned in this slice because Purchase Invoice settlement still uses it inside the full-mode callback handed to `recordPreBuiltVoucher`.

## End-User View

No user-facing change. Posting a Purchase Invoice behaves the same, including vendor balance, stock/cost updates, taxes, and optional settlement. Internally, the Purchase Invoice financial event now uses the accounting bridge as the single posting decision point.
