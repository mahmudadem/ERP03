# Completion Report: 134 — Forms Management page polish

Polished the per-module Voucher Designer page into a production-grade **Forms Management** page across Accounting, Sales, and Purchases. Picks up where report 133 left off: where 133 made saves succeed against Firestore, this one makes the page actually usable end-to-end — clone UX, sidebar-group assignment, contextual help, and the backend persistence fixes that were silently dropping form metadata on create.

## Technical Developer View

### Scope
One shared file (`frontend/src/modules/shared/pages/VoucherDesignerPage.tsx`) underpins all three modules via thin wrappers, so each change applies uniformly to **Accounting**, **Sales**, and **Purchases** with no per-module duplication.

### Problems and Fixes

1. **Save silently dropped form fields on create**
   `VoucherFormController.create` was hand-picking a small subset of `formData` (name, code, typeId, prefix, description, headerFields, tableColumns, layout, enabled, isDefault). It dropped `module`, `uiModeOverrides`, `rules`, `actions`, `voucherType`, `persona`, `formType`, `baseType`, `sidebarGroup`, `numberFormat`, `isMultiLine`, `tableStyle`, `defaultCurrency`. Without `module` the repository defaulted the persisted doc to `'ACCOUNTING'`, so `loadModuleDocumentForms('SALES'|'PURCHASE')` filtered the new form out of its own module's list. User saw the success toast but no new row.
   - Fix: spread `formData` first, then apply the protected/server-managed overrides. Strip incoming sentinels (`__isClone`) and server-managed fields (`createdAt`, `createdBy`, `isSystemGenerated`, `isLocked`).
   - File: `backend/src/api/controllers/accounting/VoucherFormController.ts`

2. **Cloned forms got `isEdit = true` → PUT to a nonexistent form**
   `handleSaveAndExit` used `!!editingForm?.id` to decide create vs. update. After porting the suggested-ID logic, every clone arrives at the wizard with an `id`, so the page tried to PUT against a form that wasn't there yet.
   - Fix: `isCloneFlow = !!editingForm.__isClone || !!config.__isClone`; `isEdit = !!editingForm.id && !isCloneFlow`. Strip `__isClone` from the payload before save. Also emit `companyModulesRefresh` so the sidebar updates immediately after save.

3. **Legacy clone rules ported from the old global Forms Designer**
   The user explicitly asked for parity with the old designer rather than reinventing.
   - `handleClone` and `handleAddCustomForm` now compute `parentPrefix = (form.prefix || '').replace('-', '').replace(/[^A-Z]/g, '') || 'FORM'`, suggest `id = ${parentPrefix}_${Date.now()}_C` (or `_N` for new custom forms) and `prefix = ${parentPrefix}C-`. Preserves `formType`, `voucherType`, `persona`, `baseType`, `sidebarGroup`, `module`. Suggested values; the user can override.
   - Validation: `DocumentDesigner` step 2 → next runs `validateUniqueness` against the in-memory `existingForms` from `WizardContext` (no Firestore round-trip).

4. **DocumentDesigner ID input locked for clones**
   Step 2 used `readOnly={!!initialConfig?.id}` which blocked override for clones (clones now arrive with a suggested id).
   - Fix: `isExistingEdit = !!initialConfig?.id && !(initialConfig as any).__isClone`. ID is read-only only for genuine edits, not clones. Helper text updated to "Suggested — feel free to override".
   - File: `frontend/src/modules/tools/forms-designer/components/DocumentDesigner.tsx`

5. **Kebab menu with Export JSON, View Schema, Sidebar Group**
   The list row previously had no secondary actions. Mirrors the legacy `FormCard` kebab pattern.
   - Per-row `⋮` opens a 60px-wide dropdown.
   - **Export JSON** — downloads `voucher_form_{id}.json`.
   - **View Schema** — placeholder (disabled, "Coming soon").
   - **Sidebar Group** — inline editor with free-text input and four preset chips. Routes through `updateFormMetadata` (backend PUT, Admin SDK) so Firestore rules don't block; optimistic update + rollback on failure.

6. **Locked forms refused `sidebarGroup` updates**
   Backend `update` allowed only `enabled` past the locked-form gate. The user has to be able to flip both `enabled` and `sidebarGroup` on locked default forms because both are organizational preferences, not design changes.
   - Fix: `ORG_PREFERENCE_KEYS = new Set(['enabled', 'sidebarGroup'])`. If every key in the update is one of those, the locked check is bypassed. Anything else still requires a clone.

7. **Kebab dropdown was being clipped**
   `InstalledTypeRow` had `overflow-hidden` on the type-card so rounded corners survived the expanded list. That clipped the kebab dropdown.
   - Fix: `overflow-visible` on the type-card; `rounded-t-lg` on the header button so the collapsed-state rounding still renders correctly.

8. **Silent `"Vouchers" → "Documents"` sidebar merge confused users**
   A previous task (#15) folded `sidebarGroup="Vouchers"` into the canonical Documents bucket as a migration hack for the legacy seed value. Result: clicking the "Vouchers" preset visibly moved the form to Documents.
   - Seed updated: five accounting templates in `seedSystemVoucherTypes.ts` now seed with `sidebarGroup="Documents"` (was `"Vouchers"`).
   - `useSidebarConfig` now only merges the literal canonical `"Documents"`; everything else is rendered as its own top-level group (including user-typed custom names).
   - Preset chips: `['Documents', 'Vouchers', 'Reports', 'Operations']`.

9. **Page rename + remove redundant copy + slide-over instructions**
   User asked to remove the verbose paragraph and amber "Locked defaults install as inactive" callout, and to replace them with a slide-over modal opened by a `?` icon next to the title — matching the reusable `InstructionsModal` slide-over pattern already in `components/instructions/`.
   - **Voucher Designer** → **Forms Management** in the page title, the editor header sub-label, the loading message, and all three module entries in `moduleMenuMap.ts`.
   - `HelpCircle` icon next to the page title opens `InstructionsModal` with a five-section walkthrough (Install / Activate / Clone / Sidebar Group / Export) and a footer warnings block.

### Files Touched

| File | Change |
|---|---|
| `backend/src/api/controllers/accounting/VoucherFormController.ts` | Pass-through `create` spread; locked-form gate now allows `enabled` + `sidebarGroup`. |
| `backend/src/seeder/seedSystemVoucherTypes.ts` | Five legacy `"Vouchers"` defaults → `"Documents"`. |
| `frontend/src/config/moduleMenuMap.ts` | Three sidebar entries: `"Voucher Designer"` → `"Forms Management"`. |
| `frontend/src/hooks/useSidebarConfig.ts` | Removed silent Vouchers→Documents merge; user choice honored. |
| `frontend/src/modules/shared/pages/VoucherDesignerPage.tsx` | Header rename, `?` icon + slide-over modal, kebab menu (Export JSON / View Schema / Sidebar Group), suggested-ID clone, in-memory uniqueness, sidebar refresh on save. |
| `frontend/src/modules/tools/forms-designer/components/DocumentDesigner.tsx` | Step 2 ID/Prefix editable for clones. |
| `frontend/src/modules/tools/forms-designer/services/documentDesignerService.ts` | (Was already on backend API path from #133; no functional change here.) |

### Verification Done

- `npx tsc --noEmit` (frontend): exit 0
- `npx tsc --noEmit` (backend): exit 0
- Smoke-tested manually per the QA script below.

## Manual QA Script

Re-installation: any of Accounting / Sales / Purchases. Run the same script in each — behaviour must match.

1. **Sidebar label**
   - Tools → confirm the entry reads **"Forms Management"** (was "Voucher Designer").
2. **Header + help**
   - Page title reads **"Forms Management — {Module}"**.
   - Click the `?` icon next to the title — a slide-over panel comes in from the right with sections: Install a Voucher Type, Activate / Deactivate a Form, Clone or Add a Custom Form, Sidebar Group, Export & Schema. Clicking the backdrop or `X` closes it.
3. **Install** (only if Available Types is non-empty)
   - Click **Install** on a row. Toast confirms `n default form(s) added as locked, inactive`. The type appears under Installed Types with its forms collapsed below; sidebar refreshes.
4. **Activate / Deactivate**
   - Toggle the green switch on a locked default form. Sidebar updates immediately (form appears/disappears under Documents).
5. **Clone (suggested ID + Prefix)**
   - Click the `+` icon on a locked form row → wizard modal opens at step 2.
   - Confirm **ID Key** and **Prefix** are pre-filled with suggested values (e.g. `PI_1748640000000_C` and `PIC-`), both editable, helper text reads "Suggested — feel free to override".
   - Try entering an existing form's id → click Next → red error "This ID is already in use".
   - Restore suggested id → walk to step 7 → click **Save & Close** → toast `{name} saved` and the new row appears in the Installed Types tree. **Critical:** the new row must appear without manual refresh. Sidebar shows the new form.
6. **Add Custom Form**
   - Expand a type → click **+ Add Custom Form** → suggested id `..._N`, prefix `..N-`, editable. Save → new row appears.
7. **Sidebar Group**
   - Open the `⋮` kebab on any form row → confirm three options: **Export JSON**, **View Schema** (disabled), **Sidebar Group**.
   - Click Sidebar Group → preset chips show `Documents · Vouchers · Reports · Operations`.
   - Click `Vouchers` → form's purple badge updates to "Vouchers" → sidebar shows a new top-level "Vouchers" submenu in that module's sidebar containing this form. Click `Documents` → form moves back to Documents (no silent rewrite).
   - Type `Approvals` → press Enter → form appears under a new top-level "Approvals" submenu.
   - **Critical:** repeat all of the above on a **locked default** form. Sidebar group assignment must work without the "Cannot edit locked form. Clone it instead." error.
8. **Export JSON**
   - Kebab → Export JSON → browser downloads `voucher_form_{id}.json`. Verify content has the full form config.
9. **Clipping check**
   - Expand the last installed type and open the kebab menu on the last form row → dropdown must render in full, not be clipped by the section below.

## End-User View

The Tools → **Forms Management** page (in Accounting, Sales, and Purchases) is the single place to control which documents your team can use and how they look.

### What it does
- **Install** a voucher type from the system catalog when you need a new kind of document (Sales Return, Receipt Voucher, etc.).
- **Activate / Deactivate** any form to show or hide it from the sidebar without losing it.
- **Clone** a locked default form to customise its layout, fields, or rules.
- Assign each form to a **Sidebar Group** (Documents, Vouchers, Reports, Operations, or your own name) — the form moves into that submenu instantly.
- **Export** any form as JSON for backup, sharing, or support.

### Quick walkthrough
1. Open **Tools → Forms Management** in any module.
2. Click the **`?`** icon next to the title for the in-page walkthrough.
3. To customise a default form: click **`+`** on its row, override the suggested ID/Prefix if you wish, walk the wizard, click Save.
4. To re-group a form: open the **`⋮`** kebab → Sidebar Group → pick a chip or type a custom name.

## Next Steps

This task is done. Possible follow-ups (not blockers):
- **`View Schema`** kebab option is currently a placeholder — wire it to a read-only schema viewer when the schema work in `designer-engine` is ready for end-user display.
- Implement **cleanup script for orphan voucher templates** in existing companies (task #11) — separate work, doesn't block this.
- The locked-form `ORG_PREFERENCE_KEYS` allowlist may want to grow (e.g. add `defaultCurrency`, `numberFormat`) if those turn out to be company preferences too. Current scope is intentionally minimal.
