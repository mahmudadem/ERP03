# 142 — Task 132 Phase 1 P0: confirms, dates, feedback taxonomy

Status: ✅ Done (2026-05-30)
Branch: `feat/init-wizard-forms-selection`
Commit: `41d91b77`
Source task: [tasks/132-ux-layout-production-hardening.md](../tasks/132-ux-layout-production-hardening.md)
Inventory: [tasks/132-phase-0.5-inventory.md](../tasks/132-phase-0.5-inventory.md)

## Scope

Execute the Phase 0.5 P0 backlog before broader chrome refactoring begins. Three problem areas were addressed:

1. **Posting-reversal control risk** — Purchases unpost actions used `window.confirm` with the same visual weight as a UI preference toggle. Users could reverse a posted invoice's ledger and inventory entries with one click on a browser-native dialog. P0.
2. **Bypassed shared controls** — finance-sensitive pages used raw `type="date"` inputs that don't honor company date format, fiscal calendar, or RTL. P0.
3. **Unsafe message surface** — `window.confirm` / `alert()` was scattered across 28 files, mostly for admin/security actions. No shared toast taxonomy existed. P0.

## What changed

### Shared infrastructure (new)
- [frontend/src/hooks/useConfirm.tsx](../../frontend/src/hooks/useConfirm.tsx) — promise-based replacement for `window.confirm`. Renders `ConfirmDialog` with `info` / `warning` / `danger` tones. Drop-in for inline use without per-page state plumbing.
- [docs/architecture/frontend-toast-taxonomy.md](../../docs/architecture/frontend-toast-taxonomy.md) — 8-tier feedback contract: success / info / validation / business-policy / missing-setup / permission / system / critical. Includes copy templates and tone selection rules.
- [frontend/scripts/check-no-confirm.mjs](../../frontend/scripts/check-no-confirm.mjs) — build-gate enforcement. Wired into `npm run build`. Blocks raw `window.confirm` / `alert` in `frontend/src` outside the allowlist.
- [frontend/scripts/check-no-confirm.allowlist.json](../../frontend/scripts/check-no-confirm.allowlist.json) — 13 legacy sites seeded; must shrink to zero.

### Posting-reversal hardening (P0 control)
- `PurchaseInvoiceDetailPage.unpostPI` → `ConfirmDialog` with `tone="danger"`, confirm label `"Unpost Invoice"`, message names the side effects (reverses accounting + inventory).
- `GoodsReceiptDetailPage.unpostGRN` → same pattern, confirm label `"Unpost GRN"`.
- `PurchaseReturnDetailPage.unpostReturn` → same pattern, confirm label `"Unpost Return"`.

### Raw date input → shared `DatePicker` (P0)
Eight inputs across four pages:
- `SalesInvoiceDetailPage` — 2 settlement-row payment dates + 2 clone-recurring start/end.
- `QuotationDetailPage` — quote date + valid-until.
- `PurchaseInvoiceDetailPage` — 2 settlement-row payment dates.
- `InventoryFinancialIntegrationWizard` — accounting start date (posting cutoff).

### Validation surface (P0)
- `AccountForm` hierarchy check `alert()` → `errorHandler.showWarning` — validation toast, doesn't break out of the form.
- `GenericVoucherRenderer` two "Feature to be implemented" `alert()` calls → `errorHandler.showInfo` pointing users at existing report pages.

### Admin / security confirms (P0)
17 sites migrated to `useConfirm()`:
- `SuperAdminShell` logout
- `super-admin/CompaniesListPage` impersonate
- `super-admin/SuperAdminUsersManagementPage` promote / demote / impersonate (3)
- `super-admin/UsersListPage` promote / demote (2)
- `super-admin/CompanyEntitlementsPage` revoke module
- `company-admin/UsersPage` toggle status / remove user (2)
- `company-admin/RolesPage` delete role
- `company-admin/BundlesPage` upgrade plan
- `settings/rbac/AssignUsersRolesPage` remove user
- `accounting/voucher-wizard/VoucherFormDesigner` delete form
- `tools/forms-designer/DocumentFormDesigner` delete form
- `accounting/forms-designer/VoucherTypeManager` delete type
- `inventory/ItemMasterCard` UoM conversion correction

## Decisions

- **Dev/demo routes kept visible.** User requested pre-deployment exposure of `/dev/*`, `/canvas-dev`, `/accounting/vouchers/demo`. Will revisit before production.
- **11 super-admin AI/cert sites deferred** to the AI super-admin polish thread — added to allowlist instead of migrated this session. They are super-admin-only, low tenant blast radius.
- **Topbar `AlarmWidget` / `NotesWidget` skipped** — topbar widget scope is frozen by rule 6 of Task 132. Their `alert()` placeholders stay until the topbar work is reopened.
- **`useConfirm` chosen over per-page state.** 17 mechanical sites with the same pattern justified the abstraction. Single declaration per page: `const { confirm, confirmDialog } = useConfirm()`; mount `{confirmDialog}` once.

## QA script

1. **Posting reversal — Purchases.** Open a posted Purchase Invoice, click *Unpost Invoice*. Confirm a red-tinted `ConfirmDialog` appears with title *"Unpost Purchase Invoice"* and the side-effect message. Confirm Esc / backdrop click cancels; confirm cancel button is enabled while idle. Repeat for Goods Receipt and Purchase Return.
2. **Date pickers.** Open a Quotation in edit mode. Confirm *Quote Date* and *Valid Until* render as the company-localized `DatePicker` (not a native browser date picker). Confirm the right-click context menu offers fiscal shortcuts (FY start, period start, etc.). Repeat for Sales Invoice settlement modal, Purchase Invoice settlement modal, and Inventory Financial Integration Wizard.
3. **AccountForm validation.** In *Accounting → Chart of Accounts → New Account*, select a posting account as the parent. Confirm an amber `showWarning` toast appears (not a browser `alert`) and the form does not submit.
4. **GenericVoucherRenderer drill-downs.** In a voucher render, right-click an account line and choose *Open Statement* / *Account Balance*. Confirm a blue info toast pointing at the appropriate report — no `alert()`.
5. **Admin confirms.** As Super Admin, click *Logout*. Confirm a warning-tinted `ConfirmDialog` appears. Repeat *Impersonate* on a company (warning tone) and *Demote* on a user (danger tone). Repeat in Company Admin → Users (status toggle warning, remove user danger), Roles (delete danger), Bundles (warning upgrade).
6. **Build-gate.** From repo root run `npm --prefix frontend run check:no-confirm` — must exit 0. Now temporarily add `window.confirm('x')` to any tracked file outside the allowlist; re-run; must fail with the file:line listed. Revert.
7. **Typecheck and reports.** `npm run typecheck:web` clean; `npm --prefix frontend run check:reports` reports `21 report route(s) checked. 0 allowlisted.`

## Gates

- `npm run typecheck:web` — ✅ clean
- `npm --prefix frontend run check:reports` — ✅ 21/21
- `npm --prefix frontend run check:no-confirm` — ✅ OK

## Follow-ups

- Promote `AccountSelectorSimple` + `DatePicker` from accounting module into `components/shared/selectors/` with shim re-exports. (Next step — same session.)
- Shrink `check-no-confirm.allowlist.json` toward zero — migrate the 11 super-admin AI/cert sites when the AI super-admin polish thread reactivates.
- Phase 1 remaining: dev-route hide is deferred per user request; revisit before deployment.
- Continue Task 132 with Phase 2 (list/action standardization).
