# 105 — PR2: PostingLog Auditability Foundation

**Status:** ✅ COMPLETE (Sales Invoice wired; PurchaseInvoice / DN / Returns wiring deferred as a P1 follow-up — entity and repo handle all cases)
**Date:** 2026-05-19
**Branch:** `fix/project-responsiveness`
**Scope:** Fourth of six PRs in the [alpha-readiness remediation plan](../tasks/alpha-readiness-remediation-plan.md). Closes P0-6 (PostingLog entity + write on every voucher) and P0-7 (cogsPostingStatus on lines). Foundation for PR3 (silent-skip → typed errors) and PR5 (FX gain/loss decision logging).

## Context

The audit's single highest-leverage finding: there was **no persisted record of why a posting decision was made**. An admin asking "why didn't COGS post on invoice SI-00123?" had no programmatic answer — they had to read code. PR2 closes that gap.

## What changed

### Entity, repository, infrastructure

- New domain entity [`PostingLog`](../../backend/src/domain/accounting/entities/PostingLog.ts) with structured per-line decision records, account fallback levels, skip taxonomy, and warning capture.
- New interface `IPostingLogRepository` (find by sourceId, list by module/type, get by id, create).
- Firestore impl at `companies/{cid}/posting_logs/{id}`. Wired into `diContainer.postingLogRepository`.
- Re-exported through `repository/interfaces/accounting/index.ts`.

### Line-entity additions

- `SalesInvoiceLine.cogsPostingStatus` — `'POSTED' | 'SKIPPED_POSTED_AT_DN' | 'SKIPPED_SERVICE_ITEM' | 'SKIPPED_DEFERRED_POLICY' | 'SKIPPED_UNSETTLED_COST' | null`
- `DeliveryNoteLine.cogsPostingStatus` — subset matching DN posting paths
- `PurchaseInvoiceLine.cogsPostingStatus` — analogous with `SKIPPED_POSTED_AT_GRN` for the GRN-linked case

### Sales Invoice posting wired

`PostSalesInvoiceUseCase` now:
- Determines `cogsPostingStatus` for each line during account resolution and sets it on the line
- Accepts an optional `postingLogRepo` constructor dep
- After all vouchers post successfully and inside the same transaction, builds a `PostingLog` capturing voucher IDs, per-line account decisions, and warnings for any `SKIPPED_UNSETTLED_COST` line; persists via repo
- PostingLog write failures are best-effort (warn only) — never roll back the posting itself

Both PostSalesInvoiceUseCase construction sites in `SalesController` updated to pass `diContainer.postingLogRepository`.

### Read API

- New `PostingLogController` with two endpoints
- `GET /tenant/accounting/posting-logs?sourceId=<id>` — primary use case (GL Impact drawer)
- `GET /tenant/accounting/posting-logs/:id` — single record lookup
- Both gated by `accounting.vouchers.view` permission

### Tests

- `PostingLog.test.ts` — 8 cases (construction, invariants, defensive copy, JSON, full skip taxonomy)
- Existing posting tests (44 across `SalesPostingUseCases`, `SalesInvoiceSettlementPosting`, `SalesReturnUseCases`, `SalesPaymentSyncUseCases`) still pass — the new dep is optional, so test stubs pass undefined naturally

### Docs

- New [`docs/architecture/posting-log.md`](../../docs/architecture/posting-log.md) — purpose, storage, schema, COGS taxonomy, API, wiring status, frontend integration plan, reading the data

## Files changed

New:
- `backend/src/domain/accounting/entities/PostingLog.ts`
- `backend/src/repository/interfaces/accounting/IPostingLogRepository.ts`
- `backend/src/infrastructure/firestore/repositories/accounting/FirestorePostingLogRepository.ts`
- `backend/src/api/controllers/accounting/PostingLogController.ts`
- `backend/src/tests/domain/accounting/PostingLog.test.ts`
- `docs/architecture/posting-log.md`

Modified:
- `backend/src/domain/sales/entities/SalesInvoice.ts` — `cogsPostingStatus` field on line
- `backend/src/domain/sales/entities/DeliveryNote.ts` — `cogsPostingStatus` field on line
- `backend/src/domain/purchases/entities/PurchaseInvoice.ts` — `cogsPostingStatus` field on line
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts` — status assignment + PostingLog write
- `backend/src/api/controllers/sales/SalesController.ts` — pass `postingLogRepository` to use case (both construction sites)
- `backend/src/api/routes/accounting.routes.ts` — register the new read endpoints
- `backend/src/repository/interfaces/accounting/index.ts` — re-export new interface
- `backend/src/infrastructure/di/bindRepositories.ts` — bind `FirestorePostingLogRepository`

## Verification

- `cd backend && npx tsc --noEmit` → exit 0
- `cd backend && npx jest --testPathPatterns="PostingLog"` → 8/8 pass
- `cd backend && npx jest --testPathPatterns="(SalesPostingUseCases|SalesInvoiceSettlementPosting|SalesReturnUseCases|SalesPaymentSyncUseCases)"` → 44/44 pass (no regression)

## Out of scope (P1 follow-up)

- Wire PostingLog writes into `PostPurchaseInvoiceUseCase`, `PostDeliveryNoteUseCase`, `PostSalesReturnUseCase`, `PostPurchaseReturnUseCase`, `PostGoodsReceiptUseCase`. Mechanical — copy the SI pattern.
- Include settlement / payment voucher IDs in the PostingLog's `voucherIds[]`.
- Frontend GL Impact drawer that consumes the new read endpoint.
- Integration tests asserting PostingLog content on a posted SI.

## Next PR

PR3 (strict posting — remove `skipAccountValidation`, convert silent account-skip fallbacks to typed errors, Sales persona governance hard-throw) can now use the `cogsPostingStatus` field to distinguish the four valid skip cases from the "missing account mapping" case that becomes a hard `AccountMappingError`.
