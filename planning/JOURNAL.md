# Development Journal

> Append new entries at the top. One entry per work session.

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
