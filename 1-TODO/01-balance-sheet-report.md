# 01 — Balance Sheet Report

> **Priority:** P0 (Critical)
> **Estimated Effort:** 2–3 days
> **Dependencies:** None (all prerequisite data already exists)

---

## Business Context

The Balance Sheet (Statement of Financial Position) is the **#1 most important financial statement**. It shows Assets = Liabilities + Equity at a point in time. Every auditor, regulator, bank, and investor asks for this first. Without it, the system cannot be considered a functional accounting system.

---

## Current State

- ✅ COA has `classification` field: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`
- ✅ Ledger entries exist with debit/credit per account
- ✅ Trial Balance already aggregates debits/credits per account
- ✅ `ILedgerRepository` has `getTrialBalance(companyId, asOfDate)` which returns per-account totals
- ❌ No Balance Sheet computation in backend
- ❌ No Balance Sheet page in frontend
- ❌ No Balance Sheet API endpoint

---

## Requirements

### Functional
1. Show Assets, Liabilities, and Equity grouped by classification
2. Display hierarchy (parent/child accounts) with expandable tree
3. Show totals for each classification group
4. Show "Total Assets" vs "Total Liabilities + Equity" with a balanced indicator
5. Support date filtering ("As of date")
6. Print-friendly layout
7. Retained Earnings line: automatically compute as `Revenue – Expenses` for the current fiscal period (since year-end close may not exist yet)

### Non-Functional
- Reuse existing Trial Balance data pipeline
- Consistent styling with existing reports (Trial Balance, General Ledger)

---

## Implementation Plan

### Step 1: Backend — Add Balance Sheet Use Case

**File:** `backend/src/application/accounting/use-cases/LedgerUseCases.ts`

Add a new `GetBalanceSheetUseCase` class:

```typescript
export class GetBalanceSheetUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private accountRepo: IAccountRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, asOfDate: string): Promise<BalanceSheetData> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.balanceSheet.view');
    
    // 1. Get trial balance data (reuse existing)
    const trialBalance = await this.ledgerRepo.getTrialBalance(companyId, asOfDate);
    
    // 2. Get all accounts for classification info
    const accounts = await this.accountRepo.findAll(companyId);
    
    // 3. Group by classification: ASSET, LIABILITY, EQUITY
    // 4. Compute Retained Earnings = sum(REVENUE debits/credits) - sum(EXPENSE debits/credits)
    // 5. Add Retained Earnings to EQUITY group
    // 6. Return structured data
  }
}
```

**Return type to define in a new file or inline:**

```typescript
interface BalanceSheetData {
  asOfDate: string;
  baseCurrency: string;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  retainedEarnings: number;  // P&L net for current period
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

interface BalanceSheetSection {
  accounts: BalanceSheetLine[];
  total: number;
}

interface BalanceSheetLine {
  accountId: string;
  code: string;
  name: string;
  parentId?: string | null;
  level: number;
  balance: number; // Net balance (debit nature: debit-credit, credit nature: credit-debit)
  isParent: boolean;
}
```

### Step 2: Backend — Add API Endpoint

**File:** `backend/src/api/controllers/accounting/AccountingReportsController.ts`

Add `getBalanceSheet` static method:
```typescript
static async getBalanceSheet(req: Request, res: Response, next: NextFunction) {
  const companyId = (req as any).companyId;
  const userId = (req as any).user.uid;
  const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().split('T')[0];
  
  const useCase = new GetBalanceSheetUseCase(
    diContainer.ledgerRepository,
    diContainer.accountRepository,
    permissionChecker
  );
  const result = await useCase.execute(companyId, userId, asOfDate);
  res.json(result);
}
```

**File:** `backend/src/api/routes/accounting.routes.ts`

Add route (near existing report routes ~line 57):
```typescript
router.get('/reports/balance-sheet', permissionGuard('accounting.reports.balanceSheet.view'), AccountingReportsController.getBalanceSheet);
```

**File:** RBAC permission definition — ensure `accounting.reports.balanceSheet.view` permission exists in the permissions seed/definition.

### Step 3: Frontend — Add API function

**File:** `frontend/src/api/accountingApi.ts`

Add type and function:
```typescript
export interface BalanceSheetData {
  asOfDate: string;
  baseCurrency: string;
  assets: { accounts: BalanceSheetLine[]; total: number };
  liabilities: { accounts: BalanceSheetLine[]; total: number };
  equity: { accounts: BalanceSheetLine[]; total: number };
  retainedEarnings: number;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export interface BalanceSheetLine {
  accountId: string;
  code: string;
  name: string;
  parentId?: string | null;
  level: number;
  balance: number;
  isParent: boolean;
}

getBalanceSheet(asOfDate?: string): Promise<BalanceSheetData> {
  const params = asOfDate ? { asOfDate } : {};
  return client.get('/accounting/reports/balance-sheet', { params }).then(r => r.data);
}
```

### Step 4: Frontend — Create Balance Sheet Page

**File:** `frontend/src/modules/accounting/pages/BalanceSheetPage.tsx` (NEW)

Structure:
- Date picker ("As of" date)
- Refresh and Print buttons
- Three sections: Assets | Liabilities | Equity
- Each section shows accounts in a tree with indentation
- Totals row per section
- Footer showing "Total Assets" vs "Total L+E" with balanced indicator
- Use same styling patterns as `TrialBalancePage.tsx`

### Step 5: Frontend — Add Route

**File:** Wherever accounting routes are defined (likely `App.tsx` or a routes config)

Add route: `/accounting/reports/balance-sheet` → `BalanceSheetPage`

Also add to the dashboard's "Financial Reports" section and navigation.

---

## Verification Plan

### Automated
1. **Unit test** — Create `backend/src/tests/application/accounting/use-cases/GetBalanceSheetUseCase.test.ts`
   - Test with accounts of all five classifications
   - Test that Revenue/Expense accounts are excluded from BS but their net appears as Retained Earnings
   - Test isBalanced flag
   - Command: `cd backend && npx jest --testPathPattern=GetBalanceSheetUseCase`

### Manual
1. Open the app → Navigate to Accounting → Reports → Balance Sheet
2. Verify Assets section shows only ASSET-classified accounts
3. Verify Liabilities section shows only LIABILITY-classified accounts
4. Verify Equity section shows EQUITY accounts + a "Retained Earnings" line
5. Verify Total Assets ≈ Total Liabilities + Equity (within rounding)
6. Change the "As of" date and verify numbers change accordingly
7. Click Print and verify layout renders cleanly

---

## Acceptance Criteria

- [ ] Balance Sheet page accessible from the sidebar/reports menu
- [ ] Three sections (Assets, Liabilities, Equity) display correctly
- [ ] Retained Earnings auto-computed from P&L accounts
- [ ] "As of date" filter works
- [ ] Totals show balanced/unbalanced indicator
- [ ] Print/PDF layout is clean
- [ ] Permission `accounting.reports.balanceSheet.view` is enforced
