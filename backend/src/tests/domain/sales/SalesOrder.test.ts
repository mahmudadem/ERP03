import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';

describe('SalesOrder', () => {
  // Task 170B regression. Mirrors the SI inclusive-tax fix from Task 168:
  // pre-fix, normalizeLine always treated `unitPriceDoc` as tax-exclusive, so
  // an inclusive-priced line silently stacked tax on top of the already-
  // inclusive price during entity construction. That made SO totals diverge
  // from what the user typed, and the divergence propagated downstream when
  // SO → SI conversion copied the wrong figures forward.
  it('respects priceIsInclusive when recomputing line totals during construction', () => {
    const order = SalesOrder.fromJSON({
      id: 'so_inclusive',
      companyId: 'co_1',
      orderNumber: 'SO-INC-1',
      customerId: 'cus_1',
      customerName: 'Customer One',
      orderDate: '2026-06-04',
      currency: 'USD',
      exchangeRate: 1,
      lines: [
        {
          lineId: 'line_inc_1',
          lineNo: 1,
          itemId: 'item_1',
          itemCode: '0001',
          itemName: 'Test Item',
          itemType: 'PRODUCT',
          trackInventory: true,
          orderedQty: 2,
          uom: 'PCS',
          unitPriceDoc: 10,
          taxRate: 0.1,
          priceIsInclusive: true,
        },
      ],
      status: 'DRAFT',
      createdBy: 'user_1',
      createdAt: new Date('2026-06-04T00:00:00Z'),
      updatedAt: new Date('2026-06-04T00:00:00Z'),
    });

    // 2 × 10 = 20 inclusive. Net = 20 / 1.1 ≈ 18.18, tax = 20 − 18.18 ≈ 1.82.
    expect(order.lines[0].lineTotalDoc).toBe(18.18);
    expect(order.lines[0].taxAmountDoc).toBe(1.82);
    expect(order.subtotalDoc).toBe(18.18);
    expect(order.taxTotalDoc).toBe(1.82);
    expect(order.grandTotalDoc).toBe(20);
    // Flag must survive so subsequent loads recompute consistently.
    expect(order.lines[0].priceIsInclusive).toBe(true);
  });

  it('treats priceIsInclusive=false (default) as exclusive', () => {
    const order = SalesOrder.fromJSON({
      id: 'so_exclusive',
      companyId: 'co_1',
      orderNumber: 'SO-EXC-1',
      customerId: 'cus_1',
      customerName: 'Customer One',
      orderDate: '2026-06-04',
      currency: 'USD',
      exchangeRate: 1,
      lines: [
        {
          lineId: 'line_exc_1',
          lineNo: 1,
          itemId: 'item_1',
          itemCode: '0001',
          itemName: 'Test Item',
          itemType: 'PRODUCT',
          trackInventory: true,
          orderedQty: 2,
          uom: 'PCS',
          unitPriceDoc: 10,
          taxRate: 0.1,
        },
      ],
      status: 'DRAFT',
      createdBy: 'user_1',
      createdAt: new Date('2026-06-04T00:00:00Z'),
      updatedAt: new Date('2026-06-04T00:00:00Z'),
    });

    // 2 × 10 = 20 net. Tax = 2.00. Grand = 22.
    expect(order.lines[0].lineTotalDoc).toBe(20);
    expect(order.lines[0].taxAmountDoc).toBe(2);
    expect(order.grandTotalDoc).toBe(22);
  });
});
