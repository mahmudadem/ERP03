import { PurchaseReturn } from '../../../domain/purchases/entities/PurchaseReturn';

describe('PurchaseReturn', () => {
  // Task 170C regression. Mirror of the SR fix for purchase returns: pre-fix,
  // (returnQty * unitCostDoc) was always treated as the NET subtotal, so an
  // inclusive-priced PI line being returned inflated AP credit vs. inventory
  // debit at the ledger.
  it('respects priceIsInclusive when recomputing return totals during construction', () => {
    const pr = new PurchaseReturn({
      id: 'pr_inclusive',
      companyId: 'co_1',
      returnNumber: 'PR-INC-1',
      vendorId: 'ven_1',
      vendorName: 'Vendor One',
      returnContext: 'AFTER_INVOICE',
      returnDate: '2026-06-04',
      warehouseId: 'wh_1',
      currency: 'USD',
      exchangeRate: 1,
      lines: [
        {
          lineId: 'line_inc_1',
          lineNo: 1,
          itemId: 'item_1',
          itemCode: '0001',
          itemName: 'Test Item',
          returnQty: 2,
          uom: 'PCS',
          unitCostDoc: 10,
          unitCostBase: 10,
          fxRateMovToBase: 1,
          fxRateCCYToBase: 1,
          taxRate: 0.1,
          priceIsInclusive: true,
        } as any,
      ],
      subtotalDoc: 0,
      taxTotalDoc: 0,
      grandTotalDoc: 0,
      subtotalBase: 0,
      taxTotalBase: 0,
      grandTotalBase: 0,
      reason: 'Defective',
      createdBy: 'user_1',
      createdAt: new Date('2026-06-04T00:00:00Z'),
      updatedAt: new Date('2026-06-04T00:00:00Z'),
    });

    expect(pr.subtotalDoc).toBe(18.18);
    expect(pr.taxTotalDoc).toBe(1.82);
    expect(pr.grandTotalDoc).toBe(20);
    expect(pr.lines[0].priceIsInclusive).toBe(true);
  });

  it('treats priceIsInclusive=false (default) as exclusive', () => {
    const pr = new PurchaseReturn({
      id: 'pr_exclusive',
      companyId: 'co_1',
      returnNumber: 'PR-EXC-1',
      vendorId: 'ven_1',
      vendorName: 'Vendor One',
      returnContext: 'AFTER_INVOICE',
      returnDate: '2026-06-04',
      warehouseId: 'wh_1',
      currency: 'USD',
      exchangeRate: 1,
      lines: [
        {
          lineId: 'line_exc_1',
          lineNo: 1,
          itemId: 'item_1',
          itemCode: '0001',
          itemName: 'Test Item',
          returnQty: 2,
          uom: 'PCS',
          unitCostDoc: 10,
          unitCostBase: 10,
          fxRateMovToBase: 1,
          fxRateCCYToBase: 1,
          taxRate: 0.1,
        } as any,
      ],
      subtotalDoc: 0,
      taxTotalDoc: 0,
      grandTotalDoc: 0,
      subtotalBase: 0,
      taxTotalBase: 0,
      grandTotalBase: 0,
      reason: 'Defective',
      createdBy: 'user_1',
      createdAt: new Date('2026-06-04T00:00:00Z'),
      updatedAt: new Date('2026-06-04T00:00:00Z'),
    });

    expect(pr.subtotalDoc).toBe(20);
    expect(pr.taxTotalDoc).toBe(2);
    expect(pr.grandTotalDoc).toBe(22);
  });

  // Line-discount feature parity: when a PI line carrying a discount is
  // returned, the discount is preserved so the return reverses the same
  // discounted net (not the gross). Mirrors EU VAT Art. 79(a) treatment.
  it('reverses a PERCENT discount on the return so net + tax match the SI', () => {
    const pr = new PurchaseReturn({
      id: 'pr_disc_pct',
      companyId: 'co_1',
      returnNumber: 'PR-DISC-1',
      vendorId: 'ven_1',
      vendorName: 'Vendor One',
      returnContext: 'AFTER_INVOICE',
      returnDate: '2026-06-04',
      warehouseId: 'wh_1',
      currency: 'USD',
      exchangeRate: 1,
      lines: [
        {
          lineId: 'line_disc_1',
          lineNo: 1,
          itemId: 'item_1',
          itemCode: '0001',
          itemName: 'Test Item',
          returnQty: 10,
          uom: 'PCS',
          unitCostDoc: 100,
          unitCostBase: 100,
          fxRateMovToBase: 1,
          fxRateCCYToBase: 1,
          taxRate: 0.05,
          discountType: 'PERCENT',
          discountValue: 10,
        } as any,
      ],
      subtotalDoc: 0,
      taxTotalDoc: 0,
      grandTotalDoc: 0,
      subtotalBase: 0,
      taxTotalBase: 0,
      grandTotalBase: 0,
      reason: 'Defective',
      createdBy: 'user_1',
      createdAt: new Date('2026-06-04T00:00:00Z'),
      updatedAt: new Date('2026-06-04T00:00:00Z'),
    });

    // gross 1000, 10% discount = 100, net 900, tax 5% = 45, grand 945.
    expect(pr.lines[0].discountAmountDoc).toBe(100);
    expect(pr.subtotalDoc).toBe(900);
    expect(pr.taxTotalDoc).toBe(45);
    expect(pr.grandTotalDoc).toBe(945);
  });

  it('handles AMOUNT discount with inclusive tax on return', () => {
    const pr = new PurchaseReturn({
      id: 'pr_disc_amt_inc',
      companyId: 'co_1',
      returnNumber: 'PR-DISC-2',
      vendorId: 'ven_1',
      vendorName: 'Vendor One',
      returnContext: 'AFTER_INVOICE',
      returnDate: '2026-06-04',
      warehouseId: 'wh_1',
      currency: 'USD',
      exchangeRate: 1,
      lines: [
        {
          lineId: 'line_disc_2',
          lineNo: 1,
          itemId: 'item_1',
          itemCode: '0001',
          itemName: 'Test Item',
          returnQty: 10,
          uom: 'PCS',
          unitCostDoc: 100,
          unitCostBase: 100,
          fxRateMovToBase: 1,
          fxRateCCYToBase: 1,
          taxRate: 0.1,
          priceIsInclusive: true,
          discountType: 'AMOUNT',
          discountValue: 100,
        } as any,
      ],
      subtotalDoc: 0,
      taxTotalDoc: 0,
      grandTotalDoc: 0,
      subtotalBase: 0,
      taxTotalBase: 0,
      grandTotalBase: 0,
      reason: 'Wrong item',
      createdBy: 'user_1',
      createdAt: new Date('2026-06-04T00:00:00Z'),
      updatedAt: new Date('2026-06-04T00:00:00Z'),
    });

    // gross 1000 inclusive, discount 100, postDisc 900, net = 900/1.1 = 818.18, tax = 81.82
    expect(pr.lines[0].discountAmountDoc).toBe(100);
    expect(pr.subtotalDoc).toBe(818.18);
    expect(pr.taxTotalDoc).toBe(81.82);
    expect(pr.grandTotalDoc).toBe(900);
  });
});
