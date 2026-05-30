# 138 — Task 132 Phase 0.5: Chrome inventory & mode-awareness baseline

**Date:** 2026-05-30
**Agent:** Claude (Opus 4.7)
**Branch:** `feat/init-wizard-forms-selection`
**Phase:** [Task 132](../tasks/132-ux-layout-production-hardening.md) Phase 0.5
**Status:** ✅ Inventory complete

Catalogs the chrome surface against the v1 mode-aware contract (Task 132 clause 7). Feeds Phases 1–6.

## 1. Mode-awareness state

Foundation: `useUserPreferences().uiMode → 'classic' | 'windows'` (defined in [UserPreferencesContext.tsx:13](../../frontend/src/context/UserPreferencesContext.tsx:13)), persisted in `localStorage.erp_ui_mode`, default `'windows'`. Toggled via `TopBar UIModeWidget`. `AppShell` branches on `isWindowsMode = uiMode === 'windows'`.

### Already mode-aware (chrome layer)
- `AppShell.tsx`, `TopBar.tsx`, `Sidebar.tsx`, `SidebarSection.tsx`, `SidebarItem.tsx`
- `UIModeWidget.tsx`, `AppearanceSettingsPage.tsx`, `UserPreferencesContext.tsx`
- `AccountingSettingsPage.tsx` (one of the settings pages)
- `AccountStatementPage.tsx` (one report)
- `VouchersListPage.tsx`, `CustomersListPage.tsx`
- Voucher renderer stack: `GenericVoucherRenderer.tsx`, `VoucherDesignerPage.tsx`, `DocumentDesigner.tsx`, `VoucherEntryModal.tsx`, `VoucherFormDesigner.tsx`, `VoucherDesigner.tsx`
- Wizards/mappers (read-only consumers): `voucherWizardService.ts`, `canonicalToUi.ts`, `uiToCanonical.ts`
- Dev pages: `UiLabDashboard.tsx`, `TailwindPlayDemoPage.tsx`

### NOT mode-aware (must be addressed)
Operational pages most users will see daily:

| File | Type | Why it matters |
|---|---|---|
| `modules/sales/pages/SalesInvoicesListPage.tsx` | list | Highest-traffic Sales surface |
| `modules/sales/pages/SalesInvoiceDetailPage.tsx` (2,747 lines) | detail+create | Highest-traffic SI surface — also has 37 raw `accountId/partyId/itemId/warehouseId` ID references (shared-selector candidate) |
| `modules/sales/pages/QuotationDetailPage.tsx` | detail | |
| `modules/sales/pages/PromotionsPage.tsx`, `PriceListsPage.tsx` | master | |
| `modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`, `PurchaseReturnDetailPage.tsx`, `GoodsReceiptDetailPage.tsx` | detail | |
| `modules/inventory/pages/StockMovementsPage.tsx`, `StockTransfersPage.tsx` | list | |
| `modules/sales/pages/AgedBacklogPage.tsx` and other sales pages not in the audit (need wider scan) | — | |

### Decision rule for new mode-aware work
If the visual difference between classic and windows modes is **real** (layout, container chrome, density, focus model) — branch. If the difference is purely **cosmetic** — render once, let Tailwind variant classes handle it. Don't switch every component into a two-branch render.

## 2. Action safety violations

`window.confirm` / `window.alert` / bare `alert()` usage — **28 files**. These must be replaced with `ConfirmDialog` for destructive/financial actions and toast/Snackbar for transient feedback. Notable ones:

- `purchases/pages/PurchaseInvoiceDetailPage.tsx`, `PurchaseReturnDetailPage.tsx`, `GoodsReceiptDetailPage.tsx` — financial lifecycle (post / cancel) using raw confirm.
- `accounting/components/AccountForm.tsx`, `inventory/components/ItemMasterCard.tsx` — master-data delete/clone.
- `pages/super-admin/pages/SuperAdminFieldLibraryPage.tsx`, `SuperAdminVoucherTemplatesPage.tsx`, multiple `super-admin/pages/Ai*.tsx`.
- `pages/company-admin/pages/UsersPage.tsx`, `RolesPage.tsx`, `BundlesPage.tsx`, `settings/rbac/AssignUsersRolesPage.tsx`.
- `modules/tools/forms-designer/components/DocumentDesigner.tsx`, `DocumentFormDesigner.tsx` and `accounting/voucher-wizard/components/VoucherFormDesigner.tsx`, `forms-designer/components/VoucherTypeManager.tsx`.
- Plus `accounting/components/shared/GenericVoucherRenderer.tsx`, `super-admin/components/CertificationManagerModal.tsx`, `super-admin/pages/AiSetupWizardPage.tsx`, `SuperAdminUsersManagementPage.tsx`, `UsersListPage.tsx`, `CompanyEntitlementsPage.tsx`, `CompaniesListPage.tsx`, `ai-assistant/hooks/useAiSettings.ts`, `services/errorHandler.ts`, `layout/SuperAdminShell.tsx`.

### Required taxonomy (from Task 132 Phase 0.5 step 6)
Replace by class of feedback:
- **Success** → toast (green) or inline confirmation
- **Info / no-op** → toast (slate)
- **Validation error** → inline field error or toast (amber)
- **Business policy block** → modal explaining the block (not a toast)
- **Missing setup / configuration** → CTA modal with link to fix
- **Permission block** → toast (amber) with role hint
- **System / API / network error** → toast (red) with retry
- **Critical / security / accounting-integrity** → modal, cannot dismiss until acknowledged
- **Destructive confirmation** → `ConfirmDialog` (block, not toast)

## 3. Raw date inputs

`type="date"` / `type='date'` — **9 files**:

- `sales/pages/SalesInvoiceDetailPage.tsx`, `QuotationDetailPage.tsx`, `PromotionsPage.tsx`, `PriceListsPage.tsx`
- `purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `inventory/pages/StockMovementsPage.tsx`, `StockTransfersPage.tsx`
- `inventory/wizards/InventoryFinancialIntegrationWizard.tsx`
- `components/ui/DataTable/DataTableFilter.tsx` ← shared component, intentional or fix here lifts every table

All user-facing dates must route through the shared `DatePicker.tsx` so fiscal/calendar behavior is consistent. DataTableFilter is the leverage point — fixing it normalizes filter UX everywhere.

## 4. Page-local selectors (`accountId`, `partyId`, `itemId`, `warehouseId`)

`SalesInvoiceDetailPage.tsx` alone has **37 references** to these IDs as fields/inputs. This is the canary for the wider problem — most operational detail pages capture these IDs through page-local inputs instead of going through shared selectors (`AccountSelector`, `PartySelector`, `ItemSelector`, `WarehouseSelector`).

Selector contract exists in [done/64](./64-invoice-party-account-selector-contract.md). Project-wide enforcement is unstarted and folds into Task 132 Phase 5.

**Full sweep deferred** — too wide for this inventory pass. A focused list of pages with local selectors should be produced as a sub-inventory before Phase 5 kicks off.

## 5. Duplicate React Query providers

**Confirmed.** Both files mount `<QueryClientProvider>`:
- [main.tsx:23](../../frontend/src/main.tsx:23) — `<QueryClientProvider client={queryClient}>`
- [providers/QueryProvider.tsx:19](../../frontend/src/providers/QueryProvider.tsx:19) — `<QueryClientProvider client={queryClient}>`

If `QueryProvider` is mounted inside `main.tsx`'s subtree, the inner one shadows the outer — and any cache populated against one client is invisible to the other. Phase 1 must consolidate to exactly one `QueryClient` instance. Also need to development-gate `ReactQueryDevtools` in the surviving provider.

## 6. Dev routes visible to tenants

[routes.config.ts:398-403](../../frontend/src/router/routes.config.ts:398) registers 6 dev/demo routes in the `TOOLS` section with `hideInMenu: false`:

| Path | Label |
|---|---|
| `/canvas-dev` | Canvas Dev |
| `/dev/data-table` | DataTable Demo |
| `/dev/voucher-list` | Voucher List Demo |
| `/dev/smart-vouchers` | Smart Voucher List |
| `/dev/tailwind-play-demo` | Tailwind Play Demo |
| `/dev/ui-lab` | UI Lab 🎨 |

These currently appear in the tenant sidebar's `Dev` section ([useSidebarConfig.ts](../../frontend/src/hooks/useSidebarConfig.ts), `sections[translateLabel('Dev')]`). Task 132 Phase 1 wants this hidden behind `import.meta.env.DEV` or behind a `SUPER_ADMIN` role gate — tenant users should not see them in production navigation.

## 7. Report contract — fully on `ReportContainer` ✅

**All 21 report pages already use `ReportContainer`**, plus `ReportWindow.tsx` and the container itself. No deviations found in this grep pass. Standard appears healthy:

- Accounting: TrialBalance, AccountStatement, BalanceSheet, Ledger, ProfitAndLoss, TradingAccount, CashFlow, Journal, Aging, BankReconciliation, CostCenterSummary, BudgetVsActual, ConsolidatedTB
- Sales: AR Aging, Customer Statement, Sales Analytics
- Purchases: AP Aging, Vendor Statement, Purchases Analytics
- Inventory: Unsettled Costs, Inventory Valuation

`check-reports` script (`npm --prefix frontend run check:reports`) is the regression guard — keep it passing.

What's NOT yet audited inside ReportContainer-using pages: whether their filters use shared selectors vs page-local inputs. Defer to Phase 4.5 sub-inventory.

## 8. Entity card UI-mode audit

Task 132 Phase 4.5 requires every master-data entity card to be mode-aware (`Customers`, `Vendors`, `Items`, `Warehouses`, `Accounts`). One grep hit on `CustomersListPage.tsx` for `uiMode`, plus `inventory/components/ItemMasterCard.tsx` is in scope. **Inventory of the rest deferred** — should run when Phase 4.5 starts.

## Recommended Phase 1 starting point

Phase 1 (Production Shell Cleanup, 1–2 days) has three concrete first slices that match items above:

1. **Consolidate QueryClient** — keep one provider (whichever has the right defaults), delete the other. Gate `ReactQueryDevtools` behind `import.meta.env.DEV`. ~30 min.
2. **Hide dev routes from tenant nav** — flip `hideInMenu: true` on the 6 dev routes in `routes.config.ts`, OR conditionally exclude them in `useSidebarConfig.ts` when `!import.meta.env.DEV`. Keep them functioning by URL for dev. ~30 min.
3. **Two-mode visual check** on AppShell, TopBar, Sidebar after the changes via UIModeWidget. ~15 min.

Total: ~1.5 hours to close Phase 1. Each slice is independently committable.

## Outputs of this inventory (to use later)

- 28-file `confirm/alert` replacement list → Phase 5.
- 9-file raw date input list → Phase 5.
- 37-reference `SalesInvoiceDetailPage.tsx` page-local selector example → Phase 5 (and a sub-inventory for the full selector sweep before that phase begins).
- ReportContainer audit: green ✅.
- Entity card mode-aware audit: pending Phase 4.5.

## Acceptance criteria (Task 132 Phase 0.5)

- ✅ Component inventory exists before broad UI refactoring starts.
- ✅ High-risk local controls identified and prioritized.
- ✅ Loading and feedback categories defined before page conversions (taxonomy in §2).
- ✅ Report filter/parameter inconsistencies — deferred, but ReportContainer adoption is verified.
- ⚠ Entity card UI-mode gaps — partial; full audit deferred to Phase 4.5.

Phase 0.5 is closed against its acceptance criteria with the entity-card audit explicitly deferred.
