# Task 135 — Field Component Library (three-layer cascade)

**Status:** approved — design closed, ready for Phase A code
**Owner:** product (super-admin role = project developer)
**Umbrella task:** #5 — *Unify native voucher pages and Form Designer via shared field schema*
**Builds on:** [docs/architecture/document-forms-plan.md](../../docs/architecture/document-forms-plan.md), `frontend/src/designer-engine/types/FieldDefinition.ts`, `frontend/src/pages/super-admin/pages/VoucherTemplateEditorPage.tsx`
**Follows:** [planning/done/134-forms-management-page-polish.md](../done/134-forms-management-page-polish.md)

---

## 1. Why this task exists

The available-fields catalog that powers the Forms Management page (the wizard's *Fields* step) is currently three hardcoded constants inside `frontend/src/modules/shared/pages/VoucherDesignerPage.tsx`:

- `SYSTEM_FIELDS_GENERIC`
- `AVAILABLE_FIELDS_BY_MODULE`
- `AVAILABLE_TABLE_COLUMNS_BY_MODULE`

That works for now — but the original architecture intent (captured in `document-forms-plan.md` and partially built in `VoucherTemplateEditorPage`) was that **super admin manages this catalog from the UI**, not from a code edit + redeploy.

This task formalises the **three-layer cascade** the product owner intends so it's no longer ambiguous: field library → voucher type → form variant. Each layer has a different audience, persistence boundary, and override semantic.

---

## 2. The three layers

### Layer 1 — Field Library (super-admin-managed catalog)

The set of fields the system knows how to render and validate. One entry per field, defined once.

```
warehouseId:
  type:          warehouse-selector
  label:         "Warehouse"
  fieldClass:    system_optional        # or system_core / computed / custom_metadata
  alwaysShared:  false                  # true → every voucher type can reference it
  validation:    { rules ... }
  selectorBinding: warehouses
```

- **Audience:** super admin (the developer of this project).
- **Persistence:** Firestore `system_metadata/field_library/{fieldId}` (mirrors the existing `system_metadata/voucher_types` pattern).
- **UI:** new super-admin page — *Field Component Library*.
- **Migration source:** the existing hardcoded `AVAILABLE_FIELDS_BY_MODULE` + `AVAILABLE_TABLE_COLUMNS_BY_MODULE` + `SYSTEM_FIELDS_GENERIC` get seeded into this collection on first deploy.

### Layer 2 — Voucher Type (super-admin-managed binding)

Which fields from the library this voucher type uses, where they go, and whether they're mandatory **at the type level** (i.e., every form of this type must include them). This is the layer the product owner repeatedly emphasized — *"Sales Order needs warehouse in the line, not the header"*.

```
sales_invoice:
  headerFields:
    - { fieldId: customerId,  mandatory: true,  default: <party-default> }
    - { fieldId: invoiceDate, mandatory: true }
    - { fieldId: warehouseId, mandatory: true }     # ← header here
    - { fieldId: currency,    mandatory: true }
  lineFields:
    - { fieldId: itemId, mandatory: true }
    - { fieldId: unitPriceDoc, mandatory: true }

sales_order:
  headerFields:
    - { fieldId: customerId,  mandatory: true }
    - { fieldId: orderDate,   mandatory: true }
  lineFields:
    - { fieldId: itemId, mandatory: true }
    - { fieldId: warehouseId, mandatory: true }     # ← line here, different from sales_invoice
```

- **Audience:** super admin.
- **Persistence:** Firestore `system_metadata/voucher_types/items/{typeId}` (extends what's already there — types already carry `headerFields[]` and `lineFields[]`).
- **UI:** the existing `VoucherTemplateEditorPage` (already wired to `superAdminVoucherTypesApi`) gets the additional "pick from library" affordance instead of free-typing field definitions.
- **Inherits from:** Layer 1 (type-level entries reference a `fieldId` from the library; they cannot invent new field types here).

### Layer 3 — Form (company-level variant override)

Each company installs voucher types and gets one or more form variants. The Forms Management page (#134) is where the company tunes these variants. The form can:

- **Hide** a non-mandatory field that the type lists.
- **Reorder** fields, change `colSpan`, move between sections.
- **Add** custom-metadata fields from the library (if `fieldClass: custom_metadata`).
- **Promote a non-mandatory field to required** for this form.
- **NOT** demote a type-mandatory field, NOT change field type, NOT alter validation rules.

```
forms/sales_invoice_direct (company X):
  baseType: sales_invoice
  overrides:
    headerFields:
      - { fieldId: warehouseId, hidden: false, colSpan: 6 }
      - { fieldId: salesOrderId, hidden: true }       # not relevant for Direct
    lineFields: <unchanged>

forms/sales_invoice_linked (company X):
  baseType: sales_invoice
  overrides:
    headerFields:
      - { fieldId: salesOrderId, hidden: false, mandatory: true }   # promoted
```

- **Audience:** company admin.
- **Persistence:** Firestore `companies/{companyId}/{module}/Settings/voucherForms/{formId}` (already exists — the current `headerFields` / `tableColumns` / `uiModeOverrides` shape).
- **UI:** Forms Management → kebab → Edit (the existing wizard from #134).
- **Inherits from:** Layer 2. The wizard renders Layer 1 fields filtered to "those Layer 2 has approved for this type", with Layer 2 mandatory ones locked.

---

## 3. What's already there

| Component | Status | Lives at |
|---|---|---|
| Architecture doc | ✅ exists | `docs/architecture/document-forms-plan.md` |
| `FieldDefinition` type + `FieldClass` enum (`system_core` / `system_optional` / `computed` / `custom_metadata`) | ✅ exists | `frontend/src/designer-engine/types/FieldDefinition.ts` |
| Selector types as first-class fields (party / warehouse / item / cost-center / etc.) | ✅ exists | `FieldDefinition.ts` |
| Super-admin voucher template editor (Layer 2 UI) | 🟡 partial — exists but free-types field defs instead of picking from a library | `frontend/src/pages/super-admin/pages/VoucherTemplateEditorPage.tsx` |
| Field library (Layer 1) — storage, API, UI | ❌ missing | proposed `system_metadata/field_library/{id}` |
| Form-level overrides (Layer 3) | 🟡 partial — current Forms Management saves the full snapshot, no "diff against type defaults" model | `frontend/src/modules/shared/pages/VoucherDesignerPage.tsx` |
| Hardcoded catalog in the page | ⚠️ to migrate | `AVAILABLE_FIELDS_BY_MODULE`, `AVAILABLE_TABLE_COLUMNS_BY_MODULE`, `SYSTEM_FIELDS_GENERIC` |

---

## 4. The gap between today and intent

1. **No Layer 1 storage.** The catalog of fields lives in code, not Firestore. Super admin can't add a field without a redeploy.
2. **No "pick from library" in Layer 2.** `VoucherTemplateEditorPage` lets the super-admin free-type a field definition (id, type, label) every time, which means the same `warehouseId` field can be defined inconsistently across types. Once Layer 1 exists, Layer 2 picks `fieldId` references and inherits everything else.
3. **Form-level overrides aren't differential.** Today the form persists the full `headerFields[]` snapshot. To support real "type changes propagate to forms unless overridden" semantics, the form should persist a **diff** against the type's Layer 2 definition, not a copy.
4. **No cascade enforcement in the wizard.** Step 4 of the designer shows every field allowed by the hardcoded catalog. It should instead show: *(a)* all fields the Layer 2 type approved, with type-mandatory ones locked-on, plus *(b)* all `custom_metadata` fields from Layer 1 the company is free to add.

---

## 5. Proposed implementation phases

Each phase ships independently and is safe to stop at.

### Phase A — Seed the Field Library (Layer 1 storage)
- New collection `system_metadata/field_library/{fieldId}`.
- Seeder script that ingests today's hardcoded constants into the new collection, preserving every `id`, `type`, `label`, `fieldClass`, `sectionHint`, `supportedTypes`/`excludedTypes`, `mandatory` flag.
- Read API for the super-admin and company-level pages.
- **No UI changes yet.** Catalog continues to drive everything as-is; the new collection is silent.

### Phase B — Super-admin Field Library editor
- New page `/super-admin/field-library`.
- CRUD against `system_metadata/field_library`.
- Selector binding picker (`warehouses` / `accounts` / `parties` / custom).
- Validation that a field already referenced by any voucher type can't be deleted (only deprecated).

### Phase C — Layer 2 cascade
- `VoucherTemplateEditorPage` switches its field section to a "pick fields from library" UI (multi-select chips that resolve to `{ fieldId, section, mandatory }` records).
- Layer 2 mandatory means "every form of this type must include this field, in this section".
- Backend: a new `getEffectiveFieldsForType(typeId)` use case that resolves a Layer 2 record into the full Layer 1 + override shape.

### Phase D — Layer 3 differential model
- Form persists `{ fieldOverrides: { [fieldId]: { hidden?, colSpan?, mandatory?, position? } } }` instead of full snapshots.
- Forms Management wizard renders the *resolved* view (Layer 2 cascade + form override) but only saves the override diff.
- Locked-form gate already handles "can't un-mandate type-mandatory fields" (extend the existing `ORG_PREFERENCE_KEYS` allowlist concept).

### Phase E — Native voucher renderer alignment (closes task #5)
- `GenericVoucherRenderer` reads the same resolved view (Layer 1 → Layer 2 → Layer 3) so the runtime UI is always in lockstep with what Forms Management shows.
- Removes the duplication between native pages and Form Designer for good.

---

## 6. Decisions (resolved before Phase A)

### 6.1 Field ID namespace — **FLAT** ✅
Global flat namespace. `warehouseId` is the same identity everywhere. Phase A seeder + the super-admin Field Library editor must enforce uniqueness on insert: no two Layer 1 entries can share an `id`. Rationale: matches today's constants, simpler tooling, no scoping ambiguity.

### 6.2 Custom-field authoring — **OPTION B: companies can author `custom_metadata` fields, but only of that fieldClass** ✅

Two-tier Layer 1 storage:

| Source | Path | Who authors | What kinds |
|---|---|---|---|
| **System library** (canonical) | `system_metadata/field_library/{fieldId}` | Super-admin | Any `fieldClass` — `system_core`, `system_optional`, `computed`, `custom_metadata`. Engine-aware fields (anything the accounting engine, reporting, or business rules need to understand) live here. |
| **Company library** (extension) | `companies/{companyId}/field_library/{fieldId}` | Company admin (via Forms Management → Add Custom Field) | **`custom_metadata` only.** Free-form bucket: text, number, date, checkbox, simple select. **No selector kinds** (party-selector, warehouse-selector, account-selector, etc.) — those bind to collections the company doesn't control, so they stay super-admin-only. |

Resolver order when the wizard loads the catalog: read both, merge, system entries win on id collision. The flat-namespace rule (6.1) applies across both tiers — companies can't author a field whose id already exists in the system library.

**Note on the install-time copy pattern:** voucher *types* still get copied to `companies/{cid}/.../voucher_types` on install (today's behaviour, unchanged). Layer 1 fields are NOT copied — they're **referenced** by id. That avoids drift; a system field change reaches every company without a re-install.

### 6.3 Versioning + revalidation — **LAZY** ✅

When super-admin edits a Layer 1 field (label, validation rule, binding, etc.), existing company forms keep working as-is. Revalidation happens at three lazy touchpoints:

1. **On open (Forms Management wizard)** — compare each field reference against current Layer 1. Show a small ⚠ marker on fields whose Layer 1 has changed since the form was last saved. Hover/click reveals what changed (e.g., "validation rule added 2026-06-15: warehouse must be active").
2. **On save** — re-apply current Layer 1 validation. If the form now fails (e.g., a referenced field was deleted, a new mandatory rule isn't satisfied), block save with an explanatory error so the company admin fixes it before persisting.
3. **Runtime renderer (GenericVoucherRenderer)** — uses the cached form config until next save. No re-validation on every render (avoids per-document latency).

**Supporting infrastructure:**
- Each Layer 1 field carries a monotonic `version: number` that bumps on every edit.
- Each form persists `fieldVersionsSeen: { [fieldId]: number }` recording which Layer 1 version it was last saved against.
- A super-admin audit page **Form Library Drift** lists `{ companyId, formId, fieldId, currentVersion, savedAgainstVersion, changeSummary }` so super-admin can see who's lagging and why.

**Breaking-change guardrails:**
- Deleting a Layer 1 field is forbidden if any form references it — only **soft-deprecate** (`deprecated: true`). Deprecated fields render with a strikethrough in the wizard's catalog and emit a warning.
- Type changes (e.g., `TEXT` → `NUMBER`) are forbidden via the super-admin UI. Need to rename + create a replacement.

### 6.4 Selector binding extensibility — **BOTH (code-registry + Layer 1 metadata)** ✅

A new selector kind ships in two parts; new companies pick it up automatically once the system library entry exists, with no per-company redeploy:

| Concern | Where | Who edits | When the company gets it |
|---|---|---|---|
| The **React component** that knows how to render a `project-selector` (the dropdown UI, search behaviour, etc.) | Code: `frontend/src/.../registry.ts` (existing pattern from `document-forms-plan.md`) | Developer (in code) | Next app deploy |
| The **Layer 1 metadata** describing the selector's data binding: `{ type: 'project-selector', selectorBinding: { collection: 'projects', displayField: 'name', valueField: 'id', filters?: {...} } }` | Firestore: `system_metadata/field_library/{fieldId}` | Super-admin (via Field Library editor UI) | **Immediately, no deploy** — already-running companies see it on next wizard load |

**Cascade:**
1. You (developer) ship the new `project-selector` React component, registered in the renderer's selector registry. Deploys with the next release.
2. You (super-admin) add a `projectId` entry to the system Field Library via the UI, with `type: 'project-selector'` and binding metadata.
3. All running companies can immediately reference `projectId` from their Forms Management page. No per-company config, no per-company redeploy.

Selector kinds remain super-admin-only (per 6.2) — companies can't invent new selector bindings because they'd bind to collections we can't guarantee exist or are populated.

---

## 7. Non-goals

- Replacing `GenericVoucherRenderer` with the unused `designer-engine/` scaffolding. The plan doc already established `GenericVoucherRenderer` is the production renderer.
- Building a visual drag-and-drop layout for Layer 2. Layer 2 is field-and-mandatory only; layout/visual editor stays at Layer 3.
- Migrating existing company data — per memory, no production data exists yet.

---

## 8. Next concrete step

**Phase A** is unblocked and ready to start. Scope:

1. Add a `FieldLibraryEntry` interface (mirrors `FieldDefinition` from `designer-engine/types/`, adds `version`, `deprecated`, `selectorBinding`, `fieldClass` enforced).
2. Write a one-shot seeder (`backend/src/seeder/seedFieldLibrary.ts`) that ingests today's three constants from `VoucherDesignerPage.tsx` into `system_metadata/field_library/{fieldId}`. Idempotent — re-runnable, bumps `version` only on actual content change.
3. Add a read API: `getFieldLibrary()` that merges `system_metadata/field_library` + `companies/{cid}/field_library` per the 6.2 resolver order. No write API yet.
4. **Do not** wire any UI to it. The Forms Management wizard keeps reading from the hardcoded constants. Catalog is silent / inspectable only.

Estimate: 2-3 hours. Verification: Firebase console shows the collection populated with the right `fieldId` records; the new API returns the merged shape; `npx tsc --noEmit` clean both sides.

Phase B (super-admin editor) is the natural follow-up and can ship independently the next session.
