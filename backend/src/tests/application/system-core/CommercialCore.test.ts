import {
  CommercialCore,
  calculateCommercialDiscountAmount,
  calculateCommercialLineAmounts,
  resolveLineDiscountAmount,
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

  it('FUP-2: resolveLineDiscountAmount is the shared clamp used by SI/SO/SR/PI/PO/PR entities', () => {
    // explicit amount is clamped to gross
    expect(resolveLineDiscountAmount(80, { explicitDiscountAmount: 120 })).toBe(80);
    // PERCENT of gross
    expect(resolveLineDiscountAmount(1000, { discountType: 'PERCENT', discountValue: 10 })).toBe(100);
    // AMOUNT clamped to gross
    expect(resolveLineDiscountAmount(50, { discountType: 'AMOUNT', discountValue: 999 })).toBe(50);
    // no discount → 0
    expect(resolveLineDiscountAmount(1000, {})).toBe(0);
    // delegated path produces the same number as the gross-based helper
    expect(resolveLineDiscountAmount(1000, { discountType: 'PERCENT', discountValue: 10 }))
      .toBe(calculateCommercialDiscountAmount({ quantity: 10, unitPrice: 100, discountType: 'PERCENT', discountValue: 10 }));
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

  it('250l-3 applies one discount and one free-good promotion per line by priority', () => {
    const core = new CommercialCore();

    const result = core.applyPromotions({
      asOfDate: '2026-06-21',
      source: 'pos',
      lines: [{
        lineId: 'line_1',
        itemId: 'item_1',
        categoryId: 'cat_1',
        qty: 6,
        unitPriceDoc: 10,
        lineAmountDoc: 60,
        hasManualDiscount: false,
      }],
      rules: [
        {
          id: 'disc_low',
          name: 'Lower priority discount',
          type: 'THRESHOLD_DISCOUNT',
          status: 'ACTIVE',
          priority: 10,
          scope: 'ALL',
          thresholdDiscount: { thresholdBasis: 'QTY', thresholdValue: 1, discountPct: 50 },
        },
        {
          id: 'disc_high',
          name: 'Higher priority discount',
          type: 'THRESHOLD_DISCOUNT',
          status: 'ACTIVE',
          priority: 1,
          scope: 'ALL',
          thresholdDiscount: { thresholdBasis: 'QTY', thresholdValue: 1, discountPct: 10 },
        },
        {
          id: 'bxgy_1',
          name: 'Buy 3 Get 1',
          type: 'BUY_X_GET_Y',
          status: 'ACTIVE',
          priority: 1,
          scope: 'CATEGORIES',
          categoryIds: ['cat_1'],
          buyXGetY: { buyQty: 3, getQty: 1 },
        },
      ],
    });

    expect(result.lineDiscounts).toEqual([
      expect.objectContaining({ ruleId: 'disc_high', discountPct: 10 }),
    ]);
    expect(result.freeGoods).toEqual([
      expect.objectContaining({ ruleId: 'bxgy_1', itemId: 'item_1', qty: 2 }),
    ]);
  });

  it('250l-3 leaves manually discounted lines out of automatic threshold discounts', () => {
    const core = new CommercialCore();

    const result = core.applyPromotions({
      asOfDate: '2026-06-21',
      lines: [{
        lineId: 'line_1',
        itemId: 'item_1',
        qty: 10,
        unitPriceDoc: 10,
        lineAmountDoc: 100,
        hasManualDiscount: true,
      }],
      rules: [{
        id: 'disc_1',
        name: 'Auto discount',
        type: 'THRESHOLD_DISCOUNT',
        status: 'ACTIVE',
        priority: 1,
        scope: 'ALL',
        thresholdDiscount: { thresholdBasis: 'QTY', thresholdValue: 1, discountPct: 10 },
      }],
    });

    expect(result.lineDiscounts).toHaveLength(0);
  });
});
