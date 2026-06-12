import { PurchaseOrder } from '../../../domain/purchases/entities/PurchaseOrder';

describe('PurchaseOrder', () => {
  const baseLine = (overrides: Record<string, any>) => ({
    lineId: 'line_1',
    lineNo: 1,
    itemId: 'item_1',
    itemCode: '0001',
    itemName: 'Test Item',
    itemType: 'PRODUCT',
    trackInventory: true,
    orderedQty: 10,
    uom: 'PCS',
    unitPriceDoc: 100,
    receivedQty: 0,
    invoicedQty: 0,
    returnedQty: 0,
    ...overrides,
  });

  const buildPO = (lineOverrides: Record<string, any>) =>
    PurchaseOrder.fromJSON({
      id: 'po_1',
      companyId: 'co_1',
      orderNumber: 'PO-001',
      vendorId: 'ven_1',
      vendorName: 'Vendor One',
      orderDate: '2026-06-04',
      currency: 'USD',
      exchangeRate: 1,
      lines: [baseLine(lineOverrides)],
      status: 'DRAFT',
      createdBy: 'user_1',
      createdAt: new Date('2026-06-04T00:00:00Z'),
      updatedAt: new Date('2026-06-04T00:00:00Z'),
    });

  it('no discount + no tax: lineTotal = qty × unitPrice', () => {
    const po = buildPO({ taxRate: 0 });
    expect(po.lines[0].grossLineTotalDoc).toBe(1000);
    expect(po.lines[0].discountAmountDoc).toBe(0);
    expect(po.lines[0].lineTotalDoc).toBe(1000);
    expect(po.grandTotalDoc).toBe(1000);
  });

  it('PERCENT discount reduces taxable base (tax on post-discount net)', () => {
    const po = buildPO({ taxRate: 0.05, discountType: 'PERCENT', discountValue: 10 });
    expect(po.lines[0].discountAmountDoc).toBe(100);
    expect(po.lines[0].lineTotalDoc).toBe(900);
    expect(po.lines[0].taxAmountDoc).toBe(45);
    expect(po.grandTotalDoc).toBe(945);
  });

  it('AMOUNT discount clamps at gross', () => {
    const po = buildPO({ taxRate: 0.05, discountType: 'AMOUNT', discountValue: 5000 });
    expect(po.lines[0].discountAmountDoc).toBe(1000);
    expect(po.lines[0].lineTotalDoc).toBe(0);
    expect(po.lines[0].taxAmountDoc).toBe(0);
  });

  it('round-trip persists discount fields through toJSON / fromJSON', () => {
    const po = buildPO({ taxRate: 0.1, discountType: 'PERCENT', discountValue: 20 });
    const round = PurchaseOrder.fromJSON(po.toJSON());
    expect(round.lines[0].discountType).toBe('PERCENT');
    expect(round.lines[0].discountValue).toBe(20);
    expect(round.lines[0].discountAmountDoc).toBe(200);
    expect(round.lines[0].lineTotalDoc).toBe(800);
  });
});
