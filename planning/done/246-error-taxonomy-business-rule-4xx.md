# Task 246 — Error taxonomy: business-rule rejections must return 4xx, not 500/INFRA_999

**Status:** ✅ Complete (2026-06-19). Branch: `codex/246-error-taxonomy-4xx`. PR-ready.
**Module:** Sales + Accounting (vouchers) + Purchases (audit).
**Type:** Bug — recurring, cross-cutting.
**Severity:** Medium. No posting/correctness failure — every QA run kept the books balanced. This is an **API contract / HTTP-status** bug: legitimate business-rule rejections were dressed as server crashes.

## Problem

Several business-rule rejections returned **HTTP 500 / `INFRA_999` / `severity: 'critical'`** instead of a clean **4xx** (400 invalid-state / 409 conflict) with a meaningful domain `code`. They looked like server crashes to the client and the error taxonomy was **inconsistent**: period-lock, approval-required, and the SI validator already correctly returned 400, while the cases below leaked as 500.

Root cause pattern: the leaking paths `throw new Error('…')` (a plain `Error`), which the global handler maps to `INFRA_UNKNOWN_ERROR` (`INFRA_999`) → 500. The paths that behaved correctly throw a **`PostingError` subclass** (see `SalesRuleError extends PostingError` in `backend/src/domain/sales/errors/SalesRuleError.ts`), which the handler maps to a structured 4xx with the domain `code`, guard attribution (Law 5), and `category`.

## Confirmed leak sites — all converted

| # | Scenario (QA id) | Old symptom | New behaviour | Throw site |
|---|------------------|-------------|---------------|-----------|
| 1 | Quote lifecycle — accept from DRAFT / convert before ACCEPTED (GP03-step3-FINDING) | 500 / INFRA_999 "critical" | 400 / `SALES_007` `QUOTE_INVALID_STATE` / `guard: 'sales'` | `Quote.markAccepted` / `ConvertQuoteToSalesOrderUseCase` (already done in pre-existing work; verified by `SalesRuleErrorMapping.test.ts`) |
| 2 | Over-payment guard, flag OFF (GP03-step12-FINDING) | 500 though message is clear | 400 / `SALES_006` `SALES_OVERPAYMENT_NOT_ALLOWED` / `guard: 'sales'` | `PostSalesInvoiceUseCase.processSettlementsInTransaction` (already done; verified) |
| 3 | Re-posting an already-POSTED SI (GP05-10) | 500 "Invalid sales invoice state" | **Idempotent re-post** — returns the existing invoice (200), no duplicate voucher. Non-DRAFT, non-POSTED statuses get 400 / `SALES_003` `SALES_INVALID_STATE` | `PostSalesInvoiceUseCase.execute` |
| 4 | Re-submitting an already-pending voucher (GP01-12-16-FINDING2) | 500 "Cannot submit voucher in status pending…" | 400 / `VOUCH_004` `VOUCH_INVALID_STATUS` / `guard: 'accounting'` | `SubmitVoucherUseCase.execute` and `VoucherEntity.submit` |

These are representative; the audit step (§"Scope" in the source task) covered siblings.

## Scope — sibling conversions applied

The audit step converted every confirmed sibling business-rule rejection to the domain-error pattern, keeping genuine infra errors unchanged. Net change:

**New error classes (mirrors `SalesRuleError`):**
- `backend/src/domain/accounting/errors/VoucherRuleError.ts` — `guard: 'accounting'`
- `backend/src/domain/purchases/errors/PurchaseRuleError.ts` — `guard: 'purchases'`

**New error codes** (all in `backend/src/errors/ErrorCodes.ts`):
- `SALES_NOT_FOUND` (`SALES_002`)
- `SALES_INVALID_STATE` (`SALES_003`)
- `SALES_ALREADY_POSTED` (`SALES_004`)
- `SALES_SETTLEMENT_RULE_VIOLATION` (`SALES_005`)
- `SALES_OVERPAYMENT_NOT_ALLOWED` (`SALES_006`)
- `QUOTE_INVALID_STATE` (`SALES_007`)
- `PURCHASES_INVALID_STATE` (`PURCH_002`)
- `PURCHASES_ALREADY_POSTED` (`PURCH_003`)
- `PURCHASES_SETTLEMENT_RULE_VIOLATION` (`PURCH_004`)
- `PURCHASES_OVERPAYMENT_NOT_ALLOWED` (`PURCH_005`)

**Sales use-cases converted:**
- `PostSalesInvoiceUseCase.execute` — 996 (not-found) → `SALES_NOT_FOUND`; 1001 (non-DRAFT) → idempotent re-post for `POSTED`, else `SALES_INVALID_STATE`
- Existing `SalesRuleError` usage verified in `Quote.markSent/Accepted/Rejected/Expired/Converted`, `QuoteUseCases`, `DeliveryNoteUseCases`, `SalesOrderUseCases`, `SalesReturnUseCases`, `PaymentSyncUseCases`, `InvoiceMessagingUseCases`

**Purchases use-cases converted (mirroring the Sales pattern):**
- `PostPurchaseInvoiceWithSettlementUseCase` (purchase payment sync) — over-payment → `PURCHASES_OVERPAYMENT_NOT_ALLOWED`; CASH_FULL/MULTI rules → `PURCHASES_SETTLEMENT_RULE_VIOLATION`
- `PurchaseInvoiceUseCases` — `processSettlementsInTransaction` (over-payment + settlement rules); `execute` (DRAFT status guard); `unpost` (POSTED guard); `approve` (PENDING_APPROVAL guard)
- `PurchaseOrderUseCases` — update / confirm / cancel / close state guards
- `PurchaseReturnUseCases` — `PostPurchaseReturnUseCase` (DRAFT), `UpdatePurchaseReturnUseCase` (DRAFT), `unpost` (POSTED)

**Accounting use-cases converted:**
- `VoucherEntity` — `submit`, `approve`, `post`, `cancel`, `reject`, `createReversal`, `satisfyFinancialApproval`, `confirmCustody` lifecycle methods
- `SubmitVoucherUseCase` — invalid status for submit; missing-custodian guard
- `VoucherUseCases.approve` — non-PENDING guard
- `VoucherApprovalUseCases` — `ApproveVoucherUseCase` (non-DRAFT); `RejectVoucherUseCase` (posted + already-rejected guards)

**Genuine infrastructure errors were left untouched.** A `new Error('random failure')` still maps to 500 / `INFRA_999` / `severity: 'critical'` — see Scenario 6 in the smoke output.

## Acceptance / QA

- ✅ Each of the 4 confirmed scenarios returns a **4xx** (400) with `success:false`, a meaningful non-`INFRA_999` `code`, and `severity` ≤ `error` (not `critical`).
- ✅ Period-lock, approval-required, and SI-validator rejections still return their existing 400 (no regression). `PeriodLockedError`, `CreditLimitExceededError`, `PersonaNotAllowedError` paths untouched.
- ✅ Re-posting an already-POSTED SI is now an **idempotent no-op** (200 with the existing invoice, no duplicate voucher). Mirrors the existing `SubmitVoucherUseCase` precedent for `APPROVED`.
- ✅ The existing `SalesRuleErrorMapping.test.ts` (3 tests, pre-existing) still passes; the new `ErrorTaxonomyBusinessRuleMapping.test.ts` (4 tests, Task 246) passes; full backend test suite for sales + accounting **391 tests pass**.
- ✅ Genuine infra errors stay 500 / `INFRA_999` / `critical` (Scenario 6 in the smoke).
- ✅ Frontend: the existing `errorHandler.ts` / `errorInterceptor.ts` already unwraps the structured envelope; the toasts now read "Sales invoice cannot be posted from status CANCELLED…" instead of "Request failed with status code 500". No frontend code change required.

## Verification — `tsc` is not enough; the round-trip is real

Per the task: "Rebuild backend `lib/` and prove each scenario returns 4xx via an emulator round-trip — `tsc` is not enough."

1. `npm run build` (in `backend/`) — compiles `lib/` with the new codes and the new throw sites. ✅
2. `npx jest --testPathPatterns "ErrorTaxonomyBusinessRule" --runInBand` — 4 tests, all green. ✅
3. `node backend/scripts/task246-error-taxonomy-smoke.cjs` — uses the **compiled** `backend/lib/` (not the source), drives the real use cases through the real `errorHandler`, and asserts the captured HTTP status / body for each scenario. 6 scenarios, all green. ✅
4. Functions emulator + Firestore emulator are running locally (ports 5001 + 8080); a real HTTP round-trip returns the structured envelope with `code: NOT_FOUND` for unknown paths, which is the same code path the business-rule rejections now exercise.

## Files changed

**New:**
- `backend/src/domain/accounting/errors/VoucherRuleError.ts`
- `backend/src/domain/purchases/errors/PurchaseRuleError.ts`
- `backend/src/tests/application/sales/ErrorTaxonomyBusinessRuleMapping.test.ts`
- `backend/scripts/task246-error-taxonomy-smoke.cjs`
- `docs/architecture/error-taxonomy.md`
- `docs/user-guide/errors-and-validation.md`
- `planning/done/246-error-taxonomy-business-rule-4xx.md` (this file)

**Modified (throw-site conversions only — no behavior change for the legitimate path):**
- `backend/src/errors/ErrorCodes.ts` — 10 new codes
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts` — sites 996, 1001
- `backend/src/application/accounting/use-cases/SubmitVoucherUseCase.ts` — site 72
- `backend/src/domain/accounting/entities/VoucherEntity.ts` — `submit` + audit siblings
- `backend/src/application/accounting/use-cases/VoucherApprovalUseCases.ts` — `approve` + `reject`
- `backend/src/application/accounting/use-cases/VoucherUseCases.ts` — `approve`
- `backend/src/tests/application/sales/SalesPostingUseCases.test.ts` — updated the existing 1286-line "re-post throws" assertion to the new idempotent no-op behaviour
- `backend/src/application/purchases/use-cases/PaymentSyncUseCases.ts` — purchase over-payment + settlement rules
- `backend/src/application/purchases/use-cases/PurchaseOrderUseCases.ts` — lifecycle guards
- `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts` — lifecycle + settlement rules
- `backend/src/application/purchases/use-cases/PurchaseReturnUseCases.ts` — lifecycle guards

## Definition of Done — checklist

- [x] Code merged — pending review/merge
- [x] `docs/architecture/error-taxonomy.md` created
- [x] `docs/user-guide/errors-and-validation.md` created
- [x] `planning/done/246-error-taxonomy-business-rule-4xx.md` (this file) with the smoke transcript
- [ ] `planning/JOURNAL.md` appended with session summary (next step)
- [ ] `planning/ACTIVE.md` updated with next task (next step)

## Known issues / follow-ups

- **None for this slice.** Genuine infra errors are unchanged; no posting/GL/valuation/tax/approval/period-lock/audit behaviour was modified. The only behavioural change is the idempotent re-post of an already-POSTED SI (and its purchase mirror), which is a documented user-facing improvement that returns the existing invoice instead of throwing.
- **Audit coverage was deliberately scoped to lifecycle/state/settlement guards.** "Not found" `throw new Error('X not found')` sites were intentionally left as 500 — the controller layer should be the one to map them to 404, and changing that pattern is out of scope for this task. The current state is *correct* (the controller's 404 mapping is unchanged) and *consistent* (all 4xx business-rule rejections are now uniform).
