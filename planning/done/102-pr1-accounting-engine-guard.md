# 102 — PR1: Accounting Engine Guard with Auto-Init

**Status:** ✅ COMPLETE
**Date:** 2026-05-19
**Branch:** `fix/project-responsiveness`
**Scope:** First of six PRs in the [alpha-readiness remediation plan](../tasks/alpha-readiness-remediation-plan.md). Closes P0-1 and P0-2 from the second-pass audit.

## Context

The second-pass audit found that `PostSalesInvoiceUseCase` could mark a Sales Invoice as POSTED with `voucherId=null` whenever `isAccountingEnabled(companyId)` returned false — no error, no audit row. The misframing in the original audit was treating that flag as "Accounting UI hidden." The confirmed architecture is:

- **Accounting Engine** = mandatory backend infrastructure. Always required for posting.
- **Accounting UI** = optional admin toggle. Never gates posting.

PR1 makes this explicit in code: the Engine is auto-initialized when Sales/Purchases is initialized, and posting throws `AccountingEngineUnavailableError` if the Engine is not ready.

## What changed

### New error class
- `backend/src/domain/accounting/errors/AccountingEngineUnavailableError.ts` — extends `PostingError` with reasons `MISSING_BASE_CURRENCY`, `MISSING_COA_TEMPLATE`, `INIT_FAILED`, `NOT_INITIALIZED`.

### New use case
- `backend/src/application/accounting/use-cases/EnsureAccountingEngineInitialized.ts` — idempotent guard. If accounting module already initialized, no-op. Otherwise, auto-invokes `InitializeAccountingUseCase` with safe defaults (`coaTemplate: 'standard'`, `fiscalYearStart: '01-01'`, `fiscalYearEnd: '12-31'`, `periodScheme: 'MONTHLY'`) using the company's base currency. Throws `AccountingEngineUnavailableError` when base currency is missing or init fails.

### Init-time wiring
- `InitializeSalesUseCase` (SalesSettingsUseCases.ts:208) and `InitializePurchasesUseCase` (PurchaseSettingsUseCases.ts:221) now take `EnsureAccountingEngineInitialized` as a constructor dep and call it as their first step.
- `SalesController.initializeSales` and `PurchaseController.initializePurchases` construct and pass the guard, including the full `InitializeAccountingUseCase` wiring.
- Test files updated to pass a stub for the new dep.

### Post-time guard
- `PostSalesInvoiceUseCase` (SalesInvoiceUseCases.ts:675) and `PostPurchaseInvoiceUseCase` (PurchaseInvoiceUseCases.ts:457) now throw `AccountingEngineUnavailableError` (reason `NOT_INITIALIZED`) when `createAccountingEffect=true` but the Engine is not initialized. Removes the silent path that previously marked the document POSTED with no voucher.
- `isAccountingEnabled` helper renamed to `isAccountingEngineReady` in both invoice use cases (plus the UnpostPurchaseInvoice helper for consistency).
- The legacy `createAccountingEffect=false` path (used by Opening Stock and one test) is preserved — that is an explicit caller choice, not a silent failure mode.

### Documentation
- `docs/architecture/accounting.md` — new top-level section "Accounting Engine vs Accounting App/UI" documenting that the two are independent and posting never consults the UI toggle.
- `docs/architecture/sales.md` and `docs/architecture/purchases.md` — new "Prerequisites" section pointing to the Engine guard behavior.

### Design decision (no schema change)
The existing `CompanyModule` already has `initialized` and `isEnabled` separately. For the accounting module specifically, `initialized=true` means **Engine ready** and `isEnabled` is the cosmetic admin toggle. No rename was needed — only the helper method `isAccountingEnabled` (which conflated the two) was renamed to `isAccountingEngineReady` for clarity.

## Files changed

- `backend/src/domain/accounting/errors/AccountingEngineUnavailableError.ts` (new)
- `backend/src/application/accounting/use-cases/EnsureAccountingEngineInitialized.ts` (new)
- `backend/src/application/sales/use-cases/SalesSettingsUseCases.ts`
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
- `backend/src/application/purchases/use-cases/PurchaseSettingsUseCases.ts`
- `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts`
- `backend/src/api/controllers/sales/SalesController.ts`
- `backend/src/api/controllers/purchases/PurchaseController.ts`
- `backend/src/tests/application/accounting/EnsureAccountingEngineInitialized.test.ts` (new, 4 tests)
- `backend/src/tests/application/sales/SalesSettingsUseCases.test.ts` (stub for new dep)
- `backend/src/tests/application/purchases/PurchaseSettingsUseCases.test.ts` (stub for new dep)
- `docs/architecture/accounting.md`
- `docs/architecture/sales.md`
- `docs/architecture/purchases.md`
- `planning/tasks/alpha-readiness-remediation-plan.md` (PR1 section refined during execution)

## Verification

- `cd backend && npx tsc --noEmit` → exit 0
- `cd backend && npx jest --testPathPatterns="(SalesSettingsUseCases|PurchaseSettingsUseCases|EnsureAccountingEngineInitialized)"` → 12/12 pass across 3 suites
- `cd backend && npx jest --testPathPatterns="(SalesPostingUseCases|PurchasePostingUseCases|SalesInvoiceSettlementPosting|PurchaseInvoiceSettlementPosting)"` → 40/40 pass across 4 suites (no regression)

## Out of scope (handled in later PRs)

- PR2 — PostingLog entity and `cogsPostingStatus` field. Will record which Engine code path resolved each posting decision.
- PR3 — remove `skipAccountValidation` flag, convert silent account-skip fallbacks to hard errors, persona governance hard-throw on Sales.
- Renaming `isAccountingEnabled` in the other 8 callers (DeliveryNote, SalesReturn, PurchaseReturn x2, GoodsReceipt x2, StockAdjustment, UnpostPI) — defer to a cleanup PR; the helpers function identically, just keep the old name.

## Next

PR4 (idempotency + negative stock) and PR6 (Firestore rules) can run in parallel next. PR2 (PostingLog) is the foundation for PR3 and PR5 and should come after.
