# 17 — Opening Balance Import UI

> **Priority:** P3 (Lower)
> **Estimated Effort:** 2 days
> **Dependencies:** None

---

## Business Context

When setting up a new company in the system, users need to enter **opening balances** for all accounts (carrying forward from a previous system or paper records). Manually entering 50-200 accounts one by one is tedious and error-prone. A bulk import (via spreadsheet) is essential for onboarding.

---

## Current State

- ✅ `OpeningBalanceStrategy` exists in backend
- ✅ Can create opening balance vouchers via API
- ❌ No bulk import UI
- ❌ No CSV/Excel upload for opening balances
- ❌ No guided wizard for initial setup

---

## Requirements

### Functional
1. **Download template** — CSV/Excel template with account codes and balance columns
2. **Upload populated template** — User fills in balances and uploads
3. **Validation** — Verify account codes exist, debits = credits, amounts are valid
4. **Preview** — Show parsed data before committing
5. **Generate** — Create opening balance voucher(s) from the import
6. **Error handling** — Show line-by-line validation errors

---

## Implementation Plan

### Step 1: Frontend — Import Wizard Component

**File:** `frontend/src/modules/accounting/pages/OpeningBalanceImportPage.tsx` (NEW)

Steps:
1. Download template (CSV with columns: Account Code, Account Name, Debit, Credit)
2. Upload filled template
3. Parse and validate
4. Preview table with validation status per row
5. Submit → creates opening balance voucher

### Step 2: Backend — Bulk Import Endpoint
```
POST /accounting/vouchers/opening-balance/import
Body: { lines: [{ accountCode, debit, credit }], date }
```

Validates all lines, creates OB voucher(s).

### Step 3: Template Generation
- Endpoint or client-side: generate CSV with all active accounts pre-filled (code + name, empty debit/credit columns)

---

## Acceptance Criteria

- [ ] Template can be downloaded with all company accounts
- [ ] Uploaded CSV is parsed and validated
- [ ] Validation errors shown per line (unknown account, unbalanced)
- [ ] Preview shows parsed data before commit
- [ ] Opening balance voucher created successfully
- [ ] Debits = Credits enforced
