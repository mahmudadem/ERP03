import {
  CreateSalesOrderUseCase,
} from '../../../application/sales/use-cases/SalesOrderUseCases';
import { CreateDeliveryNoteUseCase } from '../../../application/sales/use-cases/DeliveryNoteUseCases';
import { CreateSalesInvoiceUseCase } from '../../../application/sales/use-cases/SalesInvoiceUseCases';
import { CreateSalesReturnUseCase } from '../../../application/sales/use-cases/SalesReturnUseCases';
import { Item } from '../../../domain/inventory/entities/Item';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import { Party } from '../../../domain/shared/entities/Party';

const COMPANY_ID = 'cmp-1';
const USER_ID = 'u-1';

const nowDate = () => new Date('2026-01-01T00:00:00.000Z');

const makeSettings = (): SalesSettings =>
  new SalesSettings({
    companyId: COMPANY_ID,
    allowDirectInvoicing: true,
    requireSOForStockItems: true,
    defaultARAccountId: 'AR-100',
    defaultRevenueAccountId: 'REV-100',
    defaultCOGSAccountId: 'COGS-100',
    allowOverDelivery: false,
    overDeliveryTolerancePct: 0,
    overInvoiceTolerancePct: 0,
    defaultPaymentTermsDays: 30,
    salesVoucherTypeId: 'VT-SI',
    defaultWarehouseId: 'wh-1',
    soNumberPrefix: 'SO',
    soNumberNextSeq: 1,
    dnNumberPrefix: 'DN',
    dnNumberNextSeq: 1,
    siNumberPrefix: 'SI',
    siNumberNextSeq: 1,
    srNumberPrefix: 'SR',
    srNumberNextSeq: 1,
  });

const makeCustomer = (): Party =>
  new Party({
    id: 'cus-1',
    companyId: COMPANY_ID,
    code: 'C001',
    legalName: 'Customer Legal',
    displayName: 'Customer One',
    roles: ['CUSTOMER'],
    paymentTermsDays: 30,
    defaultCurrency: 'USD',
    defaultARAccountId: 'AR-200',
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeItem = (): Item =>
  new Item({
    id: 'item-1',
    companyId: COMPANY_ID,
    code: 'IT-1',
    name: 'Stock Item',
    type: 'PRODUCT',
    baseUom: 'EA',
    purchaseUom: 'EA',
    salesUom: 'EA',
    costCurrency: 'USD',
    costingMethod: 'MOVING_AVG',
    trackInventory: true,
    inventoryAssetAccountId: 'INV-100',
    revenueAccountId: 'REV-100',
    cogsAccountId: 'COGS-100',
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeSO = (item: Item): SalesOrder =>
  new SalesOrder({
    id: 'so-1',
    companyId: COMPANY_ID,
    orderNumber: 'SO-EXISTING',
    customerId: 'cus-1',
    customerName: 'Customer One',
    orderDate: '2026-01-10',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'so-line-1',
        lineNo: 1,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        itemType: item.type,
        trackInventory: item.trackInventory,
        orderedQty: 10,
        uom: 'EA',
        deliveredQty: 0,
        invoicedQty: 0,
        returnedQty: 0,
        unitPriceDoc: 10,
        lineTotalDoc: 100,
        unitPriceBase: 10,
        lineTotalBase: 100,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
        warehouseId: 'wh-1',
      },
    ],
    subtotalBase: 100,
    taxTotalBase: 0,
    grandTotalBase: 100,
    subtotalDoc: 100,
    taxTotalDoc: 0,
    grandTotalDoc: 100,
    status: 'CONFIRMED',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makePostedInvoice = (item: Item): SalesInvoice =>
  new SalesInvoice({
    id: 'si-1',
    companyId: COMPANY_ID,
    invoiceNumber: 'SI-EXISTING',
    salesOrderId: 'so-1',
    customerId: 'cus-1',
    customerName: 'Customer One',
    invoiceDate: '2026-01-12',
    dueDate: '2026-02-11',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'si-line-1',
        lineNo: 1,
        soLineId: 'so-line-1',
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        trackInventory: true,
        invoicedQty: 5,
        uom: 'EA',
        unitPriceDoc: 10,
        lineTotalDoc: 50,
        unitPriceBase: 10,
        lineTotalBase: 50,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
        warehouseId: 'wh-1',
        revenueAccountId: 'REV-100',
        cogsAccountId: 'COGS-100',
        inventoryAccountId: 'INV-100',
        unitCostBase: 4,
        lineCostBase: 20,
      },
    ],
    subtotalDoc: 50,
    taxTotalDoc: 0,
    grandTotalDoc: 50,
    subtotalBase: 50,
    taxTotalBase: 0,
    grandTotalBase: 50,
    paymentTermsDays: 30,
    paymentStatus: 'UNPAID',
    paidAmountBase: 0,
    outstandingAmountBase: 50,
    status: 'POSTED',
    voucherId: 'v-si-1',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
    postedAt: nowDate(),
  });

describe('Sales document number uniqueness', () => {
  it('skips an already-used sales order number', async () => {
    const settings = makeSettings();
    const createdOrders: any[] = [];
    const useCase = new CreateSalesOrderUseCase(
      {
        getSettings: jest.fn(async () => settings),
        saveSettings: jest.fn(async () => undefined),
      } as any,
      {
        create: jest.fn(async (so: any) => createdOrders.push(so)),
        update: jest.fn(),
        getById: jest.fn(),
        getByNumber: jest.fn().mockResolvedValueOnce({ id: 'existing-so-1' }).mockResolvedValueOnce(null),
        list: jest.fn(),
        delete: jest.fn(),
      } as any,
      { getById: jest.fn(async () => makeCustomer()) } as any,
      { getItem: jest.fn(async () => makeItem()) } as any,
      { getById: jest.fn(async () => null) } as any,
      { isEnabled: jest.fn(async () => true) } as any
    );

    await useCase.execute({
      companyId: COMPANY_ID,
      customerId: 'cus-1',
      orderDate: '2026-01-10',
      currency: 'USD',
      exchangeRate: 1,
      lines: [{ itemId: 'item-1', orderedQty: 1, unitPriceDoc: 10 }],
      createdBy: USER_ID,
    });

    expect(createdOrders).toHaveLength(1);
    expect(createdOrders[0].orderNumber).toBe('SO-00002');
    expect(settings.soNumberNextSeq).toBe(3);
  });

  it('skips an already-used delivery note number', async () => {
    const settings = makeSettings();
    const item = makeItem();
    const createdNotes: any[] = [];
    const useCase = new CreateDeliveryNoteUseCase(
      {
        getSettings: jest.fn(async () => settings),
        saveSettings: jest.fn(async () => undefined),
      } as any,
      {
        create: jest.fn(async (dn: any) => createdNotes.push(dn)),
        update: jest.fn(),
        getById: jest.fn(),
        getByNumber: jest.fn().mockResolvedValueOnce({ id: 'existing-dn-1' }).mockResolvedValueOnce(null),
        list: jest.fn(),
      } as any,
      {
        getById: jest.fn(async () => makeSO(item)),
        update: jest.fn(),
      } as any,
      { getById: jest.fn(async () => makeCustomer()) } as any,
      { getItem: jest.fn(async () => item) } as any
    );

    await useCase.execute({
      companyId: COMPANY_ID,
      salesOrderId: 'so-1',
      deliveryDate: '2026-01-11',
      warehouseId: 'wh-1',
      lines: [{ soLineId: 'so-line-1', deliveredQty: 1 }],
      createdBy: USER_ID,
    });

    expect(createdNotes).toHaveLength(1);
    expect(createdNotes[0].dnNumber).toBe('DN-00002');
    expect(settings.dnNumberNextSeq).toBe(3);
  });

  it('skips an already-used sales invoice number', async () => {
    const settings = makeSettings();
    const item = makeItem();
    const createdInvoices: any[] = [];
    const useCase = new CreateSalesInvoiceUseCase(
      {
        getSettings: jest.fn(async () => settings),
        saveSettings: jest.fn(async () => undefined),
      } as any,
      {
        create: jest.fn(async (si: any) => createdInvoices.push(si)),
        update: jest.fn(),
        getById: jest.fn(),
        getByNumber: jest.fn().mockResolvedValueOnce({ id: 'existing-si-1' }).mockResolvedValueOnce(null),
        list: jest.fn(),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn() } as any,
      { getById: jest.fn(async () => makeCustomer()) } as any,
      { getItem: jest.fn(async () => item) } as any,
      { getCategory: jest.fn(async () => null) } as any,
      { getById: jest.fn(async () => null) } as any,
      {
        getBaseCurrency: jest.fn(async () => 'USD'),
        isEnabled: jest.fn(async () => true),
      } as any
    );

    await useCase.execute({
      companyId: COMPANY_ID,
      customerId: 'cus-1',
      invoiceDate: '2026-01-12',
      currency: 'USD',
      exchangeRate: 1,
      lines: [{ itemId: 'item-1', invoicedQty: 1, unitPriceDoc: 10, warehouseId: 'wh-1' }],
      createdBy: USER_ID,
    });

    expect(createdInvoices).toHaveLength(1);
    expect(createdInvoices[0].invoiceNumber).toBe('SI-00002');
    expect(settings.siNumberNextSeq).toBe(3);
  });

  it('skips an already-used sales return number', async () => {
    const settings = makeSettings();
    const item = makeItem();
    const createdReturns: any[] = [];
    const useCase = new CreateSalesReturnUseCase(
      {
        getSettings: jest.fn(async () => settings),
        saveSettings: jest.fn(async () => undefined),
      } as any,
      {
        create: jest.fn(async (sr: any) => createdReturns.push(sr)),
        update: jest.fn(),
        getById: jest.fn(),
        getByNumber: jest.fn().mockResolvedValueOnce({ id: 'existing-sr-1' }).mockResolvedValueOnce(null),
        list: jest.fn(),
      } as any,
      { getById: jest.fn(async () => makePostedInvoice(item)), update: jest.fn() } as any,
      { getById: jest.fn(async () => null), update: jest.fn() } as any
    );

    await useCase.execute({
      companyId: COMPANY_ID,
      salesInvoiceId: 'si-1',
      returnDate: '2026-01-15',
      reason: 'Damaged',
      lines: [{ siLineId: 'si-line-1', returnQty: 1 }],
      createdBy: USER_ID,
    });

    expect(createdReturns).toHaveLength(1);
    expect(createdReturns[0].returnNumber).toBe('SR-00002');
    expect(settings.srNumberNextSeq).toBe(3);
  });
});
