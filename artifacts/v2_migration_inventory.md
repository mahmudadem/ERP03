# V2 Voucher Migration - Field Inventory

## STEP 1: Field Comparison Table

### Voucher (Header) Fields

| Category | Legacy Field | V2 Field | Status | Notes |
|----------|-------------|----------|--------|-------|
| **Identity** | `id` | `id` | ✅ Present | - |
| | `companyId` | `companyId` | ✅ Present | - |
| | `voucherNo` | `voucherNo` | ✅ Present | - |
| | `type` | `type` | ✅ Present | Uses VoucherType enum |
| **Core Data** | `date` | `date` | ✅ Present | V2 uses ISO string |
| | `description` | `description` | ✅ Present | V2 has it as required |
| | `reference` | - | ❌ **MISSING** | External ref (invoice #, etc.) |
| **Currency** | `currency` | `currency` | ✅ Present | Transaction currency |
| | `baseCurrency` | `baseCurrency` | ✅ Present | - |
| | `exchangeRate` | `exchangeRate` | ✅ Present | - |
| **Totals** | `totalDebit` | `totalDebit` | ✅ Present | - |
| | `totalCredit` | `totalCredit` | ✅ Present | - |
| | `totalDebitBase` | - | ❌ **MISSING** | Base currency total |
| | `totalCreditBase` | - | ❌ **MISSING** | Base currency total |
| **Status** | `status` | `status` | ✅ Present | Uses VoucherStatus enum |
| **Audit** | `createdBy` | `createdBy` | ✅ Present | - |
| | `createdAt` | `createdAt` | ✅ Present | - |
| | `updatedAt` | - | ❌ **MISSING** | Last modification time |
| | `approvedBy` | `approvedBy` | ✅ Present | - |
| | `approvedAt` | `approvedAt` | ✅ Present | - |
| | `rejectedBy` | `rejectedBy` | ✅ Present | - |
| | `rejectedAt` | `rejectedAt` | ✅ Present | - |
| | `rejectionReason` | `rejectionReason` | ✅ Present | - |
| | `lockedBy` | `lockedBy` | ✅ Present | - |
| | `lockedAt` | `lockedAt` | ✅ Present | - |
| | `postedBy` | `postedBy` | ✅ Present | - |
| | `postedAt` | `postedAt` | ✅ Present | - |
| **Source** | `sourceModule` | - | ❌ **MISSING** | accounting/pos/inventory/hr |
| | `formId` | - | ❌ **MISSING** | Which form created this |
| | `prefix` | - | ❌ **MISSING** | Number prefix (JE-, PV-, RV-) |
| **Lines** | `lines[]` | `lines[]` | ✅ Present | Different type |
| **Metadata** | `metadata` | `metadata` | ✅ Present | Generic extra fields |

### VoucherLine Fields

| Category | Legacy Field | V2 Field | Status | Notes |
|----------|-------------|----------|--------|-------|
| **Identity** | `id` (string) | `id` (number) | ⚠️ **TYPE DIFF** | V2 uses numeric index |
| | `voucherId` | - | ❌ **MISSING** | Back-reference to parent |
| **Account** | `accountId` | `accountId` | ✅ Present | - |
| | `costCenterId` | `costCenterId` | ✅ Present | - |
| **Amount (Legacy Pattern)** | `debitFx` | - | ⚠️ Replaced | V2 uses side+amount |
| | `creditFx` | - | ⚠️ Replaced | V2 uses side+amount |
| | `debitBase` | - | ⚠️ Replaced | V2 computes via getter |
| | `creditBase` | - | ⚠️ Replaced | V2 computes via getter |
| | `fxAmount` | `amount` | ✅ Equivalent | Transaction currency amount |
| | `baseAmount` | `baseAmount` | ✅ Present | - |
| **Amount (V2 Pattern)** | - | `side` | ✅ V2 only | 'Debit' or 'Credit' |
| | - | `amount` | ✅ V2 only | Positive, side determines dr/cr |
| | - | `debitAmount` (getter) | ✅ V2 only | Computed |
| | - | `creditAmount` (getter) | ✅ V2 only | Computed |
| **Currency** | `lineCurrency` | `currency` | ✅ Equivalent | - |
| | `rateAccToBase` | `exchangeRate` | ✅ Equivalent | - |
| **Description** | `description` | `notes` | ✅ Equivalent | Different name |
| **Metadata** | `metadata` | `metadata` | ✅ Present | - |

---

## STEP 2: Missing Fields to Add to V2

### VoucherEntity - Must Add:

| Field | Type | Purpose | Storage Strategy |
|-------|------|---------|------------------|
| `reference` | `string \| null` | External reference (invoice #, check #) | Constructor param |
| `updatedAt` | `Date \| null` | Last modification timestamp | Constructor param |
| `sourceModule` | `string \| null` | Origin module | `metadata.sourceModule` |
| `formId` | `string \| null` | Form used to create voucher | `metadata.formId` |
| `prefix` | `string \| null` | Voucher number prefix | `metadata.prefix` |

### VoucherLineEntity - Must Add:

| Field | Type | Purpose | Storage Strategy |
|-------|------|---------|------------------|
| `voucherId` | `string` | Back-reference to parent | Constructor param (optional for V2) |

---

## Conclusion

**V2 Entity is 95% complete.** Only need to add:
1. `reference` field to VoucherEntity (external references)
2. `updatedAt` field to VoucherEntity (modification tracking)
3. Form/source fields can go in metadata (already supported)

The line entity uses a cleaner pattern (side+amount) which is mathematically equivalent to the legacy pattern (debitFx/creditFx). V2 provides computed getters for backwards compatibility.
