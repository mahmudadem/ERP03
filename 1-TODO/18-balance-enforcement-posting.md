# 18 — Balance Enforcement at Posting

> **Priority:** P3 (Lower)
> **Estimated Effort:** 1 day
> **Dependencies:** None

---

## Business Context

The Account entity has a `balanceEnforcement` field with values:
- `NONE` — No restriction
- `NO_NEGATIVE` — Balance cannot go below zero (e.g., cash accounts)
- `NO_POSITIVE` — Balance cannot go above zero (rare, for contra accounts)

However, this enforcement doesn't appear to be checked during posting. This means a user could accidentally overdraw a cash account by posting a payment larger than the available balance.

---

## Current State

- ✅ `BalanceEnforcement` enum exists on `Account.ts` (line 15)
- ✅ Account entity stores the enforcement preference
- ❌ No check during voucher posting
- ❌ No check during voucher validation

---

## Requirements

1. During posting, check if any affected account would violate its balance enforcement
2. If violation: block posting with a clear error message specifying which account and what the resulting balance would be
3. Make this a configurable policy (can be turned off globally via settings)
4. Warning mode: optionally warn instead of block (allow override)

---

## Implementation Plan

### Step 1: Add Balance Enforcement Policy

**File:** `backend/src/domain/accounting/policies/implementations/BalanceEnforcementPolicy.ts` (NEW)

```typescript
export class BalanceEnforcementPolicy implements IPostingPolicy {
  readonly id = 'balance-enforcement';
  readonly name = 'Account Balance Enforcement';

  async validate(ctx: PostingPolicyContext): PolicyResult {
    for (const line of ctx.voucherLines) {
      const account = ctx.accounts.get(line.accountId);
      if (!account || account.balanceEnforcement === 'NONE') continue;
      
      // Get current balance for this account
      const currentBalance = await this.getAccountBalance(ctx.companyId, line.accountId);
      const projectedBalance = currentBalance + (line.isDebit ? line.amount : -line.amount);
      
      if (account.balanceEnforcement === 'NO_NEGATIVE' && projectedBalance < 0) {
        return { ok: false, error: { 
          code: 'BALANCE_VIOLATION',
          message: `Account ${account.code} (${account.name}) would have a negative balance of ${projectedBalance}`,
          fieldHints: ['accountId']
        }};
      }
    }
    return { ok: true };
  }
}
```

### Step 2: Register Policy
Add to the policy pipeline in `VoucherValidationService` or `CreateVoucherUseCase`.

### Step 3: Settings Toggle
Add `balanceEnforcementEnabled` to accounting settings (default: true).

---

## Acceptance Criteria

- [ ] Posting blocked when balance enforcement would be violated
- [ ] Error message clearly states which account and projected balance
- [ ] Works for NO_NEGATIVE and NO_POSITIVE enforcement types
- [ ] Can be globally disabled via settings
- [ ] Existing tests still pass
