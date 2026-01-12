# Voucher Posting Strategies

## ⚠️ PRODUCTION CODE - Handle with Care

This directory contains the **production posting logic** for all custom voucher forms.

## Purpose

Strategies support **infinite custom forms** created by users:
- User creates "JV-Depreciation" form → Uses `JournalEntryStrategy`
- User creates "Payment-Rent" form → Uses `PaymentVoucherStrategy`
- User creates "Receipt-Sales" form → Uses `ReceiptVoucherStrategy`

## Critical Rules

### 1. Base Currency MUST Come from Company Settings

```typescript
// ✅ CORRECT
const baseCurrency = settings?.baseCurrency || 'USD';

// ❌ WRONG - Security risk!
const baseCurrency = header.baseCurrency || settings?.baseCurrency;
```

**Why:** Frontend sends `header.baseCurrency` which could be the voucher currency (EUR), not the company base currency (USD). This would save ledger entries in the wrong currency.

### 2. Never Trust Frontend for Financial Data

- ✅ Fetch base currency from database
- ✅ Validate all amounts
- ✅ Verify account IDs exist
- ❌ Never use `payload.baseCurrency`

## Available Strategies

- `JournalEntryStrategy.ts` - Manual journal entries
- `PaymentVoucherStrategy.ts` - Payment vouchers
- `ReceiptVoucherStrategy.ts` - Receipt vouchers
- `OpeningBalanceStrategy.ts` - Opening balances

## See Also

- `../ARCHITECTURE.md` - Full architecture documentation
- `../factories/VoucherPostingStrategyFactory.ts` - Strategy selection
- `../../application/accounting/use-cases/VoucherUseCases.ts` - How strategies are used
