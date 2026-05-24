# Development Journal

> Append new entries at the top. One entry per work session.

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
