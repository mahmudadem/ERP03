# Voucher Corrections Guide

## Overview
After a voucher is POSTED to the ledger, it cannot be edited directly. Instead, use the **Reverse & Replace** correction flow to maintain financial integrity and audit trail.

## Correction Flow Rules

### Core Principles
- ✅ Original POSTED voucher is never modified
- ✅ All corrections represented as new vouchers
- ✅ Reversals automatically negate original financial impact
- ✅ All policies apply to corrections (approval, period lock, account access)
- ✅ Complete audit trail maintained

### Non-Negotiables
- ❌ Cannot edit POSTED voucher lines
- ❌ Cannot delete historical financial data
- ❌ Cannot bypass posting policies for corrections

---

## Correction Modes

### 1. REVERSE_ONLY
Creates a reversal voucher that negates the original's financial impact.

**Use when:**
- Original voucher was posted in error
- Need to cancel a transaction completely

**Result:**
- Original voucher: Remains POSTED (unchanged)
- Reversal voucher: POSTED (debits/credits swapped)
- Net financial impact: Zero

### 2. REVERSE_AND_REPLACE
Creates a reversal + replacement voucher with corrected data.

**Use when:**
- Need to correct wrong amounts, accounts, or details
- Want to maintain a clear correction trail

**Result:**
- Original voucher: Remains POSTED (unchanged)
- Reversal voucher: POSTED (negates original)
- Replacement voucher: DRAFT (by default), user can edit and post manually

---

## API Usage (Backend Only - NO UI)

### Endpoint
```
POST /api/v1/companies/:companyId/accounting/vouchers/:id/correct
```

### Authentication
- `userId` MUST come from auth context only
- ❌ Cannot provide `userId` in request body

### Request Examples

#### Reverse Only (Default: Original Date)
```json
{
  "correctionMode": "REVERSE_ONLY",
  "options": {
    "reason": "Posted to wrong account"
  }
}
```

#### Reverse Only (Override: Today's Date)
```json
{
  "correctionMode": "REVERSE_ONLY",
  "options": {
    "reversalDate": "today",
    "reason": "Original period locked - reversing to current period"
  }
}
```

#### Reverse and Replace
```json
{
  "correctionMode": "REVERSE_AND_REPLACE",
  "replacePayload": {
    "date": "2025-01-20",
    "description": "Corrected entry - office supplies",
    "lines": [
      {
        "accountId": "acc-supplies",
        "debitFx": 150,
        "creditFx": 0,
        "debitBase": 150,
        "creditBase": 0
      },
      {
        "accountId": "acc-cash",
        "debitFx": 0,
        "creditFx": 150,
        "debitBase": 0,
        "creditBase": 150
      }
    ]
  },
  "options": {
    "replaceStartsAsDraft": true,
    "reason": "Incorrect amount - should be $150 not $100"
  }
}
```

### Response
```json
{
  "success": true,
  "data": {
    "reverseVoucherId": "v-rev-123",
    "replaceVoucherId": "v-456",
    "correctionGroupId": "corr-uuid-789",
    "summary": {
      "reversalPosted": true,
      "replacementCreated": true,
      "replacementPosted": false
    }
  }
}
```

---

## How It Works

### Reversal Process

1. **Validation**
   - Original voucher must be POSTED
   - User must have `voucher.correct` permission

2. **Reversal Generation**
   - **Date: Original voucher date (DEFAULT)**
     - Maintains period alignment
     - Optional override: `options.reversalDate = "today"` or specific date
   - Lines: Debits/credits swapped from original
   - Metadata: Links to original via `reversalOfVoucherId`
   - Description: "Reversal of {originalVoucherNo}"

> [!IMPORTANT]
> **Default Reversal Date = Original Voucher Date**
> 
> This ensures corrections stay in the same accounting period as the original transaction.
> Use `reversalDate: "today"` only when period lock or other constraints require it.

3. **Posting**
   - Reversal posted via `PostVoucherUseCase` (single posting point)
   - All policies apply (approval, period lock, account access)
   - If policy blocks: correction fails cleanly, no partial duplicates

4. **Replacement (optional)**
   - Created as DRAFT by default
   - Metadata: Links to original via `replacesVoucherId`
   - User can edit and post manually (or set `replaceStartsAsDraft: false`)

### Idempotency

Second correction request for same voucher returns existing reversal:
- ✅ Prevents double-reversals
- ✅ Safe to retry on network failures
- ✅ Returns existing correction group ID

---

## Policy Compliance

All posting policies apply to reversals:

### Approval Required Policy
If enabled: Reversal must be approved before posting (same as original vouchers).

### Period Lock Policy
If enabled: Reversal cannot be posted if today's date falls in locked period.

**Example:**
- Original date: 2024-12-15
- Reversal date: 2025-01-15 (today)
- Locked through: 2025-01-20
- Result: ❌ BLOCKED (reversal date in locked period)

### Account Access Control
If enabled: User must have access to all accounts in original voucher.

**Example:**
- Original uses "Branch A Cash" (restricted)
- User has access to Branch B only
- Result: ❌ BLOCKED (cannot reverse voucher with inaccessible accounts)

---

## Error Handling

### Cannot Correct Non-Posted Voucher
```json
{
  "code": "INVALID_STATUS",
  "message": "Cannot correct voucher in status: DRAFT. Only POSTED vouchers can be corrected."
}
```

### Policy Blocks Reversal  
```json
{
  "code": "POLICY_VIOLATION",
  "message": "Reversal blocked: Cannot post to locked period. Voucher date 2025-01-15 is on or before locked through date 2025-01-20"
}
```

### Account Access Denied
```json
{
  "code": "ACCOUNT_ACCESS_DENIED",
  "message": "Access denied to account 'Branch A Cash'. Reversal touches restricted accounts."
}
```

---

## Audit Trail

Each correction creates traceable links:

### Metadata Fields

**Reversal voucher:**
```json
{
  "reversalOfVoucherId": "v-original-123",
  "correctionGroupId": "uuid-456",
  "correctionReason": "Posted to wrong account"
}
```

**Replacement voucher:**
```json
{
  "replacesVoucherId": "v-original-123",
  "correctionGroupId": "uuid-456",
  "correctionReason": "Amount correction"
}
```

### Helper Properties
```typescript
voucher.isReversal        // true if this voucher reverses another
voucher.isReplacement     // true if this voucher replaces another
voucher.correctionGroupId // UUID linking reversal + replacement
```

---

## Best Practices

### When to Use Corrections

✅ **DO use corrections when:**
- Voucher already posted to ledger
- Need to maintain complete audit trail
- Correction must go through policy validation

❌ **DO NOT use corrections when:**
- Voucher still in DRAFT (just edit directly)
- Voucher in APPROVED but not POSTED (update and repost)

### Replacement vs. New Voucher

**Use REVERSE_AND_REPLACE when:**
- Correcting data in same accounting period
- Want clear link between original and correction

**Use REVERSE_ONLY + Manual new voucher when:**
- Correction involves different accounting period
- Correction changes voucher type or nature

### Reason Field

Always provide clear reasons:
- ✅ "Incorrect amount - should be $150 not $100"
- ✅ "Posted to wrong account - expense not asset"
- ❌ "Mistake"
- ❌ "Error"

---

## Architecture Notes

### Single Posting Point Maintained
- Reversals posted via `PostVoucherUseCase` only
- No direct ledger writes in correction logic
- All invariants + policies apply

### Immutability Preserved
- Original voucher data never modified
- Historical financial records intact
- Audit trail complete

### Correction Metadata
Stored in `voucher.metadata`:
- `reversalOfVoucherId`
- `replacesVoucherId`
- `correctionGroupId`
- `correctionReason`

---

## Future Enhancements

Potential improvements (not in current phase):
- Bulk corrections
- Correction approval workflow
- Correction reports/audit logs
- UI for correction history visualization
