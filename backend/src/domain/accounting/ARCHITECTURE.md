# Accounting Module Architecture

## Overview

This document explains the architecture of the accounting module to prevent confusion about the different patterns used.

---

## Two Patterns: Strategies vs Handlers

### ✅ Strategies (PRODUCTION - Primary Pattern)

**Location:** `domain/accounting/strategies/`

**Purpose:** Support **custom voucher forms** created by users

**Used By:**
- `CreateVoucherUseCase` (production API)
- `UpdateVoucherUseCase` (production API)
- All custom forms (JV1, JV2, Payment-Rent, etc.)

**How It Works:**
```
User creates custom form "JV-Depreciation"
  ↓
Maps to base type: JOURNAL_ENTRY
  ↓
Uses: JournalEntryStrategy
  ↓
PostingFieldExtractor maps form fields to strategy input
  ↓
Strategy generates voucher lines
```

**Available Strategies:**
- `JournalEntryStrategy` - For custom journal entries
- `PaymentVoucherStrategy` - For custom payment forms
- `ReceiptVoucherStrategy` - For custom receipt forms
- `OpeningBalanceStrategy` - For opening balances

**Factory:** `VoucherPostingStrategyFactory` selects the right strategy based on voucher type

---

### ✅ Handlers (TESTING ONLY)

**Location:** `domain/accounting/handlers/`

**Purpose:** **Testing and direct API calls** (not used in production UI)

**Used By:**
- Unit tests
- Integration tests
- Seeder scripts (optional)

**How It Works:**
```
Test/Seeder calls SaveJournalEntryUseCase
  ↓
Uses: JournalEntryHandler
  ↓
Handler generates voucher lines
```

**Available Handlers:**
- `JournalEntryHandler` - Test helper
- `PaymentVoucherHandler` - Test helper
- `ReceiptVoucherHandler` - Test helper
- `OpeningBalanceHandler` - Test helper

**Note:** Handlers were introduced as part of ADR-005 for cleaner testing, but **production uses strategies**.

---

## Critical Rule: Base Currency

**ACCOUNTING RULE:** All ledger entries MUST be in the company's base currency.

### ✅ Correct Implementation

```typescript
// In CreateVoucherUseCase (PRODUCTION)
const settings = await this.settingsRepo.getSettings(companyId, 'accounting');
const baseCurrency = settings?.baseCurrency || 'USD';  // ✅ From company settings
```

### ❌ NEVER Do This

```typescript
// WRONG - Frontend can override base currency!
const baseCurrency = payload.baseCurrency || settings?.baseCurrency;  // ❌ SECURITY RISK
```

**Why:** If frontend sends `payload.baseCurrency = "EUR"` (voucher currency), ledger entries would be saved in EUR instead of USD, violating accounting rules.

---

## Production Flow

### Creating a Voucher

```
Frontend (Custom Form)
  ↓
POST /api/accounting/vouchers
  ↓
VoucherController.create()
  ↓
CreateVoucherUseCase
  ↓
1. Fetch company base currency from settings ✅
2. Get strategy from factory
3. Extract posting fields from form
4. Strategy generates lines
5. Create VoucherEntity
6. Save to repository
```

### Key Files

**Production:**
- `api/controllers/accounting/VoucherController.ts` - API endpoints
- `application/accounting/use-cases/VoucherUseCases.ts` - Business logic
- `domain/accounting/strategies/` - Posting logic for custom forms
- `domain/accounting/factories/VoucherPostingStrategyFactory.ts` - Strategy selection

**Testing:**
- `application/accounting/use-cases/SaveJournalEntryUseCase.ts` - Test use case
- `domain/accounting/handlers/` - Test helpers

---

## When to Use What

### Use Strategies When:
- ✅ Building custom voucher forms
- ✅ Production code
- ✅ User-facing features

### Use Handlers When:
- ✅ Writing unit tests
- ✅ Writing integration tests
- ✅ Seeder scripts (optional)

### Never Mix:
- ❌ Don't use handlers in production API
- ❌ Don't use strategies in unit tests (use handlers for cleaner tests)

---

## Common Pitfalls

### ❌ Pitfall 1: Trusting Frontend for Base Currency
```typescript
// WRONG
const baseCurrency = payload.baseCurrency || settings?.baseCurrency;
```

**Fix:** Always fetch from company settings first
```typescript
// CORRECT
const baseCurrency = settings?.baseCurrency || 'USD';
```

### ❌ Pitfall 2: Using Handlers in Production
```typescript
// WRONG - Handler not designed for production
const handler = new JournalEntryHandler();
```

**Fix:** Use strategies via CreateVoucherUseCase
```typescript
// CORRECT
const useCase = new CreateVoucherUseCase(...);
```

### ❌ Pitfall 3: Confusing Voucher Currency with Base Currency
- **Voucher Currency:** EUR (what user enters)
- **Base Currency:** USD (what ledger uses)
- **Exchange Rate:** Converts voucher → base

---

## Future Developers

**If you're confused about which pattern to use:**

1. **Are you building a production feature?** → Use **Strategies**
2. **Are you writing a test?** → Use **Handlers**
3. **Are you touching CreateVoucherUseCase?** → Be careful with `baseCurrency`!

**Questions?** Read this document first, then ask the team.

---

## Change Log

- **2026-01-12:** Initial documentation to clarify strategies vs handlers
- **2026-01-12:** Fixed critical bug where frontend could override base currency
