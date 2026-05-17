# 06 — Cash Flow Statement

> **Priority:** P1 (High)
> **Estimated Effort:** 3–4 days
> **Dependencies:** Balance Sheet Report [01] (recommended but not required)

---

## Business Context

The Cash Flow Statement is the **third mandatory financial statement** alongside the Balance Sheet and P&L. It shows how cash moves in and out of the business, categorized into:
- **Operating Activities** — day-to-day business (sales, expenses, wages)
- **Investing Activities** — buying/selling long-term assets
- **Financing Activities** — loans, equity contributions, dividends

There are two methods:
1. **Direct Method** — list actual cash receipts and payments (preferred by IFRS, harder to produce)
2. **Indirect Method** — start with net income, adjust for non-cash items and working capital changes (most common)

**Recommendation:** Implement the **Indirect Method** first (most commonly used, can be derived from existing data without additional tagging).

---

## Current State

- ✅ P&L report gives net income
- ✅ Trial balance gives account balances by classification
- ✅ Account entity has classification (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)
- ❌ No cash flow computation logic
- ❌ No cash flow page
- ❌ No account tagging for cash flow categories (Operating/Investing/Financing)

---

## Requirements

### Functional
1. Generate Cash Flow Statement using the indirect method
2. Three sections: Operating, Investing, Financing
3. Start with Net Income (from P&L)
4. Adjust for non-cash items (depreciation, etc.) — based on account classification or tag
5. Show changes in working capital (AR, AP, inventory changes)
6. Date range filter (period comparison)
7. Print-friendly layout
8. Configuration: ability to tag accounts as Operating/Investing/Financing (account metadata)

### Non-Functional
- Derive from existing ledger data (no new data entry required)
- Use account classification heuristics for initial setup

---

## Implementation Plan

### Step 1: Add Cash Flow Category to Account Entity

**File:** `backend/src/domain/accounting/entities/Account.ts` (MODIFY)

Add optional field to `AccountProps`:
```typescript
cashFlowCategory?: 'OPERATING' | 'INVESTING' | 'FINANCING' | null;
```

This allows users to tag accounts for proper cash flow categorization. Use sensible defaults based on account classification and role:
- REVENUE/EXPENSE accounts → OPERATING
- Fixed Asset accounts → INVESTING
- Loan/Equity accounts → FINANCING

### Step 2: Backend — Cash Flow Use Case

**File:** `backend/src/application/accounting/use-cases/CashFlowUseCases.ts` (NEW)

```typescript
export class GetCashFlowStatementUseCase {
  async execute(companyId: string, userId: string, fromDate: string, toDate: string): Promise<CashFlowData> {
    // 1. Get P&L for the period → net income
    // 2. Get balance changes for each account between fromDate and toDate
    // 3. Categorize changes:
    //    - Operating: current assets changes, current liabilities changes, depreciation add-backs
    //    - Investing: fixed asset changes
    //    - Financing: loan changes, equity changes
    // 4. Compute net change in cash
    // 5. Get opening cash balance + closing cash balance
    // 6. Verify: opening + net change = closing
  }
}
```

Return type:
```typescript
interface CashFlowData {
  period: { from: string; to: string };
  baseCurrency: string;
  netIncome: number;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netCashChange: number;
  openingCashBalance: number;
  closingCashBalance: number;
}

interface CashFlowSection {
  items: { name: string; amount: number; accountId?: string }[];
  total: number;
}
```

### Step 3: API Endpoint

**File:** `backend/src/api/routes/accounting.routes.ts` (MODIFY)

```typescript
router.get('/reports/cash-flow', permissionGuard('accounting.reports.cashFlow.view'), AccountingReportsController.getCashFlow);
```

### Step 4: Frontend Page

**File:** `frontend/src/modules/accounting/pages/CashFlowPage.tsx` (NEW)

Layout:
```
Cash Flow Statement
Period: [From Date] — [To Date]

NET INCOME                                          $XX,XXX

OPERATING ACTIVITIES
  Depreciation & Amortization                        X,XXX
  Decrease (Increase) in Accounts Receivable        (X,XXX)
  Increase (Decrease) in Accounts Payable            X,XXX
  Net Cash from Operating Activities               ─────────
                                                    $XX,XXX

INVESTING ACTIVITIES
  Purchase of Equipment                             (X,XXX)
  Net Cash from Investing Activities               ─────────
                                                   ($X,XXX)

FINANCING ACTIVITIES
  Proceeds from Bank Loan                            X,XXX
  Net Cash from Financing Activities               ─────────
                                                    $X,XXX

NET CHANGE IN CASH                                  $XX,XXX
Opening Cash Balance                                $XX,XXX
Closing Cash Balance                                $XX,XXX
```

### Step 5: Add Route + Navigation

Add to routing config and reports navigation menu.

---

## Verification Plan

### Manual
1. Create test data: several vouchers with different account types (revenue, expense, bank, AR, AP, fixed assets, loans)
2. Navigate to Cash Flow Statement
3. Set a date range that includes the test vouchers
4. Verify Net Income matches the P&L report for the same period
5. Verify Operating section includes working capital changes
6. Verify Net Change in Cash = Closing - Opening cash balance
7. Print → verify clean layout

---

## Acceptance Criteria

- [ ] Cash Flow Statement page renders with three sections
- [ ] Net Income correctly pulled from P&L
- [ ] Account changes categorized into Operating/Investing/Financing
- [ ] Net cash change reconciles to cash balance movement
- [ ] Date range filter works
- [ ] Print layout is professional
