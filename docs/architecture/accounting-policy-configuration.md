# Policy Configuration Guide (Backend Only - NO UI)

## Overview
The accounting policy system allows you to enable "Strict when needed" behavior through backend configuration. Policies are enforced at the validation gate in `PostVoucherUseCase` before any ledger writes occur.

## Available Policies

### 1. Approval Required Policy
- **ID**: `approval-required`
- **Purpose**: Prevents posting vouchers that haven't been approved
- **Behavior**: Vouchers must transition to APPROVED status (via `ApproveVoucherUseCase`) before they can be posted
- **Error Code**: `APPROVAL_REQUIRED`

### 2. Period Lock Policy
- **ID**: `period-lock`
- **Purpose**: Prevents posting to closed accounting periods
- **Behavior**: Vouchers dated on or before `lockedThroughDate` cannot be posted
- **Error Code**: `PERIOD_LOCKED`

### 3. Account Access Control Policy
- **ID**: `account-access`
- **Purpose**: Prevents users from posting to accounts outside their allowed scope
- **Behavior**: Checks each voucher line's account against user's allowed units
  - Shared accounts → accessible to all
  - Restricted accounts → only accessible to users with matching unitIds
  - Super users → bypass all restrictions
- **Error Code**: `ACCOUNT_ACCESS_DENIED`

## Configuration Location

Policies are configured in Firestore at:
```
companies/{companyId}/settings/accounting
```

## Configuration Examples

### Enable Approval Required
```json
{
  "approvalRequired": true,
  "periodLockEnabled": false,
  "accountAccessEnabled": false
}
```

### Enable Period Lock
```json
{
  "approvalRequired": false,
  "periodLockEnabled": true,
  "lockedThroughDate": "2024-12-31",
  "accountAccessEnabled": false
}
```
*All dates on or before 2024-12-31 will be locked*

### Enable Account Access Control
```json
{
  "approvalRequired": false,
  "periodLockEnabled": false,
  "accountAccessEnabled": true
}
```

### Enable All Policies
```json
{
  "approvalRequired": true,
  "periodLockEnabled": true,
  "lockedThroughDate": "2024-12-31",
  "accountAccessEnabled": true
}
```

### Disable All Policies (Core Invariants Only)
```json
{
  "approvalRequired": false,
  "periodLockEnabled": false,
  "accountAccessEnabled": false
}
```

## Account Access Control Setup

### User Scope Configuration
Location: `users/{userId}/profile/access`

```json
{
  "allowedUnitIds": ["branch-a", "dept-finance"],
  "isSuper": false
}
```

**Super User (bypasses all restrictions):**
```json
{
  "allowedUnitIds": [],
  "isSuper": true
}
```

### Account Ownership Configuration
Location: `companies/{companyId}/accounts/{accountId}`

**Shared Account (accessible to all):**
```json
{
  "code": "CASH-001",
  "name": "Petty Cash",
  "type": "asset",
  "ownerScope": "shared"
}
```

**Restricted Account (unit-specific):**
```json
{
  "code": "CASH-A",
  "name": "Branch A Cash",
  "type": "asset",
  "ownerUnitIds": ["branch-a"],
  "ownerScope": "restricted"
}
```

**Account without metadata (defaults to shared):**
```json
{
  "code": "EXP-001",
  "name": "General Expense",
  "type": "expense"
}
```

## How to Configure (Manual)

### Option 1: Firebase Console
1. Navigate to Firestore in Firebase Console
2. Go to: `companies` → `{yourCompanyId}` → `settings` → `accounting`
3. Edit the document with desired policy settings
4. Save changes

### Option 2: Firestore REST API
```bash
curl -X PATCH \
  "https://firestore.googleapis.com/v1/projects/erp-03/databases/(default)/documents/companies/{companyId}/settings/accounting" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "approvalRequired": {"booleanValue": true},
      "periodLockEnabled": {"booleanValue": true},
      "lockedThroughDate": {"stringValue": "2024-12-31"}
    }
  }'
```

### Option 3: Admin Script
```typescript
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

await db
  .collection('companies')
  .doc('YOUR_COMPANY_ID')
  .collection('settings')
  .doc('accounting')
  .set({
    approvalRequired: true,
    periodLockEnabled: true,
    lockedThroughDate: '2024-12-31'
  });
```

## Testing the Policy System

### Automated Test
Run the verification script:
```bash
cd backend
npm run seeder verifyPolicies
```

This will test:
1. ✓ Blocking post when approval required and not approved
2. ✓ Allowing post after approval
3. ✓ Blocking post to locked period
4. ✓ Allowing post when all policies disabled

### Manual Testing Steps

#### Test 1: Approval Required
1. Set config: `{ "approvalRequired": true }`
2. Create voucher (DRAFT)
3. Attempt to post → Should FAIL with `APPROVAL_REQUIRED`
4. Approve voucher
5. Post voucher → Should SUCCEED

#### Test 2: Period Lock
1. Set config: `{ "periodLockEnabled": true, "lockedThroughDate": "2024-12-31" }`
2. Create voucher with date "2024-12-15"
3. Attempt to post → Should FAIL with `PERIOD_LOCKED`
4. Update config: `{ "periodLockEnabled": false }`
5. Post voucher → Should SUCCEED

#### Test 3: Combined Policies
1. Set config: `{ "approvalRequired": true, "periodLockEnabled": true, "lockedThroughDate": "2024-12-31" }`
2. Create voucher with date "2025-01-15" (DRAFT)
3. Attempt to post → Should FAIL with `APPROVAL_REQUIRED`
4. Approve voucher
5. Post voucher → Should SUCCEED (date is after locked period)

## Error Handling

Policy errors are structured and include:

```typescript
{
  code: string;           // e.g., "APPROVAL_REQUIRED", "PERIOD_LOCKED"
  message: string;        // Human-readable error
  policyId: string;       // Policy identifier
  fieldHints?: string[];  // Fields that caused the error
}
```

Example error response:
```
Policy validation failed [approval-required]: Voucher must be approved before posting. Current status: draft
```

## Troubleshooting

### Policy Not Enforcing
1. Check config exists at correct path
2. Verify config values are correct types (boolean, string)
3. Check server logs for config loading errors
4. Default behavior: all policies disabled if config missing

### Period Lock Not Working
1. Verify date format is `YYYY-MM-DD`
2. Check voucher date vs locked through date
3. Remember: dates **on or before** locked date are blocked

### Approval Required Not Working
1. Verify voucher status is exactly `VoucherStatus.APPROVED`
2. Check that ApproveVoucherUseCase was called
3. Ensure voucher was re-loaded after approval

## Architecture Notes

- **No UI in Phase 2**: All configuration via backend only
- **Single Posting Point**: Only `PostVoucherUseCase` can write to ledger
- **Fail-Fast**: First policy violation stops execution
- **Policies are read-only**: They never modify data, only allow/deny
- **Config Provider**: Abstracted interface allows future config sources
