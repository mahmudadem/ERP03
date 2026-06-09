# 🎯 Current Focus

**Strategy (2026-05-30):** v1 ships natives as the primary surface. Default Forms / Field Library / cloning preserved as v2 customization path, hidden from sidebar for now. See journal entry "v1 strategy decision" for full reasoning.

**Active threads (execution order set 2026-05-30):**
1. **Task 132 chrome work** — shell cleanup, sidebar IA polish, settings taxonomy, action safety, RTL/i18n. **Each touched component is authored mode-aware from the start** (reads `uiMode` from `useUserPreferences`; both `'classic'` and `'windows'` renderings provided and tested via the TopBar UIModeWidget). No infrastructure work needed — `UiMode` context, `AppShell` mode branch, and `UIModeWidget` already exist.
2. **Native functionality retest** — once the chrome is polished, walk every native voucher flow end-to-end per module (create / edit / post / pay / cancel / void / send / attach / audit / period-lock override / credit override). Captures regressions and a real polish backlog.
3. **Native UI-mode awareness (per-voucher)** — hardcoded polished renderings for web AND Windows card/window mode for each native voucher page. Standard in [tasks/132-ux-layout-production-hardening.md](./tasks/132-ux-layout-production-hardening.md) Phase 4.5. Last because it depends on stable chrome + verified functionality.

**Latest completion reports:** [127-tailwind-play-theme-and-styling.md](./done/127-tailwind-play-theme-and-styling.md), [128-coa-template-defaults-and-comprehensive-coa.md](./done/128-coa-template-defaults-and-comprehensive-coa.md), [129-phase-f-pi-attachments.md](./done/129-phase-f-pi-attachments.md), [130-phase-f-vendor-groups.md](./done/130-phase-f-vendor-groups.md), [131-purchase-price-lists.md](./done/131-purchase-price-lists.md), [132-topbar-widget-tray-and-unified-settings.md](./done/132-topbar-widget-tray-and-unified-settings.md), [133-fix-designer-wizard-fields.md](./done/133-fix-designer-wizard-fields.md), [134-forms-management-page-polish.md](./done/134-forms-management-page-polish.md), [135a-field-library-phase-a.md](./done/135a-field-library-phase-a.md), [135b-field-library-phase-b.md](./done/135b-field-library-phase-b.md), [135c-field-library-phase-c1.md](./done/135c-field-library-phase-c1.md), [135d-field-library-phase-c2.md](./done/135d-field-library-phase-c2.md), [136-sidebar-form-grouping-policy.md](./done/136-sidebar-form-grouping-policy.md), [138-forms-visual-fixes.md](./done/138-forms-visual-fixes.md), [139-vertical-stepper-wizard.md](./done/139-vertical-stepper-wizard.md), [140-visual-layout-overflow-fixes.md](./done/140-visual-layout-overflow-fixes.md), [143-settings-taxonomy-foundation.md](./done/143-settings-taxonomy-foundation.md), [144-invoice-list-standardization.md](./done/144-invoice-list-standardization.md), [145-voucher-and-item-list-standardization.md](./done/145-voucher-and-item-list-standardization.md), [146-raw-date-input-cleanup.md](./done/146-raw-date-input-cleanup.md), [132-ui-ux-fixes-completion-report.md](./done/132-ui-ux-fixes-completion-report.md), [148-shared-selectors-enforcement.md](./done/148-shared-selectors-enforcement.md), [149-coa-ui-update.md](./done/149-coa-ui-update.md), [150-sales-invoice-page-refinement.md](./done/150-sales-invoice-page-refinement.md), [151-purchase-direct-invoicing-governance.md](./done/151-purchase-direct-invoicing-governance.md), [153-ai-floating-assistant-launcher-toggle.md](./done/153-ai-floating-assistant-launcher-toggle.md), [154-unify-mdi-windows.md](./done/154-unify-mdi-windows.md), [155-posting-authority-decoupling.md](./done/155-posting-authority-decoupling.md), [156-period-lock-unification.md](./done/156-period-lock-unification.md), [157-decouple-reporting-boundary.md](./done/157-decouple-reporting-boundary.md), [158-stage-2c-retire-per-module-approval-flag.md](./done/158-stage-2c-retire-per-module-approval-flag.md), [159-stage-4-posting-gateway.md](./done/159-stage-4-posting-gateway.md), [160-stage-5-uniform-rejection-contract.md](./done/160-stage-5-uniform-rejection-contract.md), [161-stage-6-7-vocabulary-and-future-hooks.md](./done/161-stage-6-7-vocabulary-and-future-hooks.md), [163-apex-ledger-mockup-isolated-preview.md](./done/163-apex-ledger-mockup-isolated-preview.md), [163-apex-ledger-mockup-integration.md](./done/163-apex-ledger-mockup-integration.md), [164-apex-ledger-routing-and-voucher-parity.md](./done/164-apex-ledger-routing-and-voucher-parity.md), [165-apex-ledger-full-sidebar-module-parity.md](./done/165-apex-ledger-full-sidebar-module-parity.md), [166-compact-layout-mode.md](./done/166-compact-layout-mode.md), [167-apex-shell-production-candidate-slice-1.md](./done/167-apex-shell-production-candidate-slice-1.md), [168-apex-shell-route-coverage-and-qa.md](./done/168-apex-shell-route-coverage-and-qa.md), [170-apex-route-sidebar-adapter.md](./done/170-apex-route-sidebar-adapter.md), [171-apex-sales-native-page-mounting.md](./done/171-apex-sales-native-page-mounting.md), [172-priceisinclusive-sweep-and-sod-hardening.md](./done/172-priceisinclusive-sweep-and-sod-hardening.md), [173-apex-shell-prototype-scale-restoration.md](./done/173-apex-shell-prototype-scale-restoration.md), [174-apex-company-settings-sidebar-parity.md](./done/174-apex-company-settings-sidebar-parity.md).

**Additional Apex/UI reports (2026-06-05/08):** [175-apex-shell-rtl-flyout-positioning.md](./done/175-apex-shell-rtl-flyout-positioning.md), [176-apex-prototype-typography-restoration.md](./done/176-apex-prototype-typography-restoration.md), [177-apex-purchases-inventory-native-page-mounting.md](./done/177-apex-purchases-inventory-native-page-mounting.md), [178-apex-settings-rbac-ai-native-page-mounting.md](./done/178-apex-settings-rbac-ai-native-page-mounting.md), [179-apex-route-coverage-gap-audit.md](./done/179-apex-route-coverage-gap-audit.md), [186-operational-lists-standardization.md](./done/186-operational-lists-standardization.md), [187-sales-invoice-responsive-window-layout.md](./done/187-sales-invoice-responsive-window-layout.md), [188-sales-invoice-allocation-grid-mock-cleanup.md](./done/188-sales-invoice-allocation-grid-mock-cleanup.md), [189-sales-invoice-sticky-footer-totals.md](./done/189-sales-invoice-sticky-footer-totals.md), [191-sales-purchases-document-ui-parity.md](./done/191-sales-purchases-document-ui-parity.md).


**Deferred to v2 (preserved as roadmap, no code removed):** [tasks/native-to-default-forms-migration.md](./tasks/native-to-default-forms-migration.md), [tasks/137-si-direct-capability-audit.md](./tasks/137-si-direct-capability-audit.md).

## 👉 Next agent — start here

**Settlement: approval-boundary preservation + pay-later dialog (2026-06-09, branch `feat/overpayment-credit-balance`).** Settlement QA on a Financial-Approval tenant exposed that paid invoices "always posted as deferred — payment never reached the ledger." Root cause (confirmed against the live emulator): with approval ON, posting a paid invoice throws `APPROVAL_REQUIRED`, rolls back the whole posting (invoice + receipt voucher) and parks `PENDING_APPROVAL`, **discarding the entered settlement** — so on approval it posted on credit and the payment was lost. Fixed across 6 commits: (1) `86ba56b9` #193 regression — Post handlers drove the retired settlement modal and wiped `settlementRows`, so valid CASH_FULL/MULTI never posted; both SI/PI now post directly from the inline `SettlementBlock`, gated on validity; (2) `2e677172` removed the dead settlement modal/card code; (3) `ae295800` **preserve settlement across approval** — new domain-local `pendingSettlement` on SalesInvoice/PurchaseInvoice, stored on park, replayed by `Approve{Sales,Purchase}InvoiceUseCase`, cleared on successful post (+tests); (4) `54a7e07a` docs — recorded the **two-voucher decision** (invoice voucher + separate linked receipt, not one combined entry; reasons in `sales.md`/`purchases.md`) + Approval Center per-row settlement preview; (5) `8585e246` **pay-later `RecordPaymentDialog` (Task 184 Finding 5)** replacing the broken "Create Payment/Receipt" button that navigated to a blank, never-reconciled Accounting voucher. Report: [done/194-settlement-approval-preservation-and-record-payment.md](./done/194-settlement-approval-preservation-and-record-payment.md). **Accounting boundary:** posting/tax/AR-AP/ledger unchanged — only preserve+replay an already-valid settlement and invoke the existing record-payment use case from the UI. Backend build + 50 settlement/posting/payment-sync + 28 boundary/authority tests green; frontend typecheck + production build green. **Manual QA needed:** scripts A–D in report 194 (restart the backend emulator first). **Payment-history display now done** (`7c0595c0`): a read-only `PaymentHistoryModal` opens from a "Payments" button on posted invoices. **Open follow-up (optional):** group the invoice voucher + linked receipt in the UI as one "what posted" panel.


**Task 186 Part A field-type registration completed + branch committed (2026-06-09).** The shared `<SettlementBlock>` was already built and consumed by both native SI/PI pages; the remaining gap — registering it as a Forms-Designer field type — is now done. Seeded a `settlement` `system_core` HEADER field (`seedFieldLibrary.ts`, scoped to `sales_invoice`/`purchase_invoice`); added `'settlement'` to the frontend `FieldType` union + `settlementContext` on `FieldDefinition`; new `SettlementField.tsx` adapter bridges the renderer's `value`/`onChange` to the block's granular `mode`/`rows`; `DynamicFieldRenderer` mounts it full-width; `documentMapper.mapFieldType` preserves the type. Frontend + backend typecheck clean; 28 settlement/settings/designer tests green. **This branch's accumulated uncommitted work (Apex 167–179, lists 186/190, SI 187–189, parity 191, toggle 192, settlement 193, Task 186 A/B + over-payment) was committed together** — file overlap across tasks made a per-task split impractical; granular history lives in the `planning/done/167…193.md` reports. Transcript-recovery scratch files were gitignored. **Accounting boundary:** the field-type gap is a designer placement marker + adapter over the unchanged `SettlementBlock`; no posting/tax/AR-AP/settlement/approval/period-lock/ledger behavior changed. **Manual QA needed:** the over-payment canonical scenario ($1000 invoice, $1500 paid; flag ON → invoice PAID + $500 party credit; flag OFF → rejected with clear message), plus the #193 settlement-placement visual pass.

**Sales Invoice settlement placement and RTL rail polish completed (2026-06-09).** The native Sales Invoice form now keeps the editable settlement block at the end of the invoice body, after lines and the allocation-grid placeholder, so payment handling happens just before the sticky footer actions. The duplicated lower Attachments and Audit & Warnings body tiles were removed; Attachments remains available from the top paperclip action, and audit/history moved into the compact top icon cluster. Follow-ups tightened the shared SettlementBlock so full-paid mode renders Method, Amount, and Contra Account in one equal-width row, with warnings/errors in the section header; settlement labels now read darker, placeholders stay muted gray, and the mode dropdown is wider. Arabic/RTL rail controls now mirror correctly: the native SI rail and shared `DocumentDetailScaffold` edge trigger, drawer side, inner hide button, rail icon, and back arrow use the left edge in RTL. Frontend typecheck passed. Completion report: [done/193-sales-invoice-settlement-placement.md](./done/193-sales-invoice-settlement-placement.md). **Accounting boundary:** UI placement/presentation only; settlement payload shape, posting, payment vouchers, tax, inventory valuation, approval, period-lock, AR/AP, and ledger behavior did not change. **Manual QA needed:** open `Sales -> Invoices -> New Sales Invoice`, confirm the order is Header -> Lines -> Allocation -> Settlement -> sticky footer, check the attachment/history icons, then switch to Arabic/RTL and verify the rail hide/show drawer works from the left edge.

**Sales Simple-mode SO/DN visibility toggle fixed (2026-06-08).** The Sales Settings checkbox **Show Sales Orders & Delivery Notes anyway** now gets included in the save payload and is covered by a backend regression test, so Simple-mode tenants can expose Sales Orders and Delivery Notes without switching the whole Sales workflow to Operational. Backend focused test, backend build, and frontend typecheck passed. Completion report: [done/192-sales-simple-operational-docs-toggle-fix.md](./done/192-sales-simple-operational-docs-toggle-fix.md). **Accounting boundary:** visibility/settings persistence only; invoice posting, tax, inventory valuation, AR, approval, period-lock, and ledger behavior did not change. **Manual QA needed:** save the toggle in Simple mode, reload Sales Settings, and confirm SO/DN menu visibility remains on.

**Sales/Purchases shared document scaffold parity corrected (2026-06-08).** Sales Returns list now uses the shared `OperationalListLayout` / `DataTable` pattern with quick status pills, inline filters, row actions, company date/time formatting, pagination, and centered scan-friendly cells. `frontend/src/components/shared/DocumentDetailScaffold.tsx` now owns the reusable Sales Invoice-style document skeleton: compact topbar, status/source pills, full-height scroll workspace, responsive right rail with edge drawer, shared body primitives, and persistent footer totals/actions. SO, DN, SR, PI, and PO detail pages render through that shared scaffold with document-specific slots. **PI was corrected again after visual feedback:** create/edit and saved view now use the SI-style internal anatomy too: source controls, compact header, line table region, allocation-grid placeholder, attachments/audit shortcuts, and rail ordered Info -> Posting Readiness/Document Status -> Settlement -> Totals. PI no longer accepts raw `purchaseOrderId`; it loads real POs from a dropdown, and the vendor picker is role-filtered to vendors. Frontend typecheck and production build passed. Completion report: [done/191-sales-purchases-document-ui-parity.md](./done/191-sales-purchases-document-ui-parity.md). **Accounting boundary:** UI/data-entry integrity only; posting, tax, AP/AR, inventory valuation, approval, period-lock, settlement, COGS, and ledger behavior did not change. **Manual QA needed:** Classic + Windows mode visual pass for SR list, PI new/saved view, and then SO/DN/SR/PO internal-anatomy parity.

**Sales Invoice sticky footer totals completed (2026-06-07).** Added an always-visible subtotal / tax amount / grand total strip to the right side of the native Sales Invoice sticky footer. The existing side-rail totals card remains unchanged, so totals are visible both when the rail is open and when the rail is hidden. Frontend typecheck passed. Completion report: [done/189-sales-invoice-sticky-footer-totals.md](./done/189-sales-invoice-sticky-footer-totals.md). **Accounting boundary:** UI visibility only; invoice total formula, tax calculation, posting, settlement, approval, period-lock, AR, inventory, and ledger behavior did not change.

**Sales Invoice allocation grid mock cleanup completed (2026-06-07).** Removed mocked Account Ledger & Financial Taxes Allocation Grid rows and deleted the lower **Charge / Account Name** table from the native Sales Invoice page. The grid now shows a localized empty state until Task 184 implements the controlled allocation contract. Frontend typecheck passed. Completion report: [done/188-sales-invoice-allocation-grid-mock-cleanup.md](./done/188-sales-invoice-allocation-grid-mock-cleanup.md). **Accounting boundary:** no posting, tax, totals, settlement, AR, inventory, approval, period-lock, or ledger behavior changed.

**Sales Invoice responsive window layout fix completed (2026-06-07).** Updated the native Sales Invoice detail page so resized Windows-mode invoice windows and smaller view areas use a single reliable vertical workspace scroll instead of clipping sections in nested fixed-height columns. The side rail is pinned by default only on wide layouts, can be hidden/restored from an edge button, and automatically becomes an edge-triggered drawer in Windows mode or narrow viewports so it does not push over invoice fields. Frontend typecheck/build/check:no-confirm passed. Completion report: [done/187-sales-invoice-responsive-window-layout.md](./done/187-sales-invoice-responsive-window-layout.md). **Manual QA needed:** open a Sales Invoice in Windows mode, resize below the default `1100x750`, and verify header, line items, allocation grid, settlement/totals drawer, and footer actions remain reachable.

**High-Density Single-Row Filters Bar on Standardized Operational Lists completed (2026-06-07).** Converted the filters section on all 5 standardized operational list pages (Sales Invoices, Purchase Invoices, Sales Orders, Purchase Orders, and Delivery Notes) from a multi-row grid into a single horizontal flex-wrap row and removed vertical field labels. Updated `DatePicker.tsx` to support a custom `placeholder` prop so that "Date From" and "Date To" inline placeholders display when values are blank. Frontend typecheck and build passed. Completion report: [done/186-filter-bar-one-row.md](./done/186-filter-bar-one-row.md).

**Quick Status Filters on Standardized Operational Lists completed (2026-06-07).** Integrated a premium quick status filter pills bar with dynamic counts in the shared `OperationalListLayout` component. Updated all 5 standardized operational list pages (Sales Invoices, Purchase Invoices, Sales Orders, Purchase Orders, and Delivery Notes) to fetch document lists from the API without status filters, compute document status counts dynamically (reflecting other active filters like Customer or Payment in real-time), and execute status filtering instantaneously in memory. Removed old static `summaryWidgets` card blocks from Sales/Purchase Orders list pages to utilize the new interactive pill bar instead. Frontend typecheck and build passed. Completion report: [done/186-quick-status-filters-pills.md](./done/186-quick-status-filters-pills.md).

**Next recommended slice: Task 167 Slice 3D** — Apex tenant-shell feature flag & cutover QA (estimated 2-4 hours). Check role-based navigations, company setting footer actions, empty tenant displays, and Arabic RTL visual rendering inside the candidate shell.

**Apex shell RTL flyout positioning, Contrast sidebar hardening & Hover highlights complete (2026-06-05).** Fixed coordinate alignment bugs where submenus overlapped the main sidebar in RTL mode, resolved background color discrepancies by styling spawned flyout submenus with `var(--app-sidebar-surface)`, visually hardened contrast sidebars with semi-transparent white overlays, and replaced the light-blue row hover styling in normal sidebars with theme-agnostic `hover:bg-black/5 dark:hover:bg-white/5` overlays to resolve visual mismatch issues. This avoids visual bleed, invisible text, and invisible active highlights across all presets.

**Apex shell production candidate — RTL Support & Slice 2 complete (2026-06-05).** Fully optimized layout, sidebar, headers, and dashboard widgets to support Right-to-Left (RTL) reading directions dynamically when toggled to Arabic. Spacings use logical gaps, search text commands align cleanly, active indicator borders swap sides, and chevrons rotate in RTL. Documented and completed.

**Apex route/page coverage matrix completed (2026-06-05).** Codex created [planning/briefs/20260605-apex-route-page-coverage-matrix.md](./briefs/20260605-apex-route-page-coverage-matrix.md). Verdict: do not copy main-shell pages. Apex should own shell/chrome, adapt the real `useSidebarConfig()` tree into Apex styling, and embed native production pages for Sales/Purchases/Inventory/Settings/AI operational workflows until Apex-native replacements are fully contract-equivalent. Current risk: Apex module child routes are contained by wildcard routing but many still collapse to module workbench sections instead of exact native pages. **Next recommended slice: Task 167 Slice 3B** — build the Apex route translation helper and sidebar tree adapter, then mount native pages by module. Estimate: 2-3 hours for adapter, then split page mounting by module.

**Apex route/sidebar adapter complete (2026-06-05).** Added `routeMap.ts`, switched Apex sidebar runtime child items to the real `useSidebarConfig()` tree, and preserved the Apex compact/RTL visual shell. Item-level RBAC, workflow hiding, and dynamic form groups now come from the same source as the main shell. Frontend typecheck and production build passed. **Next recommended slice: Task 167 Slice 3C** — mount native production pages inside Apex by module, starting with Sales and Purchases operational list/detail/report/settings routes. Estimate: split into 2-3 hour module slices.

**Apex Sales native page mounting complete (2026-06-05).** Added `NativeSalesRouteMount.tsx` and mounted concrete `/dev/apex-ledger/sales/*` subroutes to the existing native Sales production pages while keeping `/dev/apex-ledger/sales` on the Apex overview. Native route guards are reused, and an Apex-only hash bridge keeps internal native Sales navigations inside `/dev/apex-ledger/sales/...`. Frontend typecheck and production build passed. **Next recommended slice: Task 167 Slice 3C-Purchases/Inventory** — mount native Purchases and Inventory operational pages inside Apex using the same route-mount pattern. Estimate: 2-3 hours per module.

**Apex prototype scale restoration complete (2026-06-05).** Inspected `D:\DEV2026\apex-ledger-erp.zip` and restored the candidate shell toward the prototype sizing: full-height `w-64` sidebar, larger sidebar/header/footer/menu rhythm, `p-6` main workspace, and viewport-bound shell scrolling. Frontend typecheck and production build passed. **Manual QA needed:** compare `/#/dev/apex-ledger` against the prototype in English and Arabic RTL before treating the visual shell as cutover-ready. Estimate: 20-30 minutes visual QA.

**Apex Company Settings sidebar parity complete (2026-06-05).** Apex now mirrors the main shell's footer-level Company Settings block instead of showing the old Apex user/profile footer. Company Admin, currencies, tax-code, notification, and communication settings links route through `/dev/apex-ledger/...` and mount the native protected pages inside Apex. Frontend typecheck and production build passed. **Manual QA needed:** expand the footer in English and Arabic RTL and click every Company Settings child. Estimate: 10-15 minutes.

**Apex prototype typography restoration complete (2026-06-05).** Compared the downloaded prototype source against ERP03 global typography. Apex now loads Inter 400-900 and JetBrains Mono 400-800, scopes the Apex shell to those fonts, and temporarily restores root font scale to 100% while mounted so it is not shrunk by the main shell's 90% global dashboard scale. Frontend typecheck and production build passed. **Manual QA needed:** compare sidebar/topbar/module labels and mono metadata against the downloaded prototype. Estimate: 10-15 minutes.

**Apex Purchases and Inventory native page mounting complete (2026-06-05).** Added shared `NativeModuleRouteMount.tsx` and mounted concrete `/dev/apex-ledger/purchases/*` and `/dev/apex-ledger/inventory/*` subroutes to the existing native production pages while keeping `/dev/apex-ledger/purchases` and `/dev/apex-ledger/inventory` on the Apex workbench overviews. Native route guards are reused, and an Apex-only hash bridge keeps internal native Purchases/Inventory navigations inside `/dev/apex-ledger/...`. Frontend typecheck and production build passed. **Next recommended slice: Task 167 Slice 3C-Settings/RBAC/AI** — mount the remaining native Settings/RBAC and AI pages inside Apex. Estimate: 2-3 hours.

**Apex Settings/RBAC/AI native page mounting complete (2026-06-06).** Extended `NativeModuleRouteMount.tsx` so `/dev/apex-ledger/settings/*` renders native Settings/RBAC pages and `/dev/apex-ledger/ai/*` renders native AI Assistant pages through the existing `/ai-assistant/*` route components. Company Settings footer routes still use `NativeCompanySettingsRouteMount`, and `/dev/apex-ledger/settings/accounting` still mounts the Accounting Settings detail page. Frontend typecheck and production build passed. **Next recommended slice: Task 167 Slice 3D** — add an Apex tenant-shell feature flag and run full cross-role/module/empty-tenant cutover QA. Estimate: 2-4 hours.

**Apex route coverage gap audit complete (2026-06-06).** Rechecked tenant/native route coverage with a stricter route-table audit and fixed all routes that were still falling to Apex placeholders. Accounting Setup, Recurring Vouchers, Cost Centers, Voucher Detail/View/Demo, Voucher Designer, Budgets, Subgroup Tagging, Tools Forms Designer, Companies, Notifications, Company Admin, HR, POS, Super Admin, Company Wizard, CRM, Manufacturing, Projects, and Canvas Dev now route through native production pages inside Apex where no Apex-native page exists. Strict audit result: 185 tenant routes checked, 0 placeholder fallbacks. Follow-up sidebar-link audit found and fixed stale Apex sidebar URLs for Sales Analytics, Aged Backlog, Sales/Purchases Voucher Designer, Purchases Analytics, Low Stock Alerts, Unsettled Costs, Inventory Valuation, Budgets, and Subgroup Tagging. Sidebar audit result: 79 Apex sidebar paths checked, 0 missing route matches. Frontend typecheck and production build passed. **Boundary:** this is route continuity, not Apex visual redesign of every native page; Super Admin still requires separate platform-role QA before default-shell cutover.

**Posting-Authority epic — ALL STAGES 0–7 COMPLETE (2026-06-03).** The "one guard at the ledger door" architecture is fully realized: forged-stamp killed (Stage 1), approval centralized (2a/2b/2c), period-lock unified (3), reporting decoupled (F8), `PostingGateway` is the sole ledger door enforced by an arch test (4), uniform `{ guard, code }` rejection contract (5), vocabulary standardized (6), future hooks documented but unbuilt (7). Reports 155–161. **Only optional follow-up: Stage 4b** — fold the system-voucher exemptions (settlements, payment-sync, bank-rec, year-end closing; `grep "enforcePolicies: false" backend/src`) into the policy set so even those run the full rulebook. Behavioural — run `erp-reviewer` first.

**Posting-Authority Stage 5 — Uniform Rejection Contract (2026-06-03):** Law 5 landed. `toRejectionContract(err)` (`backend/src/domain/shared/errors/RejectionContract.ts`) maps every guard error onto `{ guard, code, message, fieldHints }`; the active error handler now surfaces `guard` + `code` consistently and gained a proper 422 branch for `CreditLimitExceededError`. Full backend suite green (139 suites, 1307 tests). Report: [done/160-stage-5-uniform-rejection-contract.md](./done/160-stage-5-uniform-rejection-contract.md).

**Posting-Authority Stage 4 — PostingGateway / Guard at the Door (2026-06-03):** Built `PostingGateway` (`backend/src/application/accounting/services/PostingGateway.ts`) — the single, mandatory choke point and the **only** code permitted to call `ILedgerRepository.recordForVoucher`. All 11 production posting paths migrated to it. The Sales/Purchase subledger path runs the full policy set **through** the gateway (enforce mode, approval derived from the caller — Law 7). The other 10 system/manual sites carry an explicit `enforcePolicies: false` + mandatory `exemptionReason` (greppable; zero behavioural change). Architecture test now forbids any direct `recordForVoucher` caller. Full backend suite green: **138 suites, 1301 tests, 0 failures.** Report: [done/159-stage-4-posting-gateway.md](./done/159-stage-4-posting-gateway.md). **Next: Stage 4b** — fold the system-voucher exemptions (settlements, payment-sync, bank-rec, year-end closing) into the policy set so even those run the full rulebook (today they pass the door + iron laws only).

**Posting-Authority Stage 2c — Per-Module Approval Flag Retired (2026-06-03):** Removed `requireApprovalBeforePosting` from `SalesSettings`/`PurchaseSettings` (entities, DTOs, use cases) and from the Sales/Purchase Settings UI + API contracts. Approval enforcement is now driven entirely by the central `AccountingPolicyConfig.approvalRequired` + per-type exemptions (Stage 2a). Backend typecheck clean; frontend typecheck clean; 5 affected suites (47 tests) green. The `Stage 2` architecture assertion in `PostingAuthority.test.ts` is now active. Report: [done/158-stage-2c-retire-per-module-approval-flag.md](./done/158-stage-2c-retire-per-module-approval-flag.md).

**Posting-Authority Reporting Decoupling (2026-06-03, Stage 4 / F8):** Decoupled Sales (`ReceivablesReportingUseCases`) and Purchases (`PurchasesReportingUseCases`) reporting from direct imports of `ILedgerRepository` and dependency on `IVoucherRepository` by re-exporting `AccountStatementEntry` from `LedgerUseCases` and injecting `GetVoucherUseCase` instead. Updated controllers and unit tests accordingly. Cleaned up the `AccountingBoundary.test.ts` violations completely. Report: [done/157-decouple-reporting-boundary.md](./done/157-decouple-reporting-boundary.md).

**Posting-Authority Period-Lock Unification (2026-06-03, Stage 3):** Consolidated period locking logic by refactoring `PeriodLockService` to be a thin adapter delegating all checks directly to `PeriodLockPolicy` under the hood. Added architecture test assertion checking that `PeriodLockService` contains no duplicate checks. Report: [done/156-period-lock-unification.md](./done/156-period-lock-unification.md).

**Posting-Authority Decoupling & Reactive Approvals (2026-06-03, Stage 2b):** Decoupled `PostSalesInvoiceUseCase` and `PostPurchaseInvoiceUseCase` from local settings-based approval flags. They now pass the real approval context to `SubledgerVoucherPostingService`. Unapproved postings are rejected by the centralized accounting guard with code `APPROVAL_REQUIRED`, which the use cases catch and handle by transactionally parking the document status as `PENDING_APPROVAL`. Report: [done/155-posting-authority-decoupling.md](./done/155-posting-authority-decoupling.md).

**AI floating launcher toggle completed (2026-06-02):** AI Settings now has **Show Floating AI Launcher**. It persists as `AiProviderConfig.showFloatingAssistant`, defaults ON for old tenants, and the global launcher reads a small chat-permission endpoint so normal chat users respect the admin setting without full settings access. The launcher icon now uses an AI brain/sparkles visual. Report: [done/153-ai-floating-assistant-launcher-toggle.md](./done/153-ai-floating-assistant-launcher-toggle.md). QA item added to [QA-QUEUE.md](./QA-QUEUE.md). No accounting/posting behavior changed.

**Native-detail contract — frontend wins landed (2026-06-01, Task 148):** Quotation frontend
contract complete (`5d8d3f17`); **Delivery Note & Sales Return drafts are now editable**
(`06256cda`) via existing `updateDN`/`updateReturn`. Frontend build/tsc green. The contract
doc's "backend already supports messaging" claim was **wrong** — messaging + attachments are
**Sales-Invoice-only**; non-invoice messaging/attachments, DN/SR Cancel, and quote audit
emission are filed in [tasks/152-sales-doc-messaging-attachments-backend.md](./tasks/152-sales-doc-messaging-attachments-backend.md).
**Next frontend wins (no backend):** (1) backport SO's RBAC credit-override gate to Sales
Invoice Detail — security finding F34; (2) swap SO's bespoke status badge for shared
`StatusChip`; (3) full-page i18n sweep for DN/SR/SO. NOTE: the working tree carries heavy
uncommitted WIP (communications backend module + SI refactor + a stray `frontend/src.zip`)
— commit work with explicit pathspec to avoid bundling it.

**Sales Invoice V2 Card Layout Mockup Alignment (2026-06-01):** Aligned `/dev/sales-invoice-v2` (`SalesInvoiceV2LayoutPage.tsx`) dev mockup to Variant V2 card layout with 5 cards (Core Settings, Financial Details, line items table, actions and allocation grid, totals and actions footer), smart selectors, Syrian tax preset calculations, mock action modals, and simulated lifecycle state switching. Report: [done/150-sales-invoice-page-refinement.md](./done/150-sales-invoice-page-refinement.md).

**Purchase direct invoicing governance fix (2026-06-01):** Purchase Settings now maps the OPERATIONAL **Allow Direct Invoicing** toggle to the explicit company-scope `direct` governance rule required by `DocumentPolicyResolver`. New OPERATIONAL purchase defaults are strict-by-default. Report: [done/151-purchase-direct-invoicing-governance.md](./done/151-purchase-direct-invoicing-governance.md).


**Done report:** [done/142-phase-1-p0-confirms-dates-taxonomy.md](./done/142-phase-1-p0-confirms-dates-taxonomy.md).

**Settings taxonomy foundation (2026-05-30):** Settings Home is now a real hub grouped by business purpose (General, Workflow, Accounting and Tax, Access and Advanced). `ModuleSettingsLayout` has responsive mobile/desktop tabs and translatable unsaved-change copy. Docs: [docs/architecture/settings.md](../docs/architecture/settings.md), [docs/user-guide/settings/settings-home.md](../docs/user-guide/settings/settings-home.md). Report: [done/143-settings-taxonomy-foundation.md](./done/143-settings-taxonomy-foundation.md).

**Invoice list standardization (2026-05-30):** Sales and Purchase invoice lists now share the same operational-list pattern: `PageHeader`, shared `PartySelector` customer/vendor filters, refresh/clear actions, status/payment chips, `EmptyState`, and explicit Open row action. Docs: [docs/architecture/operational-lists.md](../docs/architecture/operational-lists.md), [docs/user-guide/lists/invoice-lists.md](../docs/user-guide/lists/invoice-lists.md). Report: [done/144-invoice-list-standardization.md](./done/144-invoice-list-standardization.md).

**Voucher and item list standardization (2026-05-30):** Accounting Vouchers now uses the shared outer `PageHeader` while keeping its specialized `VoucherFiltersBar`/`VoucherTable`. Inventory Items now has consistent header, search/filter, refresh/clear, empty state, status chips, Open action, and create/load toast feedback. Docs: [docs/architecture/operational-lists.md](../docs/architecture/operational-lists.md), [docs/user-guide/lists/accounting-and-items-lists.md](../docs/user-guide/lists/accounting-and-items-lists.md). Report: [done/145-voucher-and-item-list-standardization.md](./done/145-voucher-and-item-list-standardization.md).

**Raw date input cleanup (2026-05-30):** Remaining native `type="date"` controls were replaced with shared `DatePicker` in Stock Movements, Stock Transfers, Sales Promotions, Sales Price Lists, and generic `DataTableFilter` date-range filters. Raw date scan across `frontend/src` now returns no matches. Docs: [docs/user-guide/lists/date-controls.md](../docs/user-guide/lists/date-controls.md). Report: [done/146-raw-date-input-cleanup.md](./done/146-raw-date-input-cleanup.md).

**Sidebar forms grouping rework (2026-05-31):** Removed the v1 default-suppression rule in `useSidebarConfig`; per-module defaulting now lands accounting forms in **Vouchers** (with *All Vouchers* dynamically prepended), sales/purchase defaults in **Default Forms**, and groupless sales/purchase clones at the **root** of the module sidebar. Accounting's static `Forms` group is gone — *Approval Center* is now a root-level Accounting item. Authoritative policy: [docs/architecture/sidebar-forms-grouping.md](../docs/architecture/sidebar-forms-grouping.md). Report: [done/147-sidebar-forms-grouping-rework.md](./done/147-sidebar-forms-grouping-rework.md).

**Next step:** Native functionality retest. Once the chrome is polished (Task 132 Phase 5 complete), walk every native voucher flow end-to-end per module (create / edit / post / pay / cancel / void / send / attach / audit / period-lock override / credit override). Captures regressions and a real polish backlog.

**Visual Layout Editor Polish & Auto Align (2026-05-30):**
- Fixed 12-to-24 column grid coordinate double-scaling bug by implementing versioned `layoutVersion = 2` checks.
- Refined Properties Panel triggers to only open when the Pencil edit icon is explicitly clicked.
- Added `Width: {span}` labels directly to canvas component boxes for better alignment visibility.
- Defaulted layout placement/missing field span to 6 (4 components per row).
- Implemented the smart **Auto Align** button toolbar action to clean and wrap canvas layouts to sequential rows of span 6 components.

**Field Library Phase C1 is complete**:

1. Forms Management now loads the tenant Field Library read API.
2. The existing saved form shape (`headerFields`, `tableColumns`, `uiModeOverrides`) is unchanged.
3. Current module-specific mandatory/optional semantics are preserved until Phase C2 introduces true Layer 2 type bindings.
4. Required accounting/sales/purchase fields, selector fields, and posting-related controls were not relaxed.

**Field Library Phase C2 is implemented**:

1. Super-admin voucher templates now load the Field Library API.
2. Header/Line authoring offers Field Library entries instead of frontend hardcoded voucher suggestions.
3. Table column suggestions derive from the template's own `layout.lineFields`.
4. Type-level placement/mandatory status is controlled by the voucher template while Field Library remains the official field metadata source.

Phase C1 actual: **~1.9 hours**. Report: [135c-field-library-phase-c1.md](./done/135c-field-library-phase-c1.md).
Phase C2 actual: **~1.2 hours**. Report: [135d-field-library-phase-c2.md](./done/135d-field-library-phase-c2.md).

Remaining Field Library follow-up estimate: **2-4 hours**:
- Add `fieldVersionsSeen` and company-form drift warnings.
- Decide whether the Field Library seed needs tighter `supportedTypes` scoping for super-admin convenience.

---

## Earlier Purchases focus (still open after the Field Library arc)

Piece A and Piece B are complete:

1. Customer/vendor per-party AR/AP account generation is implemented.
2. Backfill is available for existing parties.
3. Customer Statement now uses `GetAccountStatementUseCase` through `Party.defaultARAccountId`.
4. Statement rows are decorated from voucher metadata for source-document and accounting-voucher drill-down.
5. Open Sales Orders can be included as non-balance commitments.

Vendor Statement parity is now also complete:

1. Vendor Statement uses `GetAccountStatementUseCase` through `Party.defaultAPAccountId`.
2. Missing AP account returns `VENDOR_AP_ACCOUNT_MISSING`.
3. AP balances display as positive amount owed while preserving ledger debit/credit sides.
4. Rows are decorated from voucher metadata for Purchases source-document and accounting-voucher drill-down.
5. Open Purchase Orders can be included as non-balance commitments.

Phase F progress:
1. Ledger-backed AR Aging — migrated from Sales-only _buildRawEvents to Accounting ledger with unallocated diff display.
2. AP Aging report — new, mirrors AR Aging for vendors via defaultAPAccountId.
3. Purchases Analytics — purchases-by-vendor + purchases-by-item reports, frontend page with mode toggle.
4. Purchase Audit Log — reused RecordAuditController, wired to /tenant/purchase/audit-log.
5. Dead code cleanup — removed old GetCustomerStatementUseCase and its tests.
6. PI Attachments — tenant-scoped vendor bill/supporting evidence attachments on Purchase Invoices (report 129).
7. Vendor Groups — optional supplier segmentation master data with vendor Party assignment (report 130).
8. Purchase Price Lists — optional currency-specific supplier pricing agreements (report 131).

Remaining parity gaps (prioritized):
- RFQ (Request for Quotation) — bigger feature, 2-3 hours

---

## Earlier focus (archived for context)

**Task:** Sales completion roadmap — **Phases A ✅ B ✅ C ✅ D (all) ✅ E ✅**
**Status:** running phases autonomously (manual QA gates deferred per user instruction)
**Branch:** `feat/phase-a-sales-master-data`
**Plan:** [planning/tasks/sales-and-purchases-completion-roadmap.md](./tasks/sales-and-purchases-completion-roadmap.md)
**Done reports:** [108 — Phase A](./done/108-phase-a-master-data-pricing.md), [109 — Phase B](./done/109-phase-b-sales-operational.md), [110 — Phase C](./done/110-phase-c-sales-finance-reporting.md), [111 — Phase D.2+D.3](./done/111-phase-d-period-lock-audit-log.md), [112 — Phase D.4](./done/112-phase-d4-recurring-invoices.md), [113 — Phase D hardening audit](./done/113-phase-d-audit-hardening.md), [114 — Phase D.5 sales-return enhancements](./done/114-phase-d5-sales-return-enhancements.md), [115 — Phase D.7 invoice templates](./done/115-phase-d7-invoice-templates.md), [116 — Phase D.8 WhatsApp outbound messaging](./done/116-phase-d8-whatsapp-outbound-messaging.md), [117 — D.8 multi-tenant sender-accounts hardening](./done/117-d8-multitenant-messaging-hardening.md), [118 — D.8 Telegram outbound execution](./done/118-d8-telegram-outbound-execution.md), [119 — Phase D.6 invoice attachments](./done/119-phase-d6-invoice-attachments.md), [120 — Phase E sales cleanup](./done/120-phase-e-sales-cleanup.md)

## Where we are

Phases A, B, C are built, type-clean, and unit-tested. Phase D control stack is now complete: D.2 Period Lock, D.3 per-record audit log, D.4 recurring invoices, D.5 sales-return enhancements, D.6 invoice attachments, D.7 controlled invoice templates, and D.8 outbound messaging.

Latest hardening (report 117) corrected D.8 architecture to true multi-tenant behavior:
- per-company sender accounts in `Sales Settings -> Communications`
- encrypted per-account credentials
- multiple sender accounts per company with default/active routing
- invoice send modal supports sender selection per message

Phase D is now functionally closed. Email delivery execution remains a follow-up channel under the tenant-scoped provider/account abstraction.

Commits on `feat/phase-a-sales-master-data`:
- `5949f314` — Phase A (master data & pricing)
- `4e9ce801` — Phase B.0–B.3 checkpoint
- `b9718462` — Phase B.4–B.6
- _(pending)_ — Phase C
- _(pending)_ — Phase C/D commits not yet finalized in this branch snapshot

## Carried-forward follow-ups

- Promotion evaluator built + tested but not auto-invoked in SO/SI creation.
- Credit check enforced at SO confirm only — not on direct SIs.
- Backorder / partial-fulfillment frontend UX deferred.
- Quote numbering uses a `Q-<timestamp>` fallback (no sequence in SalesSettings).
- Commission accrual auto-wired (B.0); credit-hold enforcement live (B.2).
- AI-assistant test failures currently present in full suite: 3 in `SendChatMessageUseCase` (credits/runtime-mode path) + 1 in `AiModelCertificationUseCase` (global recommended query expectation). Unrelated to Sales D8 but now tracked for stabilization.
- D.2 period-lock override UI wired on SI/DN/SR detail pages; SO detail page has History button but no posting (SO confirm already has credit-override flow).
- **D.3 follow-up — SO confirm/cancel/close and SI payment record/status are NOT audited** (only Create/Update/Post/Override are). Add in Phase E if needed.
- **🔥 Scheduled Tasks Engine (HIGH PRIORITY, blocks recurring features across modules)** — D.4 ships templates + a manual "Generate Due" button but NO scheduler. Same gap will hit HR payroll, Accounting recurring vouchers, Purchase recurring POs, system cleanup, etc. Build a single shared engine that every module registers against, not per-feature crons. Spec: [planning/tasks/scheduled-tasks-engine.md](./tasks/scheduled-tasks-engine.md). User-facing notice added to Recurring Invoices page in the meantime.
- **D.2 follow-up — Period-lock override governance (Phase E):**
  - Role-gate the **Override Period Lock** button so only authorized roles (e.g. Controller / CFO / Accounting Manager) see it. Hide for staff/operators.
  - Add a clear option in **Accounting → Settings → Fiscal** under Period Locking:
    - Toggle: **Allow soft-lock overrides** (default ON). When OFF, the override path is fully disabled and the soft lock behaves like a hard lock for all users.
    - Multi-select: **Roles permitted to override** (default: Controller, CFO).
  - Backend must enforce both — UI gating is not enough; the override endpoint must re-check role + the allow-override toggle and reject otherwise (clear error, audit-logged attempt).
- `record_change_logs` Firestore composite index added to `firestore.indexes.json` — must be deployed before production use.
- ✅ **COA template defaults fixed (2026-05-28):**
  - Generic catch-all defaults added across templates for perpetual-mode readiness:
    - AP (`20100 Accounts Payable - General`)
    - Revenue (`400 Sales Revenue` in Standard + aligned revenue defaults in industry templates)
    - COGS (`50100 Cost of Goods Sold - General` where applicable)
    - GRNI (`209` in Standard/industry templates; `203` GRNI in Simplified)
  - Comprehensive template upgraded from placeholder to full enterprise chart.
  - Related commits: `30055d9f`, `4385873d`.
  - Follow-up: add wizard-side validation/auto-create warning when required perpetual defaults do not resolve.
- `PeriodLockService` is now wired into `buildAccountingPostingService()` — enforcement is live for all Sales posting paths.
- D.7 full free-canvas/sketch-board invoice designer is deferred; current model is controlled template selection via Forms Designer templates.

## Sequence (remaining)

1. ✅ **Phase A** — Sales master data + pricing — DONE (report 108)
2. ✅ **Phase B** — Sales operational — DONE (report 109)
3. ✅ **Phase C** — Sales finance & reporting — DONE (report 110)
4. ✅ **Phase D** — Sales auditability & control
   - ✅ D.1 GL Impact modal (pre-built, i18n fixed)
   - ✅ D.2 Period lock date (built + audited + 14 fixes applied)
   - ✅ D.3 Per-record audit log (built + audited + 14 fixes applied)
   - ✅ D.4 Recurring invoices (templated + scheduled, 19 tests)
   - ✅ D.5 Sales-return enhancements — DONE (report 114)
   - ✅ D.6 Document attachments — DONE (report 119)
   - ✅ D.7 Multiple invoice templates (controlled model) — DONE (report 115)
   - ✅ D.8 Outbound messaging — DONE as WhatsApp-first integration (report 116)
   - ✅ D.8 hardening — multi-tenant sender account isolation + encrypted per-company credentials (report 117)
   - ✅ D.8 follow-up — Telegram outbound execution (report 118)
5. ✅ **Phase E** — Sales cross-cutting cleanup — DONE (report 120; merged via 249bb86)
6. **⚠ Sales QA cycle** — Phase C run 2026-05-27, conditionally passing; see [121 — Phase C QA Results](./done/121-phase-c-qa-results.md). 11 findings; 1 report-code bug (credit notes missing from Customer Statement/Ledger), the rest upstream data/COA issues.
7. **Phase F** — Purchases parity — 4-5 days
8. **Phase G** — Purchases-specific (three-way match + vendor master) — 3-4 days
9. **Phase H** — Final hardening — 1 week

## Rabbit Holes

*(None)* — the reporting/repository violation that lived here was fixed in Stage F8 (report 157).

## Next action

Execute **Task 167 Slice 3D — Apex tenant-shell feature flag & cutover QA (estimated 2-4 hours)**:
1. Integrate Apex tenant-shell feature flag.
2. Verify role-based navigation and bundle permissions.
3. Perform empty-tenant database data checks and verify UI visual styling behaves correctly.
