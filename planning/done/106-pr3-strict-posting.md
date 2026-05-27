# 106 — PR3: Strict Posting (no more silent skips)

**Status:** ✅ COMPLETE
**Date:** 2026-05-19
**Branch:** `fix/project-responsiveness`
**Scope:** Fifth of six PRs in the [alpha-readiness remediation plan](../tasks/alpha-readiness-remediation-plan.md). Closes P0-3 (`skipAccountValidation` dead code), P0-4 (COGS branch (e) silent skip), and P0-5 (Sales persona governance asymmetry).

## Context

Two of the audit's biggest correctness gaps were silent paths in `PostSalesInvoiceUseCase`:
- Missing Revenue / Tax / COGS / Inventory account → line silently skipped from the voucher, books incomplete.
- `skipAccountValidation: true` flag set in 8 callers, even though the ledger layer validates unconditionally — dead code that hid the real defense.

The user's confirmed architecture rule was unambiguous: **missing account mapping is never a valid deferred-cost reason. It must throw.** Missing cost data (no recorded average / last cost) may be deferred only when `inventorySettings.allowDeferredCost === true`.

## What changed

### Three new typed errors

- `AccountMappingError` — thrown when a required GL account cannot resolve through the fallback chain. Carries `accountRole`, `fallbackChain`, optional `itemId` and `lineNo`. Replaces silent skips for revenue, tax, COGS, inventory.
- `PersonaNotAllowedError` — thrown when a Sales/Purchases document is created with a persona that's disabled by company / form / branch governance. Replaces a generic `Error` on Sales (Purchases already threw; PR3 makes them symmetric and structured).
- `UnsettledCostError` — thrown when a line's cost basis is missing AND `inventorySettings.allowDeferredCost === false`. Distinct from `NegativeStockError` (quantity issue) and `AccountMappingError` (configuration issue).

### Deferred-cost policy

- New `InventorySettings.allowDeferredCost` field (default `false`).
- When false: missing cost basis blocks posting with `UnsettledCostError`.
- When true: posting proceeds with `cogsPostingStatus = 'SKIPPED_UNSETTLED_COST'` and a warning in the PostingLog; a future settlement use case (P1) reconciles the cost later.

### Sales Invoice posting tightened

`PostSalesInvoiceUseCase`:
- **Revenue**: line with `lineTotalBase > 0` and no resolvable revenue account → `AccountMappingError`.
- **Tax**: line with `taxAmountBase > 0` and `taxCodeId` set, but the tax code has no `salesTaxAccountId` → `AccountMappingError`.
- **COGS / Inventory** (branch e from the audit): tracked item with cost > 0, accounting policy says recognise inventory at invoice, but `resolveCOGSAccountsSync` returns null → `AccountMappingError`. Missing account is never deferrable.
- **Unsettled cost**: tracked item with `lineCostBase === 0` and `allowDeferredCost === false` → `UnsettledCostError`. With `allowDeferredCost === true`, posting continues with the existing `SKIPPED_UNSETTLED_COST` flag plus a PostingLog warning.
- **Persona governance**: replaced generic `Error('persona not allowed')` with structured `PersonaNotAllowedError`.

### Dead code removed

`skipAccountValidation` flag deleted from 8 callers and from the `PostSubledgerVoucherInput` type. The conditional in `SubledgerVoucherPostingService.postInTransaction` (line 117) now unconditionally calls `validateAccounts()` when `accountRepo` is present. The ledger-layer defense-in-depth in `FirestoreLedgerRepository.recordForVoucher` is unchanged and continues to validate as the final safety net.

## Files changed

New:
- `backend/src/domain/accounting/errors/AccountMappingError.ts`
- `backend/src/domain/accounting/errors/PersonaNotAllowedError.ts`
- `backend/src/domain/inventory/errors/UnsettledCostError.ts`
- `backend/src/tests/domain/accounting/StrictPostingErrors.test.ts` (4 cases)

Modified (silent-skip → throw + dead-code removal):
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
- `backend/src/application/sales/use-cases/SalesReturnUseCases.ts`
- `backend/src/application/sales/use-cases/DeliveryNoteUseCases.ts`
- `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts`
- `backend/src/application/purchases/use-cases/PurchaseReturnUseCases.ts`
- `backend/src/application/purchases/use-cases/GoodsReceiptUseCases.ts`
- `backend/src/application/inventory/use-cases/StockAdjustmentUseCases.ts`
- `backend/src/application/accounting/services/SubledgerVoucherPostingService.ts` — removed `skipAccountValidation` from input type and conditional
- `backend/src/domain/inventory/entities/InventorySettings.ts` — new `allowDeferredCost` field with default `false`

## Verification

- `cd backend && npx tsc --noEmit` → exit 0
- `cd backend && npx jest --testPathPatterns="StrictPostingErrors"` → 4/4 pass
- `cd backend && npx jest --testPathPatterns="(SalesPostingUseCases|SalesInvoiceSettlementPosting|SalesReturnUseCases|SalesPaymentSyncUseCases|PurchasePostingUseCases|PurchaseInvoiceSettlementPosting|StockAdjustmentAtomicity|RecordStockMovementUseCase|NegativeStockEnforcement)"` → 84/84 pass (no regression)

## Out of scope

- Equivalent tightening on `PostPurchaseInvoiceUseCase` revenue/tax/account silent skips — same pattern, follow-up.
- Frontend handling of the new error codes (it currently renders generic error messages; PR3 only changes server-side behavior).

## Next PR

PR5 — Multi-currency completion (FX gain/loss posting on settlement) is the final P0 of the alpha-readiness plan.
