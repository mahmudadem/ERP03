# 🎯 Current Focus

**Strategy (2026-05-30):** v1 ships natives as the primary surface. Default Forms / Field Library / cloning preserved as v2 customization path, hidden from sidebar for now. See journal entry "v1 strategy decision" for full reasoning.

**Active threads (execution order set 2026-05-30):**
1. **Task 132 chrome work** — shell cleanup, sidebar IA polish, settings taxonomy, action safety, RTL/i18n. **Each touched component is authored mode-aware from the start** (reads `uiMode` from `useUserPreferences`; both `'classic'` and `'windows'` renderings provided and tested via the TopBar UIModeWidget). No infrastructure work needed — `UiMode` context, `AppShell` mode branch, and `UIModeWidget` already exist.
2. **Native functionality retest** — once the chrome is polished, walk every native voucher flow end-to-end per module (create / edit / post / pay / cancel / void / send / attach / audit / period-lock override / credit override). Captures regressions and a real polish backlog.
3. **Native UI-mode awareness (per-voucher)** — hardcoded polished renderings for web AND Windows card/window mode for each native voucher page. Standard in [tasks/132-ux-layout-production-hardening.md](./tasks/132-ux-layout-production-hardening.md) Phase 4.5. Last because it depends on stable chrome + verified functionality.

**Latest completion reports:** [127-tailwind-play-theme-and-styling.md](./done/127-tailwind-play-theme-and-styling.md), [128-coa-template-defaults-and-comprehensive-coa.md](./done/128-coa-template-defaults-and-comprehensive-coa.md), [129-phase-f-pi-attachments.md](./done/129-phase-f-pi-attachments.md), [130-phase-f-vendor-groups.md](./done/130-phase-f-vendor-groups.md), [131-purchase-price-lists.md](./done/131-purchase-price-lists.md), [132-topbar-widget-tray-and-unified-settings.md](./done/132-topbar-widget-tray-and-unified-settings.md), [133-fix-designer-wizard-fields.md](./done/133-fix-designer-wizard-fields.md), [134-forms-management-page-polish.md](./done/134-forms-management-page-polish.md), [135a-field-library-phase-a.md](./done/135a-field-library-phase-a.md), [135b-field-library-phase-b.md](./done/135b-field-library-phase-b.md), [135c-field-library-phase-c1.md](./done/135c-field-library-phase-c1.md), [135d-field-library-phase-c2.md](./done/135d-field-library-phase-c2.md), [136-sidebar-form-grouping-policy.md](./done/136-sidebar-form-grouping-policy.md), [138-forms-visual-fixes.md](./done/138-forms-visual-fixes.md), [139-vertical-stepper-wizard.md](./done/139-vertical-stepper-wizard.md), [140-visual-layout-overflow-fixes.md](./done/140-visual-layout-overflow-fixes.md).

**Deferred to v2 (preserved as roadmap, no code removed):** [tasks/native-to-default-forms-migration.md](./tasks/native-to-default-forms-migration.md), [tasks/137-si-direct-capability-audit.md](./tasks/137-si-direct-capability-audit.md).

## 👉 Next agent — start here

**Task 132 Phase 1 partial (2026-05-30):** see [tasks/132-phase-0.5-inventory.md](./tasks/132-phase-0.5-inventory.md). **Done this session:**
- 3 posting-reversal `window.confirm` in Purchases (PI/GR/PR unpost) → `ConfirmDialog` with danger tone.
- Raw `type="date"` swapped for shared `DatePicker` on 4 finance-sensitive pages: SalesInvoiceDetail (4 instances), QuotationDetail (2 instances), PurchaseInvoiceDetail (2 settlement rows), InventoryFinancialIntegrationWizard.
- `AccountForm` hierarchy `alert()` → `errorHandler.showWarning`.
- 17 admin/security `window.confirm` sites migrated via new `useConfirm()` hook ([frontend/src/hooks/useConfirm.tsx](../frontend/src/hooks/useConfirm.tsx)): SuperAdminShell logout, super-admin Companies/Users/Entitlements impersonate/promote/demote/revoke, company-admin Users/Roles/Bundles, RBAC AssignUsersRoles, VoucherFormDesigner, DocumentFormDesigner, VoucherTypeManager, ItemMasterCard.
- `GenericVoucherRenderer` "Feature to be implemented" `alert()` → soft `showInfo` toast.
- Feedback taxonomy doc: [docs/architecture/frontend-toast-taxonomy.md](../docs/architecture/frontend-toast-taxonomy.md).
- Enforcement: [frontend/scripts/check-no-confirm.mjs](../frontend/scripts/check-no-confirm.mjs) blocks builds on new raw `window.confirm`/`alert`. Wired into `npm run build`. Allowlist seeded with 11 remaining super-admin AI/cert/template/wizard sites + the 2 frozen-scope topbar widgets + DocumentDesigner preview stubs — must shrink to zero.

**Kept dev/demo routes visible** (per user request — pre-deployment).

**Deferred — left in allowlist:** 11 super-admin AI/cert/voucher-template confirms, useAiSettings deprecate confirm, DocumentDesigner preview stubs. Migrate as part of the AI super-admin polish thread.

**Next step:** continue Phase 1 — promote `AccountSelectorSimple` + `DatePicker` to `components/shared/selectors/` (move + shim re-export), then move on to Phase 2 (list/action standardization) per [tasks/132-ux-layout-production-hardening.md](./tasks/132-ux-layout-production-hardening.md).

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

- Architecture boundary test failure (`AccountingBoundary.test.ts`): `PurchasesReportingUseCases` and `ReceivablesReportingUseCases` violate dependency rules by importing accounting repository interfaces directly. Needs decoupling via clean use-cases or services.

## Next action

Start **#1 Task 132 chrome work** with the mode-aware contract:

1. **Task 132 Phase 0.5 (inventory)** — catalog the chrome surface: which shell/sidebar/topbar/settings/list pages already honor `uiMode`, which use raw `window.confirm` / `alert()`, which embed page-local account/date/party selectors instead of shared ones. The audit feeds Phases 1–6.
2. **Task 132 Phase 1 (shell cleanup)** — hide dev/demo routes from tenant nav, consolidate React Query providers, fix hash-router auth links. Verify both modes by toggling UIModeWidget.
3. Proceed through Phases 2 / 3 / 5 / 6 in order, each ending in a two-mode visual check.

Phases 4 / 4.5 (list/table standardization + entity cards + report contract) touch the same surfaces as #2 (per-voucher mode polish) and may merge with that thread when it activates.
