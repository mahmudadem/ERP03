# 10 — Budget Module

> **Priority:** P2 (Medium)
> **Estimated Effort:** 5–7 days
> **Dependencies:** Fiscal Year Management [03], Cost Center [04] (optional)

---

## Business Context

Budgeting allows businesses to **plan** their financial activities and **compare** actual performance against the plan. Key use cases:
- Set annual/monthly revenue and expense targets
- Track budget vs. actual variance in real-time
- Alert when spending exceeds budget thresholds
- Report on budget utilization percentage
- Budget by cost center for departmental control

---

## Current State

- ❌ No budget entity or data model
- ❌ No budget API
- ❌ No budget UI
- ❌ No budget vs. actual reporting

---

## Requirements

### Functional
1. **Define budgets** per account per fiscal year (with monthly breakdown)
2. **Budget entry methods**: Annual (auto-distribute monthly), Monthly (manual per month), Quarterly
3. **Budget vs. Actual** report showing variance and utilization %
4. **Budget alerts** when actual exceeds budget threshold (e.g., 80%, 100%)
5. **Budget by cost center** (if cost centers are enabled)
6. **Budget versions** — ability to create revised budgets while keeping original
7. **Budget import** — upload budget from Excel CSV

### Non-Functional
- Budget is a planning tool — it does not block posting (only alerts)
- Budgets should be linked to fiscal years

---

## Data Model

```typescript
interface Budget {
  id: string;
  companyId: string;
  fiscalYearId: string;
  name: string;           // "FY2026 Budget" or "FY2026 Revised"
  version: number;
  status: 'DRAFT' | 'APPROVED' | 'CLOSED';
  lines: BudgetLine[];
  createdAt: Date;
  createdBy: string;
}

interface BudgetLine {
  accountId: string;
  costCenterId?: string;
  monthlyAmounts: number[];  // Array of 12 monthly values
  annualTotal: number;
}
```

---

## Implementation Plan

### Step 1: Domain Entity + Repository
- Create `Budget.ts` entity with validation
- Create repository interface + Firestore implementation

### Step 2: Use Cases
```
CreateBudgetUseCase
UpdateBudgetUseCase
ApproveBudgetUseCase
GetBudgetVsActualUseCase  — compares budget lines to actual ledger data
```

### Step 3: API Endpoints
```
GET    /accounting/budgets             — List budgets
POST   /accounting/budgets             — Create budget
PUT    /accounting/budgets/:id         — Update budget
POST   /accounting/budgets/:id/approve — Approve budget
GET    /accounting/reports/budget-vs-actual — Budget vs Actual report
```

### Step 4: Frontend — Budget Management Page
- Budget list (by fiscal year)
- Budget editor: spreadsheet-like grid (accounts × months)
- Annual total auto-computed
- Import from CSV

### Step 5: Frontend — Budget vs Actual Report Page
- Table: Account | Budget | Actual | Variance | Variance %
- Color coding: green (under budget), red (over budget)
- Monthly breakdown toggle
- Cost center filter (if available)

---

## Acceptance Criteria

- [ ] Budget CRUD works (create, edit, approve, close)
- [ ] Monthly breakdown with annual totals
- [ ] Budget vs. Actual report shows correct variance
- [ ] Variance % computed correctly
- [ ] Color-coded over/under budget indicators
- [ ] Budget can be linked to fiscal year
- [ ] CSV import for bulk budget entry
