# 02 — Account Statement Report

> **Priority:** P0 (Critical)
> **Estimated Effort:** 2 days
> **Dependencies:** None

---

## Business Context

An Account Statement is the **most frequently used report by accountants**. It shows all transactions for a single account in chronological order with a **running balance**. This is how you:
- Check a customer's outstanding balance
- Verify your bank account matches the bank statement
- Trace a vendor's payment history
- Debug why an account balance looks wrong

Currently, the General Ledger report shows transactions but does **not** compute a running balance per account.

---

## Current State

- ✅ General Ledger report exists (`GeneralLedgerPage.tsx`) with account filtering
- ✅ `ILedgerRepository.getGeneralLedger()` returns entries with account filtering
- ✅ Account selector component exists and works
- ❌ No running balance computation
- ❌ No opening balance row
- ❌ No dedicated account statement page/view
- ❌ General Ledger groups by account headers but doesn't show per-line cumulative balance

---

## Requirements

### Functional
1. Select a single account (required)
2. Date range filter (from–to)
3. Opening balance row (sum of all entries before the "from" date)
4. Each row shows: Date, Voucher No, Description, Debit, Credit, Running Balance
5. Closing balance shown at the bottom
6. Supporting currency columns for foreign currency accounts
7. Print-friendly layout
8. Link voucher numbers to open the voucher detail

### Non-Functional
- Must handle large accounts (1000+ entries) efficiently
- Running balance computed server-side for accuracy
- Consistent with existing report styling

---

## Implementation Plan

### Step 1: Backend — Add Account Statement Query to Repository

**File:** `backend/src/repository/interfaces/accounting/ILedgerRepository.ts`

Add interface method:
```typescript
getAccountStatement(
  companyId: string,
  accountId: string,
  fromDate: string,
  toDate: string
): Promise<AccountStatementData>;
```

Add return types:
```typescript
interface AccountStatementData {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountCurrency: string;
  baseCurrency: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  entries: AccountStatementEntry[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
}

interface AccountStatementEntry {
  id: string;
  date: string;
  voucherId: string;
  voucherNo: string;
  description: string;
  debit: number;
  credit: number;
  balance: number; // Running balance (computed server-side)
  currency?: string;
  fxAmount?: number;
  exchangeRate?: number;
}
```

**File:** `backend/src/infrastructure/firestore/repositories/accounting/FirestoreLedgerRepository.ts`

Implement the method:
1. Query ledger entries for `accountId` where `date < fromDate` → sum to get `openingBalance`
2. Query ledger entries for `accountId` where `fromDate <= date <= toDate`, ordered by date
3. Compute running balance: start from `openingBalance`, add debit, subtract credit for each row
4. Return structured response

### Step 2: Backend — Add Use Case

**File:** `backend/src/application/accounting/use-cases/LedgerUseCases.ts`

```typescript
export class GetAccountStatementUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, accountId: string, fromDate: string, toDate: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
    return this.ledgerRepo.getAccountStatement(companyId, accountId, fromDate, toDate);
  }
}
```

### Step 3: Backend — Add API Endpoint

**File:** `backend/src/api/controllers/accounting/AccountingReportsController.ts`

Add `getAccountStatement` static method:
```typescript
static async getAccountStatement(req: Request, res: Response, next: NextFunction) {
  const companyId = (req as any).companyId;
  const userId = (req as any).user.uid;
  const { accountId, fromDate, toDate } = req.query;
  
  if (!accountId) return res.status(400).json({ error: 'accountId is required' });
  
  const useCase = new GetAccountStatementUseCase(diContainer.ledgerRepository, permissionChecker);
  const result = await useCase.execute(companyId, userId, accountId as string, fromDate as string, toDate as string);
  res.json(result);
}
```

**File:** `backend/src/api/routes/accounting.routes.ts`

Add route:
```typescript
router.get('/reports/account-statement', permissionGuard('accounting.reports.generalLedger.view'), AccountingReportsController.getAccountStatement);
```

### Step 4: Frontend — Add API Function

**File:** `frontend/src/api/accountingApi.ts`

```typescript
export interface AccountStatementData { /* ... as defined above */ }

getAccountStatement(accountId: string, fromDate?: string, toDate?: string): Promise<AccountStatementData> {
  return client.get('/accounting/reports/account-statement', {
    params: { accountId, fromDate, toDate }
  }).then(r => r.data);
}
```

### Step 5: Frontend — Create Account Statement Page

**File:** `frontend/src/modules/accounting/pages/AccountStatementPage.tsx` (NEW)

Layout:
```
┌─────────────────────────────────────────────────────┐
│ Account Statement                                    │
│ [Account Selector ▼] [From Date] [To Date] [Load]   │
├─────────────────────────────────────────────────────┤
│ Account: 1101 - Cash in Bank (USD)                   │
│ Period: 2026-01-01 to 2026-02-10                     │
├──────┬───────────┬────────────┬────────┬────────┬────┤
│ Date │ Voucher   │ Description│ Debit  │ Credit │Bal │
├──────┼───────────┼────────────┼────────┼────────┼────┤
│      │           │ Opening Bal│        │        │ XX │
│ 01/05│ JE-001    │ Sale inv   │ 500.00 │        │ XX │
│ 01/08│ PV-003    │ Rent pay   │        │ 200.00 │ XX │
│ ...  │ ...       │ ...        │ ...    │ ...    │ ...│
├──────┼───────────┼────────────┼────────┼────────┼────┤
│      │           │ Totals     │ X,XXX  │ X,XXX  │    │
│      │           │ Closing Bal│        │        │ XX │
└──────┴───────────┴────────────┴────────┴────────┴────┘
```

Key behaviors:
- Account selector is the same `AccountSelector` component used in voucher entry
- Voucher number is clickable — opens voucher in modal or window
- Running balance column is right-aligned, monospace
- Opening balance row is styled differently (bold, bg highlight)
- Print button uses `window.print()` with print-specific CSS

### Step 6: Frontend — Add Route

Add to routing config:
```
/accounting/reports/account-statement → AccountStatementPage
```

Add link in sidebar/reports navigation.

---

## Verification Plan

### Automated
1. **Backend unit test** — `backend/src/tests/application/accounting/use-cases/GetAccountStatementUseCase.test.ts`
   - Test opening balance computation
   - Test running balance accuracy across entries
   - Test empty account (no entries)
   - Test date range filtering
   - Command: `cd backend && npx jest --testPathPattern=GetAccountStatementUseCase`

### Manual
1. Navigate to Accounting → Reports → Account Statement
2. Select a known account (e.g., Cash in Bank)
3. Set a date range that includes vouchers
4. Verify opening balance = sum of all entries before start date
5. Verify running balance increments/decrements correctly with each row
6. Click a voucher number → verify it opens the voucher
7. Print → verify layout is clean

---

## Acceptance Criteria

- [ ] Account Statement page loads with account selector and date range
- [ ] Opening balance row computed from pre-period entries
- [ ] Running balance is accurate on every row
- [ ] Closing balance matches last running balance
- [ ] Voucher numbers link to voucher detail
- [ ] Print layout is clean and professional
- [ ] Works for both base currency and foreign currency accounts
