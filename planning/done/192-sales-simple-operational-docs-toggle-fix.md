# 192 - Sales Simple Mode Operational Documents Toggle Fix

**Date:** 2026-06-08
**Agent:** Codex
**Time spent:** ~0.5h

## Technical Developer View

Fixed the Sales Settings toggle **Show Sales Orders & Delivery Notes anyway** so it is included in the existing Sales Settings save flow. Added regression coverage proving the backend saves the flag and maps it back through the settings DTO.

Files changed:

- `frontend/src/modules/sales/pages/SalesSettingsPage.tsx` - includes `showOperationalDocsInSimple` in the save payload.
- `backend/src/tests/application/sales/SalesSettingsUseCases.test.ts` - adds regression coverage for saving and returning the Simple-mode operational documents visibility flag.
- `docs/architecture/sales.md` - documents that the flag is UI/workflow visibility only.
- `docs/user-guide/sales/README.md` - explains the setting to end users.

## End-User View

In Sales Settings, admins can keep the company in **Simple** workflow and still show **Sales Orders** and **Delivery Notes** when those forms are needed occasionally. Saving the setting now keeps the checkbox selected and allows the related pages to remain visible.

This does not change accounting behavior. Invoices, taxes, inventory valuation, posting controls, approvals, period locks, and ledger entries continue to follow the existing Sales rules.

## Verification

- `npm --prefix backend test -- --runInBand backend/src/tests/application/sales/SalesSettingsUseCases.test.ts` passed.
- `npm --prefix frontend run typecheck` passed.
- `npm --prefix backend run build` passed.
- `graphify update .` was attempted but failed because `graphify` is not installed/available in this PowerShell environment.

## Follow-Ups

- Manual QA: open `Sales -> Settings`, enable **Show Sales Orders & Delivery Notes anyway** while in Simple mode, save, reload, and confirm the checkbox plus Sales Orders/Delivery Notes menu visibility persist.
