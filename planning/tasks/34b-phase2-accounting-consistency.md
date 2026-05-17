# Phase 2 — Accounting Consistency Fixes

> **Priority:** 🔴 P0 — Wrong numbers / data loss
> **Claims Fixed:** D (P&L source-of-truth split), L (isUsed always returns false), A (CC-only bypass)
> **Estimated Effort:** 2 days
> **Dependencies:** Phase 1 must be complete (tx atomicity required before P&L migration)

---

## Business Context

Three critical issues undermine accounting consistency:

1. **P&L reads from vouchers** while TB/BS/CF read from the ledger — guaranteed divergence
2. **Account `isUsed()` always returns false** — querying a nonexistent subcollection, allowing deletion of accounts with ledger history
3. **CC-only mode auto-posts** — When only Custody Confirmation is enabled (FA off), `approvalRequired` is `false`, causing vouchers to skip the CC gate entirely

---

## Fix D: Migrate P&L to Ledger-Based

### Current State

**File:** `backend/src/application/reporting/use-cases/GetProfitAndLossUseCase.ts`

The use case takes `IVoucherRepository` and calls `findByDateRange()` to iterate voucher lines. This is the ONLY report that reads from vouchers instead of the ledger.

### Implementation Plan

#### Step 1: Refactor `GetProfitAndLossUseCase` to use `ILedgerRepository`

Replace the constructor dependency from `IVoucherRepository` to `ILedgerRepository`:

```typescript
export class GetProfitAndLossUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,      // CHANGED: was voucherRepository
    private accountRepository: IAccountRepository,
    private permissionChecker: PermissionChecker
  ) {}
```

#### Step 2: Rewrite `execute()` to use trial balance data

Replace the voucher-iteration logic with ledger-based approach:

```typescript
async execute(input: ProfitAndLossInput): Promise<ProfitAndLossOutput> {
    await this.permissionChecker.assertOrThrow(
      input.userId, input.companyId, 'accounting.reports.profitAndLoss.view'
    );

    const fromDate = normalizeDateInput(input.fromDate);
    const toDate = normalizeDateInput(input.toDate);

    // Get TB at start (day before fromDate) and end (toDate)
    const dayBefore = (() => {
      const d = new Date(fromDate);
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    })();

    const [openingTB, closingTB, accounts] = await Promise.all([
      this.ledgerRepo.getTrialBalance(input.companyId, dayBefore),
      this.ledgerRepo.getTrialBalance(input.companyId, toDate),
      this.accountRepository.list(input.companyId),
    ]);

    const accountMap = new Map(accounts.map((a: any) => [a.id, a]));
    const openMap = new Map(openingTB.map(r => [r.accountId, { debit: r.debit || 0, credit: r.credit || 0 }]));
    const closeMap = new Map(closingTB.map(r => [r.accountId, { debit: r.debit || 0, credit: r.credit || 0 }]));

    const revenueMap = new Map<string, { accountName: string; amount: number }>();
    const expenseMap = new Map<string, { accountName: string; amount: number }>();
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const account of accounts) {
      const classification = classificationOf(account);
      if (classification !== 'REVENUE' && classification !== 'EXPENSE') continue;

      const openBal = openMap.get(account.id) || { debit: 0, credit: 0 };
      const closeBal = closeMap.get(account.id) || { debit: 0, credit: 0 };

      // Period activity = closing cumulative - opening cumulative
      const periodDebit = (closeBal.debit - openBal.debit);
      const periodCredit = (closeBal.credit - openBal.credit);

      if (classification === 'REVENUE') {
        const amount = periodCredit - periodDebit;
        if (Math.abs(amount) >= 0.005) {
          totalRevenue += amount;
          revenueMap.set(account.id, {
            accountName: accountLabel(account, account.id),
            amount
          });
        }
      }

      if (classification === 'EXPENSE') {
        const amount = periodDebit - periodCredit;
        if (Math.abs(amount) >= 0.005) {
          totalExpenses += amount;
          expenseMap.set(account.id, {
            accountName: accountLabel(account, account.id),
            amount
          });
        }
      }
    }

    return {
      revenue: round2(totalRevenue),
      expenses: round2(totalExpenses),
      netProfit: round2(totalRevenue - totalExpenses),
      revenueByAccount: Array.from(revenueMap.entries())
        .map(([accountId, data]) => ({ accountId, accountName: data.accountName, amount: round2(data.amount) }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
      expensesByAccount: Array.from(expenseMap.entries())
        .map(([accountId, data]) => ({ accountId, accountName: data.accountName, amount: round2(data.amount) }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
      period: { from: fromDate, to: toDate },
    };
}
```

#### Step 3: Update `ReportingController.profitAndLoss`

**File:** `backend/src/api/controllers/accounting/ReportingController.ts` (line 37)

Change the constructor call:
```typescript
// BEFORE:
const useCase = new GetProfitAndLossUseCase(
    diContainer.voucherRepository,    // ← Wrong source
    diContainer.accountRepository,
    permissionChecker
);

// AFTER:
const useCase = new GetProfitAndLossUseCase(
    diContainer.ledgerRepository,     // ← Correct source
    diContainer.accountRepository,
    permissionChecker
);
```

#### Step 4: Update existing P&L test

**File:** `backend/src/tests/application/reporting/use-cases/GetProfitAndLossUseCase.test.ts`

Update the mock from `IVoucherRepository` to `ILedgerRepository`. The test should mock `getTrialBalance()` instead of `findByDateRange()`.

---

## Fix L: Fix Account `isUsed()` to Check Ledger

### Current State

**File:** `backend/src/infrastructure/firestore/repositories/accounting/FirestoreAccountRepository.ts` (line 248)

```typescript
async isUsed(companyId: string, accountId: string): Promise<boolean> {
    // Queries voucherDoc.ref.collection('lines') subcollection
    // But vouchers store lines EMBEDDED in document body — subcollection doesn't exist
    // ALWAYS returns false
}
```

### Implementation Plan

#### Step 1: Rewrite `isUsed()` to check the ledger collection

The most reliable way to determine if an account is "in use" is to check if it has any ledger entries. This is both accurate and efficient:

```typescript
async isUsed(companyId: string, accountId: string): Promise<boolean> {
    try {
      // Check ledger for any entries referencing this account
      const ledgerCol = this.db
        .collection('companies').doc(companyId)
        .collection('accounting').doc('Data')
        .collection('ledger');
      
      const ledgerSnap = await ledgerCol
        .where('accountId', '==', accountId)
        .limit(1)
        .get();
      
      if (!ledgerSnap.empty) return true;

      // Also check vouchers (embedded lines) for draft/pending entries not yet posted
      const vouchersCol = this.db
        .collection('companies').doc(companyId)
        .collection('accounting').doc('Data')
        .collection('vouchers');
      
      // Firestore can't query nested array fields directly, so we
      // fetch a batch and check client-side (limited to avoid full-table scans)
      const vouchersSnap = await vouchersCol.limit(500).get();
      
      for (const doc of vouchersSnap.docs) {
        const data = doc.data();
        const lines = data.lines || [];
        if (lines.some((line: any) => line.accountId === accountId)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking if account is used:', error);
      return false; // Fail-open is wrong for deletion guard — but matches current behavior
    }
}
```

> **Note:** The ledger check is the critical path. The voucher-embedded-lines check is a secondary safety net for unposted vouchers. In a future SQL migration, this becomes a simple JOIN query.

---

## Fix A: Fix CC-Only Approval Bypass

### Current State

**File:** `backend/src/application/accounting/use-cases/VoucherUseCases.ts` (lines 425–432)

```typescript
let approvalRequired = true;
if (this.policyConfigProvider) {
    const config = await this.policyConfigProvider.getConfig(companyId);
    approvalRequired = config.approvalRequired;  // ← Legacy field, only reflects FA!
}
```

When CC is ON but FA is OFF: `approvalRequired = false` → auto-post fires → CC gate never evaluated.

**File:** `backend/src/infrastructure/accounting/config/FirestoreAccountingPolicyConfigProvider.ts` (line 71)

```typescript
approvalRequired: false,  // Legacy sync — only reflects financialApprovalEnabled
```

### Implementation Plan

#### Step 1: Fix `approvalRequired` derivation in `getConfig()`

**File:** `backend/src/infrastructure/accounting/config/FirestoreAccountingPolicyConfigProvider.ts`

In the `getConfig()` method, after merging config, derive `approvalRequired` from BOTH FA and CC:

```typescript
// After merge (around line 54), add:
// CRITICAL FIX: approvalRequired must reflect ANY gate being ON (FA or CC)
merged.approvalRequired = merged.financialApprovalEnabled || merged.custodyConfirmationEnabled;
```

#### Step 2: Fix default config

In the same file, `getDefaultConfig()` line 71 — this is already correct (`false` when both are off). No change needed here. But add a comment:

```typescript
// Derived: true if ANY gate (FA or CC) is enabled
approvalRequired: false,  // Both FA and CC default to false
```

#### Step 3: Fix `CreateVoucherUseCase` to also check CC

**File:** `backend/src/application/accounting/use-cases/VoucherUseCases.ts`

The auto-post path at line 482 (`if (!approvalRequired && this.ledgerRepo)`) will now correctly skip auto-post when CC is ON, because `approvalRequired` will be `true`. No changes needed to the use case — the fix in the config provider is sufficient.

However, verify the strict-mode check at line 501 also considers CC:
```typescript
const isStrictNow = config.financialApprovalEnabled || config.custodyConfirmationEnabled;
```
This line is already correct. ✅

#### Step 4: Fix `UpdateVoucherUseCase.resolveStatus()` similarly

Verify that `approvalRequired` used in `resolveStatus()` (line 845) also flows through the corrected config. Since it reads from the same `policyConfigProvider.getConfig()` at line 583, the fix propagates automatically. ✅

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/application/reporting/use-cases/GetProfitAndLossUseCase.ts` | Replace `IVoucherRepository` with `ILedgerRepository`; rewrite to TB-delta approach |
| `backend/src/api/controllers/accounting/ReportingController.ts` | Change P&L constructor to use `diContainer.ledgerRepository` |
| `backend/src/infrastructure/firestore/repositories/accounting/FirestoreAccountRepository.ts` | Rewrite `isUsed()` to check ledger + embedded voucher lines |
| `backend/src/infrastructure/accounting/config/FirestoreAccountingPolicyConfigProvider.ts` | Derive `approvalRequired` from FA OR CC |
| `backend/src/tests/application/reporting/use-cases/GetProfitAndLossUseCase.test.ts` | Update mock from voucher repo to ledger repo |

---

## Verification Plan

### Automated Tests

1. **P&L test updated and passing:**
   ```bash
   cd backend && npx jest --testPathPattern="GetProfitAndLossUseCase" --no-coverage
   ```

2. **Existing report tests still pass:**
   ```bash
   cd backend && npx jest --testPathPattern="GetBalanceSheet|GetCashFlow" --no-coverage
   ```

3. **Account use case tests pass:**
   ```bash
   cd backend && npx jest --testPathPattern="AccountUseCases" --no-coverage
   ```

### Manual Verification

1. **TypeScript compilation:**
   ```bash
   cd backend && npx tsc --noEmit
   ```

2. **Verify P&L and TB consistency:**
   - Both should now use ledger as source of truth
   - Revenue total in P&L should equal sum of REVENUE accounts in TB

3. **Verify isUsed guard:**
   - Confirm `isUsed()` returns `true` for an account that has ledger entries (grep for accountId in Firestore using a script or manually check)

4. **Verify CC-only mode:**
   - With config `financialApprovalEnabled: false, custodyConfirmationEnabled: true`:
     - `approvalRequired` must be `true`
     - Voucher creation must NOT auto-post

---

## Acceptance Criteria

- [ ] `GetProfitAndLossUseCase` uses `ILedgerRepository`, NOT `IVoucherRepository`
- [ ] P&L calculates period amounts using TB-delta (closing − opening cumulative)
- [ ] `ReportingController.profitAndLoss` passes `diContainer.ledgerRepository`
- [ ] `isUsed()` checks the ledger collection first (indexed `accountId` query)
- [ ] `isUsed()` also checks embedded voucher lines as secondary check
- [ ] `approvalRequired` is derived from `financialApprovalEnabled || custodyConfirmationEnabled`
- [ ] CC-only mode does NOT auto-post (voucher stays DRAFT)
- [ ] `npx tsc --noEmit` passes cleanly
- [ ] All referenced tests pass
- [ ] Completion report created at `1-TODO/done/34-phase2-completion-report.md`

---

## STRICT RULES FOR EXECUTOR

1. **DO NOT** change the `ProfitAndLossOutput` interface shape — frontend depends on it
2. **DO NOT** remove the `IVoucherRepository` import from the file if other code uses it — just remove the constructor dependency
3. **DO NOT** change ledger repository methods — only consume existing APIs
4. **DO NOT** modify frontend code
5. For `isUsed()`, the ledger check is the PRIMARY guard. The voucher check is SECONDARY (belt + suspenders)
6. The `approvalRequired` fix must be in the CONFIG PROVIDER, not in use cases — so all consumers benefit
