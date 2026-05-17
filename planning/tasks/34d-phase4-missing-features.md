# Phase 4 — Missing Features & Tech Debt

> **Priority:** 🟢 P2 — Tech debt / missing features
> **Claims Fixed:** F (Trading Account missing), H (currency policy bypass), K (SQL/Prisma stubs)
> **Estimated Effort:** 1–3 days
> **Dependencies:** Phase 3 must be complete

---

## Business Context

These items are acknowledged tech debt and missing features. They don't cause data corruption or policy bypass, but they represent gaps in completeness. They can be individually scoped and implemented when business priority dictates.

---

## Fix F: Document Trading Account as Future Feature

### Current State

No reference to "Trading Account", "Net Sales", "COGS", or "Gross Profit" exists anywhere in the backend. This is a feature gap, not a bug.

### Implementation Plan

This is a **documentation-only** task for this phase. The Trading Account report requires:
- A way to classify REVENUE sub-categories (Sales, Cost of Sales / COGS)
- A new report use case: `GetTradingAccountUseCase`
- Frontend page

#### Step 1: Create a future plan file

**File:** `backend/src/application/accounting/use-cases/FUTURE_TRADING_ACCOUNT.md` (NEW)

Document:
- What a Trading Account is (Net Sales − COGS = Gross Profit)
- Required COA classification additions (sub-categories for REVENUE)
- Proposed use case signature
- Dependencies on COA restructuring

#### Step 2: Add a TODO comment in LedgerUseCases.ts

After the `GetJournalUseCase` class, add:

```typescript
/**
 * FUTURE: GetTradingAccountUseCase
 * 
 * Trading Account = Net Sales − COGS = Gross Profit
 * Requires: Revenue sub-classification (SALES vs COST_OF_SALES)
 * See: FUTURE_TRADING_ACCOUNT.md
 */
```

> **Note:** No code implementation in this phase — this is P3 feature work.

---

## Fix H: Add `lineCurrency` to Account Validation Context

### Current State

**File:** `backend/src/domain/accounting/rules/IAccountValidationRule.ts`

```typescript
export interface AccountValidationContext {
    companyId: string;
    userId: string;
    account: Account;
    voucherType?: string;
    lineType?: 'debit' | 'credit';
    amount?: number;
    // Missing: lineCurrency
}
```

The `CurrencyPolicyRule` cannot validate that the line currency matches the account's fixed currency because the currency is never provided to the validation context.

### Implementation Plan

#### Step 1: Add `lineCurrency` to `AccountValidationContext`

**File:** `backend/src/domain/accounting/rules/IAccountValidationRule.ts`

```typescript
export interface AccountValidationContext {
    companyId: string;
    userId: string;
    account: Account;
    voucherType?: string;
    lineType?: 'debit' | 'credit';
    amount?: number;
    lineCurrency?: string;       // NEW: currency of the voucher line
    baseCurrency?: string;       // NEW: company base currency
}
```

#### Step 2: Update `CurrencyPolicyRule` to use it

**File:** `backend/src/domain/accounting/rules/implementations/CurrencyPolicyRule.ts`

Find the `validate()` method and add a check:

```typescript
async validate(ctx: AccountValidationContext): Promise<ValidationResult> {
    // ... existing checks ...
    
    // NEW: If account has a fixed currency and line currency is provided, verify match
    const fixedCurrency = ctx.account.fixedCurrencyCode;
    if (fixedCurrency && ctx.lineCurrency) {
        const normalizedFixed = fixedCurrency.toUpperCase();
        const normalizedLine = ctx.lineCurrency.toUpperCase();
        const normalizedBase = (ctx.baseCurrency || '').toUpperCase();
        
        // Allow base currency (always valid) or matching currency
        if (normalizedLine !== normalizedFixed && normalizedLine !== normalizedBase) {
            return {
                valid: false,
                reason: `Account "${ctx.account.userCode}" only accepts ${normalizedFixed} or base currency. Got: ${normalizedLine}`
            };
        }
    }
    
    return { valid: true };
}
```

> **Note:** First examine the existing `CurrencyPolicyRule.ts` to understand what it already validates. Extend, don't replace.

#### Step 3: Pass `lineCurrency` from voucher creation

**File:** `backend/src/application/accounting/use-cases/VoucherUseCases.ts`

In the JV line mapping (lines 355–396), where `accountValidationService.validateAccountById()` is called:

```typescript
const account = await accountValidationService.validateAccountById(
    companyId,
    userId,
    l.accountId,
    undefined,               // voucherType
    { lineCurrency: lineCurrency, baseCurrency: baseCurrency }  // NEW: extraContext
);
```

The `validateAccountById()` method already supports `extraContext?: Partial<AccountValidationContext>` at line 167 — this just needs to be used at the call sites.

---

## Fix K: Document SQL/Prisma Status (No Code Change)

### Current State

All 6 Prisma repository files throw `Error('...not yet implemented...Use Firestore.')`.

This is **known and intentional tech debt** — Firestore is the primary backend, SQL is future-ready.

### Implementation Plan

#### Step 1: Add a status header to each Prisma file

Add a consistent comment block to each Prisma repository:

```typescript
/**
 * SQL MIGRATION STATUS: NOT IMPLEMENTED
 * 
 * This repository is a placeholder for future SQL/PostgreSQL migration.
 * Current production uses Firestore via the corresponding Firestore repository.
 * 
 * To activate: Set DB_TYPE=sql in .env and implement all methods with Prisma queries.
 * See: backend/src/infrastructure/di/bindRepositories.ts for the toggling mechanism.
 */
```

Files to update:
- `backend/src/infrastructure/prisma/repositories/PrismaVoucherRepository.ts`
- `backend/src/infrastructure/prisma/repositories/PrismaCompanyRepository.ts`
- `backend/src/infrastructure/prisma/repositories/PrismaCompanyCurrencyRepository.ts`
- `backend/src/infrastructure/prisma/repositories/PrismaCurrencyRepository.ts`
- `backend/src/infrastructure/prisma/repositories/PrismaExchangeRateRepository.ts`
- `backend/src/infrastructure/prisma/company-admin/PrismaCompanyAdminRepository.ts`

#### Step 2: Verify DI container handles gracefully

**File:** `backend/src/infrastructure/di/bindRepositories.ts`

Confirm that the DI container only instantiates Prisma repos when `DB_TYPE=sql`. If `DB_TYPE` is missing or `firestore`, only Firestore repos should be created.

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/domain/accounting/rules/IAccountValidationRule.ts` | Add `lineCurrency?` and `baseCurrency?` to context |
| `backend/src/domain/accounting/rules/implementations/CurrencyPolicyRule.ts` | Add currency match validation |
| `backend/src/application/accounting/use-cases/VoucherUseCases.ts` | Pass `lineCurrency` to `validateAccountById` calls |
| `backend/src/application/accounting/use-cases/LedgerUseCases.ts` | Add FUTURE comment for Trading Account |
| `backend/src/infrastructure/prisma/repositories/*.ts` (6 files) | Add status header comment |

---

## Verification Plan

### Automated Tests

```bash
cd backend && npx jest --testPathPattern="AccountUseCases|VoucherPersistence" --no-coverage
```

### Manual Verification

1. **TypeScript compilation:** `cd backend && npx tsc --noEmit`
2. **Verify currency validation:**
   - Create a voucher line with a currency that doesn't match the account's fixed currency
   - Should get a validation error (if CurrencyPolicyRule is active)
3. **Verify no regressions:**
   - Create a normal JV voucher with matching currencies — should succeed

---

## Acceptance Criteria

- [ ] `AccountValidationContext` includes `lineCurrency?` and `baseCurrency?`
- [ ] `CurrencyPolicyRule.validate()` checks line currency against account fixed currency
- [ ] Call sites in `VoucherUseCases.ts` pass `lineCurrency` via `extraContext`
- [ ] FUTURE_TRADING_ACCOUNT.md created with feature scope documentation
- [ ] All Prisma repos have migration status header comment
- [ ] `npx tsc --noEmit` passes cleanly
- [ ] Existing tests pass
- [ ] Completion report at `1-TODO/done/34-phase4-completion-report.md`

---

## STRICT RULES FOR EXECUTOR

1. **DO NOT** implement the Trading Account report — documentation only
2. **DO NOT** implement Prisma repositories — documentation/comments only
3. **DO NOT** change the `CurrencyPolicyRule` if it doesn't exist — check first
4. **DO NOT** make the `lineCurrency` check a hard rejection if the field is missing — it must be opt-in (only reject when both `fixedCurrencyCode` and `lineCurrency` are present)
5. **DO NOT** modify frontend code
