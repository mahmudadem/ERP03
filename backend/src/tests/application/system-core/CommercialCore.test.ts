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

  it('250l-2 allows healthy margins and returns the computed margin', async () => {
    const core = new CommercialCore(undefined, async () => 60);

    const result = await core.validateCostMargin({
      companyId: 'cmp_1',
      itemId: 'item_1',
      unitPriceBase: 100,
      minimumMarginPct: 20,
    });

    expect(result).toMatchObject({
      allowed: true,
      requiresApproval: false,
      reason: 'OK',
      unitCostBase: 60,
      marginPct: 40,
    });
  });

  it('250l-2 routes below-cost sales to the approval engine', async () => {
    const approvalEngine = {
      evaluate: jest.fn().mockResolvedValue({
        decision: 'PENDING',
        requiredApprovers: ['manager_1'],
        gates: [{ name: 'generic_subject', required: true }],
      }),
    };
    const core = new CommercialCore(undefined, async () => 12, approvalEngine as any);

    const result = await core.validateCostMargin({
      companyId: 'cmp_1',
      itemId: 'item_1',
      unitPriceBase: 10,
      actorUserId: 'cashier_1',
      source: 'pos',
    });

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.reason).toBe('BELOW_COST');
    expect(approvalEngine.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'below_cost_sale',
        payload: expect.objectContaining({ requiresApproval: true, unitPriceBase: 10, unitCostBase: 12 }),
      }),
      expect.objectContaining({ companyId: 'cmp_1', actorUserId: 'cashier_1', source: 'pos' })
    );
  });

  it('250l-2 honors an approved below-cost override', async () => {
    const approvalEngine = { evaluate: jest.fn() };
    const core = new CommercialCore(undefined, async () => 12, approvalEngine as any);

    const result = await core.validateCostMargin({
      companyId: 'cmp_1',
      itemId: 'item_1',
      unitPriceBase: 10,
      approvedOverride: true,
    });

    expect(result).toMatchObject({ allowed: true, requiresApproval: false, reason: 'BELOW_COST' });
    expect(approvalEngine.evaluate).not.toHaveBeenCalled();
  });
});
