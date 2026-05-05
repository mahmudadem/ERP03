# Sales Default Form Lookup Fix

**Date:** 2026-05-01  
**Agent:** Codex (CTO Mode)  
**Estimate:** 45 min  
**Actual:** 0.4h  
**Status:** Done for lookup blocker; initializer Forms-selection remains as follow-up.

## What Changed

- `frontend/src/modules/tools/pages/DynamicDocumentPage.tsx`
  - Added backend voucher-forms API fallback when resolving dynamic Sales/Purchase form routes.
  - Merged API forms with direct module Firestore forms so auto-created defaults and manually cloned forms both resolve.
  - Matched forms by `id`, `code`, `formType`, `baseType`, and `typeId`.
  - Normalized module names before filtering.
- `frontend/src/api/voucherFormApi.ts`
  - Added `voucherType` and `persona` fields to the response type.
- Detour fixes needed for frontend build verification:
  - `frontend/src/modules/accounting/components/VoucherWindow.tsx`
  - `frontend/src/modules/super-admin/templates/TemplatesPage.tsx`

## Technical Developer View

The sidebar uses the backend `voucherFormApi.list()` flow, which can see server-created default forms. `DynamicDocumentPage` was resolving the route by reading directly from the module Firestore path only. That made manually cloned forms work, because clones are written through the frontend Forms Designer path, while initializer-created forms could still fail with "Document form not found."

The page now uses the direct module read plus the same backend voucher-forms API source used by the sidebar. This keeps existing clone behavior intact while making initializer/sync-created forms resolvable by UUID or semantic identifiers.

## End-User View

When a company opens a Sales or Purchase form from the sidebar, the page should now open normally whether the form was installed automatically during setup or manually cloned later. Users should no longer need to clone a default form just to make it accessible.

## Verification

- `npm run build` in `frontend/` passes.

## Follow-Ups

- Add an explicit Forms-selection step to module initializers so companies install only the document forms they intend to use.
- Manual browser QA still needed on the reported route: `/sales/44df17b8-ccc2-497b-82a4-55cc27987d97`.
