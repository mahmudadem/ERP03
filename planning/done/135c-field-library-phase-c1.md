# Completion Report: 135c — Field Library Phase C1

Phase C1 of [task 135](../tasks/135-field-component-library.md). This slice wires Forms Management to consume the tenant-resolved Field Library catalog while deliberately preserving the current form persistence model and mandatory-field semantics.

## Technical Developer View

### What changed
- Mounted the existing designer routes at `/tenant/designer`, making `GET /tenant/designer/field-library` reachable from the tenant app.
- Added `frontend/src/api/fieldLibraryApi.ts` as the tenant read-only Field Library client.
- Updated `VoucherDesignerPage.tsx` so the Forms Management wizard builds its field picker from the Field Library response.
- Kept the legacy module field IDs as a temporary compatibility allowlist until Layer 2 voucher-type bindings become authoritative in C2.
- Save canonicalization now receives the active field catalog instead of only the generic system fields.
- Corrected the C1 compatibility mapper so module-wide legacy mandatory flags do not make unrelated Sales/Purchase fields required on every form. Required status now remains voucher-template-owned in this slice.

### Guardrails kept
- No posting, voucher, ledger, tax, AR/AP, AP/AR aging, inventory valuation, or payment logic changed.
- Existing form documents still save as full snapshots (`headerFields`, `tableColumns`, `uiModeOverrides`); no differential model yet.
- Existing module-specific required/optional behavior remains in force. C1 does not allow Field Library de-duping side effects to make fields mandatory in the wrong module.
- Existing line-table IDs are preserved so opening/saving a form does not silently drop columns such as `warehouseId`.
- BODY/layout fields are kept out of the header field picker, avoiding duplicate `Line Items Table` entries.

### Files added
- `frontend/src/api/fieldLibraryApi.ts`

### Files changed
- `backend/src/api/server/tenant.router.ts`
- `frontend/src/modules/shared/pages/VoucherDesignerPage.tsx`
- `docs/architecture/document-forms-plan.md`
- `docs/user-guide/forms-management.md`
- `planning/ACTIVE.md`
- `planning/PRIORITIES.md`
- `planning/QA-QUEUE.md`
- `planning/JOURNAL.md`

## End-User View

Forms Management still looks and works the same. The difference is behind the scenes: the field picker now reads from the platform Field Library instead of only from hardcoded frontend constants. When the super-admin updates a field's label or renderer type in the Field Library, company admins see that updated field metadata the next time they open Forms Management.

This phase does not change which financial fields are required. Required fields remain protected so users cannot accidentally remove data needed for posting, reporting, inventory movements, receivables, payables, or audit trails.

## Verification
- `npm --prefix backend run build` → passed.
- `npm --prefix frontend run typecheck` → passed.
- `npm --prefix frontend run build` → passed.
- `git diff --check` → passed.
- Browser smoke against `http://127.0.0.1:5173/sales/tools/voucher-designer` → app rendered and redirected to the unauthenticated landing page without new console errors. Auth-gated Forms Management interaction still needs manual QA with a signed-in company user.

## Known limits / next step
- Phase C1 still uses compatibility field ID lists because true Layer 2 voucher-type field bindings are not live yet.
- Phase C2 should move the super-admin voucher template editor to pick from the Field Library and make type-level placement/mandatory rules authoritative.
- `fieldVersionsSeen` and the drift audit page are not included in C1.

## Time spent

Actual: ~1.9h.
