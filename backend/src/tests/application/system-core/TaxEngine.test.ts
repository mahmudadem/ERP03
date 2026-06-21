import { TaxEngine, calculateTaxLineAmounts } from '../../../application/system-core/tax/TaxEngine';
import { calculateSalesInvoiceLineAmounts } from '../../../application/sales/services/SalesInvoiceCalculationService';
import { PurchaseInvoice } from '../../../domain/purchases/entities/PurchaseInvoice';

const engine = new TaxEngine();

describe('TaxEngine', () => {
  it('T8: gives Sales, Purchases, and POS the same line tax result for one tax code input', () => {
    const shared = {
      quantity: 2,
      unitPriceDoc: 110,
      exchangeRate: 1,
      taxRate: 0.1,
      priceIsInclusive: true,
      discountType: 'PERCENT' as const,
      discountValue: 5,
    };

    const sales = calculateSalesInvoiceLineAmounts({
      invoicedQty: shared.quantity,
      unitPriceDoc: shared.unitPriceDoc,
      exchangeRate: shared.exchangeRate,
      taxRate: shared.taxRate,
      priceIsInclusive: shared.priceIsInclusive,
      discountType: shared.discountType,
      discountValue: shared.discountValue,
    });
    const purchase = PurchaseInvoice.fromJSON({
      id: 'pi_tax_engine',
      companyId: 'co_1',
      invoiceNumber: 'PI-TAX-1',
      vendorId: 'ven_1',
      vendorName: 'Vendor One',
      invoiceDate: '2026-06-21',
      currency: 'USD',
      exchangeRate: shared.exchangeRate,
      lines: [{
        lineId: 'line_1',
        lineNo: 1,
        itemId: 'item_1',
        itemCode: 'ITEM',
        itemName: 'Item',
        trackInventory: false,
        invoicedQty: shared.quantity,
        uom: 'EA',
        unitPriceDoc: shared.unitPriceDoc,
        taxRate: shared.taxRate,
        priceIsInclusive: shared.priceIsInclusive,
        discountType: shared.discountType,
        discountValue: shared.discountValue,
        accountId: 'expense',
      }],
      paymentTermsDays: 0,
      outstandingAmountBase: 0,
      createdBy: 'user_1',
      createdAt: new Date('2026-06-21T00:00:00Z'),
      updatedAt: new Date('2026-06-21T00:00:00Z'),
    });
    const pos = engine.calcLine(shared);

    expect({
      lineTotalDoc: sales.lineTotalDoc,
      taxAmountDoc: sales.taxAmountDoc,
      grand: sales.lineTotalDoc + sales.taxAmountDoc,
    }).toEqual({
      lineTotalDoc: purchase.lines[0].lineTotalDoc,
      taxAmountDoc: purchase.lines[0].taxAmountDoc,
      grand: purchase.grandTotalDoc,
    });
    expect(pos.lineTotalDoc).toBe(sales.lineTotalDoc);
    expect(pos.taxAmountDoc).toBe(sales.taxAmountDoc);
  });

  it('preserves current exclusive and inclusive golden totals', () => {
    expect(calculateTaxLineAmounts({
      quantity: 10,
      unitPriceDoc: 100,
      exchangeRate: 1,
      taxRate: 0.1,
      priceIsInclusive: false,
      discountType: 'PERCENT',
      discountValue: 5,
    })).toMatchObject({
      grossLineTotalDoc: 1000,
      discountAmountDoc: 50,
      lineTotalDoc: 950,
      taxAmountDoc: 95,
    });

    expect(calculateTaxLineAmounts({
      quantity: 10,
      unitPriceDoc: 110,
      exchangeRate: 1,
      taxRate: 0.1,
      priceIsInclusive: true,
      discountType: 'PERCENT',
      discountValue: 5,
    })).toMatchObject({
      grossLineTotalDoc: 1100,
      discountAmountDoc: 55,
      lineTotalDoc: 950,
      taxAmountDoc: 95,
    });
  });

  it('allocates invoice discount proportionally by eligible net line total', () => {
    const result = engine.allocateInvoiceDiscount({
      exchangeRate: 2,
      discountAmountDoc: 30,
      lines: [
        { lineId: 'a', lineTotalDoc: 100, taxRate: 0.1 },
        { lineId: 'b', lineTotalDoc: 200, taxRate: 0.1 },
        { lineId: 'gift', lineTotalDoc: 50, taxRate: 0.1, isGift: true },
      ],
    });

    expect(result.allocatedDiscountDoc).toBe(30);
    expect(result.allocatedDiscountBase).toBe(60);
    expect(result.lines.find((line) => line.lineId === 'a')).toMatchObject({
      allocatedDiscountDoc: 10,
      adjustedLineTotalDoc: 90,
      adjustedTaxAmountDoc: 9,
    });
    expect(result.lines.find((line) => line.lineId === 'b')).toMatchObject({
      allocatedDiscountDoc: 20,
      adjustedLineTotalDoc: 180,
      adjustedTaxAmountDoc: 18,
    });
    expect(result.lines.find((line) => line.lineId === 'gift')?.allocatedDiscountDoc).toBe(0);
  });

  it('classifies recoverable and non-recoverable purchase input tax', () => {
    expect(engine.recoverable({ taxType: 'VAT', rate: 0.18 })).toEqual({
      isRecoverable: true,
      recoverableRate: 0.18,
      nonRecoverableRate: 0,
    });
    expect(engine.recoverable({ taxType: 'VAT', rate: 0.18, recoverableRate: 0.12 })).toEqual({
      isRecoverable: true,
      recoverableRate: 0.12,
      nonRecoverableRate: 0.06,
    });
    expect(engine.recoverable({ taxType: 'VAT', rate: 0.18, nonRecoverable: true })).toEqual({
      isRecoverable: false,
      recoverableRate: 0,
      nonRecoverableRate: 0.18,
    });
  });
});
