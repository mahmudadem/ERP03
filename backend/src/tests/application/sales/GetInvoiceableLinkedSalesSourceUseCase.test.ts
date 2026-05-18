import { describe, expect, it } from '@jest/globals';
import { DeliveryNote } from '../../../domain/sales/entities/DeliveryNote';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import { GetInvoiceableLinkedSalesSourceUseCase } from '../../../application/sales/use-cases/SalesInvoiceUseCases';

const COMPANY_ID = 'cmp-1';
const now = () => new Date('2026-01-01T00:00:00.000Z');

const makeSalesOrder = (): SalesOrder =>
  new SalesOrder({
    id: 'so-1',
    companyId: COMPANY_ID,
    orderNumber: 'SO-1',
    customerId: 'cust-1',
    customerName: 'Customer A',
    orderDate: '2026-01-10',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'so-stock',
        lineNo: 1,
        itemId: 'item-stock',
        itemCode: 'STK-1',
        itemName: 'Stock Item',
        itemType: 'PRODUCT',
        trackInventory: true,
        orderedQty: 10,
        deliveredQty: 6,
        invoicedQty: 2,
        returnedQty: 0,
        uom: 'EA',
        unitPriceDoc: 20,
        lineTotalDoc: 200,
        unitPriceBase: 20,
        lineTotalBase: 200,
        taxCodeId: 'tax-sales',
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
        warehouseId: 'wh-from-so',
      },
      {
        lineId: 'so-service',
        lineNo: 2,
        itemId: 'item-service',
        itemCode: 'SRV-1',
        itemName: 'Service Item',
        itemType: 'SERVICE',
        trackInventory: false,
        orderedQty: 5,
        deliveredQty: 0,
        invoicedQty: 2,
        returnedQty: 0,
        uom: 'EA',
        unitPriceDoc: 15,
        lineTotalDoc: 75,
        unitPriceBase: 15,
        lineTotalBase: 75,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
      },
    ],
    subtotalBase: 275,
    taxTotalBase: 0,
    grandTotalBase: 275,
    subtotalDoc: 275,
    taxTotalDoc: 0,
    grandTotalDoc: 275,
    status: 'PARTIALLY_DELIVERED',
    createdBy: 'user-1',
    createdAt: now(),
    updatedAt: now(),
  });

const makePostedDeliveryNote = (): DeliveryNote =>
  new DeliveryNote({
    id: 'dn-1',
    companyId: COMPANY_ID,
    dnNumber: 'DN-1',
    salesOrderId: 'so-1',
    customerId: 'cust-1',
    customerName: 'Customer A',
    deliveryDate: '2026-01-11',
    warehouseId: 'wh-dn',
    lines: [
      {
        lineId: 'dn-line-1',
        lineNo: 1,
        soLineId: 'so-stock',
        itemId: 'item-stock',
        itemCode: 'STK-1',
        itemName: 'Stock Item',
        deliveredQty: 6,
        uom: 'EA',
        unitCostBase: 10,
        lineCostBase: 60,
        moveCurrency: 'USD',
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
      },
    ],
    status: 'POSTED',
    createdBy: 'user-1',
    createdAt: now(),
    updatedAt: now(),
  });

const makePostedInvoice = (): SalesInvoice =>
  new SalesInvoice({
    id: 'si-1',
    companyId: COMPANY_ID,
    invoiceNumber: 'SI-1',
    formType: 'sales_invoice_linked',
    voucherType: 'sales_invoice',
    persona: 'linked',
    salesOrderId: 'so-1',
    customerId: 'cust-1',
    customerName: 'Customer A',
    invoiceDate: '2026-01-12',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'si-line-1',
        lineNo: 1,
        soLineId: 'so-stock',
        dnLineId: 'dn-line-1',
        itemId: 'item-stock',
        itemCode: 'STK-1',
        itemName: 'Stock Item',
        trackInventory: true,
        invoicedQty: 2,
        uom: 'EA',
        unitPriceDoc: 20,
        lineTotalDoc: 40,
        unitPriceBase: 20,
        lineTotalBase: 40,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
        warehouseId: 'wh-dn',
        revenueAccountId: 'REV-1',
      },
    ],
    subtotalDoc: 40,
    taxTotalDoc: 0,
    grandTotalDoc: 40,
    subtotalBase: 40,
    taxTotalBase: 0,
    grandTotalBase: 40,
    paymentTermsDays: 30,
    paymentStatus: 'UNPAID',
    paidAmountBase: 0,
    outstandingAmountBase: 40,
    status: 'POSTED',
    createdBy: 'user-1',
    createdAt: now(),
    updatedAt: now(),
    postedAt: now(),
  });

describe('GetInvoiceableLinkedSalesSourceUseCase', () => {
  it('loads stock lines from posted delivery notes and service lines from remaining SO quantities', async () => {
    const salesOrder = makeSalesOrder();
    const deliveryNote = makePostedDeliveryNote();
    const postedInvoice = makePostedInvoice();

    const useCase = new GetInvoiceableLinkedSalesSourceUseCase(
      {
        getById: async () => salesOrder,
      } as any,
      {
        list: async () => [deliveryNote],
      } as any,
      {
        list: async (_companyId: string, opts?: { status?: string }) =>
          opts?.status === 'POSTED' ? [postedInvoice] : [],
      } as any
    );

    const source = await useCase.execute(COMPANY_ID, 'so-1');

    expect(source.customerId).toBe('cust-1');
    expect(source.lines).toHaveLength(2);

    const stockLine = source.lines.find((line) => line.itemId === 'item-stock');
    expect(stockLine).toMatchObject({
      sourceType: 'DELIVERY_NOTE',
      deliveryNoteId: 'dn-1',
      deliveryNoteNumber: 'DN-1',
      dnLineId: 'dn-line-1',
      soLineId: 'so-stock',
      warehouseId: 'wh-dn',
      remainingQty: 4,
      unitPriceDoc: 20,
      taxCodeId: 'tax-sales',
    });

    const serviceLine = source.lines.find((line) => line.itemId === 'item-service');
    expect(serviceLine).toMatchObject({
      sourceType: 'SALES_ORDER',
      soLineId: 'so-service',
      remainingQty: 3,
      warehouseId: undefined,
      unitPriceDoc: 15,
    });
    expect(serviceLine?.dnLineId).toBeUndefined();
  });
});
