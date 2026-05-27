import { describe, expect, it } from '@jest/globals';
import { calculateSalesInvoiceLineAmounts } from '../../../application/sales/services/SalesInvoiceCalculationService';

// ---------------------------------------------------------------------------
// Golden tests for tax-exclusive and tax-inclusive line pricing.
//
// Context: SalesInvoiceCalculationService supports two price modes:
//   - Tax-EXCLUSIVE (default, priceIsInclusive: false/undefined):
//       unitPriceDoc is the net pre-tax price; tax is added on top.
//   - Tax-INCLUSIVE (priceIsInclusive: true):
//       unitPriceDoc already contains tax; the service back-calculates
//       the net price using lineTotalDoc = postDiscountInclusive / (1 + taxRate).
//
// Canonical IFRS/VAT math:
//   Inclusive, no discount: unitPrice=110, taxRate=10%
//     net = 110 / 1.10 = 100, tax = 10, grandTotal = 110
//   Inclusive, 5% discount applied to the inclusive price:
//     discountedInclusive = 110 * 0.95 = 104.50
//     net = 104.50 / 1.10 = 95, tax = 9.50, grandTotal = 104.50
// ---------------------------------------------------------------------------

const EXCHANGE_RATE = 1; // 1:1 so doc and base amounts are identical

// ---------------------------------------------------------------------------
// Case 1 — Tax-exclusive baseline
// unit=100, qty=1, taxRate=10%, no discount → net=100, tax=10, total=110
// ---------------------------------------------------------------------------
describe('Case 1: Tax-exclusive baseline (no discount)', () => {
  const result = calculateSalesInvoiceLineAmounts({
    invoicedQty: 1,
    unitPriceDoc: 100,
    exchangeRate: EXCHANGE_RATE,
    taxRate: 0.10,
    priceIsInclusive: false,
  });

  it('grossLineTotalDoc = 100', () => {
    expect(result.grossLineTotalDoc).toBe(100);
  });

  it('discountAmountDoc = 0', () => {
    expect(result.discountAmountDoc).toBe(0);
  });

  it('lineTotalDoc (net ex-tax) = 100', () => {
    expect(result.lineTotalDoc).toBe(100);
  });

  it('taxAmountDoc = 10', () => {
    expect(result.taxAmountDoc).toBe(10);
  });

  it('grandTotal (lineTotalDoc + taxAmountDoc) = 110', () => {
    expect(result.lineTotalDoc + result.taxAmountDoc).toBe(110);
  });
});

// ---------------------------------------------------------------------------
// Case 2 — Tax-inclusive baseline
// unit=110 (inc), qty=1, taxRate=10%, no discount → net=100, tax=10, total=110
// ---------------------------------------------------------------------------
describe('Case 2: Tax-inclusive baseline (no discount)', () => {
  const result = calculateSalesInvoiceLineAmounts({
    invoicedQty: 1,
    unitPriceDoc: 110,
    exchangeRate: EXCHANGE_RATE,
    taxRate: 0.10,
    priceIsInclusive: true,
  });

  it('grossLineTotalDoc = 110 (inclusive pre-discount amount)', () => {
    expect(result.grossLineTotalDoc).toBe(110);
  });

  it('discountAmountDoc = 0', () => {
    expect(result.discountAmountDoc).toBe(0);
  });

  it('lineTotalDoc (net ex-tax) = 100', () => {
    expect(result.lineTotalDoc).toBe(100);
  });

  it('taxAmountDoc = 10', () => {
    expect(result.taxAmountDoc).toBe(10);
  });

  it('lineTotalDoc + taxAmountDoc = 110 (same grand total as case 1)', () => {
    expect(result.lineTotalDoc + result.taxAmountDoc).toBe(110);
  });
});

// ---------------------------------------------------------------------------
// Case 3 — Tax-exclusive + 5% line discount
// unit=100, qty=1, taxRate=10%, 5% discount → net=95, tax=9.50, total=104.50
// ---------------------------------------------------------------------------
describe('Case 3: Tax-exclusive + 5% line discount', () => {
  const result = calculateSalesInvoiceLineAmounts({
    invoicedQty: 1,
    unitPriceDoc: 100,
    exchangeRate: EXCHANGE_RATE,
    taxRate: 0.10,
    priceIsInclusive: false,
    discountType: 'PERCENT',
    discountValue: 5,
  });

  it('grossLineTotalDoc = 100', () => {
    expect(result.grossLineTotalDoc).toBe(100);
  });

  it('discountAmountDoc = 5', () => {
    expect(result.discountAmountDoc).toBe(5);
  });

  it('lineTotalDoc (net ex-tax) = 95', () => {
    expect(result.lineTotalDoc).toBe(95);
  });

  it('taxAmountDoc = 9.50', () => {
    expect(result.taxAmountDoc).toBe(9.5);
  });

  it('lineTotalDoc + taxAmountDoc = 104.50', () => {
    expect(result.lineTotalDoc + result.taxAmountDoc).toBe(104.5);
  });
});

// ---------------------------------------------------------------------------
// Case 4 — Tax-inclusive + 5% line discount
// unit=110 (inc), qty=1, taxRate=10%, 5% discount
// → discountedInc=104.50, net=95, tax=9.50, total=104.50
// ---------------------------------------------------------------------------
describe('Case 4: Tax-inclusive + 5% line discount', () => {
  const result = calculateSalesInvoiceLineAmounts({
    invoicedQty: 1,
    unitPriceDoc: 110,
    exchangeRate: EXCHANGE_RATE,
    taxRate: 0.10,
    priceIsInclusive: true,
    discountType: 'PERCENT',
    discountValue: 5,
  });

  it('grossLineTotalDoc = 110 (pre-discount inclusive)', () => {
    expect(result.grossLineTotalDoc).toBe(110);
  });

  it('discountAmountDoc = 5.50 (5% of inclusive 110)', () => {
    expect(result.discountAmountDoc).toBe(5.5);
  });

  it('lineTotalDoc (net ex-tax) = 95', () => {
    expect(result.lineTotalDoc).toBe(95);
  });

  it('taxAmountDoc = 9.50', () => {
    expect(result.taxAmountDoc).toBe(9.5);
  });

  it('lineTotalDoc + taxAmountDoc = 104.50', () => {
    expect(result.lineTotalDoc + result.taxAmountDoc).toBe(104.5);
  });
});

// ---------------------------------------------------------------------------
// Case 5 — Quantity scaling (qty=10)
// Cases 3 and 4 scaled by 10: totals must scale linearly.
// ---------------------------------------------------------------------------
describe('Case 5a: Quantity scaling — tax-exclusive, qty=10', () => {
  const result = calculateSalesInvoiceLineAmounts({
    invoicedQty: 10,
    unitPriceDoc: 100,
    exchangeRate: EXCHANGE_RATE,
    taxRate: 0.10,
    priceIsInclusive: false,
    discountType: 'PERCENT',
    discountValue: 5,
  });

  it('grossLineTotalDoc = 1000', () => {
    expect(result.grossLineTotalDoc).toBe(1000);
  });

  it('discountAmountDoc = 50', () => {
    expect(result.discountAmountDoc).toBe(50);
  });

  it('lineTotalDoc = 950', () => {
    expect(result.lineTotalDoc).toBe(950);
  });

  it('taxAmountDoc = 95', () => {
    expect(result.taxAmountDoc).toBe(95);
  });

  it('lineTotalDoc + taxAmountDoc = 1045', () => {
    expect(result.lineTotalDoc + result.taxAmountDoc).toBe(1045);
  });
});

describe('Case 5b: Quantity scaling — tax-inclusive, qty=10', () => {
  const result = calculateSalesInvoiceLineAmounts({
    invoicedQty: 10,
    unitPriceDoc: 110,
    exchangeRate: EXCHANGE_RATE,
    taxRate: 0.10,
    priceIsInclusive: true,
    discountType: 'PERCENT',
    discountValue: 5,
  });

  it('grossLineTotalDoc = 1100 (inclusive pre-discount)', () => {
    expect(result.grossLineTotalDoc).toBe(1100);
  });

  it('discountAmountDoc = 55 (5% of 1100)', () => {
    expect(result.discountAmountDoc).toBe(55);
  });

  it('lineTotalDoc = 950', () => {
    expect(result.lineTotalDoc).toBe(950);
  });

  it('taxAmountDoc = 95', () => {
    expect(result.taxAmountDoc).toBe(95);
  });

  it('lineTotalDoc + taxAmountDoc = 1045', () => {
    expect(result.lineTotalDoc + result.taxAmountDoc).toBe(1045);
  });
});
