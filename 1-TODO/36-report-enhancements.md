# 36 — Report Enhancements: Trading Account, Structured P&L, Equity Subgroup

> **Priority:** P1
> **Estimated Effort:** 1.5 days
> **Dependencies:** Plan 35 (`plSubgroup` field) must be complete
> **Scope:** Backend use cases + balance sheet fix + COA template tagging + frontend P&L subgroup support

---

## Business Context

With `plSubgroup` now on every Account, we can:
1. Build a **Trading Account** report (Net Sales − COGS = Gross Profit)
2. Enhance the **P&L** to show subgroup breakdown (Gross Profit → Operating Profit → Net Profit)
3. Replace the **Balance Sheet's name-guessing** for retained earnings with a proper `equitySubgroup` field

Two user paths:
- **Pre-built COA templates** → accounts tagged correctly out of the box
- **Manual COA** → user tags accounts via the Account form (dropdown already exists for `plSubgroup`; we add `equitySubgroup` same way)

---

## Current State

- ✅ `plSubgroup` field exists on Account entity (`SALES | COST_OF_SALES | OPERATING_EXPENSES | OTHER_REVENUE | OTHER_EXPENSES | null`)
- ✅ `plSubgroup` shown in frontend AccountForm (conditional dropdown)
- ✅ COA templates have `plSubgroup` tagged on Revenue/Expense accounts
- ❌ No `equitySubgroup` field exists
- ❌ BS uses name-guessing for retained earnings (`LedgerUseCases.ts` lines 502-506)
- ❌ P&L has flat output (no Gross Profit subtotal, no subgroup breakdown)
- ❌ No Trading Account use case

---

## Implementation Plan

### Part A: Add `equitySubgroup` to Account Entity (same pattern as `plSubgroup` / `cashFlowCategory`)

**This follows the exact same steps as Plan 35 did for `plSubgroup`.** Use `plSubgroup` as the reference.

#### A1. Backend Entity — `backend/src/domain/accounting/entities/Account.ts`

Add type:
```typescript
export type EquitySubgroup = 'RETAINED_EARNINGS' | 'CONTRIBUTED_CAPITAL' | 'RESERVES' | null;
```

Add to: `AccountProps`, entity class field, constructor (`?? null`), `toJSON()`, `fromJSON()`, `getMutableFields()`.

Add validation in `validate()`:
- `equitySubgroup` is only valid when `classification === 'EQUITY'`
- If classification is not EQUITY and value is set → error

#### A2. Backend Infrastructure — Same files as Plan 35 touched for `plSubgroup`

- `backend/src/domain/accounting/models/Account.ts` — re-export `EquitySubgroup`
- `backend/src/repository/interfaces/accounting/IAccountRepository.ts` — add to `NewAccountInput` and `UpdateAccountInput`
- `backend/src/application/accounting/use-cases/accounts/CreateAccountUseCase.ts` — accept field
- `backend/src/application/accounting/use-cases/accounts/UpdateAccountUseCase.ts` — accept field
- `backend/src/api/dtos/AccountingDTOs.ts` — add to DTO types and `toAccountDTO()` mapping
- `backend/src/infrastructure/firestore/repositories/accounting/FirestoreAccountRepository.ts` — persist on create/update

#### A3. Frontend Types — `frontend/src/api/accounting/index.ts`

```typescript
export type EquitySubgroup = 'RETAINED_EARNINGS' | 'CONTRIBUTED_CAPITAL' | 'RESERVES';
```

Add `equitySubgroup?: EquitySubgroup | null` to `Account`, `NewAccountInput`, `UpdateAccountInput`.

#### A4. Frontend Form — `frontend/src/modules/accounting/components/AccountForm.tsx`

Add options:
```typescript
const EQUITY_SUBGROUPS: { value: EquitySubgroup | ''; label: string }[] = [
    { value: '', label: 'None (Unassigned)' },
    { value: 'RETAINED_EARNINGS', label: 'Retained Earnings' },
    { value: 'CONTRIBUTED_CAPITAL', label: 'Contributed Capital' },
    { value: 'RESERVES', label: 'Reserves' },
];
```

Add state, payload, conditional dropdown (show only when `classification === 'EQUITY'`), auto-clear effect.

---

### Part B: Tag COA Templates with `equitySubgroup`

**File:** `backend/src/application/accounting/templates/COATemplates.ts`

In `StandardCOA`:
- Code `302` ("Retained Earnings") → add `equitySubgroup: "RETAINED_EARNINGS"`
- Code `30201` ("Accumulated Profit") → add `equitySubgroup: "RETAINED_EARNINGS"`
- Code `301` ("Owner Capital") → add `equitySubgroup: "CONTRIBUTED_CAPITAL"`
- Code `30101` ("Paid-in Capital") → add `equitySubgroup: "CONTRIBUTED_CAPITAL"`

In `SimplifiedCOA`:
- Code `301` ("Owner's Capital") → add `equitySubgroup: "CONTRIBUTED_CAPITAL"`
- Code `302` ("Retained Earnings") → add `equitySubgroup: "RETAINED_EARNINGS"`

**File:** `backend/src/application/accounting/templates/IndustryCOATemplates.ts`
- Apply same treatment to equity accounts in all industry templates.

---

### Part C: Fix Balance Sheet — Replace Name-Guessing with `equitySubgroup`

**File:** `backend/src/application/accounting/use-cases/LedgerUseCases.ts`

Replace the name-guessing block (lines 502-506):
```typescript
// OLD (name-based guessing):
const retainedEarningsHints = ['retained earnings', 'retained earning', 'current year earnings'];
const isRetainedEarningsAccount = (acc: any) => {
    const name = String(acc?.name || '').toLowerCase();
    return retainedEarningsHints.some((hint) => name.includes(hint));
};
```

With field-based check:
```typescript
// NEW (field-based):
const isRetainedEarningsAccount = (acc: any) => {
    // Primary: use equitySubgroup tag if available
    if (acc.equitySubgroup === 'RETAINED_EARNINGS') return true;
    // Fallback: name-hint for untagged legacy accounts
    const name = String(acc?.name || '').toLowerCase();
    return ['retained earnings', 'retained earning', 'accumulated profit'].some((hint) => name.includes(hint));
};
```

> **Important:** Keep the name-hint fallback for backward compat with existing companies that haven't tagged their accounts yet. The field check takes priority.

---

### Part D: Enhance P&L with Subgroup Breakdown

**File:** `backend/src/application/reporting/use-cases/GetProfitAndLossUseCase.ts`

Extend the `ProfitAndLossOutput` interface to ADD new optional fields (backward compatible):

```typescript
export interface ProfitAndLossOutput {
    // Existing (unchanged):
    revenue: number;
    expenses: number;
    netProfit: number;
    revenueByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
    expensesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
    period: { from: string; to: string };

    // NEW (optional — populated when plSubgroup data is available):
    structured?: {
        netSales: number;
        costOfSales: number;
        grossProfit: number;
        operatingExpenses: number;
        operatingProfit: number;
        otherRevenue: number;
        otherExpenses: number;
        // Breakdowns
        salesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
        cogsByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
        opexByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
        otherRevenueByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
        otherExpensesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
        unclassifiedRevenueByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
        unclassifiedExpensesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
    };
}
```

In `execute()`, after computing `revenueMap` and `expenseMap`, group by `plSubgroup`:

- `SALES` accounts → `structured.netSales`
- `COST_OF_SALES` accounts → `structured.costOfSales`
- `OPERATING_EXPENSES` accounts → `structured.operatingExpenses`
- `OTHER_REVENUE` accounts → `structured.otherRevenue`
- `OTHER_EXPENSES` accounts → `structured.otherExpenses`
- `null` plSubgroup → `unclassifiedRevenue` / `unclassifiedExpenses`
- `grossProfit = netSales - costOfSales`
- `operatingProfit = grossProfit - operatingExpenses`
- Verify: `netProfit == operatingProfit + otherRevenue - otherExpenses + unclassifiedRevenue - unclassifiedExpenses`

Only populate `structured` if at least one account has a non-null `plSubgroup`.

---

### Part E: Create Trading Account Use Case (Standalone)

**File:** `backend/src/application/reporting/use-cases/GetTradingAccountUseCase.ts` [NEW]

```typescript
export interface TradingAccountOutput {
    netSales: number;
    costOfSales: number;
    grossProfit: number;
    grossProfitMargin: number;  // percentage
    salesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
    cogsByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
    period: { from: string; to: string };
    hasData: boolean;  // false if no SALES/COGS accounts tagged
}
```

Logic: same TB-delta pattern as P&L. Filter accounts by `plSubgroup === 'SALES'` and `plSubgroup === 'COST_OF_SALES'`.

If no tagged accounts exist → return `hasData: false` with zero values and empty arrays.

**File:** `backend/src/api/controllers/accounting/ReportingController.ts`

Add `tradingAccount` static method (same pattern as `profitAndLoss`).

**File:** `backend/src/api/routes/tenant.accounting.routes.ts`

Add route: `GET /reports/trading-account?from=...&to=...`

**Permission:** `accounting.reports.tradingAccount.view`

**File:** `backend/src/config/PermissionCatalog.ts`

Add: `{ id: 'accounting.reports.tradingAccount.view', label: 'View Trading Account' }`

---

## Files Changed Summary

| File | Part |
|------|------|
| `backend/src/domain/accounting/entities/Account.ts` | A1 |
| `backend/src/domain/accounting/models/Account.ts` | A2 |
| `backend/src/repository/interfaces/accounting/IAccountRepository.ts` | A2 |
| `backend/src/application/accounting/use-cases/accounts/CreateAccountUseCase.ts` | A2 |
| `backend/src/application/accounting/use-cases/accounts/UpdateAccountUseCase.ts` | A2 |
| `backend/src/api/dtos/AccountingDTOs.ts` | A2 |
| `backend/src/infrastructure/firestore/repositories/accounting/FirestoreAccountRepository.ts` | A2 |
| `frontend/src/api/accounting/index.ts` | A3 |
| `frontend/src/modules/accounting/components/AccountForm.tsx` | A4 |
| `backend/src/application/accounting/templates/COATemplates.ts` | B |
| `backend/src/application/accounting/templates/IndustryCOATemplates.ts` | B |
| `backend/src/application/accounting/use-cases/LedgerUseCases.ts` | C |
| `backend/src/application/reporting/use-cases/GetProfitAndLossUseCase.ts` | D |
| `backend/src/application/reporting/use-cases/GetTradingAccountUseCase.ts` | E [NEW] |
| `backend/src/api/controllers/accounting/ReportingController.ts` | E |
| `backend/src/api/routes/tenant.accounting.routes.ts` | E |
| `backend/src/config/PermissionCatalog.ts` | E |

---

## Verification Plan

### Automated Tests

1. **Existing Account tests (must still pass):**
   ```bash
   cd backend && npx jest --testPathPatterns="Account.test|AccountUseCases" --no-coverage
   ```

2. **Existing Balance Sheet tests (must still pass):**
   ```bash
   cd backend && npx jest --testPathPatterns="GetBalanceSheet" --no-coverage
   ```

3. **Existing P&L tests (must still pass):**
   ```bash
   cd backend && npx jest --testPathPatterns="GetProfitAndLossUseCase" --no-coverage
   ```

4. **Backend TypeScript compilation:**
   ```bash
   cd backend && npx tsc --noEmit
   ```

5. **Frontend TypeScript compilation:**
   ```bash
   cd frontend && npx tsc --noEmit
   ```

### Manual Verification (for user)

1. Open app → Chart of Accounts → Edit an Equity account
   - Verify "Equity Subgroup" dropdown appears with: None, Retained Earnings, Contributed Capital, Reserves
   - Set "Retained Earnings" → Save → Reopen → Confirm persisted
2. Verify dropdown disappears when classification is not EQUITY

---

## Acceptance Criteria

### Part A — equitySubgroup
- [ ] `EquitySubgroup` type: `'RETAINED_EARNINGS' | 'CONTRIBUTED_CAPITAL' | 'RESERVES'`
- [ ] Full entity lifecycle: AccountProps, constructor, toJSON, fromJSON, getMutableFields, validate
- [ ] Frontend: type, Account/NewAccountInput/UpdateAccountInput, AccountForm dropdown (EQUITY only)
- [ ] Validation: only valid for EQUITY classification

### Part B — Template Tagging
- [ ] StandardCOA equity accounts tagged with `equitySubgroup`
- [ ] SimplifiedCOA equity accounts tagged with `equitySubgroup`
- [ ] IndustryCOATemplates equity accounts tagged with `equitySubgroup`

### Part C — Balance Sheet Fix
- [ ] `isRetainedEarningsAccount` checks `equitySubgroup === 'RETAINED_EARNINGS'` first
- [ ] Name-hint fallback retained for backward compat
- [ ] Existing BS tests pass

### Part D — Enhanced P&L
- [ ] `ProfitAndLossOutput.structured` field added (optional)
- [ ] Populated when any account has non-null `plSubgroup`
- [ ] `grossProfit = netSales - costOfSales`
- [ ] `operatingProfit = grossProfit - operatingExpenses`
- [ ] `netProfit` matches existing flat calculation
- [ ] Existing P&L tests pass

### Part E — Trading Account
- [ ] New `GetTradingAccountUseCase` with `TradingAccountOutput`
- [ ] New route: `GET /reports/trading-account`
- [ ] Permission `accounting.reports.tradingAccount.view` in catalog
- [ ] Returns `hasData: false` when no SALES/COGS accounts tagged
- [ ] Ledger-based TB-delta calculation

### Compilation & Tests
- [ ] `cd backend && npx tsc --noEmit` passes
- [ ] `cd frontend && npx tsc --noEmit` passes
- [ ] All referenced tests pass
- [ ] Completion report at `1-TODO/done/36-completion-report.md`
