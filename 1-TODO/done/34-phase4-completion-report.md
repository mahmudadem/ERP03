# Phase 4 Completion Report — Missing Features & Tech Debt

Date: 2026-03-04
Plan: `1-TODO/34d-phase4-missing-features.md`

## Scope Completed
Implemented the planned Phase 4 items for claims F, H, and K with fix-only scope:
- Trading Account: documentation only (no report implementation)
- Currency policy bypass hardening via validation context + rule extension
- Prisma SQL migration status documentation/comments only

No frontend code was changed.

---

## 1) Fix F — Trading Account documented as future feature (no implementation)

### Added future plan document
- `backend/src/application/accounting/use-cases/FUTURE_TRADING_ACCOUNT.md`

Document includes:
- Trading Account definition: Net Sales - COGS = Gross Profit
- Required COA classification/mapping prerequisites
- Proposed `GetTradingAccountUseCase` interfaces/signature
- Ledger-based reconciliation expectation
- Note on report-container style usage (`AccountingReportsController`) when implemented later

### Added TODO marker in Ledger use-cases
- `backend/src/application/accounting/use-cases/LedgerUseCases.ts`
- Appended required FUTURE comment block after `GetJournalUseCase`

No Trading Account runtime code was added.

---

## 2) Fix H — Extend account validation context + currency rule + voucher call sites

### Context fields added
- `backend/src/domain/accounting/rules/IAccountValidationRule.ts`
- Added optional fields:
  - `lineCurrency?: string`
  - `baseCurrency?: string`

### CurrencyPolicyRule extended (not replaced)
- `backend/src/domain/accounting/rules/implementations/CurrencyPolicyRule.ts`
- Preserved existing policy flow and added fixed-currency check using context:
  - `lineCurrency` is read from `AccountValidationContext`
  - Opt-in behavior preserved: validation rejects only when both are present and mismatched
  - Base currency allowance added for fixed-currency accounts

### Voucher use-case call sites now pass line currency context
- `backend/src/application/accounting/use-cases/VoucherUseCases.ts`
- Updated `validateAccountById(..., extraContext)` calls to pass:
  - `lineCurrency`
  - `baseCurrency`
- Applied in both create/update mapping paths (strategy and raw line paths), so line-level validation has currency context where lines are materialized.

---

## 3) Fix K — Prisma SQL migration status documentation (comments only)

Added SQL migration status header comments to these files:
- `backend/src/infrastructure/prisma/repositories/PrismaVoucherRepository.ts`
- `backend/src/infrastructure/prisma/repositories/PrismaCompanyRepository.ts`
- `backend/src/infrastructure/prisma/repositories/PrismaCompanyCurrencyRepository.ts`
- `backend/src/infrastructure/prisma/repositories/PrismaCurrencyRepository.ts`
- `backend/src/infrastructure/prisma/repositories/PrismaExchangeRateRepository.ts`
- `backend/src/infrastructure/prisma/company-admin/PrismaCompanyAdminRepository.ts`

No Prisma method implementations were added/changed beyond comments.

### DI toggle verification
Verified `backend/src/infrastructure/di/bindRepositories.ts` still uses:
- `DB_TYPE = process.env.DB_TYPE || 'FIRESTORE'`
- Firestore by default
- Prisma only for SQL-gated repositories (e.g., company/company-admin)
- Voucher repository remains Firestore V2 with SQL TODO note

---

## Verification Results

### TypeScript
Command:
```bash
cd backend && npx tsc --noEmit
```
Result: PASS

### Jest (requested pattern set)
Note: Jest CLI in this repo expects `--testPathPatterns` (plural).

Command:
```bash
cd backend && npx jest --testPathPatterns="AccountUseCases|VoucherPersistence" --no-coverage
```
Result: PASS
- `AccountUseCases.test.ts` passed
- `VoucherPersistence.test.ts` passed

---

## Acceptance Criteria Mapping
- `AccountValidationContext` includes `lineCurrency?` and `baseCurrency?`: DONE
- `CurrencyPolicyRule.validate()` checks line vs fixed/base currency using context: DONE
- Voucher use-case call sites pass `lineCurrency`/`baseCurrency` via `extraContext`: DONE
- `FUTURE_TRADING_ACCOUNT.md` created: DONE
- All specified Prisma files include migration status header comments: DONE
- `npx tsc --noEmit` passes: DONE
- Requested tests pass: DONE

## Notes
- Trading Account report itself was intentionally not implemented (documentation-only, as required).
- Prisma repositories were not implemented in this phase (comments/documentation only, as required).
