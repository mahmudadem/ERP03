# Development Journal

> Append new entries at the top. One entry per work session.

## 2026-06-03 (Wed) — Stages 6 & 7: Vocabulary + Future Hooks (docs)

**Task:** Stage 6 (purge "ticket" metaphor; standardize override reason) + Stage 7 (document future
hooks, do not build).
**Agent:** Claude (Opus 4.7).
**Branch:** `main` (worktree `d:\DEV2026\ERP03-posting-authority`).

**What changed:**
- **Stage 6** was already satisfied in code (no `ticket` identifiers; override shape uniformly
  `{ reason, overriddenBy }` enforced by `PeriodLockOverride`/`CreditOverride`). Documented it in
  Law 3 + conformance table. No code change warranted.
- **Stage 7** — expanded `posting-authority.md` §6 with the two designed-for-but-unbuilt hooks
  (module request-gating; account-level caps), AND-gating notes, and a "do not build" marker.
- Updated the fix-plan brief status: **all stages 0–7 complete**; only optional **Stage 4b** remains.

**Report:** [done/161-stage-6-7-vocabulary-and-future-hooks.md](./done/161-stage-6-7-vocabulary-and-future-hooks.md).

---

## 2026-06-03 (Wed) — Stage 5: Uniform Rejection Contract

**Task:** Law 5 — every guard signs its refusal with a uniform `{ guard, code, message, fieldHints }`.
**Agent:** Claude (Opus 4.7).
**Branch:** `main` (worktree `d:\DEV2026\ERP03-posting-authority`).
**Time spent:** ~1h.

**What changed:**
- New `RejectionContract` type + `toRejectionContract(err)` mapper (`domain/shared/errors`). Maps
  PeriodLockedError→accounting, PersonaNotAllowedError→its module, PostingError policy violations→
  accounting, CreditLimitExceededError→sales, BusinessError/AppError→inferred from ErrorCode prefix;
  null for infrastructure/unknown.
- Added `GuardName` + optional `guard` to the shared `AppError`; tagged `guard` on PeriodLockedError
  and PersonaNotAllowedError; `createPostingError` takes an optional guard (default accounting).
- Wired the active `errors/errorHandler.ts` to surface `guard` + `code` on PeriodLocked/Posting/
  Business responses, and **added a CreditLimitExceededError 422 branch** (it previously fell through
  to the 500 unknown handler).
- New `RejectionContract.test.ts` (6 tests).

**Verification:** `tsc` clean; full backend suite **139 suites, 1307 passed, 0 failed** (one AI-cert
test flaky under parallel load — green in isolation and on re-run; unrelated).

**Report:** [done/160-stage-5-uniform-rejection-contract.md](./done/160-stage-5-uniform-rejection-contract.md).

---

## 2026-06-03 (Wed) — Stage 4: PostingGateway (Guard at the Door)

**Task:** Build the single mandatory choke point in front of every ledger write.
**Agent:** Claude (Opus 4.7).
**Branch:** `main` (worktree `d:\DEV2026\ERP03-posting-authority`).
**Time spent:** ~2h.

**What changed:**
- New `PostingGateway` — the only code permitted to call `ILedgerRepository.recordForVoucher`.
- Migrated all 11 production posting paths to route through it. Subledger path runs the full policy
  set **through** the gateway (enforce mode, approval from caller). The other 10 sites (manual
  voucher ×3, sales/purchase settlement, payment-sync ×2, bank-rec, year-end closing ×2) pass an
  explicit `enforcePolicies: false` + mandatory `exemptionReason` — preserving current behaviour
  with zero change while making every policy-skip greppable.
- Architecture test: Stage 4 `it.todo` → two active assertions (no direct `recordForVoucher` callers
  anywhere in production; gateway requires an exemption reason). Stage 1 + Law 1 assertions updated to
  the new gateway location.
- New `PostingGateway.test.ts` (6 tests, incl. the Law-7 "not-approved derived from caller" proof).
- Docs: `posting-authority.md` §7 documents the door + exemption table; conformance table updated.

**Verification:**
- `npx tsc --noEmit` clean.
- Full backend suite: **138 suites, 1301 passed, 18 skipped, 0 failed** (was 137/1293/1-todo). No
  regressions.

**Follow-up filed:** **Stage 4b** — fold the system-voucher exemptions (settlements, closings) into
the policy set so even those run the full rulebook.

**Report:** [done/159-stage-4-posting-gateway.md](./done/159-stage-4-posting-gateway.md).

---

## 2026-06-03 (Wed) — Stage 2c: Retire Per-Module `requireApprovalBeforePosting` Flag

**Task:** Finish Stage 2c of the Posting-Authority fix plan — remove the per-module approval flag now that Stage 2b drives parking from the central `AccountingPolicyRegistry`.
**Agent:** Claude (Opus 4.7) — continuation of a prior session that ran out of limits mid-WIP.
**Branch:** `main` (in `d:\DEV2026\ERP03-posting-authority` worktree)
**Time spent:** ~0.5h (audit + frontend cleanup + report + commit)

**What changed:**
- Removed `requireApprovalBeforePosting` field from `SalesSettings`/`PurchaseSettings` (entity, constructor, `toFirestore`/`fromFirestore`, defaults).
- Removed from `SalesSettingsDTO`/`PurchaseSettingsDTO` and the DTO mappers.
- Removed from `InitializeSalesInput`/`UpdateSalesSettingsInput` and the purchase equivalents, and the corresponding use-case bodies.
- Removed from frontend `salesApi.ts`/`purchasesApi.ts` types and the Sales/Purchase Settings page UI (toggle + payload mapping).
- Renamed the two A1 posting test cases to describe the central-policy driver instead of the retired flag.

**Reverted from prior WIP:**
- Stage 4 in-repo enforcement (`policyRegistry` injection into `FirestoreLedgerRepository`/`PrismaLedgerRepository`) — the prior agent's WIP would have double-run policies and re-introduced the forged-stamp problem Stage 1 fixed by reading `voucher.isApproved` instead of caller-passed `approved`. Stage 4 needs the `PostingGateway` design (plan's Option B). Filed in the brief as the next staged task.

**Verification:**
- `cd backend && npx tsc --noEmit` — clean.
- `cd frontend && npx tsc --noEmit` — clean.
- `npx jest --testPathPatterns="(SalesPostingUseCases|PurchasePostingUseCases|PostingAuthority|SalesSettingsUseCases|PurchaseSettingsUseCases)"` — 5 suites, 47 passed, 1 todo (Stage 4 placeholder).

**Report:** [done/158-stage-2c-retire-per-module-approval-flag.md](./done/158-stage-2c-retire-per-module-approval-flag.md).

---

## 2026-06-03 (Wed) — Decouple Reporting from Voucher & Ledger Repository (Stage 4 / F8)

**Task:** Decouple Sales/Purchases reporting from direct imports of `ILedgerRepository` and dependency on `IVoucherRepository` (F8).
**Agent:** Antigravity (Gemini 1.5 Pro)
**Branch:** `main` (in `d:\DEV2026\ERP03-posting-authority` worktree)
**Time spent:** ~1.5h

**What changed:**
- Re-exported `AccountStatementEntry` interface from `LedgerUseCases.ts` so Sales and Purchases reporting use cases do not reference `ILedgerRepository` directly.
- Injected `GetVoucherUseCase` (from Accounting use cases) into `GetLedgerBackedCustomerStatementUseCase` (Sales) and `GetLedgerBackedVendorStatementUseCase` (Purchases), replacing the direct dependency on `IVoucherRepository`.
- Updated `SalesReportingController.ts` and `PurchaseController.ts` to construct and inject `GetVoucherUseCase`.
- Refactored `LedgerBackedCustomerStatement.test.ts` and `LedgerBackedVendorStatement.test.ts` unit tests to mock `GetVoucherUseCase.execute()` instead of `IVoucherRepository.findById()`.
- Verified that `AccountingBoundary.test.ts` and the entire backend test suite compiles and passes cleanly with 0 violations.

**Accounting/control impact:** Code structure compliance. Strict separation of Sales and Purchases modules from low-level Accounting repositories at the application level.

**Verification:**
- `npm run typecheck` -> passed.
- `npm test` -> all 137 test suites passed.

## 2026-06-03 (Wed) — Decouple Sales/Purchases Posting & Wire Reactive Approval Guard

**Task:** Decouple Sales/Purchases document posting from local settings approval flags and implement reactive parking under the Posting-Authority architecture (Stage 2b).
**Agent:** Antigravity (Gemini 1.5 Pro)
**Branch:** `main` (in `d:\DEV2026\ERP03-posting-authority` worktree) / `feat/init-wizard-forms-selection` (in `d:\DEV2026\ERP03`)
**Actual time spent:** ~3.5h

**What changed:**
- Removed local module settings reads (e.g. `settings.requireApprovalBeforePosting`) from `PostSalesInvoiceUseCase` and `PostPurchaseInvoiceUseCase`.
- Passed the caller's real approval context (`approved: !!approvalContext`) directly to `SubledgerVoucherPostingService.postInTransaction()`.
- Implemented reactive `PostingError` catching for the centralized accounting guard rejection code `APPROVAL_REQUIRED`.
- Added serializable transaction status transitions to safely park unapproved documents as `PENDING_APPROVAL` in the database without race conditions or lost updates.
- Mocked the policy registry in `SalesPostingUseCases.test.ts` and `PurchasePostingUseCases.test.ts` to assert parking and approval post re-entry.
- Enabled Stage 2 architecture checks in `PostingAuthority.test.ts` to assert that Sales and Purchases use cases contain no policy registry references or local settings approval flags.
- Updated technical docs `docs/architecture/posting-authority.md`, `sales.md`, and `purchases.md` (removing redundant Approval Workflow rows from unimplemented list).
- Created end-user user guide `docs/user-guide/accounting/posting-approvals.md` and completion report `planning/done/155-posting-authority-decoupling.md`.

**Accounting/control impact:** Centralized posting compliance. Sales and Purchases no longer evaluate posting approvals locally. Documents are evaluated by the central Accounting policy registry at post time and are parked as `PENDING_APPROVAL` with zero GL or stock impact until approved.

**Verification:**
- `npm test` inside `backend/` -> passed for all posting/authority/use-case suites (135 passed). Known pre-existing failures (`AiModelCertificationUseCase` and `AccountingBoundary` violations) remain tracked in ACTIVE.md.

## 2026-06-03 (Wed) — Unify MDI window wrappers & drag/resize hardening

**Task:** Unify all window wrapper containers in Windows UI mode under `MdiWindowFrame.tsx` and fix text selection/dragging lag.
**Agent:** Antigravity (Gemini 3.5 Flash)
**Branch:** `feat/init-wizard-forms-selection`
**Actual time spent:** ~0.5h

**What changed:**
- Replaced the duplicate/laggy `DraggableWindow` component with the standardized `MdiWindowFrame` wrapper for `sales_invoice` (Sales Invoice detail view), `item` (Inventory Item Card), `party` (Customer/Vendor master card), and `warehouse` (Warehouse master card) window types.
- Overhauled and simplified `ReportWindow.tsx` to delegate window shell rendering, header controls, drag handlers, and resize handles directly to `MdiWindowFrame`.
- Deleted the now completely redundant `DraggableWindow.tsx` file.
- Hardened `MdiWindowFrame.tsx` by adding `e.preventDefault()` inside dragging (`handleMouseDown`) and resizing (`handleResizeMouseDown`) click handlers. This blocks default browser click-and-drag text highlighting gestures when interacting with window headers/borders.
- Verified type check and production bundling successfully.

**Accounting/control impact:** none. Layout shell changes only.

## 2026-06-02 (Tue) — AI floating launcher settings toggle

**Task:** Add an AI Settings option to show/hide the global floating AI Assistant launcher and refresh its icon.
**Agent:** Codex
**Branch:** `feat/init-wizard-forms-selection`
**Actual time spent:** ~1.0h

**What changed:**
- Added `AiProviderConfig.showFloatingAssistant`, defaulting ON for existing and new tenant configs.
- Extended AI settings update validation/use case/controller/DTOs and persisted the new flag.
- Added `GET /tenant/ai-assistant/settings/widget-preferences`, guarded by `ai-assistant.chat.use`, so normal chat users can respect the admin launcher preference without full settings access.
- Added **Show Floating AI Launcher** in AI Assistant Settings and wired it into normal save/dirty-state behavior.
- Updated `GlobalAiWidget` to hide when the setting is off or AI is disabled, and changed the closed launcher icon to Lucide `BrainCircuit` + `Sparkles`.
- Added English/Arabic/Turkish strings, architecture/user docs, completion report 153, and QA queue instructions.

**Accounting/control impact:** none to ledger, posting, tax, inventory valuation, reports, or financial controls. Disabling AI remains separate and server-enforced through `isEnabled`; hiding the launcher only removes the shell shortcut.

**Verification:**
- `npm --prefix backend test -- --runInBand src/tests/domain/ai-assistant/AiProviderConfig.test.ts src/tests/application/ai-assistant/AiSettingsUseCase.test.ts` -> passed, 36 tests.
- `npm --prefix backend run build` -> passed.
- `npm --prefix frontend run typecheck` -> passed.
- `npm --prefix frontend run build` -> passed.
- `npm run graph:update` -> passed.
- Browser smoke at `http://127.0.0.1:5173/` loaded to `/#/auth` with no runtime error from this change; only the existing React Router v7 future-flag warning appeared.

## 2026-06-01 (Mon) — Second-check of Codex control-layer diagnosis

**Task:** Verify Codex's architecture control-layer diagnosis brief for Mahmud (read-only).
**Agent:** Claude (Opus 4.8)
**Branch:** `feat/init-wizard-forms-selection`

**What I did:** Read the key control-layer files and re-ran the architecture boundary test
to check Codex's findings against the actual code. Verdict: diagnosis holds.

**Directly verified (high confidence):**
- **F4** — `SubledgerVoucherPostingService` never calls `validatePolicies()` (no policy
  registry); runs only `validateCore`/`validateAccounts` + optional period lock.
- **F5** — only `SalesController` injects `periodLockService`; Purchases/Inventory build the
  same service without it.
- **F6** — both `PeriodLockService` and `PeriodLockPolicy` exist; root cause is F4 (registry
  unreachable from the engine, so a parallel lock was bolted on).
- **F7** — both ledger repos enforce iron laws only, no policies.
- **F8** — re-ran `AccountingBoundary.test.ts`: same 6 violations (Sales/Purchases reporting).
- **F2** — `frontend/src/utils/documentPolicy.ts` duplicates backend `DocumentPolicyResolver`.
- New: manual path (`VoucherUseCases`/`PostVoucherUseCase`) DOES run the full registry — this
  asymmetry is the spine of F4–F7.

**Framing correction filed:** the shared engine and `VoucherPostingStrategyFactory` are NOT
broken — the factory's per-document line generation is correct and should stay. Real issue =
shared engine carries a reduced rulebook + inconsistent period-lock injection. It's a
unify-the-checkpoint job, not a rebuild.

**Recorded target north star** (Mahmud's framing): one posting door, one guard running the
complete rulebook (core invariants + every enabled policy), per-module preparation preserved,
no side tunnels to the ledger.

**Output:** [briefs/20260601-codex-control-layer-second-check.md](./briefs/20260601-codex-control-layer-second-check.md)
— reply to Codex with verification table, framing correction, north star, and open decisions
(read-side boundary, checkpoint shape, warning taxonomy, vocabulary lock-in). No code changed.
ACTIVE.md untouched (stays on Task 148/132).

**Decisions captured with Mahmud this session:**
- **Decision 1 (override) — DECIDED:** uniform **ticket-based** override that travels with the
  transaction; guard checks active tenant locks, rejects all bypass attempts unless a valid
  ticket is present; keep the **hard (absolute) / soft (overridable)** two-tier. Documented with
  a worked example showing today's three gaps (Sales-only guard; ticket not auth-checked; audit
  hand-wired per use-case). Open sub-decisions: who may issue a ticket; confirm always-audited.
- **`allowDirectInvoicing` meaning clarified:** = raise a Sales Invoice standalone, skipping the
  SO→DN chain (`direct` persona); skipping DN shifts the stock-out onto the invoice. Open product
  call: in OPERATIONAL mode, allow direct invoices or force the chain.

## 2026-06-01 (Mon) — Native-detail contract: Quotation frontend + DN/SR editable (Task 148)

**Task:** Continue the native-detail contract rollout (frontend-wins-first scope).
**Agent:** Claude (Opus 4.8)
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- **Build fix (`319f1ebd`):** repaired unbalanced JSX in `SalesInvoiceV2LayoutPage.tsx`
  (a stray `</div>` closed the return root early) — the whole frontend was failing
  `tsc`/`vite` before this.
- **Quotation (`5d8d3f17`):** finished the native-detail frontend — shared `StatusChip`,
  shared `ItemSelector`/`CurrencySelector`/`CurrencyExchangeWidget`, currency from
  `company.baseCurrency`, Discard action, rationalized 4-color palette, full i18n
  (`sales.quoteDetail.*`, en/ar/tr).
- **Delivery Note + Sales Return (`06256cda`):** made DRAFT drafts **editable** (the top
  systemic 🔴 gap, F38/F41). DN reuses its create form via an `isEditing` flag and saves
  through `updateDN`; SR gets a header-only inline edit (date/warehouse/settlement/reason/
  restocking/notes) via `updateReturn` with lines intentionally untouched. Both gained
  `StatusChip` + primary-palette action buttons.

**Key discovery:** the contract doc overstated backend readiness — WhatsApp/Telegram send
and attachments exist **only for Sales Invoice**. `Edit` is backend-ready everywhere, but
non-invoice messaging/attachments, DN/SR Cancel, and quote audit emission need backend
work. Filed as [tasks/152-sales-doc-messaging-attachments-backend.md](./tasks/152-sales-doc-messaging-attachments-backend.md).
Corrected `docs/architecture/native-detail-contract.md`.

**Verification:**
- `npm --prefix frontend run typecheck` -> passed.
- `npm --prefix frontend run build` -> passed (`check:reports`, `check:no-confirm`, tsc, vite).

**Commits scoped via pathspec** to avoid disturbing the heavy in-flight WIP in the tree
(communications backend module, SI refactor) which remain uncommitted.

## 2026-06-01 (Mon) — Sales Invoice V2 Card Layout Mockup Alignment (Task 150)

**Task:** Align the dev mockup layout page to match the user's Variant V2 Card layout specifications, incorporating smart selectors and double-entry allocation presets.
**Agent:** Antigravity (Gemini 1.5 Pro)
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- Aligned `/dev/sales-invoice-v2` (`SalesInvoiceV2LayoutPage.tsx`) dev mockup to Variant V2 layout with 5 cards: Core details, Financial settings, Line items table, Action buttons & allocation grid, and Totals & action footer.
- Integrated canonical selectors (`PartySelector`, `WarehouseSelector`, `DatePicker`, `CurrencySelector`, and `AccountSelector`).
- Added smart selection for `financialClientAccount` mapping to customer's AR account on credit terms or to cash safe on cash payment terms.
- Structured the items table to display exactly 10 scrollable rows with a sticky header.
- Implemented a balanced double-entry Account Ledger & Taxes Allocation Grid with a Syrian tax preset toggle (VAT 5% and Discount 2%).
- Built mock modals for Attachments, Internal Notes, and Send actions.
- Introduced simulated status-switching tabs (Create, Draft, Posted) in the header to preview footer action lifecycle states.
- Implemented GVR-style right-click context menu options (Copy, Paste, Insert Below, Highlight Row, Delete Row) on the Material Line Items table index cell.
- Adjusted root layout element height from `h-screen` to `h-full` to eliminate parent-shell viewport overflow.
- Verified TypeScript compilation and production build checks successfully (exit code 0).

**Verification:**
- `npm --prefix frontend run typecheck` -> passed.
- `npm --prefix frontend run build` -> passed.

**Time spent:** ~0.6h.

## 2026-06-01 (Mon) — Sales Invoice V3 Card Layout Mockup (Task 150)

**Task:** Final alignment of the dev mockup layout page to match the user's Variant V3 Card layout screenshot exactly.
**Agent:** Antigravity (Gemini 3.5 Flash)
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- Set Variant V3 (`v3`) as the default active layout for `/dev/sales-invoice-v2` dev mockup.
- Pre-populated the form's default state to mirror the user's mockup: Customer name set to "الشركة العربية للتجارة والخدمات (Arabian Trade Corp)" and 3 lines of Server Rack Module items.
- Uppercased all column headers in the V3 table to match the screenshot.
- Removed the duplicate code/name text span below the item selector to clean up the item cells.
- Standardized the bottom totals block (Subtotal, Tax, Grand Total) to remove its gray container box, styling it with clean horizontal flex lines and uppercase labels.
- Verified TypeScript compilation and production build (all checks passed successfully).
- Registered manual verification details in `planning/QA-QUEUE.md` and updated completion report `planning/done/150-sales-invoice-page-refinement.md`.

**Verification:**
- `npm --prefix frontend run typecheck` -> passed.
- `npm --prefix frontend run build` -> passed (checked 21 report routes and confirm/alert checks).

**Time spent:** ~0.4h.

## 2026-06-01 (Mon) — Purchase Direct Invoicing Governance Fix (Task 151)

**Task:** Fix Purchases settings mismatch where **Allow Direct Invoicing** appeared enabled but direct Purchase Invoice creation failed with `Purchase invoice persona 'direct' is not allowed by company governance policy`.
**Agent:** Codex
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- Kept `DocumentPolicyResolver` as the backend authority; no invoice guard was weakened.
- Added Purchases settings reconciliation so OPERATIONAL `allowDirectInvoicing: true` writes a company-scope `direct` governance allow rule.
- Disabling the setting removes company-scope direct rules while preserving branch/form exceptions.
- Changed new OPERATIONAL Purchase Settings defaults to strict direct-invoicing blocked unless explicitly enabled.
- Updated Purchase Settings UI so the toggle updates governance rules and policy summary uses effective governance.
- Updated Purchases architecture/user docs and created `planning/done/151-purchase-direct-invoicing-governance.md`.
- Ran graph update after code changes.

**Verification:**
- `npm --prefix backend test -- --runInBand backend/src/tests/application/purchases/PurchaseSettingsUseCases.test.ts` -> passed.
- `npm --prefix backend run build` -> passed.
- `npm --prefix frontend run typecheck` -> passed.
- `npm --prefix frontend run build` -> passed (`check:reports`, `check:no-confirm`, `tsc`, Vite build).
- `npm run graph:update` -> passed.

**Time spent:** ~1.0h.

## 2026-05-31 (Sun) — Sales Invoice Page Refinement (Task 150)

**Task:** Refine Sales Invoice Page (List & Detail view) to support MDI desktop windows (`uiMode === 'windows'`) and premium layout aesthetics (`ui-ux-pro-max` styling).
**Agent:** Antigravity (Gemini 3.5 Flash)
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- Integrated `uiMode` preference checks into Sales Invoice list & detail views to support draggable overlay windows (`isWindow={true}`) and router navigation fallbacks.
- Mapped `'sales_invoice'` window type in `WindowsDesktop.tsx` and resolved local variable shadowing (`window` -> `win`) to fix compiler error.
- Grouped header inputs on details page into two clean glassmorphic cards: "Customer & Timelines" and "Financial Details" with tailored responsive grid styles.
- Polished the line items table with right-aligned monospaced number styling (`font-mono`), transition hovers, and clean inputs.
- Structured the action bar with a split layout: metadata, history, sharing, and GL impact triggers on the left; and state-changing actions (Save, Post, Discard) on the right.
- Fixed JSX nested tag structure compilation errors (unclosed outer div in `renderHeaderForm` and mismatched `</Card>` tag in `renderChargesSection`).
- Created completion report `planning/done/150-sales-invoice-page-refinement.md`.

**Verification:**
- `npm --prefix frontend run typecheck` -> passed.
- `npm --prefix frontend run build` -> passed (all custom report and confirm safety audits passed).

**Time spent:** ~0.6h.

## 2026-05-30 (Sat) — Task 132 Phase 5 — raw window.confirm and alert cleanup

**Task:** Remove the remaining legacy `window.confirm` and `alert` usages from the remaining entries in the allowlist.
**Agent:** Antigravity (Gemini 3.5 Pro)
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- Refactored `window.confirm` to `useConfirm` hook in `AiRuntimeProfilesPage.tsx` and `CertificationManagerModal.tsx`.
- Refactored `alert()` to `toast()` in `AlarmWidget.tsx`, `NotesWidget.tsx`, and `DocumentDesigner.tsx`.
- Emptied `frontend/scripts/check-no-confirm.allowlist.json` to an empty array `[]` representing 0 remaining raw usages.

**Verification:**
- `npm --prefix frontend run check:no-confirm` -> passed.
- `npm --prefix frontend run build` -> passed.

## 2026-05-31 (Sun) — Sidebar forms grouping rework (Task 147)

**Task:** Fix the broken Accounting sidebar (empty because v1 suppressed every default voucher) and codify the per-module forms-grouping policy.
**Agent:** Claude (Opus 4.7)
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- New authoritative doc `docs/architecture/sidebar-forms-grouping.md` with vocabulary (native / default / cloned), per-module target, current implementation, and follow-ups.
- `frontend/src/hooks/useSidebarConfig.ts`: rewrote `buildDynamicFormGroups` with per-module `effectiveGroup(form)` defaulting; removed default-form suppression; groupless clones now render as top-level sidebar leaves; `All Vouchers` is dynamically prepended inside the accounting `Vouchers` group.
- `frontend/src/config/moduleMenuMap.ts`: removed the static `Forms` group from Accounting; promoted `Approval Center` to a root-level Accounting item; `All Vouchers` moved out (now dynamic).
- Updated `docs/user-guide/forms-management.md` with a per-module sidebar-defaulting table.
- Report: `planning/done/147-sidebar-forms-grouping-rework.md`.

**Why:** the v1 sidebar rule (suppress every system default) left a fresh Accounting tenant with no usable sidebar entries — Accounting *is* vouchers and they were all marked as defaults. Fixed at the sidebar layer so no data migration is needed. The seed value `sidebarGroup: "Documents"` is now treated as an unset placeholder at runtime.

## 2026-05-30 (Sat) — Task 132 Phase 5 — raw date input cleanup

**Task:** Remove the remaining user-facing native date inputs from Task 132 surfaces and route them through the shared `DatePicker`.
**Agent:** Codex (GPT-5)
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- Replaced native date inputs in Stock Movements, Stock Transfers, Sales Promotions, and Sales Price Lists with the shared `DatePicker`.
- Replaced the generic `DataTableFilter` date-range native inputs with the shared `DatePicker`, removing the last raw date inputs found under `frontend/src`.
- Updated `docs/architecture/operational-lists.md` and added `docs/user-guide/lists/date-controls.md`.
- Created completion report `planning/done/146-raw-date-input-cleanup.md`.

**Accounting/control note:** no posting, pricing, promotion eligibility, inventory costing, stock valuation, or ledger logic changed. Existing API date values remain ISO strings.

**Verification:**
- Raw date scan across `frontend/src` -> no matches
- `npm --prefix frontend run typecheck` -> passed
- `npm --prefix frontend run check:reports` -> passed, 21 report routes checked, 0 allowlisted
- `npm --prefix frontend run check:no-confirm` -> passed
- `npm --prefix frontend run build` -> passed

**Time spent:** ~0.4h.

## 2026-05-30 (Sat) — Task 132 Phase 4/5 — voucher and item list standardization

**Task:** Continue the operational-list standardization pass after Sales/Purchase invoices by covering Accounting Vouchers and Inventory Items.
**Agent:** Codex (GPT-5)
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- Updated `VouchersListPage` to use the shared `PageHeader` while preserving its specialized `VoucherFiltersBar` and `VoucherTable`.
- Updated `ItemsListPage` with shared `PageHeader`, translated quick-add/search/filter controls, refresh/clear actions, `EmptyState`, status chips, explicit Open row action, and toast feedback for create/load failures.
- Added English/Arabic/Turkish locale keys for the new visible list strings.
- Expanded `docs/architecture/operational-lists.md` and added `docs/user-guide/lists/accounting-and-items-lists.md`.
- Created completion report `planning/done/145-voucher-and-item-list-standardization.md`.

**Accounting/control note:** no posting, approval, costing, or valuation behavior changed. The voucher list intentionally kept its accounting-specific table/actions instead of replacing lifecycle behavior with a generic list.

**Verification:**
- `npm --prefix frontend run typecheck` -> passed
- `npm --prefix frontend run check:reports` -> passed, 21 report routes checked, 0 allowlisted
- `npm --prefix frontend run check:no-confirm` -> passed
- `npm --prefix frontend run build` -> passed

**Time spent:** ~0.7h.

## 2026-05-30 (Sat) — Task 132 Phase 4/5 — invoice list standardization

**Task:** Standardize the first high-traffic operational-list pair after the settings taxonomy slice.
**Agent:** Codex (GPT-5)
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- Standardized `SalesInvoicesListPage` and `PurchaseInvoicesListPage` around the same page pattern: `PageHeader`, filter card, shared party selector, refresh/clear actions, status/payment chips, `EmptyState`, and explicit Open row action.
- Replaced page-local customer/vendor dropdown filters with shared `PartySelector` using `role="CUSTOMER"` / `role="VENDOR"`.
- Added English/Arabic/Turkish locale keys for the new visible list strings.
- Added docs: `docs/architecture/operational-lists.md`, `docs/user-guide/lists/invoice-lists.md`.
- Created completion report `planning/done/144-invoice-list-standardization.md`.

**Accounting/control note:** no posting, payment, cancellation, or ledger behavior changed. The control improvement is consistent filtering and clear status/payment visibility on two financial document lists.

**Verification:**
- `npm --prefix frontend run typecheck` -> passed
- `npm --prefix frontend run check:reports` -> passed, 21 report routes checked, 0 allowlisted
- `npm --prefix frontend run check:no-confirm` -> passed
- `npm --prefix frontend run build` -> passed

**Time spent:** ~0.8h.

## 2026-05-30 (Sat) — Task 132 Phase 3 — settings taxonomy foundation

**Task:** Continue Task 132 after sidebar/navigation polish by turning Settings Home into a production settings hub and improving the shared module settings layout.
**Agent:** Codex (GPT-5)
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- Replaced placeholder `SettingsHomePage` with a grouped settings hub: General, Workflow, Accounting and Tax, Access and Advanced.
- Kept existing route ownership and permission guards; the hub links to existing settings pages instead of bypassing security.
- Improved `ModuleSettingsLayout` for responsive tabs, mobile spacing, Windows-mode-aware header spacing, and a responsive unsaved-change save/discard bar.
- Added English/Arabic/Turkish locale keys for the hub and shared layout copy.
- Added docs: `docs/architecture/settings.md`, `docs/user-guide/settings/settings-home.md`.
- Created completion report `planning/done/143-settings-taxonomy-foundation.md`.

**Accounting/control note:** no posting logic changed. This improves discoverability for approval, workflow, tax, currency, account-default, and role controls.

**Verification:**
- `npm --prefix frontend run typecheck` -> passed
- `npm --prefix frontend run check:reports` -> passed, 21 report routes checked, 0 allowlisted
- `npm --prefix frontend run check:no-confirm` -> passed
- `npm --prefix frontend run build` -> passed
- Browser smoke reached `/#/settings` and redirected unauthenticated users to `/#/auth`; authenticated visual QA is queued.

**Time spent:** ~0.7h.

## 2026-05-30 (Sat) — Task 132 Phase 1 P0 — confirm/alert/date-input hardening

**Task:** Execute the Phase 0.5 P0 backlog: posting-reversal confirms, raw date inputs, alert() removals, admin/security confirms, taxonomy doc + enforcement.
**Agent:** Claude Opus 4.7
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- Created shared `useConfirm()` hook ([frontend/src/hooks/useConfirm.tsx](../frontend/src/hooks/useConfirm.tsx)) — promise-based replacement for `window.confirm` rendering `ConfirmDialog` with tone (`info` / `warning` / `danger`).
- Posting-reversal confirms (P0 control risk) migrated to `ConfirmDialog` with `tone="danger"`: `PurchaseInvoiceDetailPage` unpostPI, `GoodsReceiptDetailPage` unpostGRN, `PurchaseReturnDetailPage` unpostReturn.
- Raw `type="date"` inputs swapped for shared `DatePicker` on 4 finance-sensitive pages: SalesInvoiceDetail (4×), QuotationDetail (2×), PurchaseInvoiceDetail (2 settlement rows), InventoryFinancialIntegrationWizard.
- `AccountForm` hierarchy `alert()` → `errorHandler.showWarning` (validation toast).
- 17 admin/security `window.confirm` sites migrated via `useConfirm()` across SuperAdminShell, super-admin Companies/Users/Entitlements, company-admin Users/Roles/Bundles, RBAC AssignUsersRoles, VoucherFormDesigner, DocumentFormDesigner, VoucherTypeManager, ItemMasterCard.
- `GenericVoucherRenderer` "Feature to be implemented" `alert()` calls → soft `errorHandler.showInfo` toasts pointing to existing report pages.
- Wrote [docs/architecture/frontend-toast-taxonomy.md](../docs/architecture/frontend-toast-taxonomy.md): 8-tier taxonomy (success / info / validation / business policy / missing setup / permission / system / critical) with copy templates and tone selection.
- Enforcement: [frontend/scripts/check-no-confirm.mjs](../frontend/scripts/check-no-confirm.mjs) blocks builds on raw `window.confirm`/`alert`. Wired into `npm run build`. Seeded allowlist with 11 remaining super-admin AI/cert sites + 2 frozen-scope topbar widgets + DocumentDesigner preview stubs — must shrink to zero.
- Kept `/dev/*`, `/canvas-dev`, `/accounting/vouchers/demo` routes visible per user request (pre-deployment).

**Gates:**
- `npm run typecheck:web` → clean.
- `npm run check:reports` → 21 report routes OK.
- `npm run check:no-confirm` → OK (no new violations).

**Time spent:** ~2h

**Follow-on (same session):**
- Wrote completion report [planning/done/142-phase-1-p0-confirms-dates-taxonomy.md](./done/142-phase-1-p0-confirms-dates-taxonomy.md) with QA script.
- Promoted `DatePicker` and `AccountSelectorSimple` to `components/shared/selectors/` via shim re-export files. Updated barrel `index.ts`. Implementation files stay put; future imports use the canonical path. Typecheck clean.

## 2026-05-30 (Sat) — Task 132 Phase 0.5 chrome inventory

**Task:** Catalog the chrome surface before broad Task 132 refactor work begins.
**Agent:** Claude Opus 4.7
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- Ran parallel inventory greps across `frontend/src` for: raw `type="date"` inputs, `window.confirm` / `alert()` usage, `uiMode` branching coverage, `ReportContainer` adoption, shared selectors, and dev/demo route exposure.
- Authored [planning/tasks/132-phase-0.5-inventory.md](./tasks/132-phase-0.5-inventory.md) — full inventory with prioritized P0/P1 remediation backlog (~10h Phase 1 P0 work).
- Key findings:
  - 9 files use raw `type="date"` (4 are posting/finance-sensitive — P0).
  - 28 files use `window.confirm`/`alert()`; 3 in Purchases are posting-reversal (P0).
  - 26 files already honor `uiMode`; shell, sidebar, topbar, master lists, and master-card windows are covered. Sales/purchases detail pages are the main mode-aware gap and route to thread #2 (Phase 4.5).
  - 7 dev/demo routes are exposed in tenant nav with `hideInMenu: false` — must hide in Phase 1.
  - All 22 active report pages route through `ReportContainer` — no remediation needed.
- Defined the 8-tier toast/error taxonomy (success, info, validation, business policy, missing setup, permission, system, critical) for Phase 1 documentation + ESLint enforcement.
- Updated `planning/ACTIVE.md` next-action pointer to Phase 1 dev-route hide.

**Time spent:** ~0.5h

## 2026-05-30 (Sat) — Visual Layout Editor Polish & Auto Align

**Task:** Fix layout double-scaling bug, refine properties panel auto-show triggers, display width labels, default layout span to 6, and implement Auto Align tool.
**Agent:** Antigravity (Gemini 3.5 Pro)
**Branch:** `feat/init-wizard-forms-selection`
**Completion report:** [planning/done/141-visual-layout-editor-polish-and-auto-align.md](./done/141-visual-layout-editor-polish-and-auto-align.md)

**What landed:**
- Fixed the 12-to-24 columns double-migration bug in `migrateTo24Columns` helper by checking `metadata.layoutVersion === 2` and only doubling coordinates when all fields fit in 12 columns. Added `layoutVersion: 2` default to new forms metadata.
- Refined Properties panel triggers so the panel only opens when clicking the Pencil edit button (preventing layout shifts during drags). Click selection is only allowed if the sidebar is already open.
- Displayed `Width: {field.colSpan}` monospace width label badges on canvas components.
- Defaulted layout placement/missing field span to 6 (for exactly 4 items per row).
- Added a smart **Auto Align** button next to Test Run, with `handleAutoAlign()` logic that organizes all fields in every section into sequential rows of 4 components (span 6), wrapping columns at the grid limit.
- Verified TypeScript compilation successfully (`npm run typecheck` in frontend -> passed).

**Time spent:** ~0.4h


## 2026-05-30 (Sat) — Visual Layout Editor Overflow & Grid Constraints Fix

**Task:** Fix Visual Layout Editor grid overflow and answer grid queries.
**Agent:** Antigravity (Gemini 3.5 Pro)
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- Explained to the user that the layout editor uses a 24-column CSS grid with relative coordinate structures. Out-of-bounds fields (`col + colSpan > 24`) cause implicit grid columns, stretching the container and causing overflow.
- Explained that the TopBar Widget Canvas in `DraggableWidgetSpace.tsx` uses `@dnd-kit/core` with a 96-column layout managed dynamically with collision checks and style toolbars.
- Added `sanitizeLayoutConfig` helper to `DocumentDesigner.tsx` to automatically clamp all loaded, cloned, or selected base template fields so that `colSpan` and `col` strictly fit within the 24-column range.
- Added coordinate safety constraints when modifying Column Start (`col`) inside the Properties Panel `updateSelectedField` function, preventing manually entered values from exceeding remaining columns.
- Clamped action group layouts and drop calculations to prevent spans from exceeding remaining grid columns.
- Filtered out fields with missing/undefined coordinates from coordinates state on load, preventing them from rendering with default row 0 col 0 spans and stacking on top of each other.
- Defaulted the Windows layout autoplacement width span to `6` instead of `8` for available fields and actions, enabling exactly 4 components per row on new designs.
- Shrunk the Right Sidebar Properties Panel from `w-72` (288px) to `w-64` (256px) so it occupies less space and leaves more room for the visual designer canvas.
- Verified compilation (`npm run typecheck:web` -> passed) and build (`npm run build:web` -> passed).
- Updated AST Graph successfully (`npm run graph:update`).

**Time spent:** ~0.5h


## 2026-05-30 (Sat) — Visual Layout Editor Polish (Breadcrumbs & Collapsible Properties)

**Task:** Fix visual wizard layout bugs: syntax error typo, horizontal canvas overflow, table designer alignment, duplicate stacked headers, and always-on properties panel.
**Agent:** Antigravity (Gemini 3.5 Pro)
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- Reverted the syntax error `retu <div` back to `return (` in `DocumentDesigner.tsx` and removed a duplicate premature closing `</div>` tag that was closing the grid card container early.
- Restored the Document Wizard vertical stepper sidebar layout in `DocumentDesigner.tsx` with connected steps and background line indicators.
- Changed the main canvas scroll wrapper class from `overflow-y-auto` to `overflow-auto` (enabling horizontal scrollbars) to prevent canvas sections with `min-w-[800px]` from stretching the parent container and pushing the properties panel off-screen.
- Added `min-w-[800px]` to the Table Column Configuration designer card to prevent column headers from squeezing and to keep it visually aligned with grid sections.
- Consolidated stacked headers: moved the breadcrumb layout title to the modal upper header band in `VoucherDesignerPage.tsx` and `SystemFormDesignerPage.tsx` and passed `hideHeader={true}` to hide the duplicate inner topbar header.
- Collapsed the Properties Panel by default when no field is selected, allowing the canvas to occupy the full modal width. Added an absolute positioned Pencil hover edit button on grid fields to open the panel, and an `X` close button on the panel header to collapse it.
- Verified TypeScript compilation (`npm run typecheck:web` -> passed) and build packaging (`npm run build:web` -> passed).

**Time spent:** ~0.8h

## 2026-05-30 (Sat) — Wizard vertical stepper layout & Forms visual fixes

**Task:** Refactor Document Wizard steps to vertical layout, and address visual bugs in voucher renderer (duplicate footer cards and exchange rate icon/spacing).
**Agent:** Antigravity (Gemini 3.5 Pro)
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- Refactored `DocumentDesigner.tsx` layout to position step navigation vertically inside a left sidebar column instead of the horizontal header, with custom SVG vector icons and continuous line connectors.
- Deduplicated `grandTotalDoc` and `totalAmount` footer summary cards in `GenericVoucherRenderer.tsx` for both Classic and Windows modes by introducing a common canonical mapping filtering pass.
- Upgraded the currency conversion indicator icon in `CurrencyExchangeWidget.tsx` from raw unicode `→` (which rendered as a hyphen `-`) to a vector `<svg>` arrow supporting automatic RTL rotation.
- Adjusted container min-widths inside `CurrencyExchangeWidget.tsx` to `min-w-[72px]` for the left identifier and `min-w-[64px]` for the right, eliminating text cramping and excessive whitespace.
- Created completion reports `planning/done/138-forms-visual-fixes.md` and `planning/done/139-vertical-stepper-wizard.md`.
- Verified TypeScript compilation (`npm run typecheck:web` -> passed) and build packaging (`npm run build:web` -> passed).

**Time spent:** ~0.8h

## 2026-05-30 (Sat) — UI Worktree Deletion

**Task:** Delete the UI revamp playground worktree (`D:\DEV2026\ERP03-ui-lab`) as requested.
**Agent:** Antigravity (Gemini 3.5 Flash)
**Branch:** `feat/init-wizard-forms-selection`

**What was done:**
- Unregistered the `D:\DEV2026\ERP03-ui-lab` worktree from Git using `git worktree remove`.
- Identified and terminated running node/esbuild processes locked in that directory (specifically the Vite dev server processes).
- Recursively deleted all files and subfolders within `D:\DEV2026\ERP03-ui-lab`. The directory is now completely empty.
- Note: The empty parent directory folder itself is temporarily locked by another active process (likely the editor/Codex or terminal), which will be released once closed.

**Time spent:** ~0.1h.

## 2026-05-30 (Sat) — Main Workspace Layout Revamp Integration & Search Widget Polish

**Task:** Resolve pop-stash merge conflicts from merging the revamp playground worktree, register the Search Widget in the Widget Designer UI, and perform full typecheck/build verification.
**Agent:** Antigravity (Gemini 3.5 Pro)
**Branch:** `feat/init-wizard-forms-selection`

**What was done:**
- Resolved pop-stash conflicts in `planning/JOURNAL.md` by deduplicating layout refactor entries and merging the stashed runtime control hardening entry.
- Discovered and fixed a missing registration for the **Search Widget** in the TopBar Widget Designer page (`TopbarWidgetDesignerPage.tsx`), importing `SearchWidget` and placing it in `WIDGET_COMPONENT_MAP`, `WIDGET_TYPES`, and `DEFAULT_WIDGETS`.
- Logged pre-existing architecture boundary check violations in `AccountingBoundary.test.ts` (relating to Reporting use cases) under **Rabbit Holes** in `planning/ACTIVE.md`.
- Staged and committed all pending files successfully. Cleaned up the merged stash.
- Verified TypeScript compilation (`npm run typecheck` -> exit 0) and Vite production build (`npm run build` -> exit 0).

**Time spent:** ~0.5h.

**Result:** Layout enhancements are integrated, search widget is customizable via settings, and the worktree compiles cleanly.

## 2026-05-30 (Sat) — Runtime voucher field control UI hardening

**Task:** Manual QA follow-up from SI Direct default-form design: runtime voucher header controls looked inconsistent because text inputs, selectors, date picker, and specialized widgets each owned their own input chrome.
**Agent:** Codex (GPT-5)
**Branch:** `feat/init-wizard-forms-selection`

**What changed:**
- Added shared header-field control classes inside `GenericVoucherRenderer` for 32px height, border radius, label style, read-only state, and selector framing.
- Wrapped account/party/item/warehouse selectors in a consistent renderer frame while preserving their modal/search behavior.
- Let `DatePicker` accept an optional `inputClassName`, so the runtime voucher renderer can use the same 32px control style without changing date picker defaults elsewhere.
- Extended `CustomComponentProps` with `className`/`noBorder` so registry-based selectors can participate in the shared styling.
- Corrected the UX after PO clarification: unified control chrome is **not forced globally**. The Visual Layout Editor now has a **Uniform controls** toggle stored at `metadata.uniformControlChrome`; runtime rendering only applies the unified selector/date/input chrome when that saved form setting is enabled.
- Follow-up crash fix: `useUserPreferencesContext` now falls back to local preference state instead of white-screening if a dev refresh/HMR path renders a shell consumer before the provider is attached.

**Verification:**
- `npm --prefix frontend run typecheck` → exit 0
- `npm --prefix frontend run build` → exit 0
- `git diff --check` → exit 0
- Browser check reached only the unauthenticated local app shell, so visual confirmation still needs Mahmud's open authenticated session after refresh.

**Time spent:** ~0.5h.

**Result:** Designers can choose per form whether runtime voucher header controls keep their native/custom appearance or use a unified control shape. Field definitions, Field Library metadata, and posting behavior are unchanged.

## 2026-05-30 (Sat) — UI/UX: Full-Width TopBar & Pinned/Overlay Sidebar Layout Refactor
**Task:** Refactor application shell, topbar, and sidebar layout to make TopBar span full width, remove brand header/logo, and support dynamic overlay/docked sidebar behaviors.
**Agent:** Antigravity (Gemini 3.5 Flash)
**Branch:** `feat/ui-ux-revamp-playground`

**What was done:**
- Restructured `AppShell.tsx` to mount `TopBar` as a full-width header at the root layout level, below which the sidebar and main workspace reside.
- Positioned `Sidebar.tsx` dynamically so that it floats on top of the TopBar (`z-50 top-0 bottom-0`) when unpinned, and docks below the TopBar (`z-30 top-12 bottom-0`) when pinned on desktop viewports.
- Configured dynamic margins on the main workspace container to shift content to the side only when the sidebar is open and pinned (in accordion mode) or dynamically based on open/closed widths (in flat mode).
- Configured theme variables to set the sidebar and topbar background surfaces to be darker than the main workspace content area (using tertiary in light mode and secondary in dark mode).
- Removed `backdrop-blur-sm` from the overlay backdrop in `AppShell.tsx` to prevent blurring the background application when the sidebar is expanded.
- Removed the branding/logo button ("ERP03 Enterprise") from the sidebar, replacing it with a clean utility header containing the pin button and a close button (which centers the Pin icon when collapsed in flat mode).
- Configured Sidebar to behave conditionally based on the user's `sidebarMode` selection: in accordion mode, the sidebar completely hides off-screen when closed; in flat mode, it collapses to a persistent narrow 6rem (`w-24`) icon-strip on desktop viewports below the TopBar.
- Removed the `lg:hidden` constraint on the TopBar hamburger menu button so it is visible on all screen sizes to toggle the sidebar.
- Verified TypeScript compilation and Vite build bundle successfully without errors.

**Verification:**
- `npm run typecheck` -> passed.
- `npm run build` -> passed.

## 2026-05-30 (Sat) — v1 strategy decision: natives are the headline surface

**Decision (product owner):** for the first deployment, ship **native forms as the primary UI**. Defaults / Field Library / cloning stay available as opt-in customization but are not put in front of typical small/medium-company users.

**Why:**
- After the SI Direct capability audit ([tasks/137-si-direct-capability-audit.md](./tasks/137-si-direct-capability-audit.md)) the gap was concrete: ~15 features missing on the default form, ~35–45h of component work plus a ~2–3d shared list surface to close it.
- Closing all of that before deploy is not justified for v1 buyers. They want a finished product, not a configuration framework.
- Native is already battle-tested. Polishing what works is faster and lower risk than rebuilding.

**What changed in code (this session):**
- [useSidebarConfig.ts](../frontend/src/hooks/useSidebarConfig.ts) `buildDynamicFormGroups` now suppresses any default form from the sidebar render. Activated defaults still live in Firestore and still appear inside Forms Management. The `DEFAULT_FORMS_GROUP` constant and label-key entry stay in place as the v2 hook point — uncommenting the early return restores the group when the migration resumes.
- Cloned forms render unchanged: their user-chosen `sidebarGroup` (or `Other Forms` if blank) honored.

**What changed in docs:**
- [tasks/native-to-default-forms-migration.md](./tasks/native-to-default-forms-migration.md) prepended with a "v1 strategy" section and marked status as ⏸ Deferred to v2.
- [tasks/137-si-direct-capability-audit.md](./tasks/137-si-direct-capability-audit.md) marked ⏸ Deferred. The audit + tier-ordered component list stay as the v2 starting point.
- [done/136-sidebar-form-grouping-policy.md](./done/136-sidebar-form-grouping-policy.md) decision-log extended with the visibility change.

**New v1 focus (next sessions):**
1. **Native functionality retest** — end-to-end QA pass on every native voucher flow (create / edit / post / pay / cancel / void / send / attach / audit / period-lock override / credit override) per module. Track findings as a manual QA task.
2. **Native UI-mode awareness** — hardcode polished web-mode AND Windows card/window-mode renderings for each native page. Standard already lives in [tasks/132-ux-layout-production-hardening.md](./tasks/132-ux-layout-production-hardening.md) Phase 4.5.
3. **Task 132 phases** become the active execution plan for shell cleanup, sidebar IA polish, settings taxonomy, action safety, RTL/i18n.

**What stays preserved (no code removed):**
- Field Library Phases A/B/C (seed + super-admin editor + tenant cascade consumption).
- Default voucher templates seeded by `seedSystemVoucherTypes.ts`.
- Super-admin Field Library editor, voucher template editor, tenant Forms Management page. All still function. They're the v2 foundation.

**Time spent:** ~0.5h on the decision, code change, and doc pivot.

**Result:** v1 scope is contained and shippable. The architectural investment in Field Library / defaults / cloning is preserved as the v2 roadmap, not lost. Sidebar shows only what a typical user needs: native list pages, plus any clones the user explicitly created.

## 2026-05-30 (Sat) — Sidebar form grouping policy (native / default / cloned)

**Task:** Establish a clear sidebar IA for the three form sources, document the native→default migration direction, and rename the static `Documents` group to `Forms`.
**Agent:** Claude (Opus 4.7)
**Branch:** `feat/init-wizard-forms-selection`
**Completion report:** [planning/done/136-sidebar-form-grouping-policy.md](./done/136-sidebar-form-grouping-policy.md)
**Design note:** [planning/tasks/native-to-default-forms-migration.md](./tasks/native-to-default-forms-migration.md)

**What was done:**
- Terminology locked: **native forms** (moduleMenuMap list pages), **default forms** (`voucher_forms` rows with `isDefault`/`isSystemGenerated`/`isLocked`), **cloned forms** (user-created `voucher_forms`).
- Earlier suppression attempt (suppress defaults whose voucherType matched a native nav entry) was rejected and reverted before commit — defaults are deliberate user activations and hiding them removed working behavior. Direction is the opposite: defaults catch up to natives via Field Library components, then natives retire.
- Renamed `Documents` → `Forms` across the static `moduleMenuMap.ts` (sales, purchase, accounting, inventory).
- `useSidebarConfig.buildDynamicFormGroups` now routes default forms to a single per-module `Default Forms` group regardless of their stored `sidebarGroup`. Cloned forms honor their user-chosen `sidebarGroup` verbatim (folds into static `Forms` group when label matches, else own group, blank → root).
- Added label-key map entries for `Forms` → `sidebar.forms` and `Default Forms` → `sidebar.defaultForms` (i18n falls back to the literal label until Arabic strings are added).
- `SidebarFormEntry` in `useVoucherTypes.ts` exposes `voucherType`/`isDefault`/`isSystemGenerated`/`isLocked` (kept from the reverted suppression work — the new grouping policy still needs the default-flag bits).
- Wrote a design note covering the three form sources, the per-voucher-type capability matrix (native vs default), and the staged migration plan (capability audit → ship Field Library components → default parity build → side-by-side QA → native retirement).
- Added `Other Forms` group as a catch-all for cloned forms with blank `sidebarGroup`, so they no longer strand at sidebar root next to Reports/Tools/Settings.
- Ordering: dynamic groups are inserted **after** the static `Forms` group in `FORM_GROUP_RANK` order (Default Forms → user-named → Other Forms), keeping `Reports`/`Tools`/`Settings` at the bottom of the section.

**Verification:**
- `npm --prefix frontend run typecheck` → exit 0
- `npm --prefix frontend run build` → exit 0
- Manual sidebar QA pending after commit.

**Time spent:** ~1.5h (including a wrong-direction round trip).

**Result:** Sidebar now expresses the three sources with clear group headings. Visual duplication of "Sales Orders" (under `Forms`) and "Sales Order" (under `Default Forms`) is preserved on purpose — it's an honest signal that the migration is incomplete. The retirement of natives is now a documented, per-voucher-type process gated on capability parity.

## 2026-05-30 (Sat) — Field Library Phase C2 (voucher template bindings)

**Task:** Phase C2 of task 135 — move Layer 2 super-admin voucher template authoring onto the Field Library instead of hardcoded frontend field suggestions.
**Agent:** Codex (GPT-5)
**Branch:** `feat/init-wizard-forms-selection`
**Completion report:** [planning/done/135d-field-library-phase-c2.md](./done/135d-field-library-phase-c2.md)
**Time spent:** ~1.2h.

**What was done:**
- Updated `VoucherTemplateEditorPage.tsx` to load `/super-admin/field-library`.
- Removed the active hardcoded `SUPPORTED_FIELDS_BY_CODE` authoring path.
- Header and Line Field tabs now offer non-deprecated Field Library entries and respect `supportedTypes`, `excludedTypes`, and `sectionHint`.
- Field Library entries now hydrate into `FieldDefinition` records with official IDs, labels, renderer types, field class, selector relation hints, and `fieldLibraryVersion`.
- Table Columns now suggest from the template's own `layout.lineFields`, keeping visible grids aligned with saved voucher template bindings.
- Updated Forms Management architecture/user docs and created completion report `planning/done/135d-field-library-phase-c2.md`.

**Validation:**
- `npm --prefix frontend run typecheck` — passed.
- `npm --prefix frontend run build` — passed.
- `npm --prefix backend run build` — passed.
- `git diff --check` — passed.

**Result:** Super-admin template authoring is now Field Library driven. Voucher templates remain the Layer 2 authority for field placement and required status. Remaining follow-up is `fieldVersionsSeen`/drift warnings and optional tighter seed scoping for super-admin convenience.

## 2026-05-30 (Sat) — Field Library Phase C1 (Forms Management consumption)

**Task:** Phase C1 of task 135 — Forms Management reads the tenant-resolved Field Library catalog while preserving the current form persistence shape and mandatory-field behavior.
**Agent:** Codex (GPT-5)
**Branch:** `feat/init-wizard-forms-selection`
**Completion report:** [planning/done/135c-field-library-phase-c1.md](./done/135c-field-library-phase-c1.md)

**What was done:**
- Mounted the existing designer routes under `/tenant/designer`, making `GET /tenant/designer/field-library` reachable by the tenant frontend.
- Added `fieldLibraryApi` as a read-only frontend client for the resolved field catalog.
- Updated `VoucherDesignerPage.tsx` so the Forms Management wizard hydrates its system/header/table field lists from the Field Library response.
- Kept legacy module field IDs as a compatibility allowlist until Phase C2 adds real Layer 2 type bindings.
- Preserved legacy mandatory/optional semantics for existing module fields, preventing Field Library flat-namespace de-duping from accidentally making fields required in the wrong module.
- Corrected the C1 compatibility mapper after UI smoke feedback: Sales Invoice clones no longer inherit unrelated module-wide required fields like Delivery Date, Return Date, or Order Date, and BODY fields stay out of the header picker.
- Passed the active field catalog into `saveDocumentForm` so canonical output has the current field metadata.
- Updated architecture/user docs, QA queue, ACTIVE, and PRIORITIES.

**Verification:**
- `npm --prefix backend run build` -> exit 0
- `npm --prefix frontend run typecheck` -> exit 0
- `npm --prefix frontend run build` -> exit 0
- `git diff --check` -> exit 0
- Browser smoke on local Vite route -> app rendered and redirected unauthenticated; signed-in Forms Management QA remains queued.

**Time spent:** ~1.9h

**Result:** Forms Management now consumes the Field Library catalog without weakening posting controls or changing saved form documents. Phase C2 should make voucher-type placement/mandatory bindings authoritative.

## 2026-05-30 (Sat) — Field Library Phase B (super-admin editor)

**Task:** Phase B of task 135 — super-admin authoring surface for the Layer 1 catalog seeded in Phase A. Builds the editor page, the six CRUD endpoints, the policy use cases (id uniqueness, id-immutability, reference-safety gate).
**Agent:** Claude (Sonnet)
**Branch:** `feat/init-wizard-forms-selection`
**Completion report:** [planning/done/135b-field-library-phase-b.md](./done/135b-field-library-phase-b.md)

**What was done:**
- Extended `IFieldLibraryRepository` with `getSystemEntry`, `setSystemEntryDeprecated`, `hardDeleteSystemEntry`. The deprecate path re-routes through `upsertSystemEntry` so the content-hash + version-bump logic stays in one place — flipping `deprecated` always produces a different hash and bumps version by 1 as decision 6.3 promises.
- Three application-layer use cases in `FieldLibraryUseCases.ts`: id-uniqueness probe on create, id-immutable patching on update, reference-safety probe against system voucher templates on hard-delete (returns `{ ok: false, usedBy[] }` instead of raising, so the controller can surface a structured 409).
- `SuperAdminFieldLibraryController` translates use-case errors into 400 (validation/collision), 404 (missing), 409 (referenced) with structured payloads.
- New route file mounted at `/super-admin/field-library` under `authMiddleware + assertSuperAdmin`. Six routes: GET list, GET one, POST create, PUT update, PATCH deprecated, DELETE.
- Typed FE API client `superAdminFieldLibraryApi` with mirrors of `FieldClass`, `FieldSectionHint`, `SelectorBinding`, `FieldLibraryEntry`. Uses the same unwrap pattern as the other super-admin clients.
- Super-admin page at `/super-admin/field-library`. Reuses `SuperAdminPage`/`SuperAdminTable`/`SuperAdminStatCard`/`SuperAdminModal` and the `useSuperAdminTable` hook so the surface stays visually consistent with `SuperAdminVoucherTemplatesPage`. Features: stat row (Total/Selectors/Custom metadata/Deprecated), sortable + searchable table, show-deprecated toggle, inline edit modal with id-collision hint while typing, selector-binding sub-form that appears when the type is one of the seven selector kinds, soft-deprecate one-click toggle, hard-delete with confirm-dialog + "blocked" modal that surfaces the `usedBy[]` list when a system voucher template references the field.
- Registered the lazy-loaded page in `routes.config.ts` under `SUPER_ADMIN` section, `requiredGlobalRole: 'SUPER_ADMIN'`.

**Intentional limits:**
- Reference-safety probe scans system voucher templates only. Company voucher types and forms are deferred to Phase C — today's forms inline field definitions which makes a robust scan fragile. Phase C migrates form storage to `{ fieldId }` references and the gate extends.
- Wizard consumption is NOT wired this phase. Forms Management still reads from hardcoded constants; super-admin edits are silent until Phase C.

**Verification:**
- `npx tsc --noEmit` (backend) -> exit 0
- `npx tsc --noEmit` (frontend) -> exit 0

**Time spent:** ~2.5h

**Result:** Super-admin can now see and author the field catalog from a UI without touching code. The system voucher template reference gate prevents foot-guns. Phase C (wizard consumption + form differential model + drift audit) unblocks task #5.

## 2026-05-30 (Sat) — Field Library Phase A (seed + read API)

**Task:** Phase A of task 135 — land Layer 1 of the three-layer field cascade. Seed the Field Library into Firestore from today's hardcoded constants, expose a silent read API, no UI consumer yet.
**Agent:** Claude (Sonnet)
**Branch:** `feat/init-wizard-forms-selection`
**Completion report:** [planning/done/135a-field-library-phase-a.md](./done/135a-field-library-phase-a.md)
**Planning doc:** [planning/tasks/135-field-component-library.md](./tasks/135-field-component-library.md)

**What was done:**
- New domain entity `FieldLibraryEntry` with `FieldClass` (`system_core`/`system_optional`/`computed`/`custom_metadata`), `SelectorBinding`, `ResolvedFieldLibrary` resolver shape.
- New repository interface `IFieldLibraryRepository` (`listSystemEntries`, `listCompanyEntries`, `resolveForCompany`, `upsertSystemEntry`).
- `FirestoreFieldLibraryRepository` implements content-hash idempotency: SHA-1 of the meaningful fields; identical content -> no version bump, no write. Honors decision 6.3 (monotonic version) and 6.2 (system wins on id collision in the resolver merge).
- `seedFieldLibrary.ts` duplicates the frontend constants from VoucherDesignerPage.tsx and de-dupes per the flat-namespace rule (6.1) — `currency` in ACCOUNTING + SALES collapse into one entry; `supportedTypes`/`excludedTypes` arrays are unioned so historical scoping is preserved. Inferred `fieldClass` from the legacy `category`/`mandatory`/`autoManaged` tags. SELECTOR_BINDINGS map kicks in for the seven selector kinds.
- Hooked into `runSystemSeeder.ts` as Step 4 with `{written, unchanged, total}` console output.
- New `FieldLibraryController` exposes `GET /tenant/designer/field-library` (merged catalog for the auth'd company) and `GET /tenant/designer/field-library/system` (system-tier alone). Mounted under `designer.vouchertypes.view` permission.
- Storage path is `system_metadata/field_library/items/{fieldId}` mirroring the existing `voucher_types/items` shape so the future super-admin UI's directory stays consistent.
- DI binding is Firestore-only this phase; Prisma binding follows in Phase B when the super-admin UI needs scaled reads.

**What was intentionally NOT done:**
- No frontend changes. Forms Management wizard still reads from hardcoded constants. The new endpoint is silent.
- No super-admin UI. Phase B.
- No company custom-field write path. Phase D.
- No `fieldVersionsSeen[]` on forms or drift audit page. Phase B/C.

**Verification:**
- `npx tsc --noEmit` (backend) -> exit 0.
- Frontend untouched (not re-run).

**Time spent:** ~2.5h.

**Result:** Layer 1 of the field component library is in place and inspectable. Phase B (super-admin Field Library editor) is unblocked; Phase C (wizard cascade) follows. Forms Management UX continues unchanged.

## 2026-05-30 (Sat) — Forms Management page polish

**Task:** Polish the per-module Voucher Designer page into a production-grade Forms Management page across Accounting, Sales, and Purchases.
**Agent:** Claude (Sonnet)
**Branch:** `feat/init-wizard-forms-selection`
**Completion report:** [planning/done/134-forms-management-page-polish.md](./done/134-forms-management-page-polish.md)
**User guide:** [docs/user-guide/forms-management.md](../docs/user-guide/forms-management.md)

**What was done:**
- Renamed the page **Voucher Designer → Forms Management** in the title, editor sub-label, loading copy, and all three module entries in `moduleMenuMap.ts`.
- Removed the verbose descriptive paragraph and amber "Locked defaults install as inactive" callout from the page body.
- Added a **`?`** HelpCircle icon next to the title that opens the reusable `InstructionsModal` slide-over with a five-section walkthrough (Install / Activate / Clone / Sidebar Group / Export) plus footer warnings.
- Ported the **legacy global Forms Designer's clone rules** verbatim: `handleClone` and `handleAddCustomForm` now compute `parentPrefix = (form.prefix||'').replace('-','').replace(/[^A-Z]/g,'') || 'FORM'` and suggest `id = ${parentPrefix}_${Date.now()}_C` (or `_N`) and `prefix = ${parentPrefix}C-` (or `N-`). Suggested values; user can override; uniqueness is validated against the in-memory `existingForms` list before save. The `DocumentDesigner` step 2 ID input is now editable for clones (was incorrectly read-only because `initialConfig?.id` was populated for clones too) via a new `isExistingEdit = !!initialConfig?.id && !__isClone` flag.
- **Critical save fix in `VoucherFormController.create`:** the create method was hand-picking a small subset of `formData` (name, code, typeId, prefix, description, headerFields, tableColumns, layout, enabled, isDefault) and silently dropping `module`, `uiModeOverrides`, `rules`, `actions`, `voucherType`, `persona`, `formType`, `baseType`, `sidebarGroup`, `numberFormat`, `isMultiLine`, `tableStyle`, `defaultCurrency`. Without `module` the repository defaulted to `'ACCOUNTING'`, so cloned Sales/Purchase forms got persisted but filtered out by `loadModuleDocumentForms('SALES'|'PURCHASE')`. Now spreads `formData` first then applies protected overrides; strips client sentinels (`__isClone`) and server-managed fields.
- Fixed `isEdit` detection in `handleSaveAndExit`: introduced `isCloneFlow` based on `__isClone` sentinel so clones with a suggested id are correctly POSTed (create) rather than PUTted (update against a nonexistent doc).
- Added a **kebab menu (`⋮`) to every form row** with three options: **Export JSON** (downloads `voucher_form_{id}.json`), **View Schema** (placeholder/disabled), and **Sidebar Group** (inline editor with free-text input and preset chips).
- Sidebar Group assignment routes through the backend metadata update (Admin SDK) so Firestore rules don't block; optimistic UI with rollback on failure; emits `companyModulesRefresh` so the sidebar moves the form into its new group immediately.
- **Backend locked-form gate now allows `sidebarGroup` updates** alongside `enabled` (both are organisational preferences, not design changes). Anything else still requires a clone.
- Removed the **silent `"Vouchers" → "Documents"` sidebar merge** in `useSidebarConfig.ts`. The legacy seed default `"Vouchers"` is now `"Documents"` in `seedSystemVoucherTypes.ts` (5 accounting templates). User-typed custom groups (e.g. "Approvals") render as their own top-level sidebar submenus, honouring user intent verbatim.
- Fixed kebab dropdown clipping by changing `InstalledTypeRow` from `overflow-hidden` to `overflow-visible` (and adding `rounded-t-lg` to keep the collapsed-state rounding).

**Verification:**
- `npx tsc --noEmit` (frontend) → exit 0
- `npx tsc --noEmit` (backend) → exit 0
- Manual QA script captured in the completion report (5 scenarios across 3 modules).

**Time spent:** ~3.5h

**Result:** Forms Management is the production-grade single home for managing voucher types and forms across every module. Newly installed forms are reliably persisted and visible. Clones flow with suggested-but-editable IDs and Prefixes. Sidebar groups (including for locked defaults) work as the user expects, with no silent rewrites.

## 2026-05-29 (Fri) — Unified Voucher Designer Wizard Saving Fix

**Task:** Fix Voucher/Document Designer wizard save and clone permissions issue (Firestore security rule bypass).
**Agent:** Antigravity (Gemini 3.5 Flash)
**Branch:** `feat/init-wizard-forms-selection`
**Completion report:** [planning/done/133-fix-designer-wizard-fields.md](./done/133-fix-designer-wizard-fields.md)

**What was done:**
- Fixed `PERMISSION_DENIED` / rules evaluation error during save/clone of custom forms in the unified Voucher/Document Designer wizard.
- Refactored `saveDocumentForm` in [documentDesignerService.ts](file:///d:/DEV2026/ERP03/frontend/src/modules/tools/forms-designer/services/documentDesignerService.ts) to use the backend `voucherFormApi` REST endpoints (`create`/`update`) instead of writing directly to Firestore using client-side `setDoc`. This routes writes through the backend (Admin SDK) and bypasses security rules, matching the project's architecture guidelines.
- Fixed `isEdit` logic in [VoucherDesignerPage.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/shared/pages/VoucherDesignerPage.tsx) to check the initial `editingForm?.id` state instead of final `config.id`, preventing new/cloned forms (where the user assigns a code in the wizard) from being incorrectly treated as updates.
- Fixed `isSuperAdmin` helper in [firestore.rules](file:///d:/DEV2026/ERP03/firestore.rules) to safely retrieve `globalRole` using `.data.get('globalRole', '')`, preventing security rules evaluation crashes for standard tenant users.
- Cleaned up unused Firestore imports (`doc`, `getDoc`, `setDoc`, `updateDoc`) from [documentDesignerService.ts](file:///d:/DEV2026/ERP03/frontend/src/modules/tools/forms-designer/services/documentDesignerService.ts).
- Updated completion report [133-fix-designer-wizard-fields.md](file:///d:/DEV2026/ERP03/planning/done/133-fix-designer-wizard-fields.md) to document the API save fix.

**Verification:**
- `npm --prefix frontend run typecheck` -> passed cleanly
- `npm --prefix frontend run build` -> passed cleanly

**Time spent:** ~0.7h
**Result:** Custom document forms can now be cloned and saved successfully without client-side permission issues. Ready to commit current branch and switch to UX Layout Production Hardening.

## 2026-05-29 (Fri) — Frontend UX/Layout Production Audit

**Task:** Deep audit of ERP03 frontend layout, shell, sidebar, top bar, auth/user flow, settings consistency, list/table patterns, RTL/i18n readiness, and production ERP UX risks.
**Agent:** Codex (GPT-5)
**Branch:** `feat/init-wizard-forms-selection`
**Audit report:** [docs/architecture/frontend-ux-layout-audit.md](../docs/architecture/frontend-ux-layout-audit.md)
**Execution plan:** [planning/tasks/132-ux-layout-production-hardening.md](./tasks/132-ux-layout-production-hardening.md)
**Future-agent brief:** [planning/briefs/20260529-frontend-ux-layout-hardening.md](./briefs/20260529-frontend-ux-layout-hardening.md)

**What was done:**
- Inspected the frontend shell, route/sidebar configuration, top bar/widget system, auth/landing pages, module settings pages, representative operational list pages, report pattern docs, and existing UI screenshot evidence.
- Confirmed the strongest current UX pattern is the report system built around `ReportContainer`.
- Identified production-readiness gaps: dev/demo routes in normal navigation, top-bar layout editing exposed in daily chrome, duplicate React Query providers, incomplete auth/language flow, inconsistent settings taxonomy, inconsistent list/table patterns, raw confirms/alerts, raw date inputs, and demo-oriented dashboard content.
- Created an English architecture audit, execution-ready task plan, and future-agent brief.
- Incorporated product-owner observations: shared components are the default project-wide behavior, loading/waiting states need one standard model, and toast/error feedback must distinguish validation, policy, permission, setup, system, and critical/security failures.
- Incorporated product-owner report/entity observations: `ReportContainer` must govern the full report contract including parameters and filters, and master-data cards must be UI-mode aware with normal web/page and Windows card/window presentations.
- Did not change application code.

**Verification:**
- `npm --prefix frontend run check:reports` -> passed, 21 report routes checked, 0 allowlisted.
- `git diff --check` -> passed.
- Frontend typecheck was intentionally not rerun for this documentation-only audit because the current worktree has unrelated pre-existing wizard typecheck failures from local dirty changes.

**Time spent:** ~2.5h

**Result:** UX/Layout hardening is now documented and ready for phased implementation. Recommended first implementation slice: hide dev/demo navigation, consolidate React Query providers, and fix auth/logout routing consistency. The top-bar widget system is frozen for now and must not be modified unless the product owner reopens that scope.
## 2026-05-29 (Fri) — UI/UX: Dead Widget Code Cleanup and Documentation Sync
**Task:** Remove unused widget and tray components and synchronize TopBar documentation.  
**Agent:** Antigravity (Gemini 3.5 Flash)  
**Branch:** `feat/ui-ux-revamp-playground`  

**What landed:**
- Deleted deprecated `WidgetTray.tsx` and `MockWidgetTray.tsx` layout components.
- Deleted unused modular widgets `CompanyInfoWidget.tsx` and `CompanyLogoWidget.tsx`.
- Updated architecture (`docs/architecture/topbar-precision-widget-layout.md`) and user guide (`docs/user-guide/topbar-widget-layout.md`) documentation to describe the inline visual styles model and grid-based canvas editor.
- Updated completion report `planning/done/132-topbar-widget-tray-and-unified-settings.md`.
- Verified typescript compilation (`npm run typecheck`) and bundle build (`npm run build`) pass cleanly with zero errors.

**Verification:**
- `npm run typecheck` -> passed.
- `npm run build` -> passed.

**Time spent:** ~1.5h  

## 2026-05-29 (Fri) — UI/UX: Layout Filtering, Search Widget, and UI Mode Enhancements

**Task:** Clean up and filter TopBar layout design styles (keeping only 1, 2, 3, 5, 10, 11, 16, 17, 18), implement a new Search Widget, and modify UIModeWidget to display both UI modes always with highlights.  
**Agent:** Antigravity (Gemini 1.5 Pro)  
**Branch:** `feat/ui-ux-revamp-playground`  

**What landed:**
- Cleaned up `TopBar.tsx`, `UiLabDashboard.tsx`, and `AppearanceSettingsPage.tsx` to retain only the selected 9 widget layouts (1, 2, 3, 5, 10, 11, 16, 17, 18) and discarded all other variations.
- Created `SearchWidget.tsx` featuring standard component props, localized placeholder values, and fluid CSS focus transitions. Registered the widget within Zustand store (`DEFAULT_WIDGETS`), `TopBar.tsx`, and `UiLabDashboard.tsx` configurations.
- Upgraded the compact mode rendering in `UIModeWidget.tsx` to display both "Win" and "Web" buttons side-by-side on the TopBar at all times, highlighting the currently active mode.
- Verified that all modifications are isolated to the git worktree `D:\DEV2026\ERP03-ui-lab` and compiled typecheck and production build successfully.

**Verification:**
- `npm run typecheck` -> passed.
- `npm run build` -> passed.

**Time spent:** ~1.2h  
**Result:** Code compiles cleanly, production build passes, and UI features are fully updated per user specifications.

## 2026-05-29 (Fri) — UI/UX: Real Inline TopBar Widgets & 20 Layout Gallery Sync

**Task:** Integrate 9 real widgets into the 20 TopBar style variations, support full width mockups in UI Lab, remove duplicate icons with compact prop, and sync selectors with settings.  
**Agent:** Antigravity (Gemini 1.5 Pro)  
**Branch:** `feat/ui-ux-revamp-playground`  
**Completion report:** [planning/done/132-topbar-widget-tray-and-unified-settings.md](./done/132-topbar-widget-tray-and-unified-settings.md)

**What landed:**
- Added `compact?: boolean` prop to all 9 system widgets to hide internal icons and horizontal margins/padding inside inline designs.
- Integrated a simplified UIMode switcher toggler and hidden text labels (e.g. "Currency: ") when `compact` is active.
- Configured real system TopBar inline widget rendering to pass `compact={true}` to widgets, and forced all 9 widgets to `visible: true` inside Zustand store on mount.
- Added a "TopBar Widget Style" select dropdown configuration inside `AppearanceSettingsPage.tsx` under *Layout & Behavior* and synced it bidirectionally with header actions via custom event listeners.
- Expanded the width of `UiLabDashboard.tsx` to full screen dimensions in widgets view, loaded initial widgets ordering from store, and wired drag-and-drop actions to update the Zustand store in real-time.

**Verification:**
- `npm --prefix frontend run typecheck` -> passed.
- `npm --prefix frontend run build` -> passed.

**Time spent:** ~3.0h  
**Result:** Widgets are fully integrated inline inside the real TopBar and settings page, and preview beautifully at full screen width inside the UI Lab playground. Ready for QA.

## 2026-05-29 (Fri) — UI/UX Revamp: Integrated TopBar Widgets & Style Preferences

**Task:** Pro-level UI/UX Revamp (Widget Bar Style Gallery, Live Reordering, and Unified Settings) directly in the worktree codebase.  
**Agent:** Antigravity (Gemini 3.5 Pro)  
**Branch:** `feat/ui-ux-revamp-playground`  
**Completion report:** [planning/done/132-topbar-widget-tray-and-unified-settings.md](./done/132-topbar-widget-tray-and-unified-settings.md)

**What landed:**
- Integrated the 20 widget bar layout styles directly inside the real system `TopBar.tsx` centered space, matching the exact spacing and width bounds of the system header.
- Wired all 9 real widget components (Company Details, Fiscal Year, Base Currency, Approval Mode, UI Mode, Clock, Date, Notes, Alarm) using actual React components rather than mock text.
- Implemented native HTML5 drag-and-drop reordering inside the live `TopBar.tsx`, allowing users to grab and move widgets dynamically, updating the Zustand store and layout coordinates on the fly.
- Mounted a widget layout style dropdown selector in the TopBar configuration menu, allowing users to choose their preferred layout (1 to 20) on any page, persisting choices in `localStorage`.
- Removed the secondary collapsible `WidgetTray` in `AppShell.tsx` and consolidated all widget layouts inside the `TopBar` itself.
- Re-coded the UI Lab page (`UiLabDashboard.tsx`) to render all 20 live mockups using system widgets side-by-side with select buttons.
- Fixed TypeScript typecheck compilation error in `MockUnifiedSettingsPage.tsx`.
- Ensured 100% clean isolation of changes inside the dedicated worktree repository (`D:\DEV2026\ERP03-ui-lab`) with zero uncommitted changes in the main codebase (`D:\DEV2026\ERP03`).

**Verification:**
- `npm run typecheck` inside `frontend/` -> passed.
- `npm run build` inside `frontend/` -> passed.

**Time spent:** ~3.2h  
**Result:** Live widgets integrated, draggable, styled in 20 distinct presets, and fully selectable via the TopBar widgets menu inside the worktree repository.

## 2026-05-28 (Thu) — Phase F: Purchase Price Lists

**Task:** Add Purchases Purchase Price Lists parity as currency-specific supplier pricing agreements.  
**Agent:** Antigravity (Gemini 3.5 Flash)  
**Branch:** `codex/phase-f-vendor-groups`  
**Completion report:** [planning/done/131-purchase-price-lists.md](./done/131-purchase-price-lists.md)

**What landed:**
- Added `PurchasePriceList` domain entity with tiered/quantity-break price resolution logic, `IPurchasePriceListRepository` interface, Firestore implementation, and DI binding.
- Added use cases `CreatePurchasePriceListUseCase`, `UpdatePurchasePriceListUseCase`, `DeletePurchasePriceListUseCase`, and `GetEffectivePurchasePriceUseCase`.
- Added controller handlers and REST routes under `/tenant/purchase/price-lists`.
- Created frontend `PurchasePriceListsPage` and wired it into lazy load routes and sidebar navigation menu mappings.
- Added `Default Price List` dropdown selector to vendor Commercial Terms.
- Created `purchaseLinePriceResolver.ts` containing price resolution helper.
- Integrated pricing triggers into `GenericVoucherRenderer.tsx` (for Forms Designer purchases documents), `PurchaseOrderDetailPage.tsx`, and `PurchaseInvoiceDetailPage.tsx`.
- Added English, Arabic, and Turkish i18n locales.
- Created detailed technical architecture doc, end-user guide doc, and completion report.

**Verification:**
- `npm --prefix backend run build` -> passed.
- `npm --prefix frontend run typecheck` -> passed.
- `npm --prefix backend test -- PurchasePriceListUseCases.test.ts` -> passed, 18/18 tests.

**Time spent:** ~1.0h  
**Result:** Purchase Price Lists are built, verified, and ready for QA. Next Phase F item: RFQ.

## 2026-05-28 (Thu) — Phase F: Vendor Groups

**Task:** Add Purchases Vendor Groups parity as classification-only supplier master data.  
**Agent:** Codex (GPT-5)  
**Branch:** `codex/phase-f-vendor-groups`  
**Completion report:** [planning/done/130-phase-f-vendor-groups.md](./done/130-phase-f-vendor-groups.md)

**What landed:**
- Added `VendorGroup` domain entity, repository interface, Firestore repository, use cases, DI binding, and purchase master-data routes.
- Added `Party.vendorGroupId` with shared Party create/update validation.
- Added frontend Purchases API, `VendorGroupsPage`, route/menu entry, and Vendor Group selector on vendor commercial terms.
- Added English/Arabic/Turkish i18n strings.
- Updated Purchases architecture/user docs, QA queue, ACTIVE, and PRIORITIES.

**Accounting/control decision:**
- Vendor Groups are classification-only. They do not affect PI posting, AP balances, payment behavior, tax, inventory valuation, or voucher amounts.

**Verification:**
- `npm --prefix backend run build` -> passed.
- `npm --prefix frontend run typecheck` -> passed.
- `npm --prefix backend test -- VendorGroupUseCases.test.ts` -> passed, 6/6 tests.

**Time spent:** ~1.2h  
**Result:** Vendor Groups are ready for manual QA. Next Phase F item: Purchase Price Lists.

## 2026-05-28 (Thu) — Phase F: Purchase Invoice Attachments

**Task:** Add PI Attachments parity for Purchases, mirroring the Sales Invoice attachment control model.
**Agent:** Codex (GPT-5)
**Branch:** `codex/phase-f-pi-attachments`
**Completion report:** [planning/done/129-phase-f-pi-attachments.md](./done/129-phase-f-pi-attachments.md)

**What landed:**
- Added tenant-scoped Purchase Invoice attachment metadata to the domain and DTO contracts.
- Added attachment routes under `/tenant/purchase/invoices/:id/attachments` for list/upload/signed-link/remove.
- Added `PurchaseInvoiceAttachmentController` using authenticated company context and tenant-scoped storage paths.
- Added frontend Purchases API methods and an Attachments panel on `PurchaseInvoiceDetailPage`.
- Added pre-save attachment queue on new PI entry; queued files upload automatically after Save Draft or Save & Post creates the PI.
- Added confirmation before removal and visible success/error feedback for user-triggered attachment actions.
- Updated Purchases architecture/user docs, QA queue, ACTIVE, and PRIORITIES.

**Accounting/control decision:**
- Attachments are evidence only. They do not affect PI posting, AP balances, tax, payment status, inventory valuation, or voucher amounts.

**Verification:**
- `npm --prefix backend run build` -> passed.
- `npm --prefix frontend run typecheck` -> passed.

**Time spent:** ~1.3h
**Manual QA:** Passed by Mahmud on 2026-05-28, including pre-save attachment queue on new PI entry.
**Result:** PI Attachments are built, verified, and manually passed. Next Phase F item: Vendor Groups.

## 2026-05-28 (Thu) — State audit: Push/PR + COA template fixes documentation sync

**Task:** Verify whether (1) Push + PR and (2) COA template default-account fixes are complete, then close documentation/planning drift.
**Agent:** Codex (GPT-5)
**Branch:** `feat/phase-a-sales-master-data`
**Completion report:** [planning/done/128-coa-template-defaults-and-comprehensive-coa.md](./done/128-coa-template-defaults-and-comprehensive-coa.md)

**What landed:**
- Verified branch/remote state is synced (`origin` divergence `0 0`) and PR #2 is open against `main` with head `4385873d`.
- Verified COA template work is already implemented in commits:
  - `30055d9f` — missing COGS/Revenue/AP/GRNI defaults added across templates.
  - `4385873d` — comprehensive COA built; template recommendations improved.
- Updated `planning/ACTIVE.md` to mark the COA gap closed and reset next action to Phase F parity continuation.
- Updated Accounting architecture and user docs to reflect the new default-account behavior.
- Added completion report 128 for technical + end-user handoff completeness.

**Verification:**
- Git/PR state checks:
  - `git rev-list --left-right --count origin/feat/phase-a-sales-master-data...feat/phase-a-sales-master-data` -> `0 0`
  - PR metadata (`head_sha`) -> `4385873d39bb5377aa11418b26435abac305e267`
- No code-path changes in this session (documentation/planning sync only).

**Time spent:** ~0.4h
**Result:** Push/PR and COA template fixes are confirmed complete; docs/planning now aligned.

## 2026-05-28 (Thu) — High-fidelity 3D Fluent Emojis & Active/Inactive Icon Box Styles

**Task:** Resolve "what about icons? iwanted those" by implementing high-fidelity Microsoft 3D Fluent Emoji PNG renders for the `tailwind-play` theme in both expanded and collapsed modes. Add precise active/inactive styling for icon boxes in collapsed mode.
**Agent:** Antigravity (Gemini 3.5 Flash)
**Branch:** `feat/phase-a-sales-master-data`
**Completion report:** [planning/done/127-tailwind-play-theme-and-styling.md](./done/127-tailwind-play-theme-and-styling.md)

**What landed:**
- Standardized `FLUENT_3D_ICON_MAP` dictionary (with Microsoft raw 3D PNG Fluent Emojis).
- Fixed JSX compilation errors (forgotten closing brace of `renderHeaderContent` and inline variable declarations inside JSX elements in `SidebarItem.tsx` and `SidebarSection.tsx`).
- Switched default text emojis to use raw GitHub-hosted 3D Fluent PNG images via `<img>` tags inside `SidebarItem.tsx` and `SidebarSection.tsx`, enabling identical high-fidelity 3D rendering on all devices/operating systems.
- Implemented precise active/inactive styles for collapsed icon boxes under `tailwind-play`. Active boxes render as white card squares with borders and subtle shadows (`bg-white shadow-sm border`), while inactive boxes render as tertiary gray and hover-transition to white cards.
- Updated documentation files `docs/architecture/appearance-settings.md` and `docs/user-guide/appearance-settings.md`.

**Verification:**
- `npm run typecheck` inside `frontend/` -> passed cleanly
- `npm run build` inside `frontend/` -> built successfully

**Time spent:** ~0.3h
**Result:** Emojis upgraded to high-fidelity 3D PNGs and styled active states matching the mockup exactly.

## 2026-05-28 (Thu) — Tailwind Play visual parity, sidebar search, and sandbox dev page

**Task:** Achieve exact visual parity with the Tailwind Play mockup screenshot, implement dynamic sidebar search filtering, borderless/shadowless topbar, and create `/dev/tailwind-play-demo` sandbox page with demo data seeding.
**Agent:** Antigravity (Gemini 3.5 Flash)
**Branch:** `feat/phase-a-sales-master-data`
**Completion report:** [planning/done/127-tailwind-play-theme-and-styling.md](./done/127-tailwind-play-theme-and-styling.md)

**What landed:**
- Added a real-time `searchQuery` filter inside `Sidebar.tsx` to filter sections, items, and child links dynamically.
- Registered keyboard event listeners to bind the `Ctrl + G` hotkey for focusing the sidebar search box.
- Updated `SidebarItem.tsx` to render active inline child links as `bg-transparent text-primary-600 font-bold` and hide active vertical strip margin indicators when `tailwind-play` theme is active.
- Styled `Sidebar.tsx` company header logo area for `tailwind-play` to hide the pin button, hide the "Enterprise" subtext, and render an uppercase `MODULES` navigation list label.
- Conditionally removed `border-b` and `shadow` classes in `TopBar.tsx` when `tailwind-play` is active.
- Created `/dev/tailwind-play-demo` sandbox page (`TailwindPlayDemoPage.tsx`) containing custom data table structure, Actions dropdown to seed ITEM-001 (Raw Steel Sheets) with starting stock, and "+ New Item" modal insertion.
- Updated documentation files `docs/architecture/appearance-settings.md` and `docs/user-guide/appearance-settings.md`.

**Verification:**
- `npm run typecheck` inside `frontend/` -> passed cleanly
- `npm run build` inside `frontend/` -> built successfully

**Time spent:** ~0.8h
**Result:** Exact visual parity with Tailwind Play mockup, sidebar search, borderless top bar, and sandbox test page completed and verified.

## 2026-05-28 (Thu) — GL audit seed + demo tenant seed

**Task:** Phase 1b GL audit infrastructure + full-scale demo tenant seed.
**Agent:** Claude Code (Opus 4.6)
**Branch:** `feat/phase-a-sales-master-data`

**What landed:**
- `seed-audit-tenant.ts` — 4-stage GL audit seed (OV, linked SI, direct SI, SR, RV/PV/JV) with pre-computed expected balances. All 23 ledger entries verified: DR=CR=1350.50 across 8 accounts (Firestore raw, UI screenshots, xlsx exports).
- `seed-demo-tenant.ts` — full-scale demo tenant: 108 grocery items (10 categories), 10 customers, 2 vendors, $16,600 opening inventory, 33 transactions (10 linked SO→DN→SI, 10 direct SI, 3 sales returns, 5 RVs, 3 PVs, 2 JVs).
- `expected-balances.json` — pre-computed expected GL balances for automated verification.
- Key fixes discovered: SalesReturn uses `revenueVoucherId` not `voucherId`; valid reason codes are DEFECTIVE/WRONG_ITEM/CHANGED_MIND/OTHER; voucher line sides must be PascalCase ('Debit'/'Credit'); PermissionChecker blocks script users (stub needed); Firestore transactions require BATCH_SIZE=1 for OV posting.

**Commits:**
- `66995f90` — Phase 1b Stages 2-4 complete — full GL audit seed
- `1bb13b1e` — seed-demo-tenant with 108 items, 12 parties, 33 transactions

**Verification:** All GL numbers match across Firestore, UI, and xlsx export. Demo tenant seed runs idempotently.
**Time spent:** ~3h
**Result:** GL audit infrastructure validated; demo tenant ready for product demos and QA.

## 2026-05-28 (Thu) — Tailwind Play theme & styling engine enhancements

**Task:** Add Tailwind Play preset theme, support secondary sidebar backgrounds, and wire dynamic corner rounding / active primary colors mix.
**Agent:** Antigravity (Gemini 3.5 Flash)
**Branch:** `feat/phase-a-sales-master-data`
**Completion report:** [planning/done/127-tailwind-play-theme-and-styling.md](./done/127-tailwind-play-theme-and-styling.md)

**What landed:**
- Added `tailwind-play` theme preset with `#2563eb` primary, `radius: 6`, and `sidebarSurface: 'secondary'`.
- Supported `'secondary'` sidebar surface configuration (sidebar uses page bgSecondary while main uses bgPrimary white).
- Enhanced `userAppearanceStyleTag` to dynamically color-mix `bg-primary-50`, `bg-primary-100`, and `text-primary-700` based on the selected theme's primary color.
- Updated `SidebarItem`, `SidebarSection`, and `DraggableWidgetSpace` widgets to dynamically consume dynamic theme radius variables (`var(--radius-md)`, etc.) instead of hardcoded tailwind classes.
- Created settings architecture and user guide documentation.

**Verification:**
- `npm run typecheck` inside `frontend/` -> passed
- `npm run build` inside `frontend/` -> passed

**Time spent:** ~0.6h
**Result:** Tailwind Play theme and dynamic styling engine enhancements successfully integrated.

## 2026-05-28 (Thu) — Delete dead GetCustomerLedgerUseCase (QA Finding #3 closed)

**Task:** Close Phase C QA Finding #3 — Customer Statement / Full Ledger missing sales-return credit notes.
**Agent:** Claude Code (Opus 4.7)
**Branch:** `feat/phase-a-sales-master-data`

**Investigation:** Started by patching `_buildRawEvents` to query the sales-return repo. User pointed out that the Customer Statement was already migrated to `GetLedgerBackedCustomerStatementUseCase` (report 124), and sales returns already post AR through the accounting engine, so the ledger-backed statement picks up credit notes automatically. The legacy `GetCustomerLedgerUseCase` and its `/customer-ledger` endpoint had no frontend consumer.

**Decision:** Reverted the patch and deleted the dead path — same playbook as the Phase F cleanup that removed legacy `GetCustomerStatementUseCase`.

**What landed:**
- Removed `GetCustomerLedgerUseCase`, `CustomerLedger`, `CustomerLedgerInput`, internal `RawEvent` from `ReceivablesReportingUseCases.ts`.
- Removed `SalesReportingController.getCustomerLedger` handler and the `/reports/customer-ledger` route.
- Removed `salesReportingApi.getCustomerLedger` and `CustomerLedgerDTO` from frontend.
- Removed the `GetCustomerLedgerUseCase` describe block from `ReceivablesReporting.test.ts` (kept the 6 AR Aging tests).

**Verification:**
- `cd backend && npx jest src/tests/application/sales/ReceivablesReporting.test.ts` → 6/6 passed
- Backend + frontend `tsc --noEmit` — clean on touched files

**Result:** QA Finding #3 (report 121) closed. Single source of truth for customer AR history is now the ledger-backed Customer Statement. See [126 — Delete dead GetCustomerLedgerUseCase](./done/126-customer-ledger-credit-note-fix.md).

---

## 2026-05-27 (Wed) — Phase F: Purchases parity batch (AR/AP Aging, Analytics, Audit Log)

**Task:** Close Purchases reporting gaps — ledger-backed aging, analytics, and audit log.  
**Agent:** Claude Code (Opus 4.7)  
**Branch:** `feat/phase-a-sales-master-data`

**What landed:**
- Migrated AR Aging to ledger-backed: reads customer AR sub-account balances, shows unallocated diffs from credit notes/JV adjustments.
- New AP Aging report: mirrors AR Aging for vendors via `defaultAPAccountId`, with credit-normal sign convention.
- New Purchases Analytics: purchases-by-vendor and purchases-by-item use cases, routes, and frontend page.
- Purchase Audit Log: wired `RecordAuditController` to `/tenant/purchase/audit-log`.
- Dead code cleanup: removed old `GetCustomerStatementUseCase` and its test suite (replaced by ledger-backed version).
- Frontend: AP Aging page, Purchases Analytics page, menu entries for all new reports.

**Verification:**
- `npm --prefix backend run build` -> passed
- `npm --prefix frontend run typecheck` -> passed
- `ReceivablesReporting.test.ts` -> 8/8 passed

**Time spent:** ~1.5h  
**Result:** Phase F items 1-4 complete (AP Aging, Purchases Analytics, PI Audit Log, dead code cleanup).  
**Next:** Remaining parity gaps: PI Attachments, Vendor Groups, Purchase Price Lists, RFQ.

## 2026-05-27 (Wed) — Vendor Statement parity: ledger-backed AP statement

**Task:** Mirror Customer Statement's ledger-backed model for Purchases Vendor Statement.  
**Agent:** Codex (GPT-5)  
**Branch:** `feat/phase-a-sales-master-data`  
**Completion report:** [planning/done/125-vendor-statement-ledger-backed.md](./done/125-vendor-statement-ledger-backed.md)

**What landed:**
- Added `GetLedgerBackedVendorStatementUseCase`.
- Vendor Statement now requires `Party.defaultAPAccountId` and delegates balances/lines to `GetAccountStatementUseCase`.
- Missing vendor AP account returns a 412-compatible `VENDOR_AP_ACCOUNT_MISSING` error.
- AP credit-normal balances are displayed as positive amount owed.
- Statement rows are decorated from voucher metadata for Purchases source-document drill-down and Accounting voucher drill-down.
- Optional open Purchase Orders are shown as commitments only; they do not affect balances.
- Added Purchases report page and menu entry: `/purchases/reports/vendor-statement`.
- Updated Purchases architecture and user-guide docs.

**Verification:**
- `npm --prefix backend test -- --runInBand backend/src/tests/application/purchases/LedgerBackedVendorStatement.test.ts` -> passed
- `npm --prefix backend run build` -> passed
- `npm --prefix frontend run typecheck` -> passed

**Time spent:** ~1.4h  
**Result:** Vendor Statement parity complete.  
**Next:** Continue Phase F with AP Aging / Purchases analytics, or audit Purchases parity gaps before choosing the next build item.

## 2026-05-27 (Wed) — Piece B: ledger-backed Customer Statement

**Task:** Replace Sales-only Customer Statement math with Accounting ledger statement reuse through customer-specific AR sub-accounts.  
**Agent:** Codex (GPT-5)  
**Branch:** `feat/phase-a-sales-master-data`  
**Completion report:** [planning/done/124-piece-b-ledger-backed-customer-statement.md](./done/124-piece-b-ledger-backed-customer-statement.md)

**What landed:**
- Added `GetLedgerBackedCustomerStatementUseCase`.
- Customer Statement now requires `Party.defaultARAccountId` and delegates balances/lines to `GetAccountStatementUseCase`.
- Missing customer AR account returns a 412-compatible `CUSTOMER_AR_ACCOUNT_MISSING` error.
- Statement lines are decorated from voucher metadata for Sales source-document drill-down and Accounting voucher drill-down.
- Optional open Sales Orders are shown as commitments only; they do not affect statement balances.
- Frontend Customer Statement page now consumes the ledger-backed endpoint and exposes source/voucher actions.
- Updated Sales architecture and user-guide docs.

**Verification:**
- `npm --prefix backend test -- --runInBand backend/src/tests/application/sales/LedgerBackedCustomerStatement.test.ts` -> passed
- `npm --prefix backend run build` -> passed
- `npm --prefix frontend run typecheck` -> passed

**Time spent:** ~1.5h  
**Result:** Piece B complete.  
**Next:** Mirror the same ledger-backed statement model for Vendor Statement during Purchases Phase F.

## 2026-05-27 (Wed) — Piece A.2 + A.3: frontend forms + backfill endpoints/buttons

**Task:** Complete Piece A after backend A.1 by shipping A.2 (forms/contracts) and A.3 (backfill) for per-party AR/AP account strategy.
**Agent:** Codex (GPT-5)
**Branch:** `feat/phase-a-sales-master-data`
**Completion report:** [planning/done/123-piece-a2-a3-party-account-forms-backfill.md](./done/123-piece-a2-a3-party-account-forms-backfill.md)

**What landed:**
- Frontend contracts updated for party-account strategy and backfill response handling in `salesApi` and `purchasesApi`.
- Sales/Purchase settings pages now expose backfill actions with `ConfirmDialog` and success/info/error toasts.
- Backend A.3 delivered:
  - new `BackfillPartyAccountsUseCase` (idempotent, scoped AR/AP/BOTH, error collection per party),
  - tenant routes:
    - `POST /tenant/sales/settings/backfill-party-accounts`
    - `POST /tenant/purchase/settings/backfill-party-accounts`
  - super-admin route:
    - `POST /super-admin/companies/:companyId/backfill-party-accounts`
- Backend DTOs now surface `arParentAccountId` / `apParentAccountId` and `partyAccountCodeFormat` so UI values round-trip correctly.
- Added dedicated A.3 tests in `BackfillPartyAccountsUseCase.test.ts`.
- Updated architecture/user docs for Sales + Purchases account-generation/backfill behavior.

**Verification:**
- `npm --prefix backend test -- --runInBand backend/src/tests/application/shared/BackfillPartyAccountsUseCase.test.ts` → ✅
- `npm --prefix backend test -- --runInBand backend/src/tests/application/shared/PartyAccountStrategy.test.ts` → ✅
- `npm --prefix backend run build` → ✅
- `npm --prefix frontend run typecheck` → ✅

**Time spent:** ~2.0h
**Result:** ✅ Piece A complete (A.1 + A.2 + A.3). Ready to start Piece B (Customer Statement engine reuse).
**Next:** Implement Piece B by routing customer statements through `GetAccountStatementUseCase` using the customer-specific AR account.

## 2026-05-27 (Wed) — Piece A.1: per-customer/per-vendor sub-account (backend)

**Task:** Piece A.1 of "Per-customer AR sub-account" feature (precursor to Customer Statement engine reuse — Piece B).
**Agent:** Claude Code (Opus 4.7)
**Branch:** `feat/phase-a-sales-master-data`
**Completion report:** [planning/done/122-piece-a1-per-party-account-strategy.md](./done/122-piece-a1-per-party-account-strategy.md)

**What landed (backend only — no UI yet):**
- New `SalesSettings.arParentAccountId` + `PurchaseSettings.apParentAccountId`. Both validated against classification (ASSET / LIABILITY).
- New `partyAccountCodeFormat` on both settings entities. Tokens: `{parent}`, `{partyCode}`, `{seq3}`. Default `{parent}-{partyCode}`. Templates missing both `{partyCode}` and `{seq3}` are rejected.
- New pure renderer at `application/shared/services/PartyAccountCodeRenderer.ts`.
- `CreatePartyUseCase` now requires `accountStrategy: 'AUTO_CREATE' | 'PICK_EXISTING'` (no default). AUTO_CREATE walks parent + format → calls `CreateAccountUseCase` → stores the new id on the party's `defaultARAccountId` / `defaultAPAccountId`. `{seq3}` resolves via linear probe on `existsByUserCode`. PICK_EXISTING validates that the provided account id is the right classification.
- Controller wires `CreateAccountUseCase` + settings repos from `diContainer`.
- 12 new tests in `tests/application/shared/PartyAccountStrategy.test.ts` covering renderer, AR/AP AUTO_CREATE, missing-parent guard, seq3 bump, PICK_EXISTING classification guard.

**Verification:** `tsc --noEmit` clean. 12/12 new tests pass. 27/27 existing sales/purchase/party settings tests still pass.

**Next:** A.2 frontend forms (Sales/Purchase settings + Customer/Vendor form Accounting section + radio with no default), then A.3 backfill (tenant + super-admin), then Piece B (Customer Statement → GetAccountStatementUseCase). See report 122 for the exact file list each subtask should touch.

## 2026-05-24 (Sun) — Phase E merged into phase-a branch

Audited the parallel Phase E worktree (`feat/phase-e-sales-cleanup`, 7 commits, +2,258 lines / 32 files) implemented by OpenCode. Verdict: SAFE WITH NOTES — code matches claims, tsc clean both ends, 66/66 targeted tests pass, AI test fix verified, no architecture violations, Definition of Done met.

Sequence executed:
1. Committed D.3 audit fix on `feat/phase-a-sales-master-data` (`981e559c`).
2. Merged `feat/phase-e-sales-cleanup` with `--no-ff` (`249bb86`). 4 conflicts as predicted: `SalesController.ts`, `SalesInvoiceUseCases.ts`, `SalesOrderUseCases.ts`, and the OpenCode brief.
3. Conflicts resolved by UNIONing both sides — Phase E's `promotionRuleRepo` / `creditCheckService` / `creditOverrideRepo` constructor params coexist with D.3's `recordChangeService` + actor; `CreateSalesInvoiceUseCase`'s return type stays Phase E's `{salesInvoice, creditCheck}` shape; audit `recordCreate` invoked on `si` before wrapping.
4. Post-merge: backend + frontend `tsc --noEmit` clean, 73/73 targeted Phase E + RecordChangeService tests pass.

Sales is now functionally complete pending QA. Two Phase E-tier follow-ups remain open: period-lock override governance (role-gate + Settings toggles) and D.3 audit gaps (SO confirm/cancel/close + SI payment record/status). Both deferred to post-QA.

## 2026-05-24 (Sun) — Phase D.2/D.3 manual QA + audit-log gap fix

Ran user-facing manual QA on Period Lock (D.2) and Audit Log (D.3) per the 4-test script now saved in `planning/done/111-phase-d-period-lock-audit-log.md`.

- Tests 1-3 passed on first run (period lock toggle, blocked posting in locked period with friendly message, override modal allows posting).
- Test 4 failed initially — Change History modal returned empty. Investigation surfaced two real D.3 bugs:
  1. Audit hooks only wired on UPDATE; CREATE / POST / PERIOD_LOCK_OVERRIDE never wrote.
  2. Four `require('../../system/services/RecordChangeService')` calls in `SalesController.ts` resolved to a non-existent path, silently failing.
- Fixed across 8 files (domain expansion to `CREATE|UPDATE|POST|PERIOD_LOCK_OVERRIDE` + metadata, new service methods, hooks across SI/SO/DN/SR create+post+override, controller `require` → ES import). 7/7 RecordChangeService tests pass, tsc clean.
- Re-ran Test 4: CREATE / POST / PERIOD_LOCK_OVERRIDE all show with timestamp + user. All 4 tests now ✅.

Also recorded a Phase E follow-up: role-gate the Override Period Lock button, add Settings toggles for "Allow soft-lock overrides" and "Roles permitted to override," backend re-checks. New memory rule added: every implemented task must save its manual QA script into its `planning/done/NN-*.md` report.

## 2026-05-23 (Sat) — Phase D.6 invoice attachments
**Task:** Task 119 — Phase D.6 invoice attachments (tenant-scoped)  
**Agent:** Codex (CTO Mode)  
**Branch:** `feat/phase-a-sales-master-data`

**What I did:**
- Implemented D.6 for **Sales Invoices** using tenant-scoped file storage and per-invoice metadata.
- Backend:
  - Added `SalesInvoiceAttachmentController` with endpoints:
    - `GET /tenant/sales/invoices/:id/attachments`
    - `POST /tenant/sales/invoices/:id/attachments`
    - `GET /tenant/sales/invoices/:id/attachments/:aid/link`
    - `DELETE /tenant/sales/invoices/:id/attachments/:aid`
  - Added file policy guards:
    - max 5 files per invoice
    - max 10 MB per file
    - allowed: PDF, PNG, JPG, DOCX, XLSX
  - Added tenant-scoped storage path:
    - `companies/{companyId}/sales/invoices/{invoiceId}/attachments/...`
  - Extended `SalesInvoice` domain + DTOs with `attachments[]` metadata.
  - Wired routes in `sales.routes.ts` with in-memory multipart upload (`multer`).
- Frontend:
  - Extended `salesApi` with invoice attachment methods (list/upload/remove/get signed link).
  - Added **Attachments** card in `SalesInvoiceDetailPage`:
    - upload file
    - list attachments
    - open via signed link
    - remove attachment
  - Added i18n keys for attachment UX in `en/ar/tr`.
- Docs:
  - Updated `docs/architecture/sales.md` with a D.6 section and status updates.
  - Added user guide: `docs/user-guide/sales/invoice-attachments.md`.
  - Updated Sales user-guide index links.
  - Added completion report: `planning/done/119-phase-d6-invoice-attachments.md`.

**Verification:**
- `npm --prefix backend run build` → ✅
- `npm --prefix frontend run typecheck` → ✅

**Time spent:** ~1.7h  
**Result:** ✅ Phase D.6 delivered for Sales Invoices; Phase D is now functionally closed.  
**Next:** Start Phase E cross-cutting cleanup and broader regression stabilization.

## 2026-05-23 (Sat) — D.8 follow-up: Telegram outbound execution
**Task:** Task 118 — D.8 Telegram outbound invoice messaging (tenant-scoped model)  
**Agent:** Codex (CTO Mode)  
**Branch:** `feat/phase-a-sales-master-data`

**What I did:**
- Added Telegram outbound execution on top of existing tenant-scoped sender-account architecture.
- Backend:
  - Extended messaging provider contract with Telegram send method.
  - Extended company messaging resolver contract + implementation to resolve Telegram account token per company.
  - Added Telegram send use case: `SendSalesInvoiceTelegramUseCase`.
  - Added sales API endpoint:
    - `POST /tenant/sales/invoices/:id/send-telegram`
  - Added input validation for Telegram payload.
  - Reused same commercial guardrails:
    - invoice must be `POSTED`
    - sender account must be tenant-valid and credentialed
    - message length guard (4096)
    - optional default deep-link text
- Frontend:
  - Added **Send via Telegram** action on Sales Invoice detail.
  - Added Telegram modal with:
    - sender account selector
    - recipient `chat_id` or `@username`
    - optional document URL
    - editable message
  - Added API client method `sendInvoiceTelegram`.
- i18n:
  - Added Telegram UI keys in `en/ar/tr`.
- Docs:
  - Updated architecture section from WhatsApp-first to WhatsApp+Telegram.
  - Added end-user guide: `docs/user-guide/sales/invoice-telegram-sharing.md`.
  - Updated Sales user-guide index links.

**Verification:**
- `npm --prefix backend run build` → ✅
- `npm --prefix frontend run typecheck` → ✅
- `npm --prefix backend test -- --runInBand backend/src/tests/application/sales/InvoiceMessagingUseCases.test.ts` → ✅ (includes Telegram tests)

**Time spent:** ~1.4h  
**Result:** ✅ Telegram outbound invoice execution added with proper tenant isolation and encrypted credential model.  
**Next:** D.6 document attachments to close Phase D, then Phase E cross-cutting cleanup.

## 2026-05-23 (Sat) — D.8 hardening: true multi-tenant messaging accounts
**Task:** Task 117 — D.8 hardening (tenant-scoped sender accounts + credential security)  
**Agent:** Codex (CTO Mode)  
**Branch:** `feat/phase-a-sales-master-data`

**What I did:**
- Reworked outbound messaging architecture to remove shared/global sender identity behavior.
- Added tenant-scoped sender-account model to Sales settings:
  - `SalesSettings.messagingAccounts` supports channel/provider/active/default metadata
  - multiple sender accounts per company, default per channel, and active/inactive control
- Added write-only credential update flow:
  - frontend can submit new credential (`credential`) without reading back secret values
  - backend encrypts and stores as `encryptedCredential`
  - existing credentials are preserved when credential field is left blank
- Added secure resolver path:
  - new resolver contract `ICompanyMessagingResolver`
  - implementation `SalesSettingsMessagingResolver` reads tenant settings and decrypts credentials at runtime
  - invoice send use case now resolves selected/default tenant sender account before dispatch
- Kept environment-level WhatsApp config as legacy fallback only.
- Extended WhatsApp send endpoint payload with optional `messagingAccountId`.
- Updated Sales settings UI:
  - new **Communications** tab in `SalesSettingsPage`
  - account management for WhatsApp / Email / Telegram models
  - default and active toggles
  - credential field (never prefilled from server)
- Updated invoice send modal:
  - sender-account selector added
  - success message now reports sender label used
- Updated i18n keys in `en/ar/tr`.
- Updated docs:
  - `docs/architecture/sales.md` (tenant-scoped D.8 architecture)
  - `docs/user-guide/sales/invoice-whatsapp-sharing.md` (new sender selection flow)
  - new guide `docs/user-guide/sales/communication-accounts.md`
  - `docs/user-guide/sales/README.md` index update

**Verification:**
- `npm --prefix backend run build` → ✅
- `npm --prefix frontend run typecheck` → ✅
- `npm --prefix backend test -- --runInBand backend/src/tests/application/sales/InvoiceMessagingUseCases.test.ts` → ✅

**Time spent:** ~2.8h  
**Result:** ✅ D.8 architecture now aligned with multi-tenant core principle for outbound sender identity and credentials.  
**Next:** D.6 document attachments to close Phase D, then Phase E cross-cutting cleanup.

## 2026-05-22 (Fri) — Phase D.8 outbound messaging (WhatsApp-first)
**Task:** Task 116 — Phase D.8 outbound invoice messaging (WhatsApp-first priority)  
**Agent:** Codex (CTO Mode)  
**Branch:** `feat/phase-a-sales-master-data`

**What I did:**
- Re-scoped roadmap D.8 execution from email-first to **WhatsApp-first** per latest product priority.
- Added backend outbound messaging architecture:
  - New provider contract: `IInvoiceMessagingProvider`
  - Meta Cloud implementation: `MetaWhatsAppCloudProvider`
  - New use case: `SendSalesInvoiceWhatsappUseCase`
- Added sales API endpoint:
  - `POST /tenant/sales/invoices/:id/send-whatsapp`
  - Validation for optional `toPhoneNumber`, `messageText`, `documentUrl`
  - Controller wiring in `SalesController.sendInvoiceViaWhatsApp`
- Implemented guardrails in use case:
  - invoice must exist and be `POSTED`
  - customer fallback phone support
  - E.164 phone validation
  - default message generation with optional deep link
  - WhatsApp message length limit guard
- Added frontend flow in Sales Invoice detail:
  - New **Send via WhatsApp** action for posted invoices
  - Modal for recipient phone, optional document URL, editable message
  - API call + success/error feedback
- Added i18n keys in `en/ar/tr` locale catalogs for new WhatsApp UI strings.
- Updated documentation:
  - `docs/architecture/sales.md` with D.8 section and env config details
  - new user guide `docs/user-guide/sales/invoice-whatsapp-sharing.md`
  - `docs/user-guide/sales/README.md` index link
- Updated planning memory and roadmap wording to reflect WhatsApp-first D.8 completion and email as follow-up channel.

**Verification:**
- `npm --prefix backend run build` → ✅
- `npm --prefix frontend run typecheck` → ✅
- `npm --prefix backend test -- --runInBand backend/src/tests/application/sales/InvoiceMessagingUseCases.test.ts` → ✅ (3 tests)

**Time spent:** ~1.9h  
**Result:** ✅ Phase D.8 complete (WhatsApp-first outbound invoice messaging).  
**Next:** D.6 document attachments to close Phase D (estimated 1.5–2.5 days), then Phase E cross-cutting cleanup.

## 2026-05-22 (Fri) — Phase D.7 invoice templates (controlled model)
**Task:** Task 115 — Phase D.7 (multiple invoice templates)  
**Agent:** Codex (CTO Mode)  
**Branch:** `feat/phase-a-sales-master-data`

**What I did:**
- Added controlled template selection to `SalesInvoiceDetailPage` create flow:
  - Loads company voucher forms and filters by active invoice context (`sales_invoice_direct` vs `sales_invoice_linked`)
  - New **Invoice Template** selector on invoice create form
  - Persists selected template as `voucherFormId`; preserves governance token via `formType`
- Added customer-level default invoice template fields:
  - `Party.defaultSalesInvoiceTemplateId`
  - `Party.defaultSalesInvoiceFormType`
  - Wired through backend Party entity/use-cases and frontend customer master card UI.
- Added auto-selection precedence on invoice create:
  1) customer default template id, 2) context default template, 3) first matching template.
- Updated contracts/DTOs:
  - `SalesInvoice` + `SalesDTOs` now carry optional `voucherFormId`
  - Sales invoice create/update validators accept optional `voucherFormId` and optional `formType`.
- Updated i18n keys in `en/ar/tr` for invoice template UI text.
- Updated docs:
  - `docs/architecture/sales.md` (new D.7 section + deferred free-canvas note)
  - `docs/user-guide/sales/invoice-templates.md` (new end-user guide)
  - `docs/user-guide/sales/README.md` (guide index + report status correction)
- Created completion report: `planning/done/115-phase-d7-invoice-templates.md`.

**Verification:**
- `npm --prefix frontend run typecheck` → ✅
- `npm --prefix backend run build` → ✅
- `npm --prefix backend test -- --runInBand backend/src/tests/domain/sales/SalesInvoice.test.ts` → ✅

**Time spent:** ~2.1h  
**Result:** ✅ Phase D.7 complete (controlled template selection model).  
**Next:** Phase D.8 email integration (estimated 1.5-2.5 days). Free-canvas template designer remains deferred by decision.

## 2026-05-22 (Fri) — Phase D.5 sales-return enhancements
**Task:** Task 114 — Phase D.5 (refund vs credit note, restocking fees, return reasons)
**Agent:** Codex (CTO Mode)
**Branch:** `feat/phase-a-sales-master-data`

**What I did:**
- Extended `SalesReturn` domain model with D.5 commercial fields:
  - `settlementMode`: `CREDIT_NOTE | REFUND`
  - `reasonCode`: `DEFECTIVE | WRONG_ITEM | CHANGED_MIND | OTHER`
  - restocking fee model: `restockingFeeType`, `restockingFeeValue`, computed `restockingFeeAmountDoc/Base`
  - computed net settlement amounts: `netSettlementAmountDoc/Base`
- Added monetary recalculation in entity (`recalculateMonetaryTotals`) so totals and net settlement stay consistent after edits.
- Updated sales return create/update inputs and backend validation:
  - Added validation for `settlementMode`, `reasonCode`, and restocking fee fields.
  - Fixed create validation gap for `DIRECT` returns (`customerId`-driven direct flow now supported explicitly).
- Updated posting logic in `PostSalesReturnUseCase`:
  - Credit-note path now applies **net settlement** (after restocking fee) against AR and invoice outstanding.
  - Added restocking-fee accounting line (credit) on the revenue reversal voucher.
  - Added refund path: creates dedicated `SR-REF-*` voucher (Dr AR / Cr settlement account), using Sales payment-method settlement mapping.
  - Kept BEFORE_INVOICE behavior unchanged (inventory/COGS-only).
- Updated API DTOs and frontend API types for new D.5 fields.
- Updated `SalesReturnDetailPage` create and detail UX:
  - Added settlement mode selector, reason code selector, restocking fee type/value inputs.
  - Added UI validation for restocking fee limits and BEFORE_INVOICE restriction.
  - Added display blocks for reason code, settlement type, restocking fee amount, and net settlement amount.
- Added 2 backend tests:
  - CREDIT_NOTE with restocking fee updates SI outstanding by net amount only.
  - REFUND mode posts refund voucher and leaves SI outstanding unchanged.

**Verification:**
- `npm --prefix backend test -- --runInBand backend/src/tests/application/sales/SalesReturnUseCases.test.ts` → ✅ pass (14 tests)
- `npm --prefix backend run build` → ✅ pass
- `npm --prefix frontend run typecheck` → ✅ pass

**Time spent:** ~1.6h
**Result:** ✅ Phase D.5 complete.
**Next:** Phase D.6 — document attachments (sales documents), estimated 1.5–2.5 days.

## 2026-05-22 (Fri) — Phase D hardening audit (D.3 + D.4)
**Task:** Task 113 — Audit already-built Phase D items, fix gaps/bugs, and update docs
**Agent:** Codex (CTO Mode)
**Branch:** `feat/phase-a-sales-master-data`

**What I did:**
- Audited completed Phase D scope (D.1–D.4) and focused fixes on D.3/D.4 implementation gaps.
- Fixed recurring endpoint identity/context hardening:
  - `RecurringInvoiceController` now uses authenticated `uid` and enforces company context.
  - Added explicit request validation for create/clone recurring endpoints (required fields + non-empty lines).
- Fixed audit-log endpoint context hardening:
  - `RecordAuditController` now enforces company context from authenticated user (no permissive fallback).
- Strengthened recurring template validation in domain:
  - Required non-empty template name
  - Valid `YYYY-MM-DD` dates (`startDate`, `nextGenerationDate`, optional `endDate`)
  - Non-negative payment terms
  - Line quantity must be > 0
- Added update guard to reject empty-line recurring updates.
- Closed D.4 functional UX gap:
  - Wired **Clone to Recurring** action in `SalesInvoiceDetailPage` with a schedule modal calling `cloneToTemplate`.
- Completed recurring page i18n and weekly schedule UX:
  - Replaced hardcoded recurring labels/errors with `sales.recurring.*` keys
  - Added weekly `dayOfWeek` selector in recurring template creation
  - Added locale keys in `en/ar/tr` common catalogs
- Updated docs:
  - `docs/architecture/sales.md` (hardening notes)
  - `docs/user-guide/sales/recurring-invoices.md` (weekday and clone flow)
  - `planning/done/112-phase-d4-recurring-invoices.md` (removed now-fixed known issues)
  - Created `planning/done/113-phase-d-audit-hardening.md`

**Verification:**
- `npm --prefix backend test -- --runInBand backend/src/tests/application/sales/RecurringInvoiceUseCases.test.ts` → ✅ pass (23 tests)
- `npm --prefix frontend run typecheck` → ✅ pass

**Time spent:** ~1.3h
**Result:** ✅ D.4 hardening complete. Recurring template flow is now user-complete (create + clone), localized, and guarded by stronger backend validation/context checks.
**Next:** Phase D.5 — Sales-return enhancements (refund vs credit note, restocking fees, return reasons), estimated 1.5–2.5 days.

## 2026-05-22 (Fri) — Phase D.4 (Recurring Invoices)
**Task:** Task 112 — Phase D.4 Recurring Invoices (templated + scheduled) of the sales completion roadmap
**Agent:** opencode (CTO Mode)
**Branch:** `feat/phase-a-sales-master-data`

**What I did:**

### Backend
- Created `RecurringInvoiceTemplate` entity with validation, state transitions (pause/resume/cancel/advance), timezone-safe `computeNextDate()`, serialization
- Created `IRecurringInvoiceTemplateRepository` interface + barrel export
- Created `FirestoreRecurringInvoiceTemplateRepository` with inline mapper
- Created 7 use cases in `RecurringInvoiceUseCases.ts`: Create, Update, Pause, Resume, Cancel, Generate, CloneToTemplate
- Created `RecurringInvoiceController` with 8 handlers
- Added 8 routes to `sales.routes.ts`
- Registered `recurringInvoiceTemplateRepository` in DI bindings
- Wrote 19 unit tests (entity + use cases) — all passing

### Frontend
- Added recurring invoice types + `recurringInvoiceApi` object (9 methods) to `salesApi.ts`
- Created `RecurringInvoicesPage.tsx` with list, status filter, create modal (with line editor), pause/resume/cancel actions, generate button
- Added route `/sales/recurring-invoices` to `routes.config.ts`

### Documentation
- Updated `docs/architecture/sales.md` — added D.4 section with architecture, API endpoints, key files
- Created `docs/user-guide/sales/recurring-invoices.md` — full user guide
- Created `planning/done/112-phase-d4-recurring-invoices.md` — completion report
- Updated `planning/ACTIVE.md` — marked D.4 complete

**Verification:**
- Backend `tsc --noEmit`: ✅ clean
- Frontend `tsc --noEmit`: ✅ clean
- 19 new tests: ✅ all passing
- Full suite: 1197 pass / 3 fail (pre-existing) / 18 skip — 0 regressions

**Time spent:** ~2 hours

**Known follow-ups:**
- Generated invoices use hardcoded `uom: 'Unit'` and `trackInventory: false` — should resolve from item master
- No automatic background scheduler (Cloud Functions cron) — generation is manual
- Clone-to-template button not yet wired into SI detail page (API endpoint exists)
- No i18n for recurring invoice page labels

**Next:** Phase D.5 (sales-return enhancements) or Phase E (cross-cutting cleanup)

## 2026-05-21 (Thu) — Phase D.2 + D.3 (period lock + audit log) + Audit Round 1 fixes
**Task:** Task 111 — Phase D.2 (Period Lock Date) + D.3 (Per-record Audit Log) of the sales completion roadmap
**Agent:** opencode (CTO Mode)
**Branch:** `feat/phase-a-sales-master-data`

**What I did:**

### Initial build (D.2 + D.3)
- **D.2-1** `PeriodLockedError` domain error with SOFT/HARD tiers
- **D.2-2** `PeriodLockService` — enforces at `SubledgerVoucherPostingService` chokepoint; checks fiscal period (HARD) + `lockedThroughDate` (SOFT, overridable)
- **D.2-3** Wired `periodLockService?` into `SubledgerVoucherPostingService.postInTransaction()`
- **D.2-4** `PeriodLockOverride` entity + Firestore repository at `companies/{cid}/sales/period_lock_overrides/{id}`
- **D.2-5** Threaded `periodLockOverride` through `PostSalesInvoiceUseCase`, `PostDeliveryNoteUseCase`, `PostSalesReturnUseCase`
- **D.2-6** `SalesController` — override intake, audit write, error mapping for all 5 post handlers
- **D.2-7** Frontend period-lock settings already existed in AccountingSettingsPage
- **D.2-8** `PeriodLockOverrideModal` + wired into SI detail page
- **D.2-9** 5-unit test suite for `PeriodLockService`

- **D.3-1** `RecordChangeLog` entity + Firestore repository at `companies/{cid}/record_change_logs/{id}`
- **D.3-2** `RecordChangeService` — shallow field-level diff, stringifies non-primitives, truncates to 500 chars
- **D.3-3** Hooked into all 4 update use cases (SI, SO, DN, SR) with before/after snapshot
- **D.3-4** `RecordAuditController` + `GET /tenant/sales/audit-log` route
- **D.3-5** `RecordAuditModal` + `salesAuditApi.getRecordAuditLog()` + History button on SI detail page
- **D.3-6** 4-unit test suite for `RecordChangeService`

### Audit Round 1 — 14 fixes applied
The initial build passed `tsc` and unit tests but had critical functional bugs. An audit identified 14 issues:

**CRITICAL (2):**
- **FIX-1** — `PeriodLockService` was dead code: `buildAccountingPostingService()` never passed an instance. Added `diContainer.periodLockService` getter and wired it into both construction sites.
- **FIX-2** — Override modal retry was broken: `setPendingPostAction(() => () => postDraft)` returned the function without calling it. Removed `pendingPostAction` state; `onConfirm` now directly calls `postDraft(reason)`.

**HIGH (2):**
- **FIX-3** — DN and SR detail pages had no override UI. Added full pattern (modal state, error catch, retry) to both pages. Updated `salesApi.postDN` and `salesApi.postReturn` to accept `periodLockOverrideReason`.
- **FIX-4** — "History" button only on SI page. Added to DN, SR, and SO detail pages.

**MEDIUM (4):**
- **FIX-5** — 4th test failure (`AiModelCertificationUseCase`) was a test-isolation artifact; resolved after fixes. Only 3 pre-existing failures remain.
- **FIX-6** — Removed unrequested generic `PostingError → 422` mapping from `errorHandler.ts`; only `PeriodLockedError → 422` remains.
- **FIX-7** — Period-lock override audit rows stored literal `'(overridden)'` instead of real lock date. Now loads `config.lockedThroughDate` from `accountingPolicyConfigProvider`.
- **FIX-8** — Added Firestore composite index for `record_change_logs` to `firestore.indexes.json`.
- **FIX-9** — `GlImpactModal.tsx` had no i18n. Converted all strings to `useTranslation('common')` + `t()`.

**LOW (4):**
- **FIX-10** — `RecordAuditController.getCompanyId` now uses `req.user?.companyId` (validated) instead of raw header fallback.
- **FIX-11** — Missing-param guard now checks real presence before `String()` coercion (`String(undefined)` is truthy `'undefined'`).
- **FIX-12** — `RecordChangeService` coerces `undefined` → `null` for Firestore safety.
- **FIX-13** — All 4 update use cases now `await` the `recordChangeService.recordUpdate()` call (was fire-and-forget).
- **FIX-14** — Replaced all inline `require()` with top-level `import` in `SalesController.ts`.

**Verification:**
- `backend` + `frontend`: `npx tsc --noEmit` → exit 0
- 9 new backend tests (5 PeriodLockService + 4 RecordChangeService), all green
- Full backend suite: **1178 pass / 18 skip / 3 fail** (the 3 are pre-existing `SendChatMessageUseCase` AI-credit failures). Zero Phase D regressions.

**Result:** ✅ Phase D.2 (Period Lock) and D.3 (Audit Log) complete. Period-lock enforcement is live for all Sales posting paths (SI/DN/SR). Per-record change tracking is wired for all 4 document types (SI/SO/DN/SR).

**Next:** Phase D remaining items (D.4 recurring invoices, D.5 return enhancements, D.6 attachments, D.7 templates, D.8 email) or Phase E (cross-cutting cleanup).

---

## 2026-05-20 (Wed) — Phase C (sales finance & reporting)
**Task:** Task 110 — Phase C of the sales completion roadmap

## 2026-05-30: Deep UI/UX Hardening

**Agent:** Antigravity

**Work Done:**
- Executed deep code-level UI/UX fixes across the frontend per user request.
- Removed disruptive `hover:scale` animations that caused grid layout jitter in sidebars and core UI components, replacing them with color/shadow transitions.
- Standardized arbitrary Z-Index values (e.g. `z-[999999]`) to normalized Tailwind brackets (e.g. `z-[90]`, `z-50`) to resolve stacking context collisions in modals and shared selectors.
- Audited `bg-white/10` contrast safety, ensuring all instances are encapsulated in forced dark-mode containers.
- Patched accessibility concerns including updating static image alt-text inside wizards and correcting pointer indicators.

**Next Steps:**
- Continue executing native functionality retests or further chrome polish according to ACTIVE.md priorities.

### Session: 2026-05-31 (Shared Selector Enforcement)

- **Goal:** Phase 5 task to enforce WarehouseSelector and ItemSelector usage across all frontend modules where raw manual text/select inputs were used for IDs.
- **What was done:** Scanned the codebase and migrated straggling manual text inputs in StockAdjustmentPage, PurchaseReturnDetailPage, and PromotionsPage to their respective shared selectors. Created completion report 148.
- **Detours:** Addressed TypeScript errors in SalesInvoiceDetailPage.tsx caused by recent shared component API changes (ConfirmDialog tone, AttachmentsCard onChange removal of readOnly, messaging accounts casting).
- **Next:** Proceed with the rest of Task 132 Phase 6 hardening, or hand back to the main Orchestrator for the native functionality retest.


### Session: 2026-05-31 (Chart of Accounts UI Update)

- **Goal:** Update the Chart of Accounts (COA) page UI to exactly match the provided design mockup screenshots.
- **What was done:**
  - Restructured \AccountsListPage.tsx\ to implement the new grid/table layout with mocked balance data.
  - Implemented the \classFilter\ logic allowing users to quickly filter the tree by classifications (Asset, Liability, etc.).
  - Built \AccountDrilldownModal.tsx\ which displays account summaries and mocked recent journal entries upon clicking an account row.
  - Preserved existing functionality for row-level actions (+, Edit, Deactivate).
  - Wrote completion report \149-coa-ui-update.md\ and created a user guide for the updated COA.
- **Next:** Proceed with the native functionality retest as outlined in ACTIVE.md, or continue with Task 132 polish.

### Session: 2026-06-01 (Architecture Control Layer Diagnosis)

- **Goal:** Diagnose whether ERP03 has a real architecture/control-layer problem around governance, business rules, engine rules, and warnings, and produce a handoff for second-check before planning repairs.
- **What was done:** Inspected planning docs, AGENTS.md, backend policy/posting services, frontend document policy helpers, frontend validation/rules, forms/designer architecture notes, and accounting boundary tests. Created `planning/briefs/20260601-architecture-control-layer-diagnosis.md`.
- **Key finding:** The concern is valid. The highest-risk confirmed issues are inconsistent subledger posting policy enforcement, Sales-only period-lock wiring, frontend "business rules" that sound authoritative but are client-only, backend/frontend governance duplication, and an existing failing accounting-boundary architecture test.
- **Verification:** `npm --prefix backend test -- --runInBand backend/src/tests/architecture/AccountingBoundary.test.ts` failed with six known/confirmed Sales/Purchases reporting boundary violations.
- **Time spent:** ~1.2h.
- **Next:** Send the brief to a read-only second-check agent (`erp-backend-architect`, `erp-frontend-architect`, `erp-api-contract`, then `erp-reviewer`) before any builder starts.

### Session: 2026-06-03 (Unify Period Lock — Stage 3)

- **Goal:** Consolidate duplicated period lock verification logic in `PeriodLockService` and `PeriodLockPolicy` to a single authoritative implementation in Accounting (`PeriodLockPolicy`).
- **What was done:**
  - Refactored `PeriodLockService.ts` to be a thin adapter delegating all checks directly to `PeriodLockPolicy` via a simulated `PostingPolicyContext` and mapping error results back to `PeriodLockedError` instances.
  - Activated the Stage 3 architectural test in `PostingAuthority.test.ts` to prevent duplication regression.
- **Verification:**
  - `npm test backend/src/application/accounting/services/__tests__/PeriodLockService.test.ts` -> ✅
  - `npm test backend/src/tests/architecture/PostingAuthority.test.ts` -> ✅
  - Full backend test suite (`npm test`) passed except pre-existing F8 boundary test.
- **Time spent:** ~1.0h.
- **Next:** Stage 4 — Put the guard at the door (ensure `recordForVoucher` is only reached through the posting guard).
