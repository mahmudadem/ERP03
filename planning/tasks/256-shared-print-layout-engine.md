# Task 256 — Shared Print Layout Engine and Designer

**Status:** V1 implemented locally
**Started:** 2026-06-22
**Owner goal:** create a full shared print layout designer engine, always available at company level, consumed by POS/Sales/other modules.

## Architecture Decision

This is a shared engine, not a POS or Sales feature. Modules consume it by document type and approved data schema.

## V1 Delivered Scope

- `IPrintLayoutCore` contract under System Core.
- `PrintLayoutCore` with default layouts and schema validation.
- Company-level template persistence under `companies/{companyId}/core/Settings/print_layouts`.
- Tenant API under `/tenant/print-layouts`.
- Tools route `/tools/print-layout-designer`.
- Canvas editor with paper area, safe area, drag/resize, fields, tables, style controls, save/load, import/export.
- POS Receipt and Sales Invoice schemas.

## Guardrails

- No custom scripts in layouts.
- Backend rejects unknown field/table bindings.
- Backend rejects components outside the paper area.
- Layout JSON is versioned.

## Remaining Follow-Ups

- Runtime renderer and print button integration for POS receipt.
- Runtime renderer and print button integration for Sales Invoice.
- PDF export/rendering path.
- QR/barcode value rendering.
- Optional richer permission model for who can edit layouts.

## Verification

- `npm test -- --runInBand src/tests/application/system-core/PrintLayoutCore.test.ts src/tests/application/print-layout/PrintLayoutTemplateUseCases.test.ts` — passed, 2 suites / 4 tests.
- `npm run build` from `backend/` — passed.
- `npm --prefix frontend run typecheck` — passed.
- `npm --prefix frontend run build` — passed with existing bundle/browser-data warnings.
