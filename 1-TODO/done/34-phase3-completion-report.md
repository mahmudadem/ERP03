# Phase 3 Completion Report — Governance & RBAC

Date: 2026-03-04
Plan: `1-TODO/34c-phase3-governance-rbac.md`

## Scope Completed
Implemented Phase 3 governance/RBAC fixes E, G, I, J as defined in the plan, without changing API response shapes or frontend code.

## Changes Implemented

### Fix E — `excludeSpecialPeriods` wiring (TB / BS / CF)

1. Trial Balance use case now accepts and forwards `excludeSpecialPeriods`:
- `backend/src/application/accounting/use-cases/LedgerUseCases.ts`
  - `GetTrialBalanceUseCase.execute(..., includeZeroBalance = false, excludeSpecialPeriods = false)`
  - forwards to `ledgerRepo.getTrialBalance(companyId, effectiveDate, excludeSpecialPeriods)`

2. Balance Sheet use case now accepts and forwards `excludeSpecialPeriods`:
- `backend/src/application/accounting/use-cases/LedgerUseCases.ts`
  - `GetBalanceSheetUseCase.execute(..., asOfDate, excludeSpecialPeriods = false)`
  - forwards to `ledgerRepo.getTrialBalance(companyId, effectiveDate, excludeSpecialPeriods)`

3. Cash Flow use case now accepts and forwards `excludeSpecialPeriods`:
- `backend/src/application/accounting/use-cases/CashFlowUseCases.ts`
  - `GetCashFlowStatementUseCase.execute(..., fromDate, toDate, excludeSpecialPeriods = false)`
  - forwards to both opening/closing trial balance calls

4. Controllers now parse query param and pass through:
- `backend/src/api/controllers/accounting/AccountingReportsController.ts`
  - `getTrialBalance`: parses `req.query.excludeSpecialPeriods === 'true'`
  - `getBalanceSheet`: parses and passes to use case
  - `getCashFlow`: parses and passes to use case
- `backend/src/api/controllers/accounting/ReportingController.ts`
  - `trialBalance`: parses and passes to use case

---

### Fix G — Policy key drift (`allowEditPostedVouchersEnabled` -> `allowEditDeletePosted`)

1. Replaced legacy-key reads in voucher use cases:
- `backend/src/application/accounting/use-cases/VoucherUseCases.ts`
  - lock-policy decisions now read `config.allowEditDeletePosted`

2. Added backward-compatible alias mapping in config provider:
- `backend/src/infrastructure/accounting/config/FirestoreAccountingPolicyConfigProvider.ts`
  - if legacy key exists and canonical key is absent, map legacy -> canonical

3. Deprecated field preserved in type (no removal):
- `backend/src/domain/accounting/policies/PostingPolicyTypes.ts`
  - `allowEditPostedVouchersEnabled?: boolean` retained as deprecated compatibility field

---

### Fix I — Retained earnings double-count prevention

Updated balance sheet retained earnings logic:
- `backend/src/application/accounting/use-cases/LedgerUseCases.ts`
  - detect equity accounts with retained-earnings name hints
  - compute `existingREBalance`
  - synthetic retained earnings now:
    - `(revenueTotal - expenseTotal) - existingREBalance`
  - synthetic line label changed to:
    - `Current Year Earnings (Unposted)`
  - synthetic line is appended only when non-zero (`abs >= 0.005`)

This avoids double-count when a real retained earnings account already carries closed earnings.

---

### Fix J — Permission catalog synchronized with route-used IDs

Added missing permission IDs to catalog (add-only; no removals):
- `backend/src/config/PermissionCatalog.ts`

Accounting additions:
- `accounting.accounts.create`
- `accounting.accounts.edit`
- `accounting.accounts.delete`
- `accounting.vouchers.approve`
- `accounting.vouchers.cancel`
- `accounting.vouchers.correct`
- `accounting.vouchers.lock`
- `accounting.reports.profitAndLoss.view`
- `accounting.reports.trialBalance.view`
- `accounting.reports.balanceSheet.view`
- `accounting.reports.cashFlow.view`
- `accounting.reports.generalLedger.view`
- `accounting.settings.read`
- `accounting.settings.write`

Also added route-used non-accounting IDs that were missing:
- `inventory.items.create`
- `inventory.warehouses.create`
- `system.company.manage`

Route-to-catalog coverage check now reports no missing route permission IDs.

## Verification Results

### TypeScript
Command:
```bash
cd backend && npx tsc --noEmit
```
Result: PASS

### Jest (required pattern set)
Note: Jest CLI in this repo uses `--testPathPatterns` (plural).

Command:
```bash
cd backend && npx jest --testPathPatterns="GetBalanceSheet|GetCashFlow|GovernancePolicy" --no-coverage
```
Result: PASS
- `GetCashFlowUseCase.test.ts` passed
- `GetBalanceSheetUseCase.test.ts` passed
- `GovernancePolicy.test.ts` passed

### Permission Coverage Check
Computed route permission IDs from `src/api/routes/*.ts` and compared with `PermissionCatalog.ts` entries.
Result: no route permission IDs missing from catalog.

## Acceptance Criteria Mapping
- `excludeSpecialPeriods` query can be passed to TB endpoint: DONE
- BS and CF use cases accept and forward `excludeSpecialPeriods`: DONE
- Legacy lock-key reads replaced in use-case logic: DONE
- Config provider maps legacy lock key to canonical key: DONE
- Synthetic retained earnings now only unposted portion: DONE
- Synthetic retained earnings omitted when zero: DONE
- Route-used permission IDs exist in catalog: DONE
- `npx tsc --noEmit` passes: DONE
- Required jest pattern suite passes: DONE
