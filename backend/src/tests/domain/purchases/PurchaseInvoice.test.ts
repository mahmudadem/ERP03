import { PurchaseInvoice } from '../../../domain/purchases/entities/PurchaseInvoice';

describe('PurchaseInvoice', () => {
  // Task 170A regression. Mirrors the SI fix from Task 168 and the SO fix
  // from Task 170B: pre-fix, PurchaseInvoice had no concept of priceIsInclusive
  // at all, so vendor invoices with tax-inclusive prices silently stacked tax
  // on top during entity construction, breaking AP totals against what the
  // vendor printed on their bill.
  it('respects priceIsInclusive when recomputing line totals during construction', () => {
    const pi = PurchaseInvoice.fromJSON({
      id: 'pi_inclusive',
      companyId: 'co_1',
      invoiceNumber: 'PI-INC-1',
      formType: 'purchase_invoice_direct',
      voucherType: 'purchase_invoice',
      persona: 'direct',
      vendorId: 'ven_1',
      vendorName: 'Vendor One',
      invoiceDate: '2026-06-04',
      currency: 'USD',
      exchangeRate: 1,
      lines: [
        {
          lineId: 'line_inc_1',
          lineNo: 1,
          itemId: 'item_1',
          itemCode: '0001',
          itemName: 'Test Item',
          trackInventory: false,
          invoicedQty: 2,
          uom: 'PCS',
          unitPriceDoc: 10,
          taxRate: 0.1,
          priceIsInclusive: true,
          accountId: 'acc_1',
        },
      ],
      paymentTermsDays: 0,
      outstandingAmountBase: 0,
      createdBy: 'user_1',
      createdAt: new Date('2026-06-04T00:00:00Z'),
      updatedAt: new Date('2026-06-04T00:00:00Z'),
    });

    // 2 × 10 = 20 inclusive. Net = 20 / 1.1 ≈ 18.18, tax = 20 − 18.18 ≈ 1.82.
    expect(pi.lines[0].lineTotalDoc).toBe(18.18);
    expect(pi.lines[0].taxAmountDoc).toBe(1.82);
    expect(pi.subtotalDoc).toBe(18.18);
    expect(pi.taxTotalDoc).toBe(1.82);
    expect(pi.grandTotalDoc).toBe(20);
    expect(pi.lines[0].priceIsInclusive).toBe(true);
  });

  it('treats priceIsInclusive=false (default) as exclusive', () => {
    const pi = PurchaseInvoice.fromJSON({
      id: 'pi_exclusive',
      companyId: 'co_1',
      invoiceNumber: 'PI-EXC-1',
      formType: 'purchase_invoice_direct',
      voucherType: 'purchase_invoice',
      persona: 'direct',
      vendorId: 'ven_1',
      vendorName: 'Vendor One',
      invoiceDate: '2026-06-04',
      currency: 'USD',
      exchangeRate: 1,
      lines: [
        {
          lineId: 'line_exc_1',
          lineNo: 1,
          itemId: 'item_1',
          itemCode: '0001',
          itemName: 'Test Item',
          trackInventory: false,
          invoicedQty: 2,
          uom: 'PCS',
          unitPriceDoc: 10,
          taxRate: 0.1,
          accountId: 'acc_1',
        },
      ],
      paymentTermsDays: 0,
      outstandingAmountBase: 0,
      createdBy: 'user_1',
      createdAt: new Date('2026-06-04T00:00:00Z'),
      updatedAt: new Date('2026-06-04T00:00:00Z'),
    });

    // 2 × 10 = 20 net. Tax = 2.00. Grand = 22.
    expect(pi.lines[0].lineTotalDoc).toBe(20);
    expect(pi.lines[0].taxAmountDoc).toBe(2);
    expect(pi.grandTotalDoc).toBe(22);
  });

  // Line discount feature parity with sales (PERCENT + AMOUNT, exclusive +
  // inclusive). Trade-discount semantics: tax base is post-discount, so a 10%
  // line discount reduces both net and tax. See EU VAT Directive Art. 79(a).
  const baseLine = (overrides: Record<string, any>) => ({
    lineId: 'line_disc_1',
    lineNo: 1,
    itemId: 'item_1',
    itemCode: '0001',
    itemName: 'Test Item',
    trackInventory: false,
    invoicedQty: 10,
    uom: 'PCS',
    unitPriceDoc: 100,
    accountId: 'acc_1',
    ...overrides,
  });

  const buildPI = (lineOverrides: Record<string, any>) =>
    PurchaseInvoice.fromJSON({
      id: 'pi_disc',
      companyId: 'co_1',
      invoiceNumber: 'PI-DISC-1',
      formType: 'purchase_invoice_direct',
      voucherType: 'purchase_invoice',
      persona: 'direct',
      vendorId: 'ven_1',
      vendorName: 'Vendor One',
      invoiceDate: '2026-06-04',
      currency: 'USD',
      exchangeRate: 1,
      lines: [baseLine(lineOverrides)],
      paymentTermsDays: 0,
      outstandingAmountBase: 0,
      createdBy: 'user_1',
      createdAt: new Date('2026-06-04T00:00:00Z'),
      updatedAt: new Date('2026-06-04T00:00:00Z'),
    });

  it('applies a PERCENT line discount before exclusive tax', () => {
    // qty=10 × 100 = 1000 gross. 10% discount → 100. Net = 900. 5% tax = 45. Grand 945.
    const pi = buildPI({ taxRate: 0.05, discountType: 'PERCENT', discountValue: 10 });
    expect(pi.lines[0].grossLineTotalDoc).toBe(1000);
    expect(pi.lines[0].discountAmountDoc).toBe(100);
    expect(pi.lines[0].lineTotalDoc).toBe(900);
    expect(pi.lines[0].taxAmountDoc).toBe(45);
    expect(pi.grandTotalDoc).toBe(945);
  });

  it('applies an AMOUNT line discount before exclusive tax', () => {
    // qty=10 × 100 = 1000 gross. AMOUNT discount = 200 → Net 800. Tax 5% = 40. Grand 840.
    const pi = buildPI({ taxRate: 0.05, discountType: 'AMOUNT', discountValue: 200 });
    expect(pi.lines[0].discountAmountDoc).toBe(200);
    expect(pi.lines[0].lineTotalDoc).toBe(800);
    expect(pi.lines[0].taxAmountDoc).toBe(40);
    expect(pi.grandTotalDoc).toBe(840);
  });

  it('caps an AMOUNT discount at gross so net/tax never go negative', () => {
    const pi = buildPI({ taxRate: 0.05, discountType: 'AMOUNT', discountValue: 9999 });
    expect(pi.lines[0].discountAmountDoc).toBe(1000); // clamped to gross
    expect(pi.lines[0].lineTotalDoc).toBe(0);
    expect(pi.lines[0].taxAmountDoc).toBe(0);
    expect(pi.grandTotalDoc).toBe(0);
  });

  it('combines PERCENT discount with inclusive tax (discount → net → tax split)', () => {
    // gross=1000 inclusive of 10% tax. 10% discount on gross → 100. postDisc=900.
    // Net = 900 / 1.1 = 818.18, tax = 81.82, lineGross = 900.
    const pi = buildPI({ taxRate: 0.1, priceIsInclusive: true, discountType: 'PERCENT', discountValue: 10 });
    expect(pi.lines[0].discountAmountDoc).toBe(100);
    expect(pi.lines[0].lineTotalDoc).toBe(818.18);
    expect(pi.lines[0].taxAmountDoc).toBe(81.82);
    expect(pi.grandTotalDoc).toBe(900);
  });

  it('no-discount path matches the pre-discount math', () => {
    const pi = buildPI({ taxRate: 0.05 });
    expect(pi.lines[0].grossLineTotalDoc).toBe(1000);
    expect(pi.lines[0].discountAmountDoc).toBe(0);
    expect(pi.lines[0].lineTotalDoc).toBe(1000);
    expect(pi.lines[0].taxAmountDoc).toBe(50);
    expect(pi.grandTotalDoc).toBe(1050);
  });
});
