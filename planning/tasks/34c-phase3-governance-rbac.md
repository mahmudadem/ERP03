# Phase 3 — Governance & RBAC Fixes

> **Priority:** 🟡 P1 — Policy bypass / access control
> **Claims Fixed:** E (excludeSpecialPeriods unwired), G (policy key drift), I (retained earnings double-count), J (RBAC permission ID mismatch)
> **Estimated Effort:** 1–2 days
> **Dependencies:** Phase 2 must be complete

---

## Business Context

These issues affect governance correctness: reports including data they shouldn't, policy keys drifting apart causing confusion, the balance sheet potentially double-counting retained earnings, and RBAC permissions that don't match between catalog and routes.

---

## Fix E: Wire `excludeSpecialPeriods` Through Use-Cases and Controllers

### Current State

- `FirestoreLedgerRepository.getTrialBalance()` accepts `excludeSpecialPeriods?: boolean` and filters correctly (line 189)
- `GetTrialBalanceUseCase.execute()` calls `getTrialBalance(companyId, effectiveDate)` — never passes the param
- No controller/route exposes it as a query parameter

### Implementation Plan

#### Step 1: Add parameter to `GetTrialBalanceUseCase.execute()`

**File:** `backend/src/application/accounting/use-cases/LedgerUseCases.ts`

```typescript
async execute(
    companyId: string,
    userId: string,
    asOfDate: string,
    includeZeroBalance: boolean = false,
    excludeSpecialPeriods: boolean = false  // NEW
): Promise<{ data: TrialBalanceLine[]; meta: TrialBalanceMeta }> {
    // ...
    const [rawTB, accounts] = await Promise.all([
      this.ledgerRepo.getTrialBalance(companyId, effectiveDate, excludeSpecialPeriods),  // CHANGED
      this.accountRepo.list(companyId)
    ]);
```

#### Step 2: Add `excludeSpecialPeriods` to TB controller

**File:** `backend/src/api/controllers/accounting/ReportingController.ts` (trialBalance method) or `AccountingReportsController.ts` — wherever the TB route handler is.

Add query parameter parsing:
```typescript
const excludeSpecialPeriods = req.query.excludeSpecialPeriods === 'true';
```

Pass it to the use case.

#### Step 3: Also wire through Balance Sheet and Cash Flow

The `GetBalanceSheetUseCase` (line 380) and `GetCashFlowStatementUseCase` (lines 142-143) both call `getTrialBalance()` — add the same `excludeSpecialPeriods` parameter:

**Files:**
- `backend/src/application/accounting/use-cases/LedgerUseCases.ts` — `GetBalanceSheetUseCase.execute()`
- `backend/src/application/accounting/use-cases/CashFlowUseCases.ts` — `GetCashFlowStatementUseCase.execute()`

Add `excludeSpecialPeriods?: boolean` as optional parameter and thread it to `getTrialBalance()` calls.

---

## Fix G: Consolidate Policy Key Drift

### Current State

Two keys exist for the same concept:
- `allowEditDeletePosted` — canonical, used in entity, use-cases, controller (15+ references)
- `allowEditPostedVouchersEnabled` — used in `CreateVoucherUseCase` line 505 and `PostVoucherUseCase` for lock policy

**File:** `backend/src/domain/accounting/policies/PostingPolicyTypes.ts` (line 156):
```typescript
/** @deprecated Use allowEditDeletePosted instead */
```

But the old key is still read in use cases.

### Implementation Plan

#### Step 1: Replace `allowEditPostedVouchersEnabled` reads with `allowEditDeletePosted`

**File:** `backend/src/application/accounting/use-cases/VoucherUseCases.ts`

Line 505 — change:
```typescript
} else if (config.allowEditPostedVouchersEnabled) {
```
to:
```typescript
} else if (config.allowEditDeletePosted) {
```

Search for all other occurrences and replace:
```bash
cd backend && grep -rn "allowEditPostedVouchersEnabled" src/
```

Replace each occurrence with `allowEditDeletePosted`.

#### Step 2: Remove the deprecated field from the type (or keep as alias)

**File:** `backend/src/domain/accounting/policies/PostingPolicyTypes.ts`

Option A (safer): Keep the deprecated field but make it a computed alias in the config provider. No type change needed.

Option B (cleaner): Remove the field entirely now that no code reads it. Do this ONLY after confirming zero references remain after Step 1.

Prefer **Option A** for backward compatibility with persisted Firestore data.

#### Step 3: Ensure config provider maps old key to new

**File:** `backend/src/infrastructure/accounting/config/FirestoreAccountingPolicyConfigProvider.ts`

In `getConfig()`, after merge, add:
```typescript
// Backward compat: if old key exists in persisted data, map to canonical key
if (merged.allowEditPostedVouchersEnabled !== undefined && merged.allowEditDeletePosted === undefined) {
    merged.allowEditDeletePosted = merged.allowEditPostedVouchersEnabled;
}
```

---

## Fix I: Prevent Retained Earnings Double-Count

### Current State

**File:** `backend/src/application/accounting/use-cases/LedgerUseCases.ts` (lines 457–482)

The BS always appends a synthetic `retained-earnings` line. But if a user has a real "Retained Earnings" equity account AND year-end closing entries were posted to it, both the real account balance AND the synthetic line appear — double counting.

### Implementation Plan

#### Step 1: Detect existing retained earnings accounts

In `GetBalanceSheetUseCase.execute()`, before computing `retainedEarnings`:

```typescript
// Filter out "Retained Earnings" accounts from the equity section
// to prevent double-counting with the synthetic RE line
const RETAINED_EARNINGS_HINTS = ['retained earnings', 'retained earning', 'current year earnings'];

const isRetainedEarningsAccount = (acc: any) => {
    const name = (acc.name || '').toLowerCase();
    return RETAINED_EARNINGS_HINTS.some(hint => name.includes(hint));
};

// Find RE accounts and their total
const reAccounts = accounts.filter(a => 
    a.classification === 'EQUITY' && isRetainedEarningsAccount(a)
);
const existingREBalance = reAccounts.reduce((sum, acc) => sum + getNetBalance(acc), 0);
```

#### Step 2: Adjust synthetic retained earnings

```typescript
// Synthetic RE = P&L net income MINUS what's already posted to RE accounts
const retainedEarnings = (revenueTotal - expenseTotal) - existingREBalance;
```

This way:
- If no year-end close has happened: synthetic RE = full P&L net income (correct)
- If year-end close posted to RE account: synthetic RE = remaining unposted portion (correct)
- If fully closed: synthetic RE = 0 (correct — all in the real account)

#### Step 3: Label the synthetic line clearly

```typescript
const retainedLine: BalanceSheetLine = {
    accountId: 'retained-earnings',
    code: 'RE',
    name: 'Current Year Earnings (Unposted)',  // CHANGED: clearer label
    parentId: null,
    level: 0,
    balance: retainedEarnings,
    isParent: false
};

// Only add if non-zero
if (Math.abs(retainedEarnings) >= 0.005) {
    equity.accounts = [...equity.accounts, retainedLine];
    equity.total += retainedEarnings;
}
```

---

## Fix J: Sync RBAC Permission Catalog with Routes

### Current State

**File:** `backend/src/config/PermissionCatalog.ts`

The catalog has 17 accounting permission IDs. Routes use ~25+ distinct IDs. Missing from catalog:

- `accounting.accounts.create`
- `accounting.accounts.edit`
- `accounting.accounts.delete`
- `accounting.vouchers.approve`
- `accounting.vouchers.cancel`
- `accounting.vouchers.correct`
- `accounting.reports.profitAndLoss.view`
- `accounting.reports.trialBalance.view`
- `accounting.reports.balanceSheet.view`
- `accounting.reports.cashFlow.view`
- `accounting.reports.generalLedger.view`
- `accounting.settings.read`
- `accounting.settings.write`

### Implementation Plan

#### Step 1: Extract all permission IDs from routes

```bash
cd backend && grep -oP "permissionGuard\('([^']+)'\)" src/api/routes/*.ts | sort -u
```

#### Step 2: Add all missing IDs to `PERMISSION_CATALOG`

**File:** `backend/src/config/PermissionCatalog.ts`

Add all missing permission definitions to the accounting module's `permissions` array:

```typescript
{
    moduleId: 'accounting',
    permissions: [
        // General
        { id: 'accounting.view', label: 'View Accounting Dashboard' },
        
        // Charts of Accounts
        { id: 'accounting.accounts.view', label: 'View Chart of Accounts' },
        { id: 'accounting.accounts.create', label: 'Create Accounts' },
        { id: 'accounting.accounts.edit', label: 'Edit Accounts' },
        { id: 'accounting.accounts.delete', label: 'Delete Accounts' },
        { id: 'accounting.accounts.manage', label: 'Manage Chart of Accounts' },
        
        // Vouchers
        { id: 'accounting.vouchers.view', label: 'View Vouchers' },
        { id: 'accounting.vouchers.create', label: 'Create Vouchers' },
        { id: 'accounting.vouchers.edit', label: 'Edit Draft Vouchers' },
        { id: 'accounting.vouchers.delete', label: 'Delete Draft Vouchers' },
        { id: 'accounting.vouchers.post', label: 'Post Vouchers' },
        { id: 'accounting.vouchers.approve', label: 'Approve/Reject Vouchers' },
        { id: 'accounting.vouchers.cancel', label: 'Cancel Vouchers' },
        { id: 'accounting.vouchers.correct', label: 'Correct/Reverse Vouchers' },
        
        // Approval Workflow
        { id: 'accounting.approve.finance', label: 'Financial Approval' },
        
        // Custody Workflow
        { id: 'accounting.custodian.view', label: 'View Custody Requests' },
        { id: 'accounting.custodian.verify', label: 'Confirm Custody' },

        // Design & Configuration
        { id: 'accounting.designer.view', label: 'View Voucher Designs' },
        { id: 'accounting.designer.create', label: 'Create Voucher Designs' },
        { id: 'accounting.designer.modify', label: 'Modify Voucher Designs' },
        { id: 'accounting.designer.delete', label: 'Delete Voucher Designs' },
        
        // Reporting
        { id: 'accounting.reports.view', label: 'View Financial Reports' },
        { id: 'accounting.reports.profitAndLoss.view', label: 'View Profit & Loss' },
        { id: 'accounting.reports.trialBalance.view', label: 'View Trial Balance' },
        { id: 'accounting.reports.balanceSheet.view', label: 'View Balance Sheet' },
        { id: 'accounting.reports.cashFlow.view', label: 'View Cash Flow Statement' },
        { id: 'accounting.reports.generalLedger.view', label: 'View General Ledger' },
        
        // Settings
        { id: 'accounting.settings.read', label: 'View Accounting Settings' },
        { id: 'accounting.settings.write', label: 'Modify Accounting Settings' },
    ]
}
```

#### Step 3: Verify all routes are covered

Run the extraction command from Step 1 again and diff against the catalog to confirm 100% coverage.

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/application/accounting/use-cases/LedgerUseCases.ts` | Wire `excludeSpecialPeriods`; fix RE double-count |
| `backend/src/application/accounting/use-cases/CashFlowUseCases.ts` | Wire `excludeSpecialPeriods` |
| `backend/src/api/controllers/accounting/ReportingController.ts` (or `AccountingReportsController.ts`) | Parse `excludeSpecialPeriods` query param for TB |
| `backend/src/application/accounting/use-cases/VoucherUseCases.ts` | Replace `allowEditPostedVouchersEnabled` with `allowEditDeletePosted` |
| `backend/src/infrastructure/accounting/config/FirestoreAccountingPolicyConfigProvider.ts` | Backward compat mapping for old key |
| `backend/src/config/PermissionCatalog.ts` | Add all missing permission IDs |

---

## Verification Plan

### Automated Tests

```bash
cd backend && npx jest --testPathPattern="GetBalanceSheet|GetCashFlow|GovernancePolicy" --no-coverage
```

### Manual Verification

1. **TypeScript compilation:** `cd backend && npx tsc --noEmit`
2. **Permission coverage check:**
   ```bash
   cd backend && grep -oP "permissionGuard\('([^']+)'\)" src/api/routes/*.ts | sed "s/.*'//;s/'.*//" | sort -u > /tmp/route_perms.txt
   cd backend && grep -oP "id: '([^']+)'" src/config/PermissionCatalog.ts | sed "s/.*'//;s/'.*//" | sort -u > /tmp/catalog_perms.txt
   diff /tmp/route_perms.txt /tmp/catalog_perms.txt
   ```
   Diff should show no route permissions missing from catalog.

---

## Acceptance Criteria

- [ ] `excludeSpecialPeriods` can be passed as a query param to TB endpoint
- [ ] BS and CF use cases accept the parameter and thread it to `getTrialBalance()`
- [ ] All references to `allowEditPostedVouchersEnabled` replaced with `allowEditDeletePosted`
- [ ] Config provider maps old persisted key to new key for backward compatibility
- [ ] Retained earnings synthetic line only includes the unposted P&L portion
- [ ] If RE account balance == P&L net, synthetic line is 0 (not shown)
- [ ] All route-used permission IDs exist in `PermissionCatalog.ts`
- [ ] `npx tsc --noEmit` passes cleanly
- [ ] All referenced tests pass
- [ ] Completion report at `1-TODO/done/34-phase3-completion-report.md`

---

## STRICT RULES FOR EXECUTOR

1. **DO NOT** change any API response shapes — frontend depends on them
2. **DO NOT** remove deprecated fields from TypeScript types — only stop reading them in code
3. **DO NOT** modify route paths or middleware order
4. **DO NOT** modify frontend code
5. For the permission catalog, ONLY ADD entries — do NOT remove existing ones
6. The retained earnings fix must handle the case where no RE account exists (synthetic = full P&L net)
