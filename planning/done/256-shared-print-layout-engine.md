# Task 256 — Shared Print Layout Engine and Designer

**Date:** 2026-06-22
**Status:** V1 implemented locally
**Actual time:** ~2.75h

## Technical Developer View

Implemented a company-level always-on print layout engine.

Files added/changed:

- `backend/src/application/system-core/contracts/IPrintLayoutCore.ts`
- `backend/src/application/system-core/print-layout/PrintLayoutCore.ts`
- `backend/src/domain/print-layout/PrintLayoutTemplate.ts`
- `backend/src/repository/interfaces/print-layout/IPrintLayoutTemplateRepository.ts`
- `backend/src/infrastructure/firestore/repositories/print-layout/FirestorePrintLayoutTemplateRepository.ts`
- `backend/src/application/print-layout/PrintLayoutTemplateUseCases.ts`
- `backend/src/api/controllers/print-layout/PrintLayoutController.ts`
- `backend/src/api/routes/print-layout.routes.ts`
- `frontend/src/api/printLayoutApi.ts`
- `frontend/src/modules/tools/print-layout/PrintLayoutDesignerPage.tsx`
- `frontend/src/router/routes.config.ts`
- `frontend/src/config/moduleMenuMap.ts`

The engine validates layout JSON, paper bounds, allowed data bindings, and table behavior settings. The designer supports paper presets, safe-area display, drag/resize, dynamic fields, a bill-table component, table header colors, row height, long-bill overflow behavior, styling, save/load, and import/export.

## End-User View

Company admins can open **Tools -> Print Layout Designer** and build print layouts visually. They can choose paper type, place fields and bill tables, resize components, change styling, save defaults, and export/import layout JSON.

The layout designer is shared. It is intended for POS receipts, Sales Invoices, and future module documents.

For long bills, admins can choose whether the table continues to another page or longer receipt, clips extra rows, or shrinks rows to fit. They can also repeat table headers after page breaks.

## Verification

- Focused backend print-layout tests passed.
- Backend build passed.
- Frontend typecheck passed.
- Frontend production build passed with existing bundle/browser-data warnings.

## Known Follow-Ups

- Connect POS receipt print action to saved layouts.
- Connect Sales Invoice print action to saved layouts.
- Add PDF generation/export.
- Add real QR/barcode rendering.
