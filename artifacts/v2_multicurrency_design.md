# V2 Multi-Currency Design Document

## Overview

This document defines the official multi-currency design for VoucherEntity and VoucherLineEntity (V2).

**Key Principle:** Mixed FX currencies are allowed within a single voucher. Balancing is ALWAYS on base currency.

---

## Money Constants (Centralized)

```typescript
// From VoucherLineEntity.ts - exported for use everywhere

/** Epsilon for money comparisons (1 cent tolerance) */
export const MONEY_EPS = 0.01;

/** Default decimal places for money rounding */
export const MONEY_DECIMALS = 2;
```

---

## Rounding Rule

**MANDATORY:** `baseAmount = roundMoney(amount * exchangeRate)`

```typescript
/**
 * Round a monetary value using STANDARD rounding (Math.round).
 * 
 * NOTE: This is NOT banker's rounding (half-even).
 * Standard rounding (half away from zero) is used consistently throughout.
 * 
 * @param value The value to round
 * @param decimals Number of decimal places (default: 2)
 * @returns Rounded value
 */
export function roundMoney(value: number, decimals: number = MONEY_DECIMALS): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Check if two money values are equal within MONEY_EPS tolerance
 */
export function moneyEquals(a: number, b: number): boolean {
  return Math.abs(a - b) <= MONEY_EPS;
}
```

---

## VoucherLineEntity Structure

```typescript
class VoucherLineEntity {
  // Identity
  readonly id: number;
  readonly accountId: string;
  readonly side: 'Debit' | 'Credit';

  // Base currency (company reporting currency)
  readonly baseAmount: number;      // ALWAYS positive, in baseCurrency
  readonly baseCurrency: string;    // Must match company base

  // FX currency (transaction currency)
  readonly amount: number;          // ALWAYS positive, in currency
  readonly currency: string;        // May differ per line

  // Exchange rate frozen at transaction time
  readonly exchangeRate: number;    // Rate from currency → baseCurrency

  // Optional
  readonly notes?: string;
  readonly costCenterId?: string;
  readonly metadata: Record<string, any>;
}
```

---

## Invariants (VoucherLineEntity)

| # | Invariant | Error if violated |
|---|-----------|-------------------|
| 1 | `side` must be 'Debit' or 'Credit' | "Invalid side" |
| 2 | `accountId` must be non-empty | "accountId is required" |
| 3 | `baseCurrency` must be non-empty | "baseCurrency is required" |
| 4 | `currency` must be non-empty | "currency is required" |
| 5 | `baseAmount` must be > 0 | "baseAmount must be positive" |
| 6 | `amount` must be > 0 | "amount must be positive" |

### FX-Specific Invariants

| Condition | Invariant | Error if violated |
|-----------|-----------|-------------------|
| `currency == baseCurrency` | `exchangeRate` must be 1 | "exchangeRate must be 1" |
| `currency == baseCurrency` | `moneyEquals(amount, baseAmount)` | "amount must equal baseAmount" |
| `currency != baseCurrency` | `exchangeRate` must be > 0 | "FX line requires positive exchangeRate" |
| `currency != baseCurrency` | `moneyEquals(baseAmount, roundMoney(amount * exchangeRate))` | "baseAmount does not match" |

---

## VoucherEntity Invariants

| # | Invariant | Error if violated |
|---|-----------|-------------------|
| 1 | Must have at least 2 lines | "Voucher must have at least 2 lines" |
| 2 | `moneyEquals(sum(debitAmount), sum(creditAmount))` in BASE currency | "Voucher not balanced in base currency" |
| 3 | `moneyEquals(totalDebit, calculatedDebit)` | "Total debit does not match" |
| 4 | `moneyEquals(totalCredit, calculatedCredit)` | "Total credit does not match" |
| 5 | All lines must have same `baseCurrency` | "All lines must use the same base currency" |

**NOTE:** Lines may have DIFFERENT `currency` values (mixed FX). This is allowed.

---

## Example: Mixed FX Voucher

Scenario: Customer pays 500 USD, split into USD cash and TRY cash.
Company base currency: TRY. Rate: 1 USD = 30 TRY.

```typescript
const lines = [
  // Debit Cash USD: 300 USD = 9000 TRY
  new VoucherLineEntity(
    1, 'acc_cash_usd', 'Debit',
    9000, 'TRY',    // base
    300, 'USD',     // FX
    30              // rate
  ),
  // Debit Cash TRY: 6000 TRY = 6000 TRY
  new VoucherLineEntity(
    2, 'acc_cash_try', 'Debit',
    6000, 'TRY',    // base
    6000, 'TRY',    // same currency
    1               // rate = 1
  ),
  // Credit Customer: 500 USD = 15000 TRY
  new VoucherLineEntity(
    3, 'acc_customer', 'Credit',
    15000, 'TRY',   // base
    500, 'USD',     // FX
    30              // rate
  )
];

// Result:
// Total Debit (base):  9000 + 6000 = 15000 TRY
// Total Credit (base): 15000 TRY
// BALANCED ✓
```

---

## Computed Getters

```typescript
// VoucherLineEntity
get debitAmount(): number   // baseAmount if side='Debit', else 0
get creditAmount(): number  // baseAmount if side='Credit', else 0
get isDebit(): boolean
get isCredit(): boolean
get isForeignCurrency(): boolean  // currency !== baseCurrency

// VoucherEntity
get isBalanced(): boolean   // moneyEquals(totalDebit, totalCredit)
get totalDebitBase(): number   // Same as totalDebit
get totalCreditBase(): number  // Same as totalCredit
```

---

## Verification Tests

Run: `npx ts-node --transpile-only src/tests/domain/accounting/entities/verifyMultiCurrency.ts`

| Test | Description | Status |
|------|-------------|--------|
| TEST 1 | Mixed FX currencies in one voucher | ✅ PASS |
| TEST 2 | Reject FX line with exchangeRate = 0 | ✅ PASS |
| TEST 3 | Reject inconsistent baseAmount | ✅ PASS |
| TEST 4 | Same currency requires rate=1 | ✅ PASS |
| TEST 5 | Balancing always in base currency | ✅ PASS |
| TEST 6 | Reject mixed baseCurrencies | ✅ PASS |
| + | VoucherLineEntity invariants (6 tests) | ✅ PASS |
| + | roundMoney standard rounding (2 tests) | ✅ PASS |

**All 18 tests pass.**

---

## No Legacy Runtime Dependencies

**IMPORTANT:** Legacy data format support has been REMOVED from `VoucherLineEntity.fromJSON()`.

If you have legacy data in the database:
1. Delete it (recommended since we have no important old data)
2. OR run a one-time migration script (not part of core runtime)

```typescript
// VoucherLineEntity.fromJSON() now throws if legacy format detected:
if (data.side === undefined || data.baseCurrency === undefined) {
  throw new Error('Invalid VoucherLineEntity data: missing required V2 fields');
}
```

---

## No Changes to Posting Persistence

The Single Posting Point (`PostVoucherUseCase`) and ledger persistence remain unchanged.
Only VoucherLineEntity constructor parameter order was modified (baseAmount/baseCurrency now come before amount/currency).
