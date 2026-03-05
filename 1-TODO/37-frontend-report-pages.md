# 37 — Frontend Report Pages: Trading Account + Enhanced P&L

> **Priority:** P1
> **Estimated Effort:** 1 day
> **Dependencies:** Plan 36 (Trading Account use case + Enhanced P&L structured output) must be complete
> **Scope:** Frontend pages + API client methods + route registration

---

## Business Context

Plan 36 added two backend capabilities with no frontend yet:
1. `GET /reports/trading-account` → Trading Account (Gross Profit) report
2. `GET /reports/profit-loss` → now returns optional `structured` data with subgroup breakdown

Both need frontend pages using the existing **ReportContainer pattern** (same as P&L, BS, CF pages).

---

## Current State

- ✅ Backend Trading Account API ready (`GET /reports/trading-account`)
- ✅ Backend P&L returns `structured` object when `plSubgroup` data exists
- ✅ `ReportContainer` component at `frontend/src/components/reports/ReportContainer.tsx`
- ✅ P&L page at `frontend/src/modules/accounting/pages/ProfitAndLossPage.tsx` (275 lines) — use as model
- ✅ Route config at `frontend/src/router/routes.config.ts` (lazy imports + route objects)
- ❌ No `getTradingAccount` method in `frontend/src/api/accountingApi.ts`
- ❌ No `TradingAccountPage.tsx`
- ❌ P&L page doesn't render `structured` data (only flat revenue/expenses)

---

## Implementation Plan

### Step 1: Add `getTradingAccount` API method

**File:** `frontend/src/api/accountingApi.ts`

After `getProfitAndLoss` (line 373), add:

```typescript
getTradingAccount: (fromDate: string, toDate: string): Promise<any> => {
    const params = new URLSearchParams();
    params.append('from', fromDate);
    params.append('to', toDate);
    return client.get(`/tenant/accounting/reports/trading-account?${params.toString()}`);
},
```

---

### Step 2: Create `TradingAccountPage.tsx` (follow P&L page pattern exactly)

**File:** `frontend/src/modules/accounting/pages/TradingAccountPage.tsx` [NEW]

Follow the same structure as `ProfitAndLossPage.tsx`:

#### 2a. `TradingAccountParams` interface
```typescript
interface TradingAccountParams {
    fromDate: string;
    toDate: string;
}
```

#### 2b. `TradingAccountData` interface (matches backend `TradingAccountOutput`)
```typescript
interface TradingAccountData {
    netSales: number;
    costOfSales: number;
    grossProfit: number;
    grossProfitMargin: number;
    salesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
    cogsByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
    period: { from: string; to: string };
    hasData: boolean;
}
```

#### 2c. `TradingAccountInitiator` component
Same as `ProfitAndLossInitiator` — date range form with `fromDate`/`toDate` DatePickers and Submit button. Can be copied and renamed.

#### 2d. `TradingAccountReportContent` component

Fetches data via `accountingApi.getTradingAccount(params.fromDate, params.toDate)`.

Layout (when `hasData === true`):

```
┌───────────────────────────────────────────────────┐
│  Summary Cards (4-col grid)                       │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐│
│  │ Net Sales    │ │ Cost of     │ │ Gross        ││
│  │ ₹ 500,000   │ │ Sales       │ │ Profit       ││
│  │ emerald-700  │ │ ₹ 300,000   │ │ ₹ 200,000    ││
│  │              │ │ rose-700    │ │ blue-700     ││
│  └─────────────┘ └─────────────┘ └──────────────┘│
│  ┌──────────────┐                                 │
│  │ GP Margin    │                                 │
│  │ 40.00%       │                                 │
│  │ slate-900    │                                 │
│  └──────────────┘                                 │
├───────────────────────────────────────────────────┤
│  Breakdown Cards (2-col grid)                     │
│  ┌───────────────────┐ ┌────────────────────────┐ │
│  │ Sales Breakdown   │ │ Cost of Sales          │ │
│  │ BreakdownCard     │ │ Breakdown              │ │
│  │ (salesByAccount)  │ │ BreakdownCard          │ │
│  │                   │ │ (cogsByAccount)        │ │
│  └───────────────────┘ └────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

When `hasData === false`:

```
┌───────────────────────────────────────────────────┐
│  ⚠️ No Sales or COGS accounts configured.        │
│  Assign P&L Subgroups in Chart of Accounts to     │
│  enable this report.                              │
└───────────────────────────────────────────────────┘
```

Use the same `BreakdownCard` component from P&L (extract to shared or duplicate — the component is small enough at ~30 lines to duplicate).

#### 2e. `TradingAccountPage` wrapper
Same pattern:
```typescript
const TradingAccountPage: React.FC = () => {
    return (
        <ReportContainer<TradingAccountParams>
            title="Trading Account (Gross Profit)"
            subtitle="Revenue vs Direct Costs"
            initiator={TradingAccountInitiator}
            ReportContent={TradingAccountReportContent}
            onExportExcel={handleExportExcel}
            config={{ paginated: false }}
        />
    );
};
```

#### 2f. `handleExportExcel`
Same pattern as P&L: fetch data, build rows (Sales section + COGS section + Gross Profit line), call `exportToExcel`.

---

### Step 3: Enhance P&L page to show structured breakdown

**File:** `frontend/src/modules/accounting/pages/ProfitAndLossPage.tsx`

#### 3a. Update `ProfitAndLossData` interface to include optional `structured`:
```typescript
interface ProfitAndLossData {
    // existing fields...
    structured?: {
        netSales: number;
        costOfSales: number;
        grossProfit: number;
        operatingExpenses: number;
        operatingProfit: number;
        otherRevenue: number;
        otherExpenses: number;
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

#### 3b. In `ProfitAndLossReportContent`, add a togglable "Detailed View" 

When `data.structured` exists, show a toggle button:
- **Summary view** (default) = current flat layout (unchanged)
- **Detailed view** = structured income statement with subtotals:

```
Net Sales                    ₹ 500,000
  (account breakdown)
Cost of Sales               (₹ 300,000)
  (account breakdown)
─────────────────────────────────────
Gross Profit                  ₹ 200,000

Operating Expenses           (₹ 100,000)
  (account breakdown)
─────────────────────────────────────
Operating Profit              ₹ 100,000

Other Revenue                  ₹ 10,000
Other Expenses                (₹ 5,000)
─────────────────────────────────────
Net Profit                    ₹ 105,000
```

This should be a clean structured table/card layout using the same `BreakdownCard` pattern with subtotal lines between sections.

When `data.structured` does NOT exist (no accounts have `plSubgroup`), the detailed view toggle is hidden and the page looks the same as before.

#### 3c. Update summary cards
When structured data is available, show 5 summary cards instead of 4:
- Net Sales (from `structured.netSales`)
- COGS (from `structured.costOfSales`)
- Gross Profit (from `structured.grossProfit`)
- Operating Profit (from `structured.operatingProfit`)
- Net Profit (existing)

When no structured data, keep existing 4 cards.

#### 3d. Update `handleExportExcel`
When structured data exists, export includes subgroup sections with subtotals.

---

### Step 4: Register route

**File:** `frontend/src/router/routes.config.ts`

Add lazy import:
```typescript
const TradingAccountPage = lazy(() => import('../modules/accounting/pages/TradingAccountPage'));
```

Add route (after P&L route at line 128):
```typescript
{ path: '/accounting/reports/trading-account', label: 'Trading Account', component: TradingAccountPage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.tradingAccount.view', requiredModule: 'accounting' },
```

---

### Step 5: Add to sidebar/navigation

Check the sidebar/navigation config and add "Trading Account" under the Reports section, near P&L. Search for where "Profit & Loss" is listed in the navigation menu and add "Trading Account" below it.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `frontend/src/api/accountingApi.ts` | Add `getTradingAccount` method |
| `frontend/src/modules/accounting/pages/TradingAccountPage.tsx` | [NEW] Trading Account page |
| `frontend/src/modules/accounting/pages/ProfitAndLossPage.tsx` | Add structured view toggle + detailed layout |
| `frontend/src/router/routes.config.ts` | Add lazy import + route |
| Sidebar/nav config file | Add "Trading Account" menu item |

---

## Verification Plan

### Automated Tests

1. **Frontend TypeScript compilation:**
   ```bash
   cd frontend && npx tsc --noEmit
   ```

2. **Backend TypeScript compilation (guard against regressions):**
   ```bash
   cd backend && npx tsc --noEmit
   ```

### Manual Verification (for user)

1. Navigate to `/accounting/reports/trading-account`
   - Verify the page loads with date range form
   - If no accounts have `plSubgroup` tagged → should show "No Sales or COGS accounts" message
   - If accounts are tagged → should show summary cards and breakdown tables
2. Navigate to `/accounting/reports/profit-loss`
   - Generate report
   - If no structured data → page should look identical to before (no toggle visible)
   - If structured data available → "Detailed View" toggle should appear
   - Click toggle → verify structured layout with Gross Profit, Operating Profit subtotals
   - Verify Net Profit in detailed view matches Net Profit in summary view
3. Verify Trading Account appears in sidebar/navigation under Reports

---

## Acceptance Criteria

- [ ] `accountingApi.getTradingAccount(from, to)` method exists and calls correct endpoint
- [ ] `TradingAccountPage.tsx` uses `ReportContainer` pattern
- [ ] Trading Account shows summary cards (Net Sales, COGS, Gross Profit, GP Margin)
- [ ] Trading Account shows `BreakdownCard`s for Sales and COGS accounts
- [ ] Trading Account shows "no data" message when `hasData === false`
- [ ] Trading Account Excel export works
- [ ] P&L page shows existing flat view by default (backward compatible)
- [ ] P&L page shows "Detailed View" toggle when `structured` data exists
- [ ] P&L detailed view shows Gross Profit → Operating Profit → Net Profit structure
- [ ] Route registered at `/accounting/reports/trading-account`
- [ ] Trading Account in sidebar navigation
- [ ] `cd frontend && npx tsc --noEmit` passes
- [ ] `cd backend && npx tsc --noEmit` passes
- [ ] Completion report at `1-TODO/done/37-completion-report.md`
