# Phase D — Sales Auditability & Control — Detailed Implementation Plan

**Created:** 2026-05-20
**Author:** Claude Opus 4.7 (CTO mode)
**Roadmap reference:** [sales-and-purchases-completion-roadmap.md](./sales-and-purchases-completion-roadmap.md) → "PHASE D"
**Scope of THIS plan:** the Phase D *core control trio* only — **D.1 GL Impact, D.2 Period Lock, D.3 per-record Audit Log**.
**Out of scope:** D.4 recurring invoices, D.5 return enhancements, D.6 attachments, D.7 invoice templates, D.8 email — separate, larger workstreams (see "Deferred").

## How to use this document

It is **self-contained** — an implementation agent can execute it without any prior conversation context.

- **D.1 is already built** (by a delegated agent) — do NOT rebuild it; it only needs auditing.
- Execute **D.2 first, then D.3** — they share files (see "Sequencing").
- Every work item names exact files and ends with acceptance criteria. The plan author will audit the result against those criteria.
- D.2 ≈ 20 files, D.3 ≈ 19 files. Per `AGENTS.md` task-size-cap, **D.2 and D.3 are two separate subtasks** — commit D.2 before starting D.3.

---

## Key finding (why D.2 is bigger than the roadmap implied)

The roadmap assumed period-lock infrastructure could simply be "filled out." Code inspection proved otherwise:

- `PeriodLockPolicy` (`backend/src/domain/accounting/policies/implementations/PeriodLockPolicy.ts`) enforces `lockedThroughDate` — BUT it only runs inside the **manual accounting-voucher** flow (`AccountingPolicyRegistry.getEnabledPolicies()` is invoked only from `VoucherUseCases.ts` and `SubmitVoucherUseCase.ts`).
- Sales documents (SI / DN / SR) post their accounting effect through `SubledgerVoucherPostingService.postInTransaction()` (`backend/src/application/accounting/services/SubledgerVoucherPostingService.ts`), which **does not run the policy pipeline at all**.
- **Therefore sales document posting is currently NOT period-locked.** D.2 must *build* enforcement into the subledger posting path, not merely extend a policy.

The chosen design enforces the lock at the single `SubledgerVoucherPostingService` chokepoint — so the same fix will also cover Purchases (PI/GRN/PR) for free in Phase F.

---

## Execution rules (apply to EVERY work item)

1. **Architecture (`AGENTS.md`):** repository interfaces in `backend/src/repository/interfaces/`; Firestore implementations in `backend/src/infrastructure/firestore/repositories/`; register every new repo in `backend/src/infrastructure/di/bindRepositories.ts`. No Firestore-specific code in domain/application layers. Controllers stay thin. Never bypass DI.
2. **Match existing patterns:** before creating a file, READ the named reference file and mirror its structure (entity ↔ `CreditOverride.ts`, etc.).
3. **TypeScript:** `npx tsc --noEmit` must exit 0 in BOTH `backend/` and `frontend/` before a work item is done.
4. **Tests:** new domain/application services require Jest unit tests — mock all repos (pattern: `backend/src/application/accounting/use-cases/__tests__/`). Run the full backend suite; the ONLY acceptable failures are the 3 pre-existing `SendChatMessageUseCase` AI-credit failures.
5. **i18n:** every new user-facing string in the frontend MUST go through i18n (`frontend/src/i18n/`). Do not hardcode — follow how the Phase C reporting pages do it.
6. **Do NOT `git commit`.** The plan owner handles commits.
7. **Multi-tenant:** every new entity/collection is scoped by `companyId`, path pattern `companies/{companyId}/...`.
8. **Non-fatal audit writes:** writing an audit/override row must never break the primary operation — wrap in try/catch + log (mirror the existing commission-accrual pattern in `SalesController`).

## Sequencing & conflict notes

Do **D.2 fully, then D.3.** Both modify these shared files — parallel work will conflict:
- `backend/src/api/controllers/sales/SalesController.ts`
- `backend/src/api/routes/sales.routes.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `frontend/src/api/salesAuditApi.ts` (created by D.1)
- the SI/DN/SR detail pages

Within each subtask, backend must compile before starting the frontend portion.

---

## D.1 — GL Impact modal — STATUS: BUILT (audit pending)

Built by a delegated agent. **Do not rebuild.** Files:
- **Created** `frontend/src/api/salesAuditApi.ts` — API client; interfaces `ResolvedAccount`, `LineDecision`, `PostingLog`, `VoucherLine`, `Voucher`; methods `getPostingLogsBySource(sourceId)` and `getVoucherById(voucherId)` (delegates to existing `accountingApi.getVoucher`).
- **Created** `frontend/src/modules/sales/components/GlImpactModal.tsx` — wraps `ui/Modal.tsx`; fetches posting logs + vouchers; renders journal tables, account-resolution decisions with fallback levels, warnings; loading/error/empty states.
- **Modified** `SalesInvoiceDetailPage.tsx`, `DeliveryNoteDetailPage.tsx`, `SalesReturnDetailPage.tsx` — "GL Impact" button (shown when status is posted) + modal wiring.
- `npx tsc --noEmit` (frontend) reported clean.

**Audit checklist (plan author verifies):**
- [ ] i18n — `GlImpactModal.tsx` user-facing strings follow the project i18n convention (the build brief omitted i18n). Refactor if recent pages use i18n.
- [ ] `'POSTED'` is the correct status enum value for each of SI / DN / SR (they may differ).
- [ ] `accountingApi.getVoucher` exists and its response shape matches the `Voucher` interface.
- [ ] No backend files were modified.
- [ ] Modal handles a document with multiple vouchers and a document with zero posting logs.

> D.3 ADDS a method to `salesAuditApi.ts` — it already exists, do not recreate it.

---

## D.2 — Period lock date

### Goal
An accountant can lock accounting periods; sales documents (SI/DN/SR) dated within a locked period cannot post. Two tiers; the soft tier is overridable with a typed reason that creates an audit record.

### Two-tier model — ASSUMPTION, confirm with owner
The roadmap says "two-tier (soft for users, hard for admins)." This plan implements:
- **SOFT tier** = `lockedThroughDate` (one date; documents dated on/before it are locked). **Overridable** by supplying a reason. The override is recorded.
- **HARD tier** = a fiscal period whose status is `CLOSED` or `LOCKED` (`FiscalYear` entity). **Not overridable.**

If the owner intended a different split (e.g. role-gated overrides), adjust D.2-2 and D.2-6; everything else stands.

### Design summary
Enforce at the `SubledgerVoucherPostingService.postInTransaction()` chokepoint via a new `PeriodLockService`. The override travels controller → posting use case → `postInTransaction` `input.metadata.periodLockOverride` → `PeriodLockService`. The existing `PeriodLockPolicy` (manual voucher flow) is left **untouched**.

### D.2-1 — `PeriodLockedError` domain error
**Create** `backend/src/domain/accounting/errors/PeriodLockedError.ts`. Read a sibling error in that folder (e.g. `AccountMappingError`) for the base pattern. Shape: extends `Error`; `name='PeriodLockedError'`; `code='PERIOD_LOCKED'`; `tier: 'SOFT'|'HARD'`; `documentDate: string`; `lockedThroughDate?: string`; constructor builds a human message.

### D.2-2 — `PeriodLockService` (application service)
**Create** `backend/src/application/accounting/services/PeriodLockService.ts`.
Constructor deps: `IAccountingPolicyConfigProvider` (`backend/src/infrastructure/accounting/config/IAccountingPolicyConfigProvider.ts`), `IFiscalYearRepository` (`backend/src/repository/interfaces/accounting/IFiscalYearRepository.ts`).
Method:
```ts
async assertPostingAllowed(
  companyId: string,
  documentDate: string,                                  // ISO YYYY-MM-DD
  override?: { reason: string; overriddenBy: string }
): Promise<void>
```
Logic (reuse `normalizeAccountingDate` from `backend/src/domain/accounting/utils/DateNormalization.ts`; mirror `PeriodLockPolicy.validate`):
1. `config = await configProvider.getConfig(companyId)`. If `!config.periodLockEnabled` → return.
2. `date = normalizeAccountingDate(documentDate)`.
3. **HARD:** `fy = await fiscalYearRepo.findActiveForDate(companyId, date)`; `status = fy?.getPeriodForDate(date)?.status`. If `status` is `CLOSED` or `LOCKED` → `throw new PeriodLockedError({ tier:'HARD', documentDate: date })`.
4. **SOFT:** if `config.lockedThroughDate` and `date <= normalizeAccountingDate(config.lockedThroughDate)`:
   - if `override?.reason?.trim()` → return (allowed);
   - else → `throw new PeriodLockedError({ tier:'SOFT', documentDate: date, lockedThroughDate: config.lockedThroughDate })`.
5. return.

This intentionally duplicates ~8 lines of `PeriodLockPolicy` rather than refactoring it — keeps blast radius small. **Do NOT modify `PeriodLockPolicy.ts`.**

### D.2-3 — Enforce in `SubledgerVoucherPostingService`
**Modify** `backend/src/application/accounting/services/SubledgerVoucherPostingService.ts`:
- Add an OPTIONAL constructor param `periodLockService?: PeriodLockService` (last param — mirrors existing optional `accountRepo?` / `validationService?`).
- At the very start of `postInTransaction()` (before currency resolution):
  `if (this.periodLockService) await this.periodLockService.assertPostingAllowed(input.companyId, input.date, input.metadata?.periodLockOverride);`
- `PostSubledgerVoucherInput.metadata` is already `Record<string, any>` — no type change. The override rides at `input.metadata.periodLockOverride`.

### D.2-4 — `PeriodLockOverride` audit entity + repository
Mirror `CreditOverride` exactly — read `backend/src/domain/sales/entities/CreditOverride.ts` and `backend/src/infrastructure/firestore/repositories/sales/FirestoreCreditOverrideRepository.ts`.
- **Create** `backend/src/domain/accounting/entities/PeriodLockOverride.ts` — immutable; UUID auto-generated; `toJSON`/`fromJSON`. Fields: `id, companyId, sourceModule ('sales'), sourceType ('SALES_INVOICE'|'DELIVERY_NOTE'|'SALES_RETURN'), sourceId, sourceNumber, documentDate, lockedThroughDate, reason, overriddenBy, overriddenAt, createdAt`.
- **Create** `backend/src/repository/interfaces/accounting/IPeriodLockOverrideRepository.ts` — `create(o)`, `listByCompany(companyId, opts?: { limit?: number })`, `findBySource(companyId, sourceId)`.
- **Create** `backend/src/infrastructure/firestore/repositories/accounting/FirestorePeriodLockOverrideRepository.ts` — collection `companies/{companyId}/period_lock_overrides/{id}`.
- **Register** in `bindRepositories.ts` as `periodLockOverrideRepository`.

### D.2-5 — Thread the override through the 3 sales posting use cases
Add an OPTIONAL trailing param `periodLockOverride?: { reason: string; overriddenBy: string }` to `execute()` of:
- `PostSalesInvoiceUseCase` — `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
- `PostDeliveryNoteUseCase` — `backend/src/application/sales/use-cases/DeliveryNoteUseCases.ts`
- `PostSalesReturnUseCase` — `backend/src/application/sales/use-cases/SalesReturnUseCases.ts`

In each, find EVERY `accountingPostingService.postInTransaction({ ... })` call (in `SalesInvoiceUseCases.ts` there are calls near lines 1113 and 1159 — search for all of them) and merge the override into the input's `metadata`:
`metadata: { ...existingMetadata, ...(periodLockOverride ? { periodLockOverride } : {}) }`.
If a use case posts via a path other than `SubledgerVoucherPostingService`, apply the same override-into-metadata approach there. The enforcement itself (D.2-3) covers all of them automatically.

### D.2-6 — `SalesController`: override intake, audit write, error mapping
**Modify** `backend/src/api/controllers/sales/SalesController.ts`:
- In the post handlers — `postSI`, `createAndPostSI`, `updateAndPostSI`, `postDN`, `postSR` (confirm exact names) — read `req.body.periodLockOverrideReason` (string). If non-empty, build `periodLockOverride = { reason, overriddenBy: SalesController.getUserId(req) }` and pass it as the new trailing arg to the use case.
- After a successful post **when an override was supplied**, write a `PeriodLockOverride` row via `diContainer.periodLockOverrideRepository` using the returned document's number/date. Non-fatal (try/catch + log).

**Error mapping:** the use case throws `PeriodLockedError` (raised inside `PeriodLockService`). Find the Express error-handling middleware (search `backend/src/api/middlewares/` and `app.ts`/`index.ts`). Map `PeriodLockedError` → HTTP **422** with body:
```json
{ "success": false, "error": { "code": "PERIOD_LOCKED", "tier": "SOFT", "message": "...", "documentDate": "...", "lockedThroughDate": "..." } }
```
If domain errors are not centrally mapped, map it in the affected controller `catch` blocks.

### D.2-7 — Frontend: period-lock settings
- **Backend check first:** open `backend/src/api/controllers/accounting/SettingsController.ts`. It already accepts `lockedThroughDate` (lines ~133-183). Confirm it ALSO accepts `periodLockEnabled`; if not, add it following the `lockedThroughDate` pattern (validate boolean).
- **Frontend:** find the accounting settings page (search `frontend/src/` for the component calling the accounting settings endpoint). Add a `periodLockEnabled` toggle and a `lockedThroughDate` date picker, saved through the existing accounting-settings API client. All labels via i18n.

### D.2-8 — Frontend: period-lock override modal
- **Create** `frontend/src/modules/sales/components/PeriodLockOverrideModal.tsx` (wrap `ui/Modal.tsx`). Props `{ isOpen, onClose, documentDate, lockedThroughDate, onConfirm(reason) }`. Required reason textarea; confirm disabled until non-empty.
- On the SI/DN/SR detail pages, in the Post action handler: catch the error; if `err.response?.data?.error?.code === 'PERIOD_LOCKED'`:
  - `tier === 'SOFT'` → open `PeriodLockOverrideModal`; on confirm, re-call the post endpoint with `periodLockOverrideReason` in the body.
  - `tier === 'HARD'` → plain error toast ("This accounting period is closed."), no override.
- All strings via i18n.

### D.2-9 — Tests
**Create** `backend/src/application/accounting/services/__tests__/PeriodLockService.test.ts` — cases: disabled config → allowed; SOFT lock, no override → throws `PeriodLockedError` tier SOFT; SOFT lock + override reason → allowed; HARD (closed fiscal period) → throws tier HARD even WITH an override; date after `lockedThroughDate` → allowed. Mock `configProvider` + `fiscalYearRepo`.

### D.2 — Acceptance criteria (audit checklist)
- [ ] With `periodLockEnabled` + `lockedThroughDate=2026-05-31`, posting an SI dated 2026-05-15 returns HTTP 422 `code=PERIOD_LOCKED tier=SOFT`.
- [ ] Re-posting with `periodLockOverrideReason` succeeds; a `PeriodLockOverride` row is written; the reason is on the voucher metadata.
- [ ] Same enforcement holds for Delivery Note and Sales Return posting.
- [ ] A document in a CLOSED fiscal period returns `tier=HARD` and the override does NOT bypass it.
- [ ] `periodLockEnabled=false` → no blocking.
- [ ] `PeriodLockPolicy.ts` is unmodified; manual voucher posting behaviour unchanged.
- [ ] backend + frontend `tsc` clean; `PeriodLockService` tests pass; no suite regressions.

---

## D.3 — Per-record audit log

### Goal
Every update to a Sales Invoice / Sales Order / Delivery Note / Sales Return creates an immutable audit row capturing which fields changed (before → after), who, and when. Viewable per record.

### Design note — entity choice
A generic `AuditLog` exists at `backend/src/domain/system/entities/AuditLog.ts` but it is platform-scoped (no `companyId`) and unused by tenant modules. To preserve multi-tenant isolation, D.3 introduces a **new, tenant-scoped** entity `RecordChangeLog` rather than reusing it.

### D.3-1 — `RecordChangeLog` entity + repository
Mirror `CreditOverride` for the entity style.
- **Create** `backend/src/domain/system/entities/RecordChangeLog.ts` — immutable; UUID auto-gen; `toJSON`/`fromJSON`. Fields: `id, companyId, entityType ('SALES_INVOICE'|'SALES_ORDER'|'DELIVERY_NOTE'|'SALES_RETURN'), entityId, entityNumber?, action ('UPDATE'), changes: FieldChange[], userId, userEmail?, timestamp`. `FieldChange = { field: string; before: unknown; after: unknown }`.
- **Create** `backend/src/repository/interfaces/system/IRecordChangeLogRepository.ts` — `create(entry)`, `findByEntity(companyId, entityType, entityId)` (returns newest-first).
- **Create** `backend/src/infrastructure/firestore/repositories/system/FirestoreRecordChangeLogRepository.ts` — collection `companies/{companyId}/record_change_logs/{id}`. Reference `FirestoreSystemRepositories.ts` for style.
- **Register** in `bindRepositories.ts` as `recordChangeLogRepository`.

### D.3-2 — `RecordChangeService`
**Create** `backend/src/application/system/services/RecordChangeService.ts`. Constructor: `(repo: IRecordChangeLogRepository)`.
Method:
```ts
async recordUpdate(params: {
  companyId: string; entityType: string; entityId: string; entityNumber?: string;
  userId: string; userEmail?: string;
  before: Record<string, any>; after: Record<string, any>;
}): Promise<void>
```
- Compute a **shallow** field-level diff. Primitives compared directly. Arrays/objects (e.g. `lines`) compared via `JSON.stringify`; if different, record one `FieldChange` with stringified values truncated to ~500 chars.
- Zero changes → write nothing.
- Otherwise create one `RecordChangeLog` and `repo.create(...)`.
- Must be safe inside a non-fatal try/catch (never throw on diff edge cases).

### D.3-3 — Hook into the 4 update use cases
`UpdateSalesInvoiceUseCase` (`SalesInvoiceUseCases.ts`), `UpdateSalesOrderUseCase` (`SalesOrderUseCases.ts`), `UpdateDeliveryNoteUseCase` (`DeliveryNoteUseCases.ts`), `UpdateSalesReturnUseCase` (`SalesReturnUseCases.ts`):
- Inject `RecordChangeService` as a new constructor dependency.
- Snapshot `before = existing.toJSON()` immediately after loading the entity, BEFORE applying changes.
- After the successful save, `after = updated.toJSON()`; call `recordChangeService.recordUpdate({...})` inside a try/catch (non-fatal).
- `userId`/`userEmail`: if `execute()` does not already receive the acting user, add an optional `actor?: { userId: string; userEmail?: string }` param and pass `req.user.uid`/`req.user.email` from `SalesController`'s update handlers.
- Update the use-case instantiation sites in `SalesController.ts` to inject a `RecordChangeService` backed by `diContainer.recordChangeLogRepository`.

### D.3-4 — Read endpoint
- **Create** a thin controller `backend/src/api/controllers/RecordAuditController.ts` — handler `getByEntity`: reads `req.query.entityType` + `req.query.entityId`, calls `recordChangeLogRepository.findByEntity(companyId, entityType, entityId)`, returns `{ success: true, data: RecordChangeLog[] }`.
- **Register** route `GET /audit-log` in `backend/src/api/routes/sales.routes.ts` (full path `/tenant/sales/audit-log`).

### D.3-5 — Frontend: audit log viewer
- **Add** to `frontend/src/api/salesAuditApi.ts` (exists from D.1): `getRecordAuditLog(entityType, entityId)` → `GET /tenant/sales/audit-log` with params; plus `RecordChangeLog` / `FieldChange` interfaces.
- **Create** `frontend/src/modules/sales/components/RecordAuditModal.tsx` (wrap `ui/Modal.tsx`) — entries newest-first: timestamp, user, per-field `before → after` table.
- Add a "History" button to the SI / SO / DN / SR detail pages opening the modal for that record.
- All strings via i18n.

### D.3-6 — Tests
**Create** `backend/src/application/system/services/__tests__/RecordChangeService.test.ts` — single-field change; multiple-field change; no-change → nothing written; non-primitive (`lines`) change recorded as one stringified entry. Mock the repo.

### D.3 — Acceptance criteria (audit checklist)
- [ ] Editing a draft SI's description writes one `RecordChangeLog` with a `description` before/after.
- [ ] An update that changes nothing writes no row.
- [ ] Audit rows appear for SO, DN, SR updates too.
- [ ] `GET /tenant/sales/audit-log?entityType=SALES_INVOICE&entityId=<id>` returns rows newest-first.
- [ ] The detail-page "History" modal renders the changes.
- [ ] Audit write failure does not break the update (non-fatal).
- [ ] backend + frontend `tsc` clean; `RecordChangeService` tests pass; no suite regressions.

---

## Deferred (NOT in this plan)
D.4 recurring invoices (templated + scheduled), D.5 sales-return enhancements (refund vs credit note, restocking fees, reasons), D.6 document attachments, D.7 multiple invoice templates, D.8 email integration. Each is a separate workstream.

## Definition of Done (plan author handles after build + audit pass)
Per `AGENTS.md`: update `docs/architecture/sales.md` + new architecture notes; new `docs/user-guide/sales/` guides for GL Impact, period lock, audit log; `planning/done/111-phase-d-*.md` completion report; `JOURNAL.md` entry; `ACTIVE.md` next-task update. Commit only after the owner approves.

---

## Audit Round 1 — Findings & Required Fixes

**Audited:** 2026-05-21 by Claude Opus 4.7 against the acceptance criteria above.
**Verdict:** NOT READY. D.1 (GL Impact) and D.3 (audit log) are functional with defects. **D.2 (period lock) is non-functional — enforcement is unwired.** 14 fixes required (FIX-5 pending a test diagnosis). Re-audit required after fixes.

Hand this section to the build agent. Each fix names the exact file and change. Do NOT commit until the re-audit passes. After fixing, `npx tsc --noEmit` must be clean on backend + frontend, and the criteria must be *exercised*, not just type-checked.

### CRITICAL — D.2 does nothing without these

**FIX-1 — Wire `PeriodLockService` into the posting service (period lock is currently dead code).**
`SubledgerVoucherPostingService` received an *optional* `periodLockService?` param, but no construction site passes an instance, so `this.periodLockService` is always `undefined` and the `if (this.periodLockService)` enforcement block never runs. `tsc` passes because the param is optional — that is why it slipped through.
- `backend/src/infrastructure/di/bindRepositories.ts`: add a `periodLockService` getter. `PeriodLockService`'s constructor needs an `IAccountingPolicyConfigProvider` and `IFiscalYearRepository`. Source the config provider the same way `AccountingPolicyRegistry` already obtains it (grep `new AccountingPolicyRegistry` and `FirestoreAccountingPolicyConfigProvider`); use `diContainer.fiscalYearRepository` for the fiscal repo.
- `backend/src/api/controllers/sales/SalesController.ts` → `buildAccountingPostingService()` (lines ~160-176): pass `diContainer.periodLockService` as the 6th argument to BOTH `new SubledgerVoucherPostingService(...)` calls:
  - validateAccounts branch: `(voucherRepository, ledgerRepository, companyCurrencyRepository, accountRepository, new VoucherValidationService(), diContainer.periodLockService)`
  - default branch: `(voucherRepository, ledgerRepository, companyCurrencyRepository, undefined, undefined, diContainer.periodLockService)`
- Note: `PurchaseController.ts` also builds `SubledgerVoucherPostingService` without the service — purchases period-lock is out of D.2 scope (Phase F); leave it but be aware.

**FIX-2 — Repair the broken override retry on `SalesInvoiceDetailPage.tsx`.**
`setPendingPostAction(() => () => postDraft)` stores `() => postDraft`; the modal's `onConfirm` then calls `pendingPostAction()`, which *returns* `postDraft` without calling it and without passing the reason. Clicking "Override & Post" currently does nothing.
- Delete the `pendingPostAction` state and every `setPendingPostAction(...)` call.
- In `postDraft`'s catch, the `PERIOD_LOCKED` + `tier==='SOFT'` branch: only `setOverrideModalData({...})` + `setOverrideModalOpen(true)`.
- `PeriodLockOverrideModal` `onConfirm`: `onConfirm={(reason) => { setOverrideModalOpen(false); postDraft(reason); }}`.

### HIGH — incomplete vs plan

**FIX-3 — Period-lock override UI on Delivery Note & Sales Return detail pages.**
Backend supports DN/SR override; the frontend cannot reach it.
- `frontend/src/api/salesApi.ts`: add `periodLockOverrideReason?: string` to `postDN` and `postSR` (mirror the `postSI` change — include it in the POST body).
- `DeliveryNoteDetailPage.tsx` and `SalesReturnDetailPage.tsx`: mirror the corrected (post-FIX-2) `SalesInvoiceDetailPage` override pattern — import `PeriodLockOverrideModal`, add modal state, post handler takes an optional reason, catch `PERIOD_LOCKED` (SOFT → modal, HARD → plain error), retry with the reason.

**FIX-4 — "History" button on Delivery Note, Sales Return, and Sales Order detail pages.**
Only `SalesInvoiceDetailPage` got it. Mirror on `DeliveryNoteDetailPage.tsx`, `SalesReturnDetailPage.tsx`, `SalesOrderDetailPage.tsx`: import `RecordAuditModal`, add `auditModalOpen` state + a "History" button, render `<RecordAuditModal entityType="DELIVERY_NOTE"|"SALES_RETURN"|"SALES_ORDER" entityId={…} />`.

### MEDIUM

**FIX-5 — 4th test failure (`AiModelCertificationUseCase.test.ts`).** Diagnosis in progress — fix instructions pending.

**FIX-6 — Remove the unrequested generic `PostingError → 422` mapping in `backend/src/errors/errorHandler.ts`.**
The plan required only `PeriodLockedError → 422`. The agent also added `if (err instanceof PostingError) → 422`, which silently changes the HTTP status of EVERY posting error (`AccountMappingError`, `PersonaNotAllowedError`, etc.) across accounting/inventory/purchases. Delete that generic block; the `PeriodLockedError` block above it has its own check and keeps working. (If the owner wants all posting errors at 422, do it as a separate, deliberate change.)

**FIX-7 — Record the real `lockedThroughDate` in `PeriodLockOverride` audit rows.**
All 5 post handlers in `SalesController` write `lockedThroughDate: periodLockOverrideReason ? '(overridden)' : ''` — always the literal `'(overridden)'`. Load the accounting policy config for the company and use `config.lockedThroughDate ?? ''` instead.

**FIX-8 — Add the Firestore composite index for `record_change_logs`.**
`FirestoreRecordChangeLogRepository.findByEntity` runs `where('entityType','==') + where('entityId','==') + orderBy('timestamp','desc')` — needs a composite index or it throws `FAILED_PRECONDITION` in production. Add to the deployed `firestore.indexes.json` (check `firebase.json` for the path):
```
{ "collectionGroup": "record_change_logs", "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "entityType", "order": "ASCENDING" },
    { "fieldPath": "entityId", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ] }
```

**FIX-9 — i18n for `GlImpactModal.tsx` (D.1).**
It hardcodes every user-facing string; the D.2/D.3 modals correctly use `useTranslation`. AGENTS.md requires i18n. Convert all strings to `useTranslation('common')` + `t('key','default')`.

### LOW

**FIX-10 — `RecordAuditController.getCompanyId`** uses `req.companyId || req.headers['x-company-id']`. Use the canonical validated value `req.user?.companyId` (mirror `SalesController.getCompanyId`) — the raw-header fallback bypasses tenant-context validation.

**FIX-11 — `RecordAuditController` missing-param guard is dead.** `String(undefined)` is `'undefined'` (truthy), so `if (!entityType || !entityId)` never fires. Read `req.query.entityType`/`entityId` without `String()` coercion and check real presence before the 400.

**FIX-12 — `RecordChangeService.computeDiff` can emit `undefined` field values.** For primitive fields, `before`/`after` may be `undefined`, which Firestore `.set()` rejects unless `ignoreUndefinedProperties` is enabled — silently dropping the audit row (caught by the non-fatal handler). Coerce: `before: beforeVal ?? null`, `after: afterVal ?? null`.

**FIX-13 — `await` the audit write.** The 4 update use cases call `this.recordChangeService.recordUpdate(...)` without `await` (fire-and-forget); on Cloud Functions, post-response work can be dropped. `await` it — `recordUpdate` is already internally non-fatal, so awaiting is safe.

**FIX-14 — Replace inline `require()` with top-level `import`** in `SalesController.ts` for `RecordChangeService` and `PeriodLockOverride`.

### What is already correct (no action)
- `PeriodLockService` logic, `PeriodLockedError`, `PeriodLockOverride`/`RecordChangeLog` entities, both Firestore repos, the override threading through the 3 posting use cases, the `SubledgerVoucherPostingService` hook itself, DI repo registration, the before/after snapshot timing in all 4 update use cases, and i18n in `PeriodLockOverrideModal`/`RecordAuditModal`.
- D.2-7 settings: `SettingsController` accepts both `periodLockEnabled` and `lockedThroughDate`; default is `false` (safe).
