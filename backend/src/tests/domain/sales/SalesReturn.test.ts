import { SalesReturn } from '../../../domain/sales/entities/SalesReturn';

describe('SalesReturn', () => {
  // Task 170C regression. Pre-fix, the SR entity always treated
  // (returnQty * unitPriceDoc) as the NET subtotal contribution, so a return
  // against an inclusive-priced SI silently inflated grandTotalDoc by stacking
  // tax on top of an already-inclusive gross. The ledger reversal would then
  // not match the original SI's posting.
  it('respects priceIsInclusive when recomputing return totals during construction', () => {
    const sr = new SalesReturn({
      id: 'sr_inclusive',
      companyId: 'co_1',
      returnNumber: 'SR-INC-1',
      customerId: 'cus_1',
      customerName: 'Customer One',
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
          unitPriceDoc: 10,
          unitPriceBase: 10,
          unitCostBase: 0,
          fxRateMovToBase: 1,
          fxRateCCYToBase: 1,
          taxRate: 0.1,
          priceIsInclusive: true,
          // taxAmountDoc/taxAmountBase omitted so normalizeLine computes them
          // from the inclusive split. Passing explicit 0 here would short-
          // circuit the default path via `??`, which is the production contract
          // ("if caller supplied tax, trust it") — not what we want to test.
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

    // 2 × 10 = 20 inclusive. Net = 20 / 1.1 ≈ 18.18, tax = 20 − 18.18 ≈ 1.82.
    expect(sr.subtotalDoc).toBe(18.18);
    expect(sr.taxTotalDoc).toBe(1.82);
    expect(sr.grandTotalDoc).toBe(20);
    expect(sr.lines[0].priceIsInclusive).toBe(true);
  });

  it('treats priceIsInclusive=false (default) as exclusive', () => {
    const sr = new SalesReturn({
      id: 'sr_exclusive',
      companyId: 'co_1',
      returnNumber: 'SR-EXC-1',
      customerId: 'cus_1',
      customerName: 'Customer One',
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
          unitPriceDoc: 10,
          unitPriceBase: 10,
          unitCostBase: 0,
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

    // 2 × 10 = 20 net. Tax = 2.00. Grand = 22.
    expect(sr.subtotalDoc).toBe(20);
    expect(sr.taxTotalDoc).toBe(2);
    expect(sr.grandTotalDoc).toBe(22);
  });
});
