# 38 — Bulk Subgroup Tagging Tool

> **Priority:** P1
> **Estimated Effort:** 0.5 day
> **Dependencies:** Plans 35-36 (`plSubgroup` + `equitySubgroup` fields) must be complete
> **Scope:** Backend batch endpoint + Frontend tagging page + route/nav

---

## Business Context

Companies with existing COAs have all accounts at `plSubgroup = null` / `equitySubgroup = null`. Without this tool, users must edit each account individually to enable Trading Account and structured P&L reports. This tool provides a dedicated page to tag many accounts at once.

---

## Current State

- ✅ `plSubgroup` and `equitySubgroup` fields exist on Account entity (Plans 35-36)
- ✅ `updateAccount` API exists (`PUT /tenant/accounting/accounts/:id`)
- ✅ Frontend `AccountForm.tsx` has individual dropdowns for both fields
- ❌ No batch update endpoint
- ❌ No dedicated bulk tagging UI

---

## Implementation Plan

### Step 1: Backend — Add batch subgroup update endpoint

**File:** `backend/src/api/controllers/accounting/AccountController.ts` (or wherever account routes are handled)

Add a new endpoint that accepts an array of `{ accountId, plSubgroup, equitySubgroup }` updates:

```typescript
// POST /tenant/accounting/accounts/batch-update-subgroups
// Body: { updates: Array<{ accountId: string; plSubgroup?: string | null; equitySubgroup?: string | null }> }
// Returns: { updated: number; errors: Array<{ accountId: string; error: string }> }
```

Implementation: iterate over updates, call existing `updateAccount` use case for each, collect results. Wrap in a try/catch per item so one failure doesn't block others.

**File:** `backend/src/api/routes/accounting.routes.ts`

Add route: `POST /accounts/batch-update-subgroups`

Permission: `accounting.accounts.edit` (same as regular account update — no new permission needed).

---

### Step 2: Frontend — Add API method

**File:** `frontend/src/api/accountingApi.ts`

Add after `updateAccount`:
```typescript
batchUpdateSubgroups: (updates: Array<{ accountId: string; plSubgroup?: string | null; equitySubgroup?: string | null }>): Promise<{ updated: number; errors: Array<{ accountId: string; error: string }> }> => {
    return client.post('/tenant/accounting/accounts/batch-update-subgroups', { updates });
},
```

---

### Step 3: Frontend — Create `SubgroupTaggingPage.tsx`

**File:** `frontend/src/modules/accounting/pages/SubgroupTaggingPage.tsx` [NEW]

#### Layout:

```
┌────────────────────────────────────────────────────────────────┐
│  Subgroup Tagging Tool                                         │
│  Tag your accounts for Trading Account & structured P&L        │
├────────────────────────────────────────────────────────────────┤
│  Filters:  [Classification ▼]  [Current Subgroup ▼]  [Search] │
├────────────────────────────────────────────────────────────────┤
│  ☑ Select All                        Assign: [Subgroup ▼] [Apply]│
├────────────────────────────────────────────────────────────────┤
│  ☐  4000  Revenue Header          classification: REVENUE      │
│  ☑  4001  Domestic Sales           plSubgroup: SALES           │ 
│  ☑  4002  Export Sales             plSubgroup: (none)  ← needs │
│  ☐  4003  Interest Income          plSubgroup: OTHER_REVENUE   │
│  ☑  5001  Purchases                plSubgroup: (none)  ← needs │
│  ☐  5002  Freight In               plSubgroup: COST_OF_SALES   │
│  ☐  301   Owner Capital            equitySubgroup: CONTRIBUTED │
│  ☐  302   Retained Earnings        equitySubgroup: RETAINED    │
├────────────────────────────────────────────────────────────────┤
│  Selected: 3 accounts          [Save Changes]                  │
└────────────────────────────────────────────────────────────────┘
```

#### Features:

1. **Load all accounts** via `accountingApi.getAccounts()` (or `accountingApi` from `accounting/index.ts`)
2. **Filter controls:**
   - Classification dropdown: All / Revenue / Expense / Equity (Asset/Liability excluded — no subgroups apply)
   - Current subgroup filter: All / Unassigned / Sales / Cost of Sales / etc.
   - Text search: filter by account code or name
3. **Table columns:**
   - Checkbox (for selection)
   - Account Code
   - Account Name
   - Classification
   - Current P&L Subgroup (or Equity Subgroup for equity accounts)
4. **Bulk assign bar** (sticky top or inline):
   - Dropdown showing valid subgroups for the current filter (auto-filter based on selected accounts' classification)
   - "Apply to Selected" button
   - This updates the local state (preview), doesn't save yet
5. **Individual inline edit:**
   - Each row has an inline dropdown for the subgroup (quick single-account change)
6. **Save button:**
   - Collects all modified accounts
   - Shows confirmation: "Update X accounts?"
   - Calls `batchUpdateSubgroups` endpoint
   - Shows success count + any errors
7. **Visual indicators:**
   - Unassigned accounts highlighted with a subtle warning background
   - Modified (pending save) accounts highlighted with a blue background
   - Row count summary: "3 of 45 Revenue accounts tagged as Sales"

#### Key UX Rules:

- When filtering by "Revenue", the bulk assign dropdown shows: Sales, Other Revenue, (Clear)
- When filtering by "Expense", shows: Cost of Sales, Operating Expenses, Other Expenses, (Clear)
- When filtering by "Equity", shows: Retained Earnings, Contributed Capital, Reserves, (Clear)
- "(Clear)" option sets subgroup back to `null`
- POSTING accounts only (HEADER accounts should be taggable too for report grouping, don't filter them out)

---

### Step 4: Route + Navigation

**File:** `frontend/src/router/routes.config.ts`

```typescript
const SubgroupTaggingPage = lazy(() => import('../modules/accounting/pages/SubgroupTaggingPage'));
```

Route:
```typescript
{ path: '/accounting/settings/subgroup-tagging', label: 'Subgroup Tagging', component: SubgroupTaggingPage, section: 'ACCOUNTING', requiredPermission: 'accounting.accounts.edit', requiredModule: 'accounting' },
```

**Sidebar/Nav:** Add under Accounting → Settings or Accounting → Tools (near Chart of Accounts).

---

## Files Changed Summary

| File | Change |
|------|--------|
| `backend/src/api/controllers/accounting/AccountController.ts` | Add `batchUpdateSubgroups` endpoint |
| `backend/src/api/routes/accounting.routes.ts` | Add route |
| `frontend/src/api/accountingApi.ts` | Add `batchUpdateSubgroups` method |
| `frontend/src/modules/accounting/pages/SubgroupTaggingPage.tsx` | [NEW] Bulk tagging UI |
| `frontend/src/router/routes.config.ts` | Add lazy import + route |
| Sidebar/nav config | Add menu item |

---

## Verification Plan

### Automated Tests

1. **Backend TypeScript compilation:**
   ```bash
   cd backend && npx tsc --noEmit
   ```

2. **Frontend TypeScript compilation:**
   ```bash
   cd frontend && npx tsc --noEmit
   ```

3. **Existing Account tests (must not break):**
   ```bash
   cd backend && npx jest --testPathPatterns="Account.test|AccountUseCases" --no-coverage
   ```

### Manual Verification

1. Navigate to `/accounting/settings/subgroup-tagging`
2. Verify accounts load with current subgroup values
3. Filter by "Revenue" → verify only Revenue accounts shown
4. Select several unassigned Revenue accounts → Bulk assign "Sales" → Verify preview (blue highlight)
5. Click "Save Changes" → Verify success message
6. Refresh page → Verify changes persisted
7. Navigate to Trading Account report → Verify newly tagged accounts appear

---

## Acceptance Criteria

- [ ] Backend `POST /accounts/batch-update-subgroups` endpoint works
- [ ] Frontend `batchUpdateSubgroups` API method exists
- [ ] `SubgroupTaggingPage.tsx` renders accounts in a filterable table
- [ ] Classification filter: Revenue / Expense / Equity
- [ ] Subgroup filter: All / Unassigned / specific values
- [ ] Text search by code/name
- [ ] Checkbox multi-select with "Select All"
- [ ] Bulk assign dropdown (context-aware per classification)
- [ ] Inline individual edit per row
- [ ] Modified accounts highlighted before save
- [ ] "Save Changes" calls batch endpoint
- [ ] Success/error feedback shown
- [ ] Route registered + sidebar navigation
- [ ] `cd backend && npx tsc --noEmit` passes
- [ ] `cd frontend && npx tsc --noEmit` passes
- [ ] Existing Account tests pass
- [ ] Completion report at `1-TODO/done/38-completion-report.md`
