# Completion Report: Forms Designer — Module Status + Catalog Sync

**Date:** 2026-04-28
**Task:** Fix Forms Designer to show module initialization status and integrate system catalog as source of truth
**Agent:** OpenCode (CTO mode)

---

## Problem

Sales Invoice and Sales Order forms appeared in the Tools Forms Designer before the Sales module was initialized. The root cause was two-fold:
1. Voucher types are seeded at company creation (all 13 system templates), not at module initialization
2. The Forms Designer checked bundle entitlement only, not module initialization state

## What Changed

### 1. Module Status Detection (Frontend)
- `ToolsFormsDesignerPage.tsx` now uses `useCompanyModules` hook to get real initialization status
- `isModuleActive()` remains as entitlement check (bundle-based)
- New `getModuleInitStatus()` returns: `'not_installed' | 'not_initialized' | 'initializing' | 'ready'`
- Module tabs show status indicators (amber dot = not initialized, blue pulse = initializing)

### 2. Module Status Banner Component
- **New file:** `frontend/src/modules/tools/forms-designer/components/ModuleStatusBanner.tsx`
- Shows context-aware messages per module state:
  - **Not Initialized:** "The {module} module is enabled but not yet configured" + "Initialize {Module}" button linking to `/{module}/setup`
  - **Initializing:** Spinner with "Setting up {module}..." message
  - **Not Installed:** "The {module} module is not enabled for this company"
  - **Ready:** No banner (normal operation)

### 3. System Catalog Integration
- **New service:** `loadSystemVoucherTypes(module)` reads from `system_metadata/voucher_types/items`
- Definitions merged with catalog types, each tagged with adoption status:
  - **Active** — company has a form for this type (system-generated, locked)
  - **Available** — in system catalog, entitled module, but no company form yet
  - **Custom** — company cloned and modified the system template
- Catalog types only shown for entitled modules (entitlement gate preserved)

### 4. Three-Layer UI in DocumentFormDesigner
- **Active Forms** section — adopted system templates with full edit/clone/toggle
- **Available in Catalog** section — new section showing adoptable types with "Adopt & Customize" button
- **Your Custom Forms** section — user-created copies

### 5. Backend Sync Endpoint
- **New route:** `POST /company-admin/modules/:module/sync-voucher-types`
- Uses existing `syncCompanyVoucherTemplatesFromSystem` service
- Compares system catalog vs company types, creates missing ones
- Idempotent and safe to run repeatedly

### 6. Legacy Accounting Forms Designer Deprecated
- `FormsDesignerPage.tsx` now redirects to `/tools/forms-designer`
- Route and menu entry preserved for backward compatibility (redirects)

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/modules/tools/pages/ToolsFormsDesignerPage.tsx` | Rewritten with status detection, catalog loading, status banner |
| `frontend/src/modules/tools/forms-designer/components/ModuleStatusBanner.tsx` | **NEW** — status banner component |
| `frontend/src/modules/tools/forms-designer/services/documentDesignerService.ts` | Added `loadSystemVoucherTypes()` |
| `frontend/src/modules/tools/forms-designer/components/FormCard.tsx` | Added `adoptionStatus` prop, updated badges |
| `frontend/src/modules/tools/forms-designer/components/DocumentFormDesigner.tsx` | Added "Available in Catalog" section, adoption status badges |
| `frontend/src/modules/accounting/pages/FormsDesignerPage.tsx` | Replaced with redirect to tools version |
| `backend/src/api/controllers/company-admin/CompanyModulesController.ts` | Added `syncVoucherTypes` endpoint |
| `backend/src/api/routes/company-admin.routes.ts` | Added route for sync endpoint |

---

## Build Verification
- `npm run build` (backend) — ✅ zero errors
- `npm run build` (frontend) — ✅ zero errors

---

## Acceptance Criteria Met
- [x] Forms Designer shows exact reason why no forms are visible (not initialized, not installed, initializing)
- [x] Module tabs show status indicators
- [x] "Initialize {Module}" button links to module setup wizard
- [x] System catalog types visible as "Available" for entitled modules only
- [x] Three-layer classification: System (catalog), Company (active), User (custom)
- [x] Legacy Accounting Forms Designer redirects to Tools version
- [x] Backend sync endpoint for catalog updates

---

## Technical View

### Architecture
The Forms Designer now operates with a clear separation:
1. **Entitlement** (`moduleBundles`) — what modules the company has access to
2. **Initialization** (`useCompanyModules`) — what modules are configured
3. **Catalog** (`system_metadata`) — platform-wide voucher type definitions
4. **Adoption** (company-level forms) — which catalog types the company uses

### Data Flow
```
system_metadata/voucher_types/items → loadSystemVoucherTypes() → "Available" cards
companies/{id}/{module}/Settings/voucherForms → loadModuleDocumentForms() → "Active" cards
User clones → unlocked copy → "Custom" cards
```

---

## End-User View

### What's New
The Document Form Designer now tells you exactly what's going on:

- **If a module isn't set up yet:** You'll see a clear message saying "The Sales module is enabled but not yet configured" with a button to go directly to the setup wizard. No more wondering why you see empty forms.

- **Module tabs show status dots:** An amber dot means the module needs setup. A pulsing blue dot means it's being configured right now.

- **See what's available from the platform:** A new "Available in Catalog" section shows document types that exist in the system but your company hasn't adopted yet. Click "Adopt & Customize" to start using them.

- **Three clear categories:**
  - **Active** — forms your company is using (system templates you adopted)
  - **Available** — new forms from the platform catalog you can adopt
  - **Custom** — forms you created or modified yourself

- **Old Accounting Forms Designer:** If you had a bookmark to the old `/accounting/forms-designer`, it now automatically redirects you to the new unified Tools version.
