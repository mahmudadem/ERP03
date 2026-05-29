# Completion Report: 135a — Field Library (Phase A: seed + read API)

Phase A of [task 135](../tasks/135-field-component-library.md). Lands the Layer 1 storage, the seeder that ingests today's hardcoded field constants into Firestore, and a silent read API. **No UI consumes any of this yet** — the Forms Management wizard still reads from the hardcoded constants in `VoucherDesignerPage.tsx`. Phase B will build the super-admin editor; Phase C will switch the wizard onto the new read path.

## Technical Developer View

### What this phase delivers
- A new Firestore collection — `system_metadata/field_library/items/{fieldId}` — populated with every field id today's wizard knows about.
- A domain entity (`FieldLibraryEntry`), repository interface, Firestore implementation, and DI binding.
- A read API at `GET /tenant/designer/field-library` returning the merged catalog visible to a given company, and `GET /tenant/designer/field-library/system` returning the system-tier alone.
- Idempotent seeder hooked into `runSystemSeeder.ts` as Step 4. Safe to re-run; content-hash skip means identical content → no version bump.

### Files added

| File | Purpose |
|---|---|
| `backend/src/domain/designer/entities/FieldLibraryEntry.ts` | Domain entity, `FieldClass` enum, `SelectorBinding`, `ResolvedFieldLibrary` resolver shape. |
| `backend/src/repository/interfaces/designer/IFieldLibraryRepository.ts` | Repo contract — `listSystemEntries`, `listCompanyEntries`, `resolveForCompany`, `upsertSystemEntry`. |
| `backend/src/infrastructure/firestore/repositories/designer/FirestoreFieldLibraryRepository.ts` | Firestore implementation with content-hash idempotency, monotonic version bumps, scope tagging. |
| `backend/src/seeder/seedFieldLibrary.ts` | Source-of-truth content (duplicated from the frontend constants); de-dupes the per-module unions per the flat-namespace rule. |
| `backend/src/api/controllers/designer/FieldLibraryController.ts` | Two read endpoints. |
| `planning/done/135a-field-library-phase-a.md` | This report. |

### Files changed
- `backend/src/repository/interfaces/designer/index.ts` — re-exports `IFieldLibraryRepository`.
- `backend/src/infrastructure/di/bindRepositories.ts` — `fieldLibraryRepository` accessor (Firestore-only this phase; Prisma binding follows in Phase B).
- `backend/src/seeder/runSystemSeeder.ts` — adds Step 4 (Field Library), reports `{written, unchanged, total}`.
- `backend/src/api/routes/designer.routes.ts` — mounts the two GETs under `designer.vouchertypes.view` permission.

### Storage paths

```
system_metadata/field_library/items/{fieldId}        ← seeded here
companies/{companyId}/field_library/{fieldId}         ← reserved for Phase D (custom_metadata only)
```

The system path mirrors the existing `system_metadata/voucher_types/items` shape so the super-admin UI's directory layout stays consistent.

### Decisions honored

| Decision | Implementation |
|---|---|
| 6.1 — flat namespace | Seeder unions all source lists and de-dupes by `id`; `currency` from ACCOUNTING and SALES collapse into one entry. Phase B's UI will enforce uniqueness on insert. |
| 6.2 — two-tier resolver | `resolveForCompany` reads both paths and merges; system wins on id collision. Company tier is empty until Phase D. |
| 6.3 — lazy revalidation + monotonic version | `upsertSystemEntry` computes a SHA-1 content hash of the meaningful fields, compares against the persisted `contentHash`, bumps `version` only on change. Re-running the seeder is a verified no-op. |
| 6.4 — selector binding split | Each entry carries `selectorBinding: { collection, displayField, valueField?, filters? }`. The renderer registry (code) will resolve the actual React component in Phase C. |

### What's NOT in this phase (deferred)

- **Super-admin UI** — Phase B. Today the only authoring path is the seeder.
- **Company custom-field authoring** — Phase D. The `companies/{cid}/field_library` collection exists in code paths but no write endpoint.
- **Wizard consuming the API** — Phase C. The Forms Management wizard still uses the hardcoded constants. The new endpoint is silent.
- **Prisma binding** — Firestore only. Add Prisma when the super-admin UI ships and reads need to scale.
- **Field Library Drift audit page** — Phase B/C, depends on forms persisting `fieldVersionsSeen`.

### Verification
- `npx tsc --noEmit` (backend): **exit 0**
- Frontend untouched; FE typecheck not re-run because no FE file changed in this phase.

## Manual QA Script

Phase A is silent — there's no end-user visible change. QA is super-admin / developer flavor only.

### 1. Run the seeder
From `backend/`:

```bash
npx ts-node src/seeder/runSystemSeeder.ts
```

Expected console output near the end:
```
--- Step 4: Seeding Field Library ---
  • documentId            v1  (new)
  • status                v1  (new)
  ... (~50 lines)
✅ Field Library Step Finished. 50 written, 0 unchanged (total 50).
```

### 2. Confirm idempotency
Re-run the same command immediately. Expected:
```
✅ Field Library Step Finished. 0 written, 50 unchanged (total 50).
```
No `(updated)` lines, no version bumps.

### 3. Inspect via Firebase console
Open the emulator UI (or production console) → `system_metadata/field_library/items` → confirm ~50 documents present. Spot-check `warehouseId`:
- `fieldClass: 'system_core'` (was mandatory in at least one module)
- `type: 'warehouse-selector'`
- `selectorBinding: { collection: 'warehouses', displayField: 'name' }`
- `version: 1`
- `contentHash`: sha1 hex string

### 4. Hit the read API
Signed in as any tenant user with `designer.vouchertypes.view`:

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:5001/erp-03/.../api/v1/tenant/designer/field-library
```

Expected:
- `success: true`
- `data.entries` — full merged catalog, sorted by id
- `data.headerEligible` — entries where `sectionHint !== 'BODY'`
- `data.lineEligible` — entries where `sectionHint === 'BODY'` (the line-item columns)

Try `?includeDeprecated=1` — still returns everything (no deprecated entries yet).

### 5. Confirm the wizard is unaffected
Open **Tools → Forms Management** in Sales/Purchases/Accounting → click Clone or Add Custom Form on any locked form → walk to step 4 (Fields). The available fields shown must be **identical to before Phase A** — they're still being read from the hardcoded constants. If anything visibly changed, Phase A leaked into the wizard, which it shouldn't have.

## End-User View

No user-visible changes. This phase is groundwork for the field component library promised in task 135. Forms Management continues to work exactly as it did after task 134's polish.

## Next steps

**Phase B** (super-admin editor) is unblocked:
- New super-admin page `/super-admin/field-library` (sidebar entry under super-admin tools).
- CRUD against `system_metadata/field_library/items` via the existing `superAdminVoucherTypesApi`-style pattern.
- Flat-namespace uniqueness enforced on insert.
- Soft-deprecate flow (no destructive deletes).
- Selector-binding picker (resolves against the renderer registry).

Estimate: 4-5 hours.

**Phase C** (wizard cascade) is unblocked after Phase B:
- Forms Management wizard switches from the hardcoded constants to `GET /tenant/designer/field-library`.
- VoucherTemplateEditorPage gets a "pick fields from library" affordance instead of free-typing.
- `getEffectiveFieldsForType(typeId)` use case resolves Layer 1 + Layer 2 placement metadata.

Estimate: 6-8 hours.
