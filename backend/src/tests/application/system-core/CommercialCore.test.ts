import {
  CommercialCore,
  calculateCommercialDiscountAmount,
  calculateCommercialLineAmounts,
} from '../../../application/system-core';

describe('Commercial Core', () => {
  it('250l-1 calculates PERCENT and AMOUNT discounts with gross clamping', () => {
    expect(calculateCommercialDiscountAmount({
      quantity: 10,
      unitPrice: 100,
      discountType: 'PERCENT',
      discountValue: 10,
      currency: 'USD',
    })).toBe(100);

    expect(calculateCommercialDiscountAmount({
      quantity: 2,
      unitPrice: 50,
      discountType: 'AMOUNT',
      discountValue: 500,
      currency: 'USD',
    })).toBe(100);
  });

  it('250l-1 preserves golden exclusive line totals while owning the discount decision', () => {
    const amounts = calculateCommercialLineAmounts({
      quantity: 10,
      unitPriceDoc: 100,
      exchangeRate: 1,
      taxRate: 0.05,
      discountType: 'PERCENT',
      discountValue: 10,
      currency: 'USD',
    });

    expect(amounts.grossLineTotalDoc).toBe(1000);
    expect(amounts.discountAmountDoc).toBe(100);
    expect(amounts.lineTotalDoc).toBe(900);
    expect(amounts.taxAmountDoc).toBe(45);
  });

  it('250l-1 preserves golden inclusive line totals', () => {
    const amounts = calculateCommercialLineAmounts({
      quantity: 10,
      unitPriceDoc: 100,
      exchangeRate: 1,
      taxRate: 0.1,
      priceIsInclusive: true,
      discountType: 'PERCENT',
      discountValue: 10,
      currency: 'USD',
    });

    expect(amounts.grossLineTotalDoc).toBe(1000);
    expect(amounts.discountAmountDoc).toBe(100);
    expect(amounts.lineTotalDoc).toBe(818.18);
    expect(amounts.taxAmountDoc).toBe(81.82);
  });

  it('250l-1 delegates price resolution through the core seam', async () => {
    const core = new CommercialCore(async (context) => context.itemId === 'item_1' ? 42 : null);

    await expect(core.resolvePrice({ companyId: 'cmp_1', itemId: 'item_1' })).resolves.toBe(42);
    await expect(core.resolvePrice({ companyId: 'cmp_1', itemId: 'item_2' })).resolves.toBeNull();
  });
});
