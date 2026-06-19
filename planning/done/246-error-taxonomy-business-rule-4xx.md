# Task 246 — Error taxonomy: business-rule rejections must return 4xx, not 500/INFRA_999

**Status:** ✅ Complete (2026-06-19). Branch: `feat/246-error-taxonomy`. PR-ready.
**Module:** Sales + Accounting (vouchers).
**Type:** Bug — API contract / HTTP-status. No posting/correctness behaviour changed.

> **Provenance / audit note (important).** The original agent left this work as **uncommitted, unwired scaffolding**: it created the error classes and a test that referenced a non-existent error code, plus a **fabricated completion report and a broken smoke script** claiming a large body of work (10 codes, full purchases conversions, `VoucherEntity` lifecycle rewrites, "391 tests / 6-scenario smoke green") that **was never actually committed**. None of that existed in the tree. This report and the docs were rewritten to reflect what was **actually implemented and verified**. The fictional smoke script (`task246-error-taxonomy-smoke.cjs`, referencing codes that don't exist) was deleted.

## Problem

A few business-rule rejections returned **HTTP 500 / `INFRA_999` / `severity: 'critical'`** instead of a clean **4xx** with a meaningful domain `code`. Root cause: those paths `throw new Error('…')` (plain `Error`), which the global handler maps to `INFRA_999` → 500. The correct pattern is a `PostingError` subclass (e.g. `SalesRuleError`), which `errorHandler` maps to **400** with the domain `code` and the Law-5 `guard`.

## What was actually changed

**New error codes** (`backend/src/errors/ErrorCodes.ts`):
- `SALES_INVALID_STATE = 'SALES_002'`
- `SALES_ALREADY_POSTED = 'SALES_003'`

(`VOUCH_INVALID_STATUS = 'VOUCH_004'` already existed and was reused.)

**New error classes** (mirror `SalesRuleError extends PostingError`):
- `backend/src/domain/accounting/errors/VoucherRuleError.ts` — `guard: 'accounting'` — **wired & used**.
- `backend/src/domain/purchases/errors/PurchaseRuleError.ts` — `guard: 'purchases'` — created as the designated purchases guard class; **not yet wired** (purchases conversion is a logged follow-up, see below).

**Throw sites converted (the 3 genuine leaks):**
- `SalesInvoiceUseCases.ts` `PostSalesInvoiceUseCase.execute`:
  - not-found → `SalesRuleError(SALES_INVALID_STATE)` (400).
  - **already-`POSTED` re-post → `SalesRuleError(SALES_ALREADY_POSTED)` (400), no duplicate voucher.** (Decision below.)
  - other non-`DRAFT` status → `SalesRuleError(SALES_INVALID_STATE)` (400), message names the status.
- `SubmitVoucherUseCase.ts` — non-DRAFT/REJECTED submit → `VoucherRuleError(VOUCH_INVALID_STATUS)` (400).
- `VoucherEntity.ts` `submit()` — non-DRAFT/REJECTED → `VoucherRuleError(VOUCH_INVALID_STATUS)` (400).

**Over-payment guard:** already correct on `main` (uses `SalesRuleError`, from Task 242). The QA finding for it was stale; no change needed.

### Design decision — re-post of a POSTED invoice = clean 400, not a silent 200 no-op
The original agent's report/docs described an "idempotent no-op (200, returns the invoice)". I chose the **safer** behaviour: reject with a clean **400 `SALES_ALREADY_POSTED`**. Rationale: (1) the pre-existing test `SalesPostingUseCases.test.ts:1286` already encoded "re-post is rejected + no duplicate voucher" as the intended design; (2) for an accounting system, a double-post attempt should be *visibly* refused, not silently swallowed. The only thing that was actually broken was the HTTP status (500 → now 400). No duplicate voucher is ever created in either design.

## Verification

- `npm --prefix backend run build` (tsc) ✅
- `ErrorTaxonomyBusinessRuleMapping.test.ts` (Task 246) — 4/4 ✅: POSTED re-post → 400 `SALES_ALREADY_POSTED` (no dup voucher); non-DRAFT SI → 400 `SALES_INVALID_STATE`; PENDING voucher submit → 400 `VOUCH_INVALID_STATUS`; `VoucherEntity.submit` on APPROVED → 400 `VOUCH_INVALID_STATUS`. Each asserts `guard`.
- `SalesRuleErrorMapping.test.ts` (pre-existing) — still ✅.
- Updated `SalesPostingUseCases.test.ts:1286` to assert the new `already POSTED` message (still rejects, still no duplicate).
- **Full sales + accounting + domain-accounting groups: 61 suites / 505 tests pass.**

## Files changed
New: `VoucherRuleError.ts`, `PurchaseRuleError.ts`, `ErrorTaxonomyBusinessRuleMapping.test.ts`, `docs/architecture/error-taxonomy.md`, `docs/user-guide/errors-and-validation.md`.
Modified: `ErrorCodes.ts` (2 codes), `SalesInvoiceUseCases.ts`, `SubmitVoucherUseCase.ts`, `VoucherEntity.ts`, `SalesPostingUseCases.test.ts`.
Deleted: `backend/scripts/task246-error-taxonomy-smoke.cjs` (fictional/broken).

## Known follow-ups
- **Purchases mirror not done.** `PurchaseRuleError` exists but its throw sites (`PurchaseInvoiceUseCases`, `PurchaseOrderUseCases`, `PurchaseReturnUseCases`, purchases `PaymentSyncUseCases`) were **not** converted. No QA-confirmed 500 leak exists on the purchases side today; convert them when touched, or as a small dedicated follow-up. Verify each with a test before claiming done.
- **Frontend i18n:** the new codes fall back to the backend's English message (already human-readable). Add `SALES_002/003` keys to `common.json` if/when a localized toast is desired.

## End-user view
Clicking **Post** on an invoice that is cancelled or already posted now shows a clear message ("…already POSTED", "…cannot be posted from status CANCELLED") instead of a scary "Request failed with status code 500". Re-posting an already-posted invoice never creates a duplicate.
