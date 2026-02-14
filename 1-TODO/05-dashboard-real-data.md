# 05 — Dashboard with Real Data

> **Priority:** P1 (High)
> **Estimated Effort:** 2–3 days
> **Dependencies:** None (uses existing APIs)
> **Source:** Gap analysis — hardcoded placeholder data

---

## Business Context

The accounting dashboard is the **first screen users see**. Currently it shows hardcoded numbers ("1,248 Total Vouchers", "$459.2k Cash On Hand") and a "coming soon" placeholder for recent journal entries. This **destroys trust** — users immediately sense fake data. A dashboard with real, live data creates confidence in the system.

---

## Current State

- ✅ `AccountingDashboard.tsx` exists with layout structure
- ✅ `PendingApprovalsWidget` fetches real data (API exists)
- ❌ "Total Vouchers" card shows hardcoded `1,248`
- ❌ "Cash On Hand" card shows hardcoded `$459.2k`
- ❌ "Recent Journal Entries" section shows "coming soon" placeholder
- ❌ No "Financial Reports" links actually navigate anywhere
- ❌ No overview of fiscal status (open/closed periods)
- ❌ No unbalanced vouchers alert

---

## Requirements

### Functional
1. **Total Vouchers card** — Query real count from voucher list API (current month + % change)
2. **Cash Position card** — Sum balances of accounts classified as ASSET with role CASH/BANK
3. **Recent Journal Entries** — Show the last 10 posted vouchers with date, type, amount, status
4. **Quick Stats row** — Draft count, Pending Approval count, Posted this month count
5. **Financial Reports** links — Navigate to real report pages
6. **Unbalanced Vouchers alert** — Red warning if any draft vouchers are unbalanced
7. **Period Status** — Show current fiscal period status (if fiscal year management exists)

### Non-Functional
- Dashboard data should load in under 2 seconds
- Auto-refresh every 60 seconds (or on tab focus)
- Graceful loading states (skeletons, not spinners)

---

## Implementation Plan

### Step 1: Backend — Dashboard Summary API

**File:** `backend/src/api/controllers/accounting/AccountingReportsController.ts` (MODIFY)

Add `getDashboardSummary` static method:
```typescript
static async getDashboardSummary(req: Request, res: Response, next: NextFunction) {
  const companyId = (req as any).companyId;
  const userId = (req as any).user.uid;
  
  // Parallel queries for speed
  const [vouchers, trialBalance, recentVouchers] = await Promise.all([
    voucherRepo.getVoucherCounts(companyId),      // { total, draft, pending, postedThisMonth }
    ledgerRepo.getTrialBalance(companyId, today),  // For cash position
    voucherRepo.getRecent(companyId, 10)           // Last 10 vouchers
  ]);
  
  // Extract cash position from trial balance (accounts with role CASH or BANK)
  const cashAccounts = ...; // filter by account role
  const cashPosition = cashAccounts.reduce((sum, a) => sum + a.netBalance, 0);
  
  res.json({ vouchers, cashPosition, recentVouchers, baseCurrency });
}
```

**File:** `backend/src/api/routes/accounting.routes.ts` (MODIFY)

```typescript
router.get('/reports/dashboard-summary', permissionGuard('accounting.vouchers.view'), AccountingReportsController.getDashboardSummary);
```

### Step 2: Backend — Repository Methods

**File:** Voucher repository interface + implementation

Add methods:
```typescript
getVoucherCounts(companyId: string): Promise<{
  total: number;
  draft: number;
  pending: number;
  postedThisMonth: number;
  lastMonthTotal: number;  // For % change calculation
}>;

getRecent(companyId: string, limit: number): Promise<VoucherSummary[]>;
```

### Step 3: Frontend — API Function

**File:** `frontend/src/api/accountingApi.ts` (MODIFY)

```typescript
getDashboardSummary(): Promise<DashboardSummary>;
```

### Step 4: Frontend — Refactor Dashboard

**File:** `frontend/src/modules/accounting/AccountingDashboard.tsx` (MODIFY — major rewrite)

Replace hardcoded data with real API calls:

```tsx
const AccountingDashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    accountingApi.getDashboardSummary().then(setSummary).finally(() => setLoading(false));
  }, []);
  
  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      accountingApi.getDashboardSummary().then(setSummary);
    }, 60000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    // ... cards backed by real summary data
    // Total Vouchers: summary.vouchers.total
    // Cash Position: summary.cashPosition
    // Recent entries: summary.recentVouchers
  );
};
```

Key UI improvements:
- Skeleton loading states for each card
- Percentage change badges (green up / red down)
- Recent entries as a compact table with clickable voucher numbers
- Quick action buttons: "New Voucher", "View Ledger", "View Reports"
- Financial Reports section with real navigation links

---

## Verification Plan

### Manual
1. Open the dashboard with test data in the system
2. Verify Total Vouchers matches the count on the vouchers list page
3. Verify Cash Position reflects the sum of cash/bank accounts in the trial balance
4. Verify Recent Entries shows the actual last 10 vouchers
5. Click a recent entry → verify it navigates to the voucher
6. Wait 60 seconds → verify data refreshes (or add a manual refresh button and test)
7. Test with an empty company (no vouchers) → verify graceful empty states

---

## Acceptance Criteria

- [ ] All dashboard cards show real, live data from the API
- [ ] Zero hardcoded values remain
- [ ] Recent journal entries section shows actual recent vouchers
- [ ] Loading states (skeletons) display while data loads
- [ ] Financial Reports links navigate to real report pages
- [ ] Dashboard loads in under 2 seconds
- [ ] Works correctly with empty company (no data)
