import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';

describe('SalesInvoice', () => {
  it('hydrates stale selector object refs without crashing on trim', () => {
    const invoice = SalesInvoice.fromJSON({
      id: { id: 'si_1' },
      companyId: { id: 'co_1' },
      invoiceNumber: 'SI-1',
      formType: { id: 'sales_invoice_direct' },
      voucherType: { id: 'sales_invoice_direct' },
      persona: { value: 'direct' },
      customerId: { id: 'cus_1', label: 'Customer One' },
      customerName: { label: 'Customer One' },
      invoiceDate: '2026-05-01',
      currency: { code: 'SYP' },
      exchangeRate: 1,
      lines: [
        {
          lineId: { id: 'line_1' },
          lineNo: 1,
          itemId: { id: 'item_1', code: '0001' },
          itemCode: { code: '0001' },
          itemName: { name: 'Test Item' },
          trackInventory: true,
          invoicedQty: 2,
          uomId: { id: 'uom_1' },
          uom: { code: 'PCS' },
          unitPriceDoc: 5,
          taxRate: 0,
          warehouseId: { id: 'wh_1' },
          revenueAccountId: { id: 'rev_1' },
        },
      ],
      paymentTermsDays: 0,
      outstandingAmountBase: 0,
      createdBy: { id: 'user_1' },
      createdAt: new Date('2026-05-01T00:00:00Z'),
      updatedAt: new Date('2026-05-01T00:00:00Z'),
    });

    expect(invoice.id).toBe('si_1');
    expect(invoice.formType).toBe('sales_invoice_direct');
    expect(invoice.voucherType).toBe('sales_invoice');
    expect(invoice.persona).toBe('direct');
    expect(invoice.customerId).toBe('cus_1');
    expect(invoice.currency).toBe('SYP');
    expect(invoice.lines[0].itemId).toBe('item_1');
    expect(invoice.lines[0].warehouseId).toBe('wh_1');
    expect(invoice.lines[0].uom).toBe('PCS');
    expect(invoice.grandTotalDoc).toBe(10);
  });

  it('calculates line discounts and document charges in totals', () => {
    const invoice = SalesInvoice.fromJSON({
      id: 'si_2',
      companyId: 'co_1',
      invoiceNumber: 'SI-2',
      formType: 'sales_invoice_direct',
      voucherType: 'sales_invoice',
      persona: 'direct',
      customerId: 'cus_1',
      customerName: 'Customer One',
      invoiceDate: '2026-05-01',
      currency: 'USD',
      exchangeRate: 1,
      lines: [
        {
          lineId: 'line_1',
          lineNo: 1,
          itemId: 'item_1',
          itemCode: '0001',
          itemName: 'Test Item',
          trackInventory: false,
          invoicedQty: 2,
          uom: 'PCS',
          unitPriceDoc: 10,
          discountType: 'PERCENT',
          discountValue: 10,
          taxRate: 0.1,
          revenueAccountId: 'rev_1',
        },
      ],
      charges: [
        {
          chargeId: 'chg_1',
          name: 'Delivery',
          amountDoc: 5,
          taxRate: 0,
          revenueAccountId: 'rev_1',
        },
      ],
      paymentTermsDays: 0,
      outstandingAmountBase: 0,
      createdBy: 'user_1',
      createdAt: new Date('2026-05-01T00:00:00Z'),
      updatedAt: new Date('2026-05-01T00:00:00Z'),
    });

    expect(invoice.lines[0].grossLineTotalDoc).toBe(20);
    expect(invoice.lines[0].discountAmountDoc).toBe(2);
    expect(invoice.lines[0].lineTotalDoc).toBe(18);
    expect(invoice.taxTotalDoc).toBe(1.8);
    expect(invoice.subtotalDoc).toBe(23);
    expect(invoice.grandTotalDoc).toBe(24.8);
  });
});
