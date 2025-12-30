/**
 * VoucherEntity Multi-Currency Verification Script
 * 
 * Official verification for V2 multi-currency support.
 * Run with: npx ts-node --transpile-only src/tests/domain/accounting/entities/verifyMultiCurrency.ts
 * 
 * ROUNDING RULE: baseAmount = roundMoney(amount * exchangeRate) using standard rounding
 */

import { VoucherEntity } from '../../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity, roundMoney, MONEY_EPS } from '../../../../domain/accounting/entities/VoucherLineEntity';
import { VoucherStatus, VoucherType } from '../../../../domain/accounting/types/VoucherTypes';


let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${err.message}`);
    failed++;
  }
}

function expect(value: any) {
  return {
    toBe: (expected: any) => {
      if (value !== expected) {
        throw new Error(`Expected ${expected} but got ${value}`);
      }
    },
    toBeDefined: () => {
      if (value === undefined) {
        throw new Error(`Expected value to be defined`);
      }
    },
    toThrow: (pattern?: RegExp) => {
      try {
        value();
        throw new Error(`Expected function to throw`);
      } catch (err: any) {
        if (pattern && !pattern.test(err.message)) {
          throw new Error(`Expected error to match ${pattern} but got: ${err.message}`);
        }
      }
    }
  };
}

const createVoucher = (lines: VoucherLineEntity[], baseCurrency: string = 'TRY') => {
  const totalDebit = lines.reduce((sum, l) => sum + l.debitAmount, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.creditAmount, 0);
  
  return new VoucherEntity(
    'voucher-1',
    'company-1',
    'V-001',
    VoucherType.JOURNAL_ENTRY,
    '2025-12-29',
    'Test Voucher',
    'USD',
    baseCurrency,
    1,
    lines,
    totalDebit,
    totalCredit,
    VoucherStatus.DRAFT,
    {},
    'user-1',
    new Date()
  );
};

console.log('\n========================================');
console.log('V2 Multi-Currency Verification Tests');
console.log('========================================\n');

// ============================================================
// TEST 1: Mixed FX currencies in one voucher
// ============================================================
console.log('\n--- TEST 1: Mixed FX currencies in one voucher ---');

test('Allow mixed FX currencies with same baseCurrency (USD+TRY lines)', () => {
  const lines = [
    // Debit Cash USD: 300 USD = 9000 TRY
    new VoucherLineEntity(
      1, 'acc_cash_usd', 'Debit',
      9000, 'TRY',  // base
      300, 'USD',   // FX
      30
    ),
    // Debit Cash TRY: 6000 TRY = 6000 TRY
    new VoucherLineEntity(
      2, 'acc_cash_try', 'Debit',
      6000, 'TRY',  // base
      6000, 'TRY',  // same currency
      1
    ),
    // Credit Customer: 500 USD = 15000 TRY
    new VoucherLineEntity(
      3, 'acc_customer', 'Credit',
      15000, 'TRY', // base
      500, 'USD',   // FX
      30
    )
  ];

  const voucher = createVoucher(lines, 'TRY');
  expect(voucher).toBeDefined();
  expect(voucher.totalDebit).toBe(15000);
  expect(voucher.totalCredit).toBe(15000);
  expect(voucher.isBalanced).toBe(true);
});

// ============================================================
// TEST 2: Reject FX line missing exchangeRate
// ============================================================
console.log('\n--- TEST 2: Reject FX line missing exchangeRate ---');

test('Throw when FX line has exchangeRate = 0', () => {
  expect(() => {
    new VoucherLineEntity(
      1, 'acc_bank', 'Debit',
      3000, 'TRY',
      100, 'USD',
      0  // INVALID
    );
  }).toThrow(/FX line requires positive exchangeRate/);
});

test('Throw when FX line has negative exchangeRate', () => {
  expect(() => {
    new VoucherLineEntity(
      1, 'acc_bank', 'Debit',
      3000, 'TRY',
      100, 'USD',
      -5  // INVALID
    );
  }).toThrow(/FX line requires positive exchangeRate/);
});

// ============================================================
// TEST 3: Reject inconsistent baseAmount vs amount*rate
// ============================================================
console.log('\n--- TEST 3: Reject inconsistent baseAmount ---');

test('Throw when baseAmount does not match amount * rate', () => {
  expect(() => {
    new VoucherLineEntity(
      1, 'acc_bank', 'Debit',
      5000, 'TRY',   // WRONG: should be 3000 (100*30)
      100, 'USD',
      30
    );
  }).toThrow(/baseAmount.*does not match/);
});

test('Accept baseAmount within rounding tolerance', () => {
  // 100.33 * 30 = 3009.9, rounds to 3009.9
  const line = new VoucherLineEntity(
    1, 'acc_bank', 'Debit',
    3009.9, 'TRY',   // Correct: round(100.33 * 30) = 3009.9
    100.33, 'USD',
    30
  );
  expect(line.baseAmount).toBe(3009.9);
});

// ============================================================
// TEST 4: Same currency line uses rate=1
// ============================================================
console.log('\n--- TEST 4: Same currency line uses rate=1 ---');

test('Throw when same currency but exchangeRate != 1', () => {
  expect(() => {
    new VoucherLineEntity(
      1, 'acc_bank', 'Debit',
      1000, 'TRY',
      1000, 'TRY',
      1.5   // INVALID: must be 1
    );
  }).toThrow(/exchangeRate must be 1/);
});

test('Accept same currency with rate=1', () => {
  const line = new VoucherLineEntity(
    1, 'acc_bank', 'Debit',
    1000, 'TRY',
    1000, 'TRY',
    1
  );
  expect(line.isForeignCurrency).toBe(false);
  expect(line.exchangeRate).toBe(1);
});

test('Throw when same currency but amount != baseAmount', () => {
  expect(() => {
    new VoucherLineEntity(
      1, 'acc_bank', 'Debit',
      1000, 'TRY',
      500, 'TRY',  // INVALID: should equal baseAmount
      1
    );
  }).toThrow(/amount.*must equal baseAmount/);
});

// ============================================================
// TEST 5: Balancing always in base currency
// ============================================================
console.log('\n--- TEST 5: Balancing always in base currency ---');

test('Reject voucher where base totals do not match', () => {
  const lines = [
    // 100 USD * 30 = 3000 TRY
    new VoucherLineEntity(1, 'acc_bank_usd', 'Debit', 3000, 'TRY', 100, 'USD', 30),
    // 100 EUR * 35 = 3500 TRY (Unbalanced with 3000!)
    new VoucherLineEntity(2, 'acc_payable_eur', 'Credit', 3500, 'TRY', 100, 'EUR', 35)
  ];

  expect(() => {
    createVoucher(lines, 'TRY');
  }).toThrow(/Voucher not balanced in base currency/);
});

test('Accept voucher balanced in base currency despite different FX', () => {
  // Use amounts that correctly multiply to same baseAmount
  // 100 USD * 30 = 3000 TRY
  // 85.7142857... EUR * 35 = 3000 TRY (we use baseAmount directly)
  const lines = [
    new VoucherLineEntity(1, 'acc_bank_usd', 'Debit', 3000, 'TRY', 100, 'USD', 30),
    // For credit: 3000 / 35 = 85.714..., so amount = 85.71, baseAmount must = round(85.71*35) = 2999.85
    // To get exactly 3000, we need amount = 85.7142857... but that won't round nicely
    // So let's use: 120 EUR * 25 = 3000 TRY
    new VoucherLineEntity(2, 'acc_payable_eur', 'Credit', 3000, 'TRY', 120, 'EUR', 25)
  ];

  const voucher = createVoucher(lines, 'TRY');
  expect(voucher.isBalanced).toBe(true);
  expect(voucher.totalDebit).toBe(3000);
  expect(voucher.totalCredit).toBe(3000);
});

// ============================================================
// TEST 6: All lines must share same baseCurrency
// ============================================================
console.log('\n--- TEST 6: All lines must share same baseCurrency ---');

test('Reject voucher with mixed baseCurrencies', () => {
  const line1 = new VoucherLineEntity(1, 'acc1', 'Debit', 1000, 'TRY', 1000, 'TRY', 1);
  const line2 = new VoucherLineEntity(2, 'acc2', 'Credit', 1000, 'USD', 1000, 'USD', 1); // Different base!

  expect(() => {
    new VoucherEntity(
      'v1', 'c1', 'V-001', VoucherType.JOURNAL_ENTRY,
      '2025-12-29', 'Test', 'TRY', 'TRY', 1,
      [line1, line2],
      1000, 1000,
      VoucherStatus.DRAFT, {}, 'u1', new Date()
    );
  }).toThrow(/All lines must use the same base currency/);
});

// ============================================================
// VoucherLineEntity Invariants
// ============================================================
console.log('\n--- VoucherLineEntity Invariants ---');

test('Compute debitAmount correctly for Debit line', () => {
  const line = new VoucherLineEntity(1, 'acc', 'Debit', 1000, 'TRY', 1000, 'TRY', 1);
  expect(line.debitAmount).toBe(1000);
  expect(line.creditAmount).toBe(0);
});

test('Compute creditAmount correctly for Credit line', () => {
  const line = new VoucherLineEntity(1, 'acc', 'Credit', 1000, 'TRY', 1000, 'TRY', 1);
  expect(line.debitAmount).toBe(0);
  expect(line.creditAmount).toBe(1000);
});

test('Reject zero baseAmount', () => {
  expect(() => {
    new VoucherLineEntity(1, 'acc', 'Debit', 0, 'TRY', 0, 'TRY', 1);
  }).toThrow(/baseAmount must be positive/);
});

test('Reject negative amount', () => {
  expect(() => {
    new VoucherLineEntity(1, 'acc', 'Debit', 1000, 'TRY', -500, 'TRY', 1);
  }).toThrow(/amount must be positive/);
});

test('Reject empty accountId', () => {
  expect(() => {
    new VoucherLineEntity(1, '', 'Debit', 1000, 'TRY', 1000, 'TRY', 1);
  }).toThrow(/accountId is required/);
});

// ============================================================
// Rounding Helper
// ============================================================
console.log('\n--- Rounding Helper (Standard Rounding) ---');

test('roundMoney: Round to 2 decimals by default', () => {
  expect(roundMoney(100.456)).toBe(100.46);
  expect(roundMoney(100.454)).toBe(100.45);
});

test('roundMoney: Handle whole numbers', () => {
  expect(roundMoney(100)).toBe(100);
});

// ============================================================
// Summary
// ============================================================
console.log('\n========================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
