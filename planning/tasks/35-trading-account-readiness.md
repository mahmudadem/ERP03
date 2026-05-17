# 35 — Trading Account Readiness (P&L Subgroup Field)

> **Priority:** P1 (High — unblocks future Trading Account report)
> **Estimated Effort:** 1 day
> **Dependencies:** Phase 1-4 GAP fixes (plan 34) should be complete
> **Source:** [Trading Account Architecture Spec](../../.gemini/antigravity/brain/baa02fa0-9658-4c3d-ab11-3fcb6b93fe54/trading_account_spec.md)

---

## Business Context

The GAP audit identified that the system has no way to distinguish Sales revenue from Other revenue, or COGS from Operating expenses. Without this, a Trading Account (Gross Profit) report is impossible. This plan adds the **data foundation only** — an optional `plSubgroup` field on the `Account` entity — following the exact same pattern as the existing `cashFlowCategory` field.

**This plan does NOT create the Trading Account report.** It makes the COA "report-ready" so the report can be added later with zero schema changes.

---

## Current State

- ✅ `Account` entity has `classification`: `ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE` (line 12)
- ✅ `cashFlowCategory` exists as a proven precedent: optional enum, null default, full end-to-end support (line 154 in `AccountProps`, line 199 in entity, line 423 in `toJSON`, line 451 in `fromJSON`)
- ✅ Frontend `AccountForm.tsx` has `cashFlowCategory` dropdown (lines 58-63, 95, 164, 300-310)
- ✅ Frontend API types in `frontend/src/api/accounting/index.ts` define `CashFlowCategory` (line 17)
- ❌ No `plSubgroup` or equivalent field exists anywhere

---

## Implementation Plan

### Step 1: Backend — Add `PlSubgroup` type and field to `Account.ts`

**File:** `backend/src/domain/accounting/entities/Account.ts`

#### 1a. Add the type (after line 17, near other type declarations):

```typescript
export type PlSubgroup = 'SALES' | 'COST_OF_SALES' | 'OPERATING_EXPENSES' | 'OTHER_REVENUE' | 'OTHER_EXPENSES';
```

#### 1b. Add to `AccountProps` (after `cashFlowCategory` on line 154):

```typescript
plSubgroup?: PlSubgroup | null;
```

#### 1c. Add to `Account` class fields (after `cashFlowCategory` on line 199):

```typescript
plSubgroup: PlSubgroup | null;
```

#### 1d. Add to constructor (after `cashFlowCategory` assignment on line 245):

```typescript
this.plSubgroup = props.plSubgroup ?? null;
```

#### 1e. Add to `toJSON()` (after `cashFlowCategory` on line 423):

```typescript
plSubgroup: this.plSubgroup,
```

#### 1f. Add to `fromJSON()` (after `cashFlowCategory` on line 451):

```typescript
plSubgroup: data.plSubgroup ?? null,
```

#### 1g. Add to `getMutableFields()` (after `custodianUserId` on line 359):

```typescript
'plSubgroup',
```

> **Important:** `plSubgroup` goes in `getMutableFields()` (not `getUsedImmutableFields()`) because it's a reporting tag, not an accounting constraint. Users should always be able to change it.

#### 1h. Add validation in `validate()` method (after currency validation, around line 384):

```typescript
// P&L Subgroup validation
if (this.plSubgroup) {
    const revenueSubgroups: PlSubgroup[] = ['SALES', 'OTHER_REVENUE'];
    const expenseSubgroups: PlSubgroup[] = ['COST_OF_SALES', 'OPERATING_EXPENSES', 'OTHER_EXPENSES'];
    
    if (this.classification === 'REVENUE' && !revenueSubgroups.includes(this.plSubgroup)) {
        errors.push(`P&L Subgroup "${this.plSubgroup}" is not valid for Revenue accounts. Use: ${revenueSubgroups.join(', ')}.`);
    }
    if (this.classification === 'EXPENSE' && !expenseSubgroups.includes(this.plSubgroup)) {
        errors.push(`P&L Subgroup "${this.plSubgroup}" is not valid for Expense accounts. Use: ${expenseSubgroups.join(', ')}.`);
    }
    if (['ASSET', 'LIABILITY', 'EQUITY'].includes(this.classification)) {
        errors.push('P&L Subgroup only applies to Revenue and Expense accounts.');
    }
}
```

---

### Step 2: Frontend — Add `PlSubgroup` type to API types

**File:** `frontend/src/api/accounting/index.ts`

#### 2a. Add type export (after `CashFlowCategory` on line 17):

```typescript
export type PlSubgroup = 'SALES' | 'COST_OF_SALES' | 'OPERATING_EXPENSES' | 'OTHER_REVENUE' | 'OTHER_EXPENSES';
```

#### 2b. Add to `Account` interface (after `cashFlowCategory` on line 50):

```typescript
plSubgroup?: PlSubgroup | null;
```

#### 2c. Add to `NewAccountInput` (after `cashFlowCategory` on line 90):

```typescript
plSubgroup?: PlSubgroup | null;
```

#### 2d. Add to `UpdateAccountInput` (after `cashFlowCategory` on line 120):

```typescript
plSubgroup?: PlSubgroup | null;
```

---

### Step 3: Frontend — Add `plSubgroup` dropdown to `AccountForm.tsx`

**File:** `frontend/src/modules/accounting/components/AccountForm.tsx`

#### 3a. Import `PlSubgroup` (add to import on line 11):

```typescript
import { 
    Account, NewAccountInput, AccountRole, AccountClassification, 
    BalanceNature, BalanceEnforcement, CurrencyPolicy, AccountStatus,
    CashFlowCategory, PlSubgroup           // ADD PlSubgroup
} from '../../../api/accounting';
```

#### 3b. Add options array (after `CASH_FLOW_CATEGORIES` on line 63):

```typescript
const PL_SUBGROUPS: { value: PlSubgroup | ''; label: string; forClassification: AccountClassification[] }[] = [
    { value: '', label: 'None (Unassigned)', forClassification: ['REVENUE', 'EXPENSE'] },
    { value: 'SALES', label: 'Sales', forClassification: ['REVENUE'] },
    { value: 'OTHER_REVENUE', label: 'Other Revenue', forClassification: ['REVENUE'] },
    { value: 'COST_OF_SALES', label: 'Cost of Sales (COGS)', forClassification: ['EXPENSE'] },
    { value: 'OPERATING_EXPENSES', label: 'Operating Expenses', forClassification: ['EXPENSE'] },
    { value: 'OTHER_EXPENSES', label: 'Other Expenses', forClassification: ['EXPENSE'] },
];
```

#### 3c. Add state (after `cashFlowCategory` state on line 95):

```typescript
const [plSubgroup, setPlSubgroup] = useState<PlSubgroup | ''>(initialValues?.plSubgroup || '');
```

#### 3d. Add to payload in `handleSubmit` (after `cashFlowCategory` on line 164):

```typescript
plSubgroup: plSubgroup || null,
```

#### 3e. Add dropdown to the form (after the Cash Flow Category dropdown, after line 310):

```tsx
{/* P&L Subgroup — only show for Revenue/Expense accounts */}
{(classification === 'REVENUE' || classification === 'EXPENSE') && (
    <div className="mt-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">P&L Subgroup</label>
        <select
            value={plSubgroup}
            onChange={(e) => setPlSubgroup(e.target.value as PlSubgroup | '')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
            {PL_SUBGROUPS
                .filter(s => s.forClassification.includes(classification))
                .map(s => <option key={s.value || 'NONE'} value={s.value}>{s.label}</option>)
            }
        </select>
        <p className="text-xs text-gray-400 mt-1">
            Optional. Used by Trading Account and detailed P&L reports.
        </p>
    </div>
)}
```

#### 3f. Reset `plSubgroup` when classification changes to non-P&L type

Add a `useEffect` (after the balance nature auto-set effect at line 146):

```typescript
// Clear P&L subgroup when switching away from Revenue/Expense
useEffect(() => {
    if (!['REVENUE', 'EXPENSE'].includes(classification)) {
        setPlSubgroup('');
    }
}, [classification]);
```

---

### Step 4: Backend — Update COA Templates (Optional but Recommended)

**File:** `backend/src/application/accounting/templates/COATemplates.ts`

Scan the template for Revenue and Expense accounts and add `plSubgroup` values to the most obvious ones.

Common assignments:
- Revenue accounts with codes like `4000`, `4100`, names containing "Sales", "Service Revenue" → `plSubgroup: 'SALES'`
- Expense accounts with codes like `5000`, `5100`, names containing "Cost of Goods", "Cost of Sales", "COGS" → `plSubgroup: 'COST_OF_SALES'`
- Expense accounts with codes like `6000+`, names containing "Rent", "Salaries", "Utilities" → `plSubgroup: 'OPERATING_EXPENSES'`

If unsure about an account, leave `plSubgroup` out (defaults to `null`).

Also check **File:** `backend/src/application/accounting/templates/IndustryCOATemplates.ts` for the same treatment.

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/domain/accounting/entities/Account.ts` | Add `PlSubgroup` type, field in `AccountProps`, entity, constructor, `toJSON`, `fromJSON`, `getMutableFields`, `validate` |
| `frontend/src/api/accounting/index.ts` | Add `PlSubgroup` type, add to `Account`, `NewAccountInput`, `UpdateAccountInput` |
| `frontend/src/modules/accounting/components/AccountForm.tsx` | Add `plSubgroup` state, dropdown (conditional on classification), payload, effect |
| `backend/src/application/accounting/templates/COATemplates.ts` | Add `plSubgroup` to obvious Revenue/Expense template accounts |
| `backend/src/application/accounting/templates/IndustryCOATemplates.ts` | Same treatment |

---

## Verification Plan

### Automated Tests

1. **Existing Account entity tests must pass:**
   ```bash
   cd backend && npx jest --testPathPatterns="Account.test" --no-coverage
   ```

2. **Existing Account use case tests must pass:**
   ```bash
   cd backend && npx jest --testPathPatterns="AccountUseCases" --no-coverage
   ```

3. **TypeScript backend compilation:**
   ```bash
   cd backend && npx tsc --noEmit
   ```

4. **TypeScript frontend compilation:**
   ```bash
   cd frontend && npx tsc --noEmit
   ```

### Manual Verification

1. Open the app → Navigate to Chart of Accounts → Create a new **Revenue** account
   - Verify the "P&L Subgroup" dropdown appears with options: None, Sales, Other Revenue
   - Select "Sales" → Save → Reopen → Confirm it persisted
2. Edit the account → Change classification to **Expense**
   - Verify dropdown options change to: None, Cost of Sales, Operating Expenses, Other Expenses
3. Change classification to **Asset**
   - Verify the P&L Subgroup dropdown disappears
4. Create an Expense account → set subgroup to "Cost of Sales (COGS)" → Save
   - Verify it persisted correctly

---

## Acceptance Criteria

- [ ] `PlSubgroup` type defined in backend: `'SALES' | 'COST_OF_SALES' | 'OPERATING_EXPENSES' | 'OTHER_REVENUE' | 'OTHER_EXPENSES'`
- [ ] `plSubgroup` field in `AccountProps`, `Account` entity, constructor, `toJSON()`, `fromJSON()`, `getMutableFields()`
- [ ] Validation: `SALES`/`OTHER_REVENUE` only valid for REVENUE; `COST_OF_SALES`/`OPERATING_EXPENSES`/`OTHER_EXPENSES` only valid for EXPENSE; any value invalid for ASSET/LIABILITY/EQUITY
- [ ] `PlSubgroup` type defined in frontend (`api/accounting/index.ts`)
- [ ] `plSubgroup` in `Account`, `NewAccountInput`, `UpdateAccountInput` frontend interfaces
- [ ] Dropdown in `AccountForm.tsx` — conditional on `classification`, filtered options
- [ ] Dropdown clears when classification switches to non-P&L type
- [ ] Backend `npx tsc --noEmit` passes
- [ ] Frontend `npx tsc --noEmit` passes
- [ ] Existing Account tests pass
- [ ] COA templates updated with `plSubgroup` for obvious accounts
- [ ] Completion report at `1-TODO/done/35-completion-report.md`
