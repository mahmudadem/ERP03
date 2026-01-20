# Manual Test Guide: Multi-Currency Voucher Logic

## Prerequisites
1. Start the backend: `npm run dev --prefix backend`
2. Start the frontend: `npm run dev --prefix frontend`
3. Ensure you have at least two currencies enabled (e.g., USD as base, EUR as foreign)
4. Set EUR exchange rate to **1.1** (meaning 1 EUR = 1.1 USD)

---

## Test Case 1: Pure Foreign Currency Voucher (EUR → EUR)

### Steps
1. Navigate to **Vouchers** → **New Voucher** (Journal Entry type)
2. Set **Header Currency**: `EUR`
3. Set **Header Exchange Rate**: `1.1`
4. Add **Line 1**: 
   - Account: Any expense account
   - Currency: `EUR`
   - Debit: `100`
5. Add **Line 2**:
   - Account: Any bank account
   - Currency: `EUR`
   - Credit: `100`

### Expected Results
| Field | Expected Value |
|-------|----------------|
| Line 1 Parity | **1.0** (auto-calculated, 1 EUR = 1 EUR) |
| Line 1 Equivalent | **100.00** (displayed in voucher currency) |
| Line 2 Parity | **1.0** |
| Line 2 Equivalent | **100.00** |
| Footer Total Debit (USD) | **110.00** (100 × 1.0 × 1.1) |
| Footer Total Credit (USD) | **110.00** |
| Footer Status | **Balanced** (green) |

### Verification
- Save the voucher
- Open browser DevTools → Network tab
- Inspect the POST request payload
- Confirm `lines[0].exchangeRate` = **1** (not 1.1!)
- Confirm `lines[0].baseAmount` is **NOT** in the payload (backend calculates it)

---

## Test Case 2: Mixed Currency Voucher (EUR Header, USD Line)

### Steps
1. Create a new Journal Entry voucher
2. Set **Header Currency**: `EUR`
3. Set **Header Exchange Rate**: `1.1`
4. Add **Line 1**:
   - Account: Any expense account
   - Currency: `EUR`
   - Debit: `100`
5. Add **Line 2**:
   - Account: Any bank account (USD account if available)
   - Currency: `USD`
   - Credit: `110`

### Expected Results
| Field | Expected Value |
|-------|----------------|
| Line 1 Parity | **1.0** |
| Line 1 Equivalent | **100.00** EUR |
| Line 2 Parity | **~0.909** (auto-calculated: 1/1.1) |
| Line 2 Equivalent | **100.00** EUR (110 × 0.909) |
| Footer Total Debit (USD) | **110.00** |
| Footer Total Credit (USD) | **110.00** |
| Footer Status | **Balanced** |

### Backend Calculation Verification
- Line 1: 100 × 1.0 × 1.1 = **110 USD** ✓
- Line 2: 110 × 0.909 × 1.1 ≈ **110 USD** ✓

---

## Test Case 3: Parity Override

### Steps
1. Create a new Journal Entry voucher in EUR @ 1.1
2. Add Line 1: EUR, Debit 100, Parity auto-fills as 1.0
3. **Manually change Line 1 Parity to 1.05** (user override)
4. Observe the Equivalent and Footer update

### Expected Results
| Field | Expected Value |
|-------|----------------|
| Line 1 Parity | **1.05** (overridden) |
| Line 1 Equivalent | **105.00** EUR (100 × 1.05) |
| Footer Total Debit (USD) | **115.50** (100 × 1.05 × 1.1) |

---

## Test Case 4: USD Voucher (Base Currency Document)

### Steps
1. Create a new Journal Entry voucher
2. Set **Header Currency**: `USD`
3. Set **Header Exchange Rate**: `1.0` (or leave default)
4. Add Line 1: USD, Debit 100
5. Add Line 2: USD, Credit 100

### Expected Results
| Field | Expected Value |
|-------|----------------|
| Line 1 Parity | **1.0** |
| Line 2 Parity | **1.0** |
| Footer Total Debit (USD) | **100.00** |
| Footer Total Credit (USD) | **100.00** |

---

## Test Case 5: Third Currency Line (TRY in EUR Voucher)

### Prerequisites
- Enable TRY currency
- Set TRY/USD rate (e.g., 0.03 meaning 1 TRY = 0.03 USD)

### Steps
1. Create Journal Entry voucher: EUR @ 1.1
2. Add Line 1: TRY, Debit 1000
3. Observe auto-calculated Parity

### Expected Results
| Field | Expected Value |
|-------|----------------|
| Line 1 Parity | ~0.027 (TRY→EUR rate, fetched from API) |
| Line 1 Equivalent | ~27 EUR |
| Footer Total Debit (USD) | ~30 USD (1000 × 0.027 × 1.1) |

---

## Validation Error Tests

### Test 6A: Zero Header Rate (Should Block)
1. Create voucher with EUR currency
2. Try to set Exchange Rate to `0`
3. **Expected**: UI should prevent saving or show error

### Test 6B: Empty Parity (Should Default to 1)
1. Create voucher
2. Clear the Parity field on a line
3. **Expected**: Should default to 1.0 or block saving

---

## Database Verification

After saving a voucher, query Firestore/Database to verify:

```javascript
// Check saved voucher line
const line = voucher.lines[0];
console.log({
  amount: line.amount,        // Should match UI input
  currency: line.currency,    // Should be uppercase
  exchangeRate: line.exchangeRate,  // Absolute rate (parity × headerRate)
  baseAmount: line.baseAmount,      // Calculated: amount × exchangeRate
  baseCurrency: line.baseCurrency   // Should be 'USD'
});
```

### Example: EUR Line in EUR Voucher @ 1.1
- `amount`: 100
- `currency`: EUR
- `exchangeRate`: **1.1** (1.0 × 1.1)
- `baseAmount`: **110** (100 × 1.1)
- `baseCurrency`: USD

---

## Summary Checklist

- [ ] EUR/EUR line has parity 1.0
- [ ] USD line in EUR voucher has parity ~0.909
- [ ] Footer shows USD totals
- [ ] Balanced status turns green when debits = credits (in USD)
- [ ] Network payload does NOT include calculated baseAmount
- [ ] Saved voucher has correct baseAmount in database
