# 11 — Aging Reports (Accounts Receivable / Payable)

> **Priority:** P2 (Medium)
> **Estimated Effort:** 3 days
> **Dependencies:** Account Statement Report [02] (recommended)

---

## Business Context

Aging reports show **how long invoices/payments have been outstanding**, organized into time buckets (Current, 30, 60, 90, 120+ days). Critical for:
- **AR Aging** — Who owes us money and for how long? Drives collections effort.
- **AP Aging** — What do we owe and which payments are overdue? Manages cash flow.
- **Credit risk assessment** — Identifying slow-paying customers

---

## Current State

- ✅ Ledger entries exist with dates and account IDs
- ✅ Accounts have classification (ASSET for AR, LIABILITY for AP)
- ❌ No aging computation
- ❌ No aging report page
- ❌ No customer/vendor sub-ledger concept (accounts act as sub-ledgers)

---

## Requirements

### Functional
1. **AR Aging Report** — For accounts with role RECEIVABLE or classification ASSET + tagged
2. **AP Aging Report** — For accounts with role PAYABLE or classification LIABILITY + tagged
3. **Aging buckets**: Current, 1-30 days, 31-60 days, 61-90 days, 91-120 days, 120+ days
4. **"As of" date** — Calculate aging relative to a specific date
5. **Summary row** — Total per bucket
6. **Drill-down** — Click an account to see individual outstanding transactions
7. **Export** — Print / CSV

---

## Implementation Plan

### Step 1: Backend — Aging Computation

**File:** `backend/src/application/accounting/use-cases/AgingReportUseCase.ts` (NEW)

Logic:
1. Get all sub-ledger accounts (by role or configuration)
2. For each account, get open (uncleared) transactions as of the "as of" date
3. Compute days outstanding for each transaction
4. Bucket them into aging categories
5. Sum by account and by bucket

```typescript
interface AgingReportData {
  asOfDate: string;
  type: 'AR' | 'AP';
  buckets: string[]; // ['Current', '1-30', '31-60', '61-90', '91-120', '120+']
  accounts: AgingAccountRow[];
  totals: number[]; // Sum per bucket
  grandTotal: number;
}

interface AgingAccountRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  bucketAmounts: number[]; // Amount in each bucket
  total: number;
}
```

### Step 2: API Endpoint
```typescript
router.get('/reports/aging', permissionGuard('accounting.reports.aging.view'), AccountingReportsController.getAgingReport);
```

### Step 3: Frontend — Aging Report Page

**File:** `frontend/src/modules/accounting/pages/AgingReportPage.tsx` (NEW)

- Toggle: AR / AP
- "As of" date picker
- Table with columns: Account | Current | 1-30 | 31-60 | 61-90 | 91-120 | 120+ | Total
- Totals row
- Click account to drill down to individual transactions
- Color gradient: green → yellow → red as aging increases
- Print / export button

---

## Acceptance Criteria

- [ ] AR and AP aging reports generate correctly
- [ ] Aging buckets calculated based on transaction date vs "as of" date
- [ ] Summary totals per bucket are accurate
- [ ] Drill-down shows individual transactions for an account
- [ ] Configurable "as of" date
- [ ] Print layout is clean
