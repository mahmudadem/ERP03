import { describe, expect, it, vi } from 'vitest';
import { Item } from '../../../domain/inventory/entities/Item';
import { DeliveryNote } from '../../../domain/sales/entities/DeliveryNote';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import { PostDeliveryNoteUseCase } from '../../../application/sales/use-cases/DeliveryNoteUseCases';
import { PostSalesInvoiceUseCase } from '../../../application/sales/use-cases/SalesInvoiceUseCases';

const COMPANY_ID = 'cmp-1';
const USER_ID = 'u-1';

const nowDate = () => new Date('2026-01-01T00:00:00.000Z');

const makeSettings = (
  mode: 'SIMPLE' | 'CONTROLLED',
  overrides: Partial<SalesSettings> = {}
): SalesSettings =>
  new SalesSettings({
    companyId: COMPANY_ID,
    salesControlMode: mode,
    requireSOForStockItems: mode === 'CONTROLLED',
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
    ...overrides,
  });

const makeCustomer = (overrides: Partial<Party> = {}): Party =>
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
    ...overrides,
  });

const makeItem = (
  id: string,
  options: {
    trackInventory: boolean;
    type?: 'PRODUCT' | 'SERVICE' | 'RAW_MATERIAL';
    costCurrency?: string;
    revenueAccountId?: string;
    cogsAccountId?: string;
    inventoryAssetAccountId?: string;
    defaultSalesTaxCodeId?: string;
  }
): Item =>
  new Item({
    id,
    companyId: COMPANY_ID,
    code: `IT-${id}`,
    name: `Item ${id}`,
    type: options.type ?? (options.trackInventory ? 'PRODUCT' : 'SERVICE'),
    baseUom: 'EA',
    purchaseUom: 'EA',
    salesUom: 'EA',
    costCurrency: options.costCurrency ?? 'USD',
    costingMethod: 'MOVING_AVG',
    trackInventory: options.trackInventory,
    revenueAccountId: options.revenueAccountId ?? 'REV-200',
    cogsAccountId: options.cogsAccountId ?? (options.trackInventory ? 'COGS-200' : undefined),
    inventoryAssetAccountId:
      options.inventoryAssetAccountId ?? (options.trackInventory ? 'INV-100' : undefined),
    defaultSalesTaxCodeId: options.defaultSalesTaxCodeId,
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeSO = (input: {
  id: string;
  item: Item;
  status?: SalesOrder['status'];
  orderedQty?: number;
  deliveredQty?: number;
  invoicedQty?: number;
}): SalesOrder => {
  const orderedQty = input.orderedQty ?? 10;
  const deliveredQty = input.deliveredQty ?? 0;
  const invoicedQty = input.invoicedQty ?? 0;

  return new SalesOrder({
    id: input.id,
    companyId: COMPANY_ID,
    orderNumber: `SO-${input.id}`,
    customerId: 'cus-1',
    customerName: 'Customer One',
    orderDate: '2026-01-10',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'so-line-1',
        lineNo: 1,
        itemId: input.item.id,
        itemCode: input.item.code,
        itemName: input.item.name,
        itemType: input.item.type,
        trackInventory: input.item.trackInventory,
        orderedQty,
        uom: 'EA',
        deliveredQty,
        invoicedQty,
        returnedQty: 0,
        unitPriceDoc: 10,
        lineTotalDoc: orderedQty * 10,
        unitPriceBase: 10,
        lineTotalBase: orderedQty * 10,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
        warehouseId: 'wh-1',
      },
    ],
    subtotalBase: orderedQty * 10,
    taxTotalBase: 0,
    grandTotalBase: orderedQty * 10,
    subtotalDoc: orderedQty * 10,
    taxTotalDoc: 0,
    grandTotalDoc: orderedQty * 10,
    status: input.status ?? 'CONFIRMED',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });
};

const makeDN = (input: {
  id: string;
  salesOrderId: string;
  item: Item;
  deliveredQty: number;
  status?: DeliveryNote['status'];
}): DeliveryNote =>
  new DeliveryNote({
    id: input.id,
    companyId: COMPANY_ID,
    dnNumber: `DN-${input.id}`,
    salesOrderId: input.salesOrderId,
    customerId: 'cus-1',
    customerName: 'Customer One',
    deliveryDate: '2026-01-11',
    warehouseId: 'wh-1',
    lines: [
      {
        lineId: 'dn-line-1',
        lineNo: 1,
        soLineId: 'so-line-1',
        itemId: input.item.id,
        itemCode: input.item.code,
        itemName: input.item.name,
        deliveredQty: input.deliveredQty,
        uom: 'EA',
        unitCostBase: 0,
        lineCostBase: 0,
        moveCurrency: 'USD',
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
        stockMovementId: null,
      },
    ],
    status: input.status ?? 'DRAFT',
    cogsVoucherId: null,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeSI = (input: {
  id: string;
  item: Item;
  salesOrderId?: string;
  soLineId?: string;
  dnLineId?: string;
  currency?: string;
  exchangeRate?: number;
  invoicedQty: number;
  unitPriceDoc: number;
  taxCodeId?: string;
  warehouseId?: string;
}): SalesInvoice =>
  new SalesInvoice({
    id: input.id,
    companyId: COMPANY_ID,
    invoiceNumber: `SI-${input.id}`,
    salesOrderId: input.salesOrderId,
    customerId: 'cus-1',
    customerName: 'Customer One',
    invoiceDate: '2026-01-12',
    dueDate: '2026-02-11',
    currency: (input.currency ?? 'USD').toUpperCase(),
    exchangeRate: input.exchangeRate ?? 1,
    lines: [
      {
        lineId: 'si-line-1',
        lineNo: 1,
        soLineId: input.soLineId,
        dnLineId: input.dnLineId,
        itemId: input.item.id,
        itemCode: input.item.code,
        itemName: input.item.name,
        trackInventory: input.item.trackInventory,
        invoicedQty: input.invoicedQty,
        uom: 'EA',
        unitPriceDoc: input.unitPriceDoc,
        lineTotalDoc: input.invoicedQty * input.unitPriceDoc,
        unitPriceBase: (input.exchangeRate ?? 1) * input.unitPriceDoc,
        lineTotalBase: input.invoicedQty * input.unitPriceDoc * (input.exchangeRate ?? 1),
        taxCodeId: input.taxCodeId,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
        warehouseId: input.warehouseId,
        revenueAccountId: input.item.revenueAccountId || '',
        cogsAccountId: input.item.cogsAccountId,
        inventoryAccountId: input.item.inventoryAssetAccountId,
        stockMovementId: null,
      },
    ],
    subtotalDoc: 0,
    taxTotalDoc: 0,
    grandTotalDoc: 0,
    subtotalBase: 0,
    taxTotalBase: 0,
    grandTotalBase: 0,
    paymentTermsDays: 30,
    paymentStatus: 'UNPAID',
    paidAmountBase: 0,
    outstandingAmountBase: 0,
    status: 'DRAFT',
    voucherId: null,
    cogsVoucherId: null,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeTaxCode = (rate: number): TaxCode =>
  new TaxCode({
    id: 'tax-1',
    companyId: COMPANY_ID,
    code: 'VAT18',
    name: 'VAT 18%',
    rate,
    taxType: rate === 0 ? 'EXEMPT' : 'VAT',
    scope: 'SALES',
    salesTaxAccountId: 'TAX-OUT-100',
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeTransactionManager = () => ({
  runTransaction: vi.fn(async (operation: (transaction: any) => Promise<any>) => operation({ id: 'txn-1' })),
});

const makeInventoryService = () => {
  let seq = 1;
  return {
    processOUT: vi.fn(async () => ({
      id: `mov-out-${seq++}`,
      unitCostBase: 5,
      movementCurrency: 'USD',
      fxRateMovToBase: 1,
      fxRateCCYToBase: 1,
    })),
    processIN: vi.fn(async () => ({ id: `mov-in-${seq++}` })),
  };
};

describe('Sales posting use-cases (Phase 2)', () => {
  it('1) PostDN creates SALES_DELIVERY inventory movement per line', async () => {
    const settings = makeSettings('CONTROLLED');
    const item = makeItem('stock-1', { trackInventory: true });
    const so = makeSO({ id: 'so-1', item, orderedQty: 10, deliveredQty: 0 });
    const dn = makeDN({ id: 'dn-1', salesOrderId: so.id, item, deliveredQty: 4 });

    const inventoryService = makeInventoryService();
    const useCase = new PostDeliveryNoteUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      { getById: vi.fn(async () => dn), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => so), update: vi.fn(async () => undefined) } as any,
      { getItem: vi.fn(async () => item) } as any,
      { getCategory: vi.fn(async () => null) } as any,
      { getWarehouse: vi.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      inventoryService as any,
      { save: vi.fn(async (voucher: any) => voucher) } as any,
      { recordForVoucher: vi.fn(async () => undefined) } as any,
      makeTransactionManager() as any
    );

    await useCase.execute(COMPANY_ID, dn.id);

    expect(inventoryService.processOUT).toHaveBeenCalledTimes(1);
    const input = (inventoryService.processOUT as any).mock.calls[0][0];
    expect(input.movementType).toBe('SALES_DELIVERY');
    expect(input.refs.type).toBe('DELIVERY_NOTE');
    expect(input.refs.docId).toBe(dn.id);
  });

  it('2) PostDN creates COGS GL voucher (Dr COGS, Cr Inventory)', async () => {
    const settings = makeSettings('CONTROLLED');
    const item = makeItem('stock-2', {
      trackInventory: true,
      cogsAccountId: 'COGS-100',
      inventoryAssetAccountId: 'INV-100',
    });
    const so = makeSO({ id: 'so-2', item, orderedQty: 10, deliveredQty: 0 });
    const dn = makeDN({ id: 'dn-2', salesOrderId: so.id, item, deliveredQty: 2 });

    const voucherRepo = { save: vi.fn(async (voucher: any) => voucher) };

    const useCase = new PostDeliveryNoteUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      { getById: vi.fn(async () => dn), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => so), update: vi.fn(async () => undefined) } as any,
      { getItem: vi.fn(async () => item) } as any,
      { getCategory: vi.fn(async () => null) } as any,
      { getWarehouse: vi.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      voucherRepo as any,
      { recordForVoucher: vi.fn(async () => undefined) } as any,
      makeTransactionManager() as any
    );

    await useCase.execute(COMPANY_ID, dn.id);

    expect(voucherRepo.save).toHaveBeenCalledTimes(1);
    const voucher = (voucherRepo.save as any).mock.calls[0][0];
    const hasCogsDebit = voucher.lines.some((line: any) => line.accountId === 'COGS-100' && line.side === 'Debit');
    const hasInventoryCredit = voucher.lines.some((line: any) => line.accountId === 'INV-100' && line.side === 'Credit');
    expect(hasCogsDebit).toBe(true);
    expect(hasInventoryCredit).toBe(true);
    expect(voucher.metadata.sourceModule).toBe('sales');
    expect(voucher.metadata.sourceType).toBe('DELIVERY_NOTE');
    expect(voucher.metadata.sourceId).toBe(dn.id);
  });

  it('3) PostDN updates SO line deliveredQty', async () => {
    const settings = makeSettings('CONTROLLED');
    const item = makeItem('stock-3', { trackInventory: true });
    const so = makeSO({ id: 'so-3', item, orderedQty: 10, deliveredQty: 1 });
    const dn = makeDN({ id: 'dn-3', salesOrderId: so.id, item, deliveredQty: 3 });

    const useCase = new PostDeliveryNoteUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      { getById: vi.fn(async () => dn), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => so), update: vi.fn(async () => undefined) } as any,
      { getItem: vi.fn(async () => item) } as any,
      { getCategory: vi.fn(async () => null) } as any,
      { getWarehouse: vi.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      { save: vi.fn(async (voucher: any) => voucher) } as any,
      { recordForVoucher: vi.fn(async () => undefined) } as any,
      makeTransactionManager() as any
    );

    await useCase.execute(COMPANY_ID, dn.id);
    expect(so.lines[0].deliveredQty).toBe(4);
  });

  it('4) PostDN updates SO status to PARTIALLY_DELIVERED', async () => {
    const settings = makeSettings('CONTROLLED');
    const item = makeItem('stock-4', { trackInventory: true });
    const so = makeSO({ id: 'so-4', item, orderedQty: 10, deliveredQty: 0, status: 'CONFIRMED' });
    const dn = makeDN({ id: 'dn-4', salesOrderId: so.id, item, deliveredQty: 2 });

    const useCase = new PostDeliveryNoteUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      { getById: vi.fn(async () => dn), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => so), update: vi.fn(async () => undefined) } as any,
      { getItem: vi.fn(async () => item) } as any,
      { getCategory: vi.fn(async () => null) } as any,
      { getWarehouse: vi.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      { save: vi.fn(async (voucher: any) => voucher) } as any,
      { recordForVoucher: vi.fn(async () => undefined) } as any,
      makeTransactionManager() as any
    );

    await useCase.execute(COMPANY_ID, dn.id);
    expect(so.status).toBe('PARTIALLY_DELIVERED');
  });

  it('5) PostSI (CONTROLLED stock): blocks if invoicedQty > deliveredQty', async () => {
    const settings = makeSettings('CONTROLLED');
    const customer = makeCustomer();
    const item = makeItem('stock-5', { trackInventory: true });
    const so = makeSO({ id: 'so-5', item, orderedQty: 10, deliveredQty: 5, invoicedQty: 0 });
    const si = makeSI({
      id: 'si-5',
      item,
      salesOrderId: so.id,
      soLineId: 'so-line-1',
      invoicedQty: 6,
      unitPriceDoc: 10,
      warehouseId: 'wh-1',
    });

    const voucherRepo = { save: vi.fn(async (voucher: any) => voucher) };

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      { getById: vi.fn(async () => si), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => so), update: vi.fn(async () => undefined) } as any,
      { list: vi.fn(async () => []) } as any,
      { getById: vi.fn(async () => customer) } as any,
      { getById: vi.fn(async () => null) } as any,
      { getItem: vi.fn(async () => item) } as any,
      { getCategory: vi.fn(async () => null) } as any,
      { getWarehouse: vi.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      voucherRepo as any,
      { recordForVoucher: vi.fn(async () => undefined) } as any,
      makeTransactionManager() as any
    );

    await expect(useCase.execute(COMPANY_ID, si.id)).rejects.toThrow(/delivered/i);
    expect(voucherRepo.save).not.toHaveBeenCalled();
  });

  it('6) PostSI (CONTROLLED service): allows invoice without DN', async () => {
    const settings = makeSettings('CONTROLLED');
    const customer = makeCustomer();
    const serviceItem = makeItem('svc-1', {
      trackInventory: false,
      type: 'SERVICE',
      revenueAccountId: 'REV-500',
    });
    const so = makeSO({ id: 'so-6', item: serviceItem, orderedQty: 10, deliveredQty: 0, invoicedQty: 0 });
    const si = makeSI({
      id: 'si-6',
      item: serviceItem,
      salesOrderId: so.id,
      soLineId: 'so-line-1',
      invoicedQty: 3,
      unitPriceDoc: 20,
    });

    const inventoryService = makeInventoryService();
    const invoiceStore = new Map([[si.id, si]]);
    const voucherRepo = { save: vi.fn(async (voucher: any) => voucher) };

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      {
        getById: vi.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: vi.fn(async (entity: SalesInvoice) => {
          invoiceStore.set(entity.id, entity);
        }),
      } as any,
      { getById: vi.fn(async () => so), update: vi.fn(async () => undefined) } as any,
      { list: vi.fn(async () => []) } as any,
      { getById: vi.fn(async () => customer) } as any,
      { getById: vi.fn(async () => null) } as any,
      { getItem: vi.fn(async () => serviceItem) } as any,
      { getCategory: vi.fn(async () => null) } as any,
      { getWarehouse: vi.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      inventoryService as any,
      voucherRepo as any,
      { recordForVoucher: vi.fn(async () => undefined) } as any,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, si.id);
    expect(posted.status).toBe('POSTED');
    expect(inventoryService.processOUT).not.toHaveBeenCalled();
    expect(voucherRepo.save).toHaveBeenCalledTimes(1);
    const voucher = (voucherRepo.save as any).mock.calls[0][0];
    expect(voucher.metadata.sourceModule).toBe('sales');
    expect(voucher.metadata.sourceType).toBe('SALES_INVOICE');
  });

  it('7) PostSI (SIMPLE standalone): creates inventory OUT + Revenue + COGS vouchers', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const stockItem = makeItem('stock-7', {
      trackInventory: true,
      cogsAccountId: 'COGS-700',
      inventoryAssetAccountId: 'INV-700',
      revenueAccountId: 'REV-700',
    });
    const si = makeSI({
      id: 'si-7',
      item: stockItem,
      invoicedQty: 2,
      unitPriceDoc: 15,
      warehouseId: 'wh-1',
    });

    const inventoryService = makeInventoryService();
    const invoiceStore = new Map([[si.id, si]]);
    const voucherRepo = { save: vi.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: vi.fn(async () => undefined) };

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      {
        getById: vi.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: vi.fn(async (entity: SalesInvoice) => {
          invoiceStore.set(entity.id, entity);
        }),
      } as any,
      { getById: vi.fn(async () => null), update: vi.fn(async () => undefined) } as any,
      { list: vi.fn(async () => []) } as any,
      { getById: vi.fn(async () => customer) } as any,
      { getById: vi.fn(async () => null) } as any,
      { getItem: vi.fn(async () => stockItem) } as any,
      { getCategory: vi.fn(async () => null) } as any,
      { getWarehouse: vi.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      inventoryService as any,
      voucherRepo as any,
      ledgerRepo as any,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, si.id);
    expect(posted.status).toBe('POSTED');
    expect(inventoryService.processOUT).toHaveBeenCalledTimes(1);
    expect(voucherRepo.save).toHaveBeenCalledTimes(2);
    expect(ledgerRepo.recordForVoucher).toHaveBeenCalledTimes(2);
  });

  it('8) PostSI (SIMPLE SO-linked): blocks if invoicedQty > orderedQty', async () => {
    const settings = makeSettings('SIMPLE', { overInvoiceTolerancePct: 0 });
    const customer = makeCustomer();
    const stockItem = makeItem('stock-8', { trackInventory: true });
    const so = makeSO({ id: 'so-8', item: stockItem, orderedQty: 5, deliveredQty: 0, invoicedQty: 0 });
    const si = makeSI({
      id: 'si-8',
      item: stockItem,
      salesOrderId: so.id,
      soLineId: 'so-line-1',
      invoicedQty: 6,
      unitPriceDoc: 10,
      warehouseId: 'wh-1',
    });

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      { getById: vi.fn(async () => si), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => so), update: vi.fn(async () => undefined) } as any,
      { list: vi.fn(async () => []) } as any,
      { getById: vi.fn(async () => customer) } as any,
      { getById: vi.fn(async () => null) } as any,
      { getItem: vi.fn(async () => stockItem) } as any,
      { getCategory: vi.fn(async () => null) } as any,
      { getWarehouse: vi.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      { save: vi.fn(async (voucher: any) => voucher) } as any,
      { recordForVoucher: vi.fn(async () => undefined) } as any,
      makeTransactionManager() as any
    );

    await expect(useCase.execute(COMPANY_ID, si.id)).rejects.toThrow(/order qty/i);
  });

  it('9) PostSI: tax snapshot frozen at posting time', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const stockItem = makeItem('stock-9', {
      trackInventory: true,
      defaultSalesTaxCodeId: 'tax-1',
    });
    const si = makeSI({
      id: 'si-9',
      item: stockItem,
      invoicedQty: 1,
      unitPriceDoc: 100,
      warehouseId: 'wh-1',
      taxCodeId: 'tax-1',
    });

    const taxStore = new Map<string, TaxCode>([['tax-1', makeTaxCode(0.18)]]);
    const invoiceStore = new Map([[si.id, si]]);

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      {
        getById: vi.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: vi.fn(async (entity: SalesInvoice) => {
          invoiceStore.set(entity.id, entity);
        }),
      } as any,
      { getById: vi.fn(async () => null), update: vi.fn(async () => undefined) } as any,
      { list: vi.fn(async () => []) } as any,
      { getById: vi.fn(async () => customer) } as any,
      { getById: vi.fn(async (_companyId: string, id: string) => taxStore.get(id) ?? null) } as any,
      { getItem: vi.fn(async () => stockItem) } as any,
      { getCategory: vi.fn(async () => null) } as any,
      { getWarehouse: vi.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      { save: vi.fn(async (voucher: any) => voucher) } as any,
      { recordForVoucher: vi.fn(async () => undefined) } as any,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, si.id);
    expect(posted.lines[0].taxRate).toBe(0.18);
    expect(posted.lines[0].taxCode).toBe('VAT18');

    taxStore.set('tax-1', makeTaxCode(0.25));
    const reloaded = invoiceStore.get(si.id)!;
    expect(reloaded.lines[0].taxRate).toBe(0.18);
    expect(reloaded.lines[0].taxCode).toBe('VAT18');
  });

  it('10) PostSI with foreign currency: base amounts computed correctly', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const stockItem = makeItem('stock-10', {
      trackInventory: true,
      cogsAccountId: 'COGS-1000',
      inventoryAssetAccountId: 'INV-1000',
      revenueAccountId: 'REV-1000',
    });
    const si = makeSI({
      id: 'si-10',
      item: stockItem,
      currency: 'EUR',
      exchangeRate: 1.5,
      invoicedQty: 2,
      unitPriceDoc: 10,
      warehouseId: 'wh-1',
      taxCodeId: 'tax-1',
    });

    const taxCode = makeTaxCode(0.1);
    const invoiceStore = new Map([[si.id, si]]);
    const savedVouchers: any[] = [];

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      {
        getById: vi.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: vi.fn(async (entity: SalesInvoice) => {
          invoiceStore.set(entity.id, entity);
        }),
      } as any,
      { getById: vi.fn(async () => null), update: vi.fn(async () => undefined) } as any,
      { list: vi.fn(async () => []) } as any,
      { getById: vi.fn(async () => customer) } as any,
      { getById: vi.fn(async () => taxCode) } as any,
      { getItem: vi.fn(async () => stockItem) } as any,
      { getCategory: vi.fn(async () => null) } as any,
      { getWarehouse: vi.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      { save: vi.fn(async (voucher: any) => { savedVouchers.push(voucher); return voucher; }) } as any,
      { recordForVoucher: vi.fn(async () => undefined) } as any,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, si.id);
    expect(posted.subtotalDoc).toBe(20);
    expect(posted.taxTotalDoc).toBe(2);
    expect(posted.grandTotalDoc).toBe(22);
    expect(posted.subtotalBase).toBe(30);
    expect(posted.taxTotalBase).toBe(3);
    expect(posted.grandTotalBase).toBe(33);
    expect(posted.outstandingAmountBase).toBe(33);

    const revenueVoucher = savedVouchers.find((voucher) => voucher.voucherNo === `SI-${si.invoiceNumber}`);
    expect(revenueVoucher).toBeTruthy();
    expect(revenueVoucher.totalDebit).toBe(33);
    expect(revenueVoucher.totalCredit).toBe(33);
    expect(revenueVoucher.metadata.sourceModule).toBe('sales');
    expect(revenueVoucher.metadata.sourceType).toBe('SALES_INVOICE');
    expect(revenueVoucher.metadata.sourceId).toBe(si.id);
  });
});
