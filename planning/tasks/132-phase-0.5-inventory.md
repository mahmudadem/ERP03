# Task 132 — Phase 0.5 Chrome Inventory

Date: 2026-05-30
Branch: `feat/init-wizard-forms-selection`
Source phase: [132 Phase 0.5](./132-ux-layout-production-hardening.md#phase-05---shared-component-and-feedback-inventory)

This inventory is the precondition for Phases 1–6. It records what shared chrome already exists, what currently bypasses it, and the prioritized list of remediations.

---

## 1. Shared components (the baseline)

| Concern | Shared component | Location |
| --- | --- | --- |
| Item picker | `ItemSelector` | `frontend/src/components/shared/selectors/ItemSelector.tsx` |
| Party picker | `PartySelector` | `frontend/src/components/shared/selectors/PartySelector.tsx` |
| Warehouse picker | `WarehouseSelector` | `frontend/src/components/shared/selectors/WarehouseSelector.tsx` |
| Party AR/AP account picker | `PartyAccountSelector` | `frontend/src/components/shared/selectors/PartyAccountSelector.tsx` |
| Account picker | `AccountSelectorSimple` | `frontend/src/modules/accounting/components/AccountSelectorSimple.tsx` *(lives inside accounting module — candidate for promotion to `components/shared/selectors/`)* |
| Date picker | `DatePicker` | `frontend/src/modules/accounting/components/shared/DatePicker.tsx` *(also module-local — candidate for promotion)* |
| Confirmation dialog | `ConfirmDialog` | `frontend/src/components/ui/ConfirmDialog.tsx` |
| Toast | `useToast` via `services/errorHandler.ts` + `layout/TopBar.tsx` | central |
| Report shell | `ReportContainer` | `frontend/src/components/reports/ReportContainer.tsx` |
| Settings layout | `ModuleSettingsLayout` | `frontend/src/components/shared/ModuleSettingsLayout.tsx` |
| Master-card windows | `PartyCardWindow`, `WarehouseCardWindow`, `ItemCardWindow`, `VoucherWindow`, `MasterCardLayout` | `modules/accounting/components/*`, `modules/inventory/components/*` |

**Gap:** `AccountSelectorSimple` and `DatePicker` are not co-located with the other shared selectors. Phase 2/3 should move them under `components/shared/` and re-export from the old path for one cycle.

---

## 2. P0 — raw `type="date"` inputs (bypass shared `DatePicker`)

9 hits. `DataTableFilter` is a legitimate use; everything else is a remediation target.

| File | Notes |
| --- | --- |
| `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx` | Posting/finance-sensitive — **P0** |
| `frontend/src/modules/sales/pages/QuotationDetailPage.tsx` | **P0** |
| `frontend/src/modules/sales/pages/PromotionsPage.tsx` | P1 (config) |
| `frontend/src/modules/sales/pages/PriceListsPage.tsx` | P1 (config) |
| `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx` | Posting/finance-sensitive — **P0** |
| `frontend/src/modules/inventory/wizards/InventoryFinancialIntegrationWizard.tsx` | **P0** (posting cutoff) |
| `frontend/src/modules/inventory/pages/StockMovementsPage.tsx` | P1 (filter) |
| `frontend/src/modules/inventory/pages/StockTransfersPage.tsx` | P1 |
| `frontend/src/components/ui/DataTable/DataTableFilter.tsx` | **Keep** — generic filter primitive |

---

## 3. P0 — unsafe `window.confirm` / `alert()` (bypass `ConfirmDialog` & toast taxonomy)

30+ usages across 28 files. **Posting-reversal confirms are the highest control risk** — they must move to `ConfirmDialog` with explicit "type to confirm" or two-step pattern.

### Posting-control sensitive (P0)
- `modules/purchases/pages/GoodsReceiptDetailPage.tsx:472` — unpost GR (reverses inventory)
- `modules/purchases/pages/PurchaseInvoiceDetailPage.tsx:689` — unpost PI (reverses accounting+inventory)
- `modules/purchases/pages/PurchaseReturnDetailPage.tsx:423` — unpost PR (reverses accounting+inventory)
- `modules/accounting/voucher-wizard/components/VoucherFormDesigner.tsx:105` — delete form
- `modules/tools/forms-designer/components/DocumentFormDesigner.tsx:127` — delete form
- `modules/accounting/components/AccountForm.tsx:225` — uses `alert()` for hierarchy validation error → must become validation toast

### Admin / security sensitive (P0)
- `pages/super-admin/pages/SuperAdminVoucherTemplatesPage.tsx:64`
- `pages/super-admin/pages/SuperAdminFieldLibraryPage.tsx:169`
- `pages/company-admin/pages/UsersPage.tsx:85,99` — toggle status, remove user
- `pages/company-admin/pages/RolesPage.tsx:26` — delete role
- `pages/company-admin/pages/BundlesPage.tsx:15` — upgrade bundle
- `modules/super-admin/pages/UsersListPage.tsx:57,68` — promote/demote
- `modules/super-admin/pages/SuperAdminUsersManagementPage.tsx:56,67,78` — promote/demote/impersonate
- `modules/super-admin/pages/CompaniesListPage.tsx:59` — impersonate
- `modules/super-admin/pages/CompanyEntitlementsPage.tsx:104` — revoke module
- `modules/super-admin/pages/AiApiKeysPage.tsx:126` — delete API key
- `modules/super-admin/pages/AiModelProfilesPage.tsx:211`
- `modules/super-admin/pages/AiRuntimeProfilesPage.tsx:249`
- `modules/super-admin/components/CertificationManagerModal.tsx:224,238`
- `modules/super-admin/pages/AiSetupWizardPage.tsx:1234`
- `modules/settings/rbac/AssignUsersRolesPage.tsx:38`
- `layout/SuperAdminShell.tsx:31` — logout confirm
- `modules/accounting/forms-designer/components/VoucherTypeManager.tsx:31`
- `modules/inventory/components/ItemMasterCard.tsx:263`
- `modules/ai-assistant/hooks/useAiSettings.ts:474` — deprecate model

### Stubs / WIP (P2 — remove or implement)
- `modules/accounting/components/shared/GenericVoucherRenderer.tsx:1390,1400` — `alert("Feature to be implemented")` for account drill-down. **Remove or wire to real navigation.**
- `modules/tools/forms-designer/components/DocumentDesigner.tsx:2370,2372` — preview/test stubs
- `components/topbar/widgets/AlarmWidget.tsx:27`, `NotesWidget.tsx:27` — placeholder alerts. **Topbar widget scope is frozen (rule 6) — leave as-is.**

### Acceptable / legitimate
- `services/errorHandler.ts:154` — fallback when toast system unavailable. **Keep.**
- `utils/mathUtils.ts:16` — comment string only. **Keep.**

---

## 4. P0 — dev/demo routes exposed in tenant nav

`router/routes.config.ts` exposes the following with `hideInMenu: false` — visible to tenants. Phase 1 must hide.

| Route | Component |
| --- | --- |
| `/canvas-dev` | `CanvasDevPage` |
| `/dev/data-table` | `DataTableDemoPage` |
| `/dev/voucher-list` | `VoucherListDemoPage` |
| `/dev/smart-vouchers` | `SmartVoucherListPage` |
| `/dev/tailwind-play-demo` | `TailwindPlayDemoPage` |
| `/dev/ui-lab` | `UiLabDashboard` |
| `/accounting/vouchers/demo` | `NewVoucherFormsDemo` *(label: "🆕 New Forms Demo")* |

**Action:** flip `hideInMenu: true` for all of the above and gate behind a dev/super-admin role check. Keep routes available for dev environments.

---

## 5. uiMode awareness coverage

`useUserPreferences` / `uiMode === 'windows'` branching exists in **26 files** (good baseline). The shell, sidebar, topbar, and the major list pages already branch:

**Already mode-aware:**
- Shell & nav: `AppShell`, `TopBar`, `Sidebar`, `SidebarItem`, `SidebarSection`, `UIModeWidget`
- Master lists: `CustomersListPage`, `VendorsListPage`, `WarehousesPage`, `ItemsListPage`, `VouchersListPage`
- Reports: `AccountStatementPage`, `ReportContainer`
- Settings: `AppearanceSettingsPage`, `AccountingSettingsPage`, `company-admin/SettingsPage`
- Onboarding: `CompaniesListPage`, `NewCompanyWizardPage`, `CompanySelectorPage`
- Profile: `core/ProfilePage`
- Tools: `DynamicDocumentPage`
- Master cards (Windows variants exist): `PartyCardWindow`, `WarehouseCardWindow`, `ItemCardWindow`, `PartyMasterCard`, `WarehouseMasterCard`, `ItemMasterCard`, `VoucherWindow`, `VoucherEntryModal`, `WindowsDesktop`, `MasterCardLayout`

**Not yet mode-aware (sample — to be expanded during phase work):**
- All sales/purchases **detail pages** (`SalesInvoiceDetailPage`, `QuotationDetailPage`, `SalesOrderDetailPage`, `SalesReturnDetailPage`, `PurchaseInvoiceDetailPage`, `GoodsReceiptDetailPage`, `PurchaseReturnDetailPage`)
- Sales/purchase settings & list pages: `SalesSettingsPage`, `PurchaseSettingsPage`, `RecurringInvoicesPage`, `PurchasePriceListsPage`, `VendorGroupsPage`
- Most super-admin pages (out of scope for tenant chrome — keep classic)

**Decision:** detail pages are owned by **thread #2 / Phase 4.5 (per-voucher mode polish)**, not by Phase 1–3 chrome work. Phase 0.5 only records the gap.

---

## 6. ReportContainer adoption — clean

All 22 active report pages route through `ReportContainer`:

`SalesAnalyticsPage`, `CustomerStatementPage`, `ArAgingReportPage`, `VendorStatementPage`, `PurchasesAnalyticsPage`, `ApAgingReportPage`, `UnsettledCostsPage`, `InventoryValuationPage`, `AccountStatementPage`, `JournalPage`, `LedgerReportPage`, `TrialBalancePage`, `TradingAccountPage`, `ProfitAndLossPage`, `CostCenterSummaryPage`, `ConsolidatedTrialBalancePage`, `CashFlowPage`, `BudgetVsActualPage`, `BankReconciliationPage`, `BalanceSheetPage`, `AgingReportPage`, plus the `ReportWindow` Windows wrapper.

**No remediation needed.** `check-reports.mjs` enforcement remains the guardrail.

---

## 7. Toast / error taxonomy (definition for Phase 1+)

Eight categories, distinguished by **icon, color, persistence, and copy template**:

| Category | Trigger | Color/icon | Persistence | Example copy |
| --- | --- | --- | --- | --- |
| Success | Action completed | green check | 3s auto | "Invoice INV-1042 posted" |
| Info / no-op | Idempotent action | blue info | 3s | "No new records to import" |
| Validation error | Field-level user input invalid | amber warning | until dismissed | "Quantity must be greater than 0" |
| Business policy block | Domain rule rejected action | amber lock | until dismissed | "Period is locked. Use Override to proceed." |
| Missing setup | Required config absent | blue gear | until dismissed | "AP account not set for vendor X. Open vendor card → Accounts." |
| Permission block | Role/scope denied | gray shield | 5s | "You don't have permission to post invoices." |
| System / network error | API/timeout/5xx | red alert | until dismissed | "Couldn't reach the server. Retrying…" |
| Critical / integrity error | Tenant scope mismatch, double-post, ledger inconsistency | red alert + modal | requires acknowledgement | "Critical: voucher number collision. Contact administrator." |

**Enforcement decision:** documented in `docs/architecture/frontend-toast-taxonomy.md` (to be created in Phase 1). Lint-level enforcement deferred; ESLint rule banning raw `window.confirm`/`alert` added in Phase 1.

---

## 8. Prioritized remediation backlog

| Priority | Item | Phase | Est. |
| --- | --- | --- | --- |
| P0 | Hide all `/dev/*`, `/canvas-dev`, `/accounting/vouchers/demo` from tenant nav | 1 | 1h |
| P0 | Replace posting-reversal `window.confirm` (3 purchases unpost pages) with `ConfirmDialog` two-step | 1 | 2h |
| P0 | Replace `type="date"` on 4 sales/purchases detail + inventory wizard pages with shared `DatePicker` | 2 | 3h |
| P0 | Replace admin/security `window.confirm` (super-admin + company-admin pages, 15 sites) with `ConfirmDialog` | 1 | 4h |
| P0 | Replace `AccountForm` `alert()` with validation toast | 1 | 0.5h |
| P0 | Remove `GenericVoucherRenderer` "Feature to be implemented" alerts (wire or strip) | 2 | 1h |
| P0 | Promote `AccountSelectorSimple` + `DatePicker` to `components/shared/selectors/` with shim re-exports | 2 | 2h |
| P0 | Write toast taxonomy doc + add ESLint rule banning raw confirm/alert | 1 | 2h |
| P1 | Replace remaining `window.confirm` (RBAC, voucher type manager, item master card, AI settings) | 2 | 3h |
| P1 | Replace `type="date"` on price-list / promotions / stock filter pages | 3 | 2h |
| P2 | Make sales/purchases detail pages mode-aware | 4.5 (per-voucher polish thread) | — |

Total Phase 1 P0 effort: **~10 hours** before any per-voucher work.

---

## 9. Acceptance check (Phase 0.5)

- [x] Shared selector and date picker inventory recorded
- [x] Page-local date / selector inputs identified and prioritized
- [x] Loading and feedback categories defined (8-tier toast taxonomy)
- [x] Report contract adoption confirmed (22/22 — no remediation)
- [x] Entity card UI-mode gaps listed (detail pages routed to Phase 4.5)
- [x] Dev/demo route exposure enumerated
- [x] Posting-control-sensitive confirms flagged as P0 with explicit list

Phase 0.5 is **complete**. Next: Phase 1 — Production Shell Cleanup, starting with the dev-route hide + posting-reversal `ConfirmDialog` swap.
