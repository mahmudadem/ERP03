# 274 — Purchase Invoice Native Header, Rail Focus, and Print Engine

**Date:** 2026-06-27  
**Branch/worktree:** `codex/pi-native-print-rail` / `D:\DEV2026\ERP03-pi-native-print-rail`  
**Status:** Complete locally, not committed  
**Estimated time:** 1.5-2.5h  
**Actual time:** ~2.0h

## Technical Developer View

### What changed

- Moved direct Purchase Invoice warehouse selection from line-level editing into the native form header, matching Sales Invoice.
- Direct PI stock lines now use the header warehouse fallback when no source warehouse exists.
- PO/GRN-linked PI lines keep source warehouse identity for traceability.
- Added rail focus state for Purchase Invoice vendor, item, and warehouse contexts.
- Added Purchase Invoice runtime printing through the shared Print Layout Engine:
  - `PrintLayoutCore` now exposes and validates a `PURCHASE_INVOICE` schema.
  - New `PrintPurchaseInvoiceUseCase` returns a read-only print payload plus saved/default layout.
  - New `GET /tenant/purchase/invoices/:id/print` endpoint resolves the engine layout.
  - The native PI page opens a browser print window from the returned layout/payload.
- Updated architecture and user documentation.

### Files changed

- `backend/src/application/system-core/print-layout/PrintLayoutCore.ts`
- `backend/src/application/purchases/use-cases/PurchaseInvoicePrintUseCases.ts`
- `backend/src/api/controllers/purchases/PurchaseController.ts`
- `backend/src/api/routes/purchases.routes.ts`
- `backend/src/tests/application/system-core/PrintLayoutCore.test.ts`
- `frontend/src/api/purchasesApi.ts`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `docs/architecture/purchases.md`
- `docs/architecture/print-layout-engine.md`
- `docs/user-guide/purchases/purchase-invoice-native-form.md`
- `docs/user-guide/purchases/README.md`

### Accounting / ERP impact

No posting math changed.

This does not change AP posting, purchase tax treatment, recoverable/non-recoverable tax, inventory receipt valuation, average cost, settlement, approval, period lock, unpost, return, or ledger behavior.

The warehouse change is data-entry placement only. Direct PI lines still send a warehouse to the existing backend posting path; source-linked lines keep their source warehouse.

Printing is read-only. It does not mutate invoice state or create accounting events.

## End-User View

Purchase Invoice now behaves more like Sales Invoice:

- For direct bills, choose the warehouse once in the header instead of inside every line.
- The right-side rail changes based on whether you are working on the vendor, an item, or the warehouse.
- Saved bills now have a Print action that uses the company Purchase Invoice print layout. If no layout has been saved, the system uses the built-in default.

## Verification

- `npm --prefix backend test -- --runInBand backend/src/tests/application/system-core/PrintLayoutCore.test.ts` — PASS, 4 tests.
- `npm --prefix backend run build` — PASS.
- `npm --prefix frontend run typecheck` — PASS.

## Manual QA Script

1. Open `Purchases -> Invoices -> New Bill`.
2. In Direct mode, confirm **Main Warehouse** appears in the header and the line table no longer shows an editable warehouse column.
3. Select a vendor, warehouse, and stock item. Hover/focus vendor, warehouse, and item controls; confirm the rail switches context.
4. Save the bill and reopen it. Confirm warehouse was preserved on the saved line payload.
5. Open a PO-linked Purchase Invoice. Confirm the header does not offer a direct warehouse override and source lines preserve their source warehouse.
6. Open a saved Purchase Invoice and click **Print**. Confirm a print preview window opens using the Purchase Invoice print layout.

## Known Follow-Ups

- Runtime print rendering is now implemented for Purchase Invoice only. POS/Sales runtime adoption remains separate.
- The browser print renderer is intentionally minimal and script-free; PDF generation and printer-driver integration remain future print-engine work.
