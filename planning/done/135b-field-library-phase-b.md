# Completion Report: 135b — Field Library (Phase B: super-admin editor)

Phase B of [task 135](../tasks/135-field-component-library.md). Adds the super-admin authoring surface for the Layer 1 Field Library seeded in Phase A. **No tenant-side UI changes** — the Forms Management wizard still reads from hardcoded constants. Phase C swaps the wizard onto the new read path.

## Technical Developer View

### What this phase delivers
- A new super-admin page at **`/super-admin/field-library`** that lists every entry in the seeded catalog and lets the super-admin create, edit, soft-deprecate, and (when safe) hard-delete entries.
- Six authoring endpoints under `/super-admin/field-library/*`, gated by `assertSuperAdmin`.
- Three application-layer use cases that centralise the policy: ID uniqueness on create, id-immutability on update, reference-safety on hard-delete.
- A typed FE API client (`superAdminFieldLibraryApi`) with the unwrap pattern used by the rest of the super-admin clients.

### Files added

| File | Purpose |
|---|---|
| `backend/src/application/designer/use-cases/FieldLibraryUseCases.ts` | `CreateFieldLibraryEntryUseCase` (id-uniqueness probe, validation), `UpdateFieldLibraryEntryUseCase` (id-immutable, validation), `DeprecateFieldLibraryEntryUseCase` (soft delete), `HardDeleteFieldLibraryEntryUseCase` (scans system voucher templates; returns `usedBy[]` on conflict). |
| `backend/src/api/controllers/super-admin/SuperAdminFieldLibraryController.ts` | Six handlers; converts use-case errors into 400/404/409 with structured messages. |
| `backend/src/api/routes/super-admin.field-library.routes.ts` | Auth + assertSuperAdmin chain; six routes (list/get/create/update/deprecate/delete). |
| `frontend/src/api/superAdmin/fieldLibrary.ts` | Typed `superAdminFieldLibraryApi` with mirrors of the backend `FieldClass`, `FieldSectionHint`, `SelectorBinding`, `FieldLibraryEntry` types. |
| `frontend/src/pages/super-admin/pages/SuperAdminFieldLibraryPage.tsx` | The page. Mirrors the layout of `SuperAdminVoucherTemplatesPage` (same shell, same table primitives, same `useSuperAdminTable` hook). Inline editor modal, delete-blocked modal, deprecated toggle. |
| `planning/done/135b-field-library-phase-b.md` | This report. |

### Files changed
- `backend/src/repository/interfaces/designer/IFieldLibraryRepository.ts` — added `getSystemEntry`, `setSystemEntryDeprecated`, `hardDeleteSystemEntry`.
- `backend/src/infrastructure/firestore/repositories/designer/FirestoreFieldLibraryRepository.ts` — implements the three new methods. `setSystemEntryDeprecated` re-routes through `upsertSystemEntry` so the version-bump + contentHash logic stays in one place; flipping `deprecated` produces a different hash and bumps version by 1.
- `backend/src/api/server/platform.router.ts` — mounted the new sub-router at `/super-admin/field-library`.
- `frontend/src/api/superAdmin/index.ts` — re-exports `fieldLibrary`.
- `frontend/src/router/routes.config.ts` — lazy-imports the page; route appears in the super-admin section of the sidebar via `requiredGlobalRole: 'SUPER_ADMIN'`.

### Decisions honored (continued from Phase A)

| Decision | Implementation in this phase |
|---|---|
| 6.1 flat namespace, enforced on insert | `CreateFieldLibraryEntryUseCase` probes `getSystemEntry(id)` before write and refuses on collision. The FE page also surfaces a real-time "ID already exists" hint while typing. ID format validated against `^[a-zA-Z_][a-zA-Z0-9_-]{1,63}$`. |
| 6.2 system tier is super-admin only | All authoring endpoints sit behind `assertSuperAdmin`. The page itself is gated by `requiredGlobalRole: 'SUPER_ADMIN'`. Phase D will add the parallel company-tier authoring surface. |
| 6.3 lazy revalidation, monotonic version, soft-delete preferred | Editor surfaces version + last-updated + by-whom in the footer of the modal. Default action on the row is **deprecate** (one click, no confirm) — hard-delete is intentionally further-clicked, with a stronger confirm dialog and the "Tip: prefer Deprecate" prompt. Hard-delete falls back to "blocked" with a `usedBy[]` list whenever any system voucher template references the field. |
| 6.4 selector binding split | When the selected `type` is one of the seven selector kinds, the editor reveals a `SelectorBinding` sub-form (`collection`, `displayField`, `valueField`). The renderer registry (code-side) is unchanged. |

### Routes added

| Method | Path | Purpose |
|---|---|---|
| GET | `/super-admin/field-library` | List all system-tier entries (sorted by id). |
| GET | `/super-admin/field-library/:id` | Single entry or 404. |
| POST | `/super-admin/field-library` | Create. 400 on validation, 400 on id collision. |
| PUT | `/super-admin/field-library/:id` | Update. 404 if missing, 400 on validation. `id`, `version`, `scope` in the body are ignored. |
| PATCH | `/super-admin/field-library/:id/deprecated` | Soft-delete toggle. Body: `{ deprecated: boolean }`. |
| DELETE | `/super-admin/field-library/:id` | Hard delete. **409 with `usedBy[]`** when referenced by a system voucher template. |

### Reference-safety gate scope (intentional limit)

Phase B's hard-delete only scans **system voucher templates** (via `getSystemTemplates()`). It does NOT scan:
- Company voucher type definitions
- Company forms (`companies/{cid}/.../voucherForms`)
- Inflight clones in someone's open wizard

Reason: a full multi-company scan is expensive, and company forms today inline the field definitions instead of referencing by id, which means a scan would have to deep-match shape — fragile. Phase C normalises form storage to `{ fieldId }` references, after which the gate can extend safely.

In the meantime, **the deprecate path is the only non-blocking deletion** for fields that *might* be referenced downstream. The UI nudges hard accordingly.

### What's NOT in this phase
- **Company custom-field authoring** — Phase D.
- **Wizard consumption** — Phase C. The page exists, edits land, but the Forms Management wizard still uses hardcoded constants. Edits are silent until C.
- **Form Library Drift audit page** — Phase B/C, depends on forms persisting `fieldVersionsSeen`.
- **Form-deep reference scan on delete** — extended in Phase C.

### Verification
- `npx tsc --noEmit` (backend): exit 0
- `npx tsc --noEmit` (frontend): exit 0

## Manual QA Script

Sign in as a SUPER_ADMIN user. From the super-admin section of the sidebar, click **Field Library**.

### 1. List + stats
- Page loads with a 4-card stat row (Total / Selectors / Custom metadata / Deprecated) and a sortable table of all 61 seeded entries.
- Click the **ID** column header → entries reorder. Same with Label, Type, Class.
- Type "warehouse" in the search box → results filter live (id/label/type/class).

### 2. Edit an existing entry
- Click the pencil on `warehouseId`. Modal opens, **ID Key is read-only** with the helper text about renaming.
- Change the Label to "Warehouse (test)" → click Save changes → row updates → version increments by 1 → re-open the row → version shows `v2`.
- Edit again, change the label back → version becomes `v3`. (No skip — every meaningful save bumps once.)

### 3. Soft-deprecate
- Click the eye-off icon on any entry → row renders with strikethrough + amber "Deprecated" badge → version increments.
- Toggle the **"Show deprecated"** checkbox above the table → entry disappears from the table.
- Re-enable show-deprecated → entry reappears.
- Click the eye-on icon → entry un-deprecates → version increments again.

### 4. Create a new entry
- Click **New Field**. Modal opens with `id`, `label`, `type`, `fieldClass = system_optional`, `sectionHint = HEADER` pre-filled.
- Type `id = warehouseId` (already exists) → "A field with this ID already exists" appears in red, Create button stays disabled.
- Change to `id = projectId`, set `type = warehouse-selector` → **Selector Binding sub-form appears**.
- Fill `collection = projects`, `displayField = name` → click Create → row appears at v1.

### 5. Hard-delete (blocked path)
- Try to delete `customerId` (referenced by the seeded sales voucher templates) → confirm the warning prompt → "Can't delete" modal appears with the **`Used by`** list of voucher type codes.
- Close it. Field is still there, unmodified.

### 6. Hard-delete (allowed path)
- Find the `projectId` you just created (no references yet) → trash icon → confirm → row disappears.

### 7. Re-run the seeder is still safe
- From `backend/`: `npx ts-node src/seeder/runSystemSeeder.ts` → Step 4 reports `0 written, N unchanged`.
- **Caveat:** any entry whose label you edited via the UI will now differ from the seeder's source. The next seeder run will revert it and bump version. This is by design for Phase B — the source of truth is moving to the UI, but the constants in `seedFieldLibrary.ts` are still authoritative for fields the seeder knows about. Phase B users who want to keep UI edits should remove the entry from the seeder's `SYSTEM_FIELDS_GENERIC` / `AVAILABLE_FIELDS_BY_MODULE` lists, or stop running the seeder on systems that have been hand-curated. A future hardening pass will add an "owned by UI" flag to suppress the seeder reset.

## End-User View

A new entry **Field Library** appears in the super-admin sidebar (super-admin users only). It lists every field the ERP knows how to render — Document Number, Customer, Warehouse, Line Items Table, and so on. From here you can:

- See the full catalog at a glance, sorted/searchable.
- Open any field to edit its label, type, classification, default section, or its selector binding.
- Soft-deprecate fields that are no longer recommended (they stay in the catalog with a strikethrough so existing forms keep working).
- Add brand-new fields without touching code or redeploying.
- Hard-delete a field only if nothing references it — otherwise the UI shows what's referencing it so you can decide what to clean up first.

This is the foundation for Phase C, where the per-module Forms Management page will start reading its available fields from here instead of from hardcoded code.

## Next steps

**Phase C** (wizard consumption) is unblocked:
- Forms Management wizard step 4 switches from `AVAILABLE_FIELDS_BY_MODULE` to `GET /tenant/designer/field-library`.
- `VoucherTemplateEditorPage` gets a "pick fields from library" affordance instead of free-typing field definitions.
- New backend use case `GetEffectiveFieldsForType(typeId)` resolves Layer 1 + Layer 2 placement metadata.
- Form persistence model migrates from inline-snapshots to `{ fieldId, overrides }` differential records (decision 6.3 substrate for lazy revalidation).
- `fieldVersionsSeen[]` lands on form configs, drift audit page lands on super-admin.

Estimate: 6-8 hours, possibly split into C1 (wizard read) and C2 (template-editor cascade + drift audit).
