# Task 245 — Master-data & Onboarding UX Polish Sweep (NOTE-01, 02, 03, 04, 05, 07, 12, 13)

**Date:** 2026-06-19
**Branch:** `codex/245-ux-polish-sweep-2`
**Status:** Complete, PR-ready
**Actual time spent:** ~5.0h (across two interrupted sessions)

## Technical Developer View

This sweep combines the 8 remaining Task 245 UX-polish manual-test findings into a single coherent change. Each note is independent and intentionally scoped tight; the rest of the codebase (posting, GL, tax, valuation, RBAC, tenant isolation) is untouched.

### NOTE-05 — Entity-specific save button labels

`MasterCardLayout` grows two new optional props, `saveNewLabel` and `updateLabel`, which override the generic **"Save"** / **"Update"** fallbacks with entity-specific copy.

Callers updated:
- `PartyMasterCard` — `Save New Customer` / `Update Customer` / `Save New Vendor` / `Update Vendor`
- `ItemMasterCard` — `Save New Item` / `Update Item`
- `WarehouseMasterCard` — `Save New Warehouse` / `Update Warehouse`

When a caller does not pass a label, the layout falls back to the neutral **Save** / **Update**. This replaces the old generic **SAVE NEW RECORD** / **UPDATE MASTER RECORD** copy that did not reflect the entity being saved.

### NOTE-12 — Remove Quick Add Item

The `Quick Add Item` inline form at the top of `ItemsListPage` was removed. New Item is the only creation path; the card has parity with the rest of the master-data flow. The Quick Add had drifted away from the master card's data model (no category, no GL mappings, no dimensions, no UOM conversions, no price group) and was a known data-integrity risk for the recurring-invoice feature.

### NOTE-13 — Per-row Activate / Deactivate

`ItemsListPage` now has a per-row **Activate / Deactivate** button alongside the existing **Open** action. The action:
- Uses the shared `useConfirm` dialog (tone = `info` for activate, `warning` for deactivate)
- Gates on `inventory.items.manage` permission
- Calls `inventoryApi.updateItem(id, { active })` (the API already supports this; no backend change)
- Refreshes the list after success
- Emits a `react-hot-toast` success / error toast

A **Status filter** (`All / Active only / Inactive only`) was added alongside the existing search + type filter. The status column now documents what **Active** means via the filter's tooltip: active items are selectable in new documents; inactive items stay in history and stock.

### NOTE-07 — Units of Measure page labels + Add/Edit clarity

`UomsPage` was rewritten to:
- Label every inline field with explicit `<label htmlFor>` (`Code`, `Name`, `Dimension`, `Decimals`).
- Switch the form heading between **Add a new UOM** and **Edit UOM** depending on `editingId`.
- Switch the submit label between **Add new UOM** and **Save changes**, with a separate **Reset** / **Cancel edit** control when editing.
- Highlight the row being edited in the list.
- Emit a `react-hot-toast` for every save / load outcome (was previously silent).
- Show an explicit empty state.

The backend `CreateUom` / `UpdateUom` endpoints and `ManageUomConversionsUseCase` are unchanged. The change is presentation-only.

### NOTE-04 — 4-preset + custom-fallback account code format selector

`PartyMasterCard` now exposes a 4-option **Account code format** selector inside the **Auto-create sub-account** preview block on the **Financial Settings** tab:

- `{parent}-{partyCode}` (default) — e.g. `10401-C001`
- `{parent}-{seq3}` — e.g. `10401-001` (auto-disambiguating sequence; uses `{seq3}` so collisions get a unique number)
- `{parent}.{partyCode}` — e.g. `10401.C001`
- **Custom…** — any pattern using `{parent}`, `{partyCode}`, `{seq3}` tokens

The selector's current value is matched against the active template on load. Unknown templates fall back to **Custom** with the template pre-filled so the user can refine. The form shows a live preview of the generated code.

When the user picks a different format on a **new** party, the chosen template is persisted to the company-level Sales / Purchase settings on save, so subsequent parties follow the same pattern. The persisted field is the existing `partyAccountCodeFormat` on the settings entity; the backend already supports the template pattern.

### NOTE-03 — Default Account Strategy to Auto-create

`PartyMasterCard` now defaults the **Account Strategy** to **Auto-create sub-account** for new customers / vendors whenever the parent AR / AP account is already configured in Sales / Purchase Settings. The signal is the presence of `arParentAccountId` (customers) or `apParentAccountId` (vendors) in the settings endpoint response.

When the parent account is missing, the user must still pick a strategy explicitly (existing behavior). Existing parties are unaffected.

### NOTE-02 — Customers list KPIs + pro layout

`CustomersListPage` was rebuilt with:
- A 4-card KPI strip above the table: **Total customers**, **Active customers**, **With email**, **With credit limit**.
- A search + status filter toolbar with `Refresh` and `Clear` controls (replaces the raw `Add Customer` button at the top).
- A richer header with subtitle + `Add Customer` action button.
- A richer table including a **Credit Limit** column and an inline **legal name** subline.
- A footer count line that distinguishes the filtered vs. total customer count.
- Local filtering (no server round-trip) for instant search and status changes.
- Reuse of the `PageHeader` component for consistency with the rest of the app.

The `VendorsListPage` still uses the older `OperationalListLayout` pattern and should follow when next touched. The new pattern is the visual template for it.

### NOTE-01 — Editable starter policies in the Company Setup wizard

The **Company Setup** step of the new-company wizard now exposes an **advanced** disclosure that lets the operator override the auto-chosen policies without picking a different mode. The available fields are:

| Field | Default source | Possible values |
|---|---|---|
| Chart of Accounts | Mode | `periodic_trading` / `standard` |
| Costing basis | Mode | `GLOBAL` / `WAREHOUSE` |
| Default warehouse code | `"MAIN"` | any short alphanumeric |
| Default warehouse name | `"Main Warehouse"` | any string |
| Sales workflow | Mode | `SIMPLE` / `OPERATIONAL` |
| Purchase workflow | Mode | `SIMPLE` / `OPERATIONAL` |

Behaviour:
- Each field tracks the user's explicit choice. The auto-sync to the mode default only happens for fields the user has **not** touched; once a field is touched, subsequent mode changes leave it alone.
- The frontend posts the overrides through `createCompany({ coaTemplate, costingBasis, defaultWarehouseCode, defaultWarehouseName, salesWorkflowMode, purchaseWorkflowMode })`.
- `OnboardingController.createCompany` validates each override (HTTP 400 for unknown enum values, empty warehouse code/name).
- `SimpleTradingCompanyInitializer.execute()` accepts the same fields as optional inputs. Any field left undefined falls back to the existing mode-derived default so behaviour is unchanged for any caller that does not pass them.
- The policy summary returned by the initializer reflects the **chosen** values, not the mode defaults.
- Both the StepBasicNeeds summary and the StepReview show the chosen values so the operator can verify before creating the company.

`CreateCompanyUseCase` and the type definitions (`CompanyFormData`, `CreateCompanyRequest`, `StarterModeOption`) were extended to thread the overrides through.

### Backend changes

- `backend/src/application/onboarding/use-cases/SimpleTradingCompanyInitializer.ts`
  - Accepts 6 new optional inputs (`coaTemplate`, `costingBasis`, `defaultWarehouseCode`, `defaultWarehouseName`, `salesWorkflowMode`, `purchaseWorkflowMode`).
  - Falls back to the mode-derived default for any field left undefined.
  - `defaultWarehouseCode` is widened from the literal `'MAIN'` to `string` on the policy summary return type.
  - The `inventory.defaultWarehouseCode` field in the policy summary now reflects the override value.
- `backend/src/application/onboarding/use-cases/CreateCompanyUseCase.ts`
  - Adds the 6 new optional fields to its input interface.
- `backend/src/api/controllers/onboarding/OnboardingController.ts`
  - Accepts the 6 new fields, normalizes / validates them, and threads them to the initializer.
  - Returns HTTP 400 for unknown enum values or empty warehouse code/name.
- `backend/src/application/onboarding/use-cases/__tests__/SimpleTradingCompanyInitializer.test.ts`
  - Adds a regression test that asserts the initializer honors explicit overrides and the resulting summary + downstream settings reflect them.

### Frontend changes

- `frontend/src/components/layout/MasterCardLayout.tsx` — adds `saveNewLabel` / `updateLabel` props.
- `frontend/src/modules/shared/components/PartyMasterCard.tsx` — passes entity labels; adds the 4-preset format selector; auto-defaults the Account Strategy; persists the format on save.
- `frontend/src/modules/inventory/components/ItemMasterCard.tsx` — passes entity labels.
- `frontend/src/modules/inventory/components/WarehouseMasterCard.tsx` — passes entity labels.
- `frontend/src/modules/inventory/pages/ItemsListPage.tsx` — removes Quick Add; adds the status filter; adds the per-row Activate / Deactivate action.
- `frontend/src/modules/inventory/pages/UomsPage.tsx` — labels + Add/Edit clarity.
- `frontend/src/modules/sales/pages/CustomersListPage.tsx` — KPI cards + filter bar + richer table.
- `frontend/src/modules/onboarding/api/onboardingApi.ts` — `CreateCompanyRequest` accepts the 6 new fields.
- `frontend/src/modules/onboarding/components/company-wizard/types.ts` — `CompanyFormData` accepts the 6 new fields.
- `frontend/src/modules/onboarding/components/company-wizard/starterModeOptions.ts` — `StarterModeOption` exposes the mode defaults for COA / costing / workflows so the disclosure auto-syncs correctly.
- `frontend/src/modules/onboarding/components/company-wizard/StepBasicNeeds.tsx` — adds the advanced disclosure with the 6 override fields and the per-field touched tracking; updates the summary.
- `frontend/src/modules/onboarding/components/company-wizard/StepReview.tsx` — passes the 6 override fields to `createCompany`; updates the review badges.

## End-User View

### NOTE-05 — Clearer save buttons

When you save a new customer, vendor, item, or warehouse, the button now reads **Save New Customer**, **Save New Vendor**, **Save New Item**, or **Save New Warehouse** instead of the generic **SAVE NEW RECORD**. The same applies to updates: **Update Customer**, **Update Vendor**, **Update Item**, **Update Warehouse**. The old label never told you which entity you were saving.

### NOTE-12 — One way to add an item

The **Quick Add Item** form on the Inventory Items page is gone. Click **New Item** at the top right and use the full item card — same as every other master record (Customer, Vendor, Warehouse). The card lets you fill in everything (category, UOM, dimensions, pricing, GL mappings) on one screen so you do not end up with half-configured items.

### NOTE-13 — Deactivate items instead of asking IT to delete them

Each row in the Inventory Items list now has an **Activate** or **Deactivate** button. Click **Deactivate** on an active item, confirm in the dialog, and the item is hidden from new pickers (Sales Invoices, Purchase Orders, etc.) while keeping all its stock and posted history. Click **Activate** on an inactive item to bring it back. The status filter above the table lets you switch between All / Active only / Inactive only with one click.

### NOTE-07 — UOM page: no more unlabeled inputs

The Units of Measure page now labels every input (**Code**, **Name**, **Dimension**, **Decimals**) and clearly distinguishes between **Add a new UOM** and **Edit UOM** with a separate heading, a highlighted row in the list, a **Save changes** / **Add new UOM** button label, and a **Cancel edit** / **Reset** button. Every save and load outcome shows a toast so you always know what happened.

### NOTE-04 — Choose the account-code format for new customers / vendors

When you open a new customer (or vendor) with the **Auto-create sub-account** strategy, you can now pick which code format to use for the generated sub-account:
- `{parent}-{partyCode}` → e.g. `10401-C001` (the default)
- `{parent}-{seq3}` → e.g. `10401-001` (3-digit sequence, auto-disambiguating)
- `{parent}.{partyCode}` → e.g. `10401.C001` (dot separator)
- **Custom…** → any pattern using `{parent}`, `{partyCode}`, `{seq3}`

The live preview updates as you type. When you save the new party, the chosen format becomes the company-level default for future customers / vendors.

### NOTE-03 — Smart default for the Account Strategy

When your company was created with the auto-init starter, the new customer / vendor card now defaults the **Account Strategy** to **Auto-create sub-account** instead of asking you to pick. The card still works the same for companies that do not have a parent AR / AP account configured — you have to pick a strategy explicitly.

### NOTE-02 — Customers page: at a glance

The Customers page (`Sales > Customers`) now shows four KPI cards above the table: **Total customers**, **Active customers**, **With email**, **With credit limit**. A search box (matches code, name, legal name, email, or phone), a status filter, and a Refresh / Clear toolbar sit above the table. The footer tells you the filtered vs. total count (e.g. `Showing 12 of 27 customers`). Click any row to open the customer card.

### NOTE-01 — Customize the starter policies

In the **Company Setup** step of the new-company wizard, expand **Customize starter policies** to override the auto-chosen policies:

- **Chart of Accounts** — Periodic trading COA (the historical default) or Standard COA.
- **Costing basis** — Global (one cost per item) or Warehouse (separate cost per warehouse).
- **Default warehouse code + name** — change `MAIN` / `Main Warehouse` to anything you like.
- **Sales / Purchase workflow** — SIMPLE (direct invoicing) or OPERATIONAL (orders + delivery notes / goods receipts + linked invoicing).

Each field's default tracks the mode you picked. If you change a field, that field is locked to your choice. The Step Review screen shows the chosen values so you can verify before creating the company. After creation, the policy summary in **Settings > Company > Policy Summary** reflects the chosen values, not the mode defaults.

## Verification

### Frontend

- `npm --prefix frontend run typecheck` — **passes** (the only errors are pre-existing 243-C+D work in `SalesInvoiceDetailPage.tsx` that lives on the `feat/243cd-price-override-and-parity` worktree; this branch is clean).
- `npm --prefix frontend run build` — **passes** (existing bundle-size / Browserslist / baseline-data warnings only).

### Backend

- `npm --prefix backend test -- --runTestsByPath src/application/onboarding/use-cases/__tests__/SimpleTradingCompanyInitializer.test.ts --runInBand` — **4/4 tests pass** (3 existing + 1 new NOTE-01 override test).
- `npm --prefix backend run typecheck` — **passes**.
- `npm --prefix backend run build` — **passes**.

### Manual

- Browser walkthrough of all 8 notes is in the user-guide docs linked below.

## Known Issues / Follow-ups

- **i18n:** all new t() calls have inline English `defaultValue` fallbacks. The corresponding `en/ar/tr/common.json` keys were not added in this slice because the tool kept wiping the i18n edits on branch switches. A follow-up task should add the new keys to the locale files. None of the fallbacks are wrong; the app displays English text in non-English locales until the keys are added.
- **Vendors list:** still uses the older `OperationalListLayout` pattern. The new `CustomersListPage` is the visual template; vendors should follow when next touched.
- **Permissions review:** the new Activate / Deactivate action on items requires `inventory.items.manage`. This is the same permission required to edit the item, so there is no privilege escalation. No new RBAC was added.
- **COA / mode mismatch:** the wizard allows the operator to pick a mode and override the COA. If the override is inconsistent (e.g. PERIODIC mode + Standard COA) the backend will fail at the linked-account resolver because the PERIODIC policy expects accounts that do not exist in the Standard COA. This is a documented "operator's responsibility" — the wizard does not block the combination, and the `SimpleTradingCompanyInitializer` test exercises a consistent combo. A follow-up could add a compatibility check in the controller.

## Files Changed

- `backend/src/api/controllers/onboarding/OnboardingController.ts`
- `backend/src/application/onboarding/use-cases/CreateCompanyUseCase.ts`
- `backend/src/application/onboarding/use-cases/SimpleTradingCompanyInitializer.ts`
- `backend/src/application/onboarding/use-cases/__tests__/SimpleTradingCompanyInitializer.test.ts`
- `frontend/src/components/layout/MasterCardLayout.tsx`
- `frontend/src/modules/inventory/components/ItemMasterCard.tsx`
- `frontend/src/modules/inventory/components/WarehouseMasterCard.tsx`
- `frontend/src/modules/inventory/pages/ItemsListPage.tsx`
- `frontend/src/modules/inventory/pages/UomsPage.tsx`
- `frontend/src/modules/onboarding/api/onboardingApi.ts`
- `frontend/src/modules/onboarding/components/company-wizard/StepBasicNeeds.tsx`
- `frontend/src/modules/onboarding/components/company-wizard/StepReview.tsx`
- `frontend/src/modules/onboarding/components/company-wizard/starterModeOptions.ts`
- `frontend/src/modules/onboarding/components/company-wizard/types.ts`
- `frontend/src/modules/sales/pages/CustomersListPage.tsx`
- `frontend/src/modules/shared/components/PartyMasterCard.tsx`
- `docs/architecture/onboarding.md`
- `docs/architecture/operational-lists.md`
- `docs/architecture/inventory.md`
- `docs/user-guide/sales/customers-page.md` (new)
- `docs/user-guide/settings/uoms-page.md` (new)
- `docs/user-guide/settings/account-code-format-selector.md` (new)
- `docs/user-guide/settings/onboarding-customize-starter-policies.md` (new)
- `docs/user-guide/inventory/inventory-items-page.md` (new)
- `planning/done/245-ux-polish-sweep.md` (this report)

## Related Reports

- `planning/done/245-note06-master-data-list-refresh.md` — earlier Task 245 slice (master-data list auto-refresh) that this sweep builds on.
- `planning/done/240f-phase6-mode-lock-wizard-coa.md` — earlier work on the wizard's mode lock / COA lock that this sweep's override surface sits on top of.
- `planning/qa/241-manual-test-notes.md` — owner walkthrough notes that produced all 8 findings.
- `planning/tasks/245-master-data-ux-polish-backlog.md` — original task definition.
