import { describe, expect, it, jest } from '@jest/globals';
import { GoodsReceipt } from '../../../domain/purchases/entities/GoodsReceipt';
import { PurchaseInvoice } from '../../../domain/purchases/entities/PurchaseInvoice';
import { PurchaseOrder } from '../../../domain/purchases/entities/PurchaseOrder';
import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';
import { Item } from '../../../domain/inventory/entities/Item';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import {
  PostGoodsReceiptUseCase,
} from '../../../application/purchases/use-cases/GoodsReceiptUseCases';
import { PostPurchaseInvoiceUseCase } from '../../../application/purchases/use-cases/PurchaseInvoiceUseCases';
import { SubledgerVoucherPostingService } from '../../../application/accounting/services/SubledgerVoucherPostingService';

const COMPANY_ID = 'cmp-1';
const USER_ID = 'u-1';

const nowDate = () => new Date('2026-01-01T00:00:00.000Z');

const makeSettings = (
  mode: 'SIMPLE' | 'CONTROLLED',
  overrides: Partial<PurchaseSettings> = {}
): PurchaseSettings =>
  new PurchaseSettings({
    companyId: COMPANY_ID,
    allowDirectInvoicing: mode === 'SIMPLE',
    requirePOForStockItems: mode === 'CONTROLLED',
    defaultAPAccountId: 'AP-100',
    defaultPurchaseExpenseAccountId: 'EXP-100',
    allowOverDelivery: false,
    overDeliveryTolerancePct: 0,
    overInvoiceTolerancePct: 0,
    defaultPaymentTermsDays: 30,
    purchaseVoucherTypeId: 'VT-PI',
    defaultWarehouseId: 'wh-1',
    poNumberPrefix: 'PO',
    poNumberNextSeq: 1,
    grnNumberPrefix: 'GRN',
    grnNumberNextSeq: 1,
    piNumberPrefix: 'PI',
    piNumberNextSeq: 1,
    prNumberPrefix: 'PR',
    prNumberNextSeq: 1,
    ...overrides,
  });

const makeVendor = (overrides: Partial<Party> = {}): Party =>
  new Party({
    id: 'ven-1',
    companyId: COMPANY_ID,
    code: 'V001',
    legalName: 'Vendor Legal',
    displayName: 'Vendor One',
    roles: ['VENDOR'],
    paymentTermsDays: 30,
    defaultCurrency: 'USD',
    defaultAPAccountId: 'AP-200',
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
    inventoryAssetAccountId?: string;
    cogsAccountId?: string;
    defaultPurchaseTaxCodeId?: string;
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
    inventoryAssetAccountId: options.inventoryAssetAccountId ?? (options.trackInventory ? 'INV-100' : undefined),
    cogsAccountId: options.cogsAccountId ?? (!options.trackInventory ? 'EXP-200' : undefined),
    defaultPurchaseTaxCodeId: options.defaultPurchaseTaxCodeId,
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makePO = (input: {
  id: string;
  item: Item;
  status?: PurchaseOrder['status'];
  orderedQty?: number;
  receivedQty?: number;
  invoicedQty?: number;
}): PurchaseOrder => {
  const orderedQty = input.orderedQty ?? 10;
  const receivedQty = input.receivedQty ?? 0;
  const invoicedQty = input.invoicedQty ?? 0;
  return new PurchaseOrder({
    id: input.id,
    companyId: COMPANY_ID,
    orderNumber: `PO-${input.id}`,
    vendorId: 'ven-1',
    vendorName: 'Vendor One',
    orderDate: '2026-01-10',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'po-line-1',
        lineNo: 1,
        itemId: input.item.id,
        itemCode: input.item.code,
        itemName: input.item.name,
        itemType: input.item.type,
        trackInventory: input.item.trackInventory,
        orderedQty,
        uom: 'EA',
        receivedQty,
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

const makeGRN = (input: {
  id: string;
  purchaseOrderId: string;
  item: Item;
  receivedQty: number;
}): GoodsReceipt =>
  new GoodsReceipt({
    id: input.id,
    companyId: COMPANY_ID,
    grnNumber: `GRN-${input.id}`,
    purchaseOrderId: input.purchaseOrderId,
    vendorId: 'ven-1',
    vendorName: 'Vendor One',
    receiptDate: '2026-01-11',
    warehouseId: 'wh-1',
    lines: [
      {
        lineId: 'grn-line-1',
        lineNo: 1,
        poLineId: 'po-line-1',
        itemId: input.item.id,
        itemCode: input.item.code,
        itemName: input.item.name,
        receivedQty: input.receivedQty,
        uom: 'EA',
        unitCostDoc: 10,
        unitCostBase: 10,
        moveCurrency: 'USD',
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
      },
    ],
    status: 'DRAFT',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makePI = (input: {
  id: string;
  item: Item;
  purchaseOrderId?: string;
  poLineId?: string;
  grnLineId?: string;
  currency?: string;
  exchangeRate?: number;
  invoicedQty: number;
  unitPriceDoc: number;
  taxCodeId?: string;
  warehouseId?: string;
}): PurchaseInvoice =>
  new PurchaseInvoice({
    id: input.id,
    companyId: COMPANY_ID,
    invoiceNumber: `PI-${input.id}`,
    purchaseOrderId: input.purchaseOrderId,
    vendorId: 'ven-1',
    vendorName: 'Vendor One',
    invoiceDate: '2026-01-12',
    dueDate: '2026-02-11',
    currency: (input.currency ?? 'USD').toUpperCase(),
    exchangeRate: input.exchangeRate ?? 1,
    lines: [
      {
        lineId: 'pi-line-1',
        lineNo: 1,
        poLineId: input.poLineId,
        grnLineId: input.grnLineId,
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
        accountId: '',
      },
    ],
    subtotalDoc: 0,
    taxTotalDoc: 0,
    grandTotalDoc: 0,
    subtotalBase: 0,
    taxTotalBase: 0,
    grandTotalBase: 0,
    paymentTermsDays: 30,
    outstandingAmountBase: 0,
    status: 'DRAFT',
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
    scope: 'PURCHASE',
    purchaseTaxAccountId: 'TAX-IN-100',
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeTransactionManager = () => ({
  runTransaction: jest.fn(async (operation: (transaction: any) => Promise<any>) => operation({ id: 'txn-1' })),
});

const makeInventoryService = () => {
  let seq = 1;
  return {
    processIN: jest.fn(async () => ({ id: `mov-${seq++}` })),
    processOUT: jest.fn(async () => ({ id: `mov-out-${seq++}` })),
  };
};

const makeInventorySettingsRepository = (method: 'PERIODIC' | 'PERPETUAL' = 'PERPETUAL') => ({
  getSettings: jest.fn(async () => ({
    inventoryAccountingMethod: method,
    defaultInventoryAssetAccountId: 'INV-100',
  })),
});

describe('Purchase posting use-cases (Phase 2)', () => {
  it('1) PostGRN creates PURCHASE_RECEIPT inventory movement per line', async () => {
    const settings = makeSettings('CONTROLLED');
    const item = makeItem('stock-1', { trackInventory: true });
    const po = makePO({ id: 'po-1', item, orderedQty: 10, receivedQty: 0 });
    const grn = makeGRN({ id: 'grn-1', purchaseOrderId: po.id, item, receivedQty: 4 });

    const transactionManager = makeTransactionManager();
    const inventoryService = makeInventoryService();
    const settingsRepo = { getSettings: jest.fn(async () => settings) };
    const grnStore = new Map([[grn.id, grn]]);
    const poStore = new Map([[po.id, po]]);
    const goodsReceiptRepo = {
      getById: jest.fn(async (_companyId: string, id: string) => grnStore.get(id) ?? null),
      update: jest.fn(async (entity: GoodsReceipt) => { grnStore.set(entity.id, entity); }),
    };
    const purchaseOrderRepo = {
      getById: jest.fn(async (_companyId: string, id: string) => poStore.get(id) ?? null),
      update: jest.fn(async (entity: PurchaseOrder) => { poStore.set(entity.id, entity); }),
    };
    const itemRepo = { getItem: jest.fn(async () => item) };
    const warehouseRepo = { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) };
    const uomConversionRepo = { getConversionsForItem: jest.fn(async () => []) };

    const useCase = new PostGoodsReceiptUseCase(
      settingsRepo as any,
      goodsReceiptRepo as any,
      purchaseOrderRepo as any,
      itemRepo as any,
      warehouseRepo as any,
      uomConversionRepo as any,
      inventoryService as any,
      transactionManager as any
    );

    await useCase.execute(COMPANY_ID, grn.id);

    expect(inventoryService.processIN).toHaveBeenCalledTimes(1);
    const input = (inventoryService.processIN as any).mock.calls[0][0];
    expect(input.movementType).toBe('PURCHASE_RECEIPT');
    expect(input.refs.type).toBe('GOODS_RECEIPT');
    expect(input.refs.docId).toBe(grn.id);
  });

  it('2) PostGRN updates PO line receivedQty', async () => {
    const settings = makeSettings('CONTROLLED');
    const item = makeItem('stock-2', { trackInventory: true });
    const po = makePO({ id: 'po-2', item, orderedQty: 10, receivedQty: 1 });
    const grn = makeGRN({ id: 'grn-2', purchaseOrderId: po.id, item, receivedQty: 3 });

    const transactionManager = makeTransactionManager();
    const inventoryService = makeInventoryService();
    const settingsRepo = { getSettings: jest.fn(async () => settings) };
    const goodsReceiptRepo = {
      getById: jest.fn(async () => grn),
      update: jest.fn(async () => undefined),
    };
    const purchaseOrderRepo = {
      getById: jest.fn(async () => po),
      update: jest.fn(async () => undefined),
    };
    const itemRepo = { getItem: jest.fn(async () => item) };
    const warehouseRepo = { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) };
    const uomConversionRepo = { getConversionsForItem: jest.fn(async () => []) };

    const useCase = new PostGoodsReceiptUseCase(
      settingsRepo as any,
      goodsReceiptRepo as any,
      purchaseOrderRepo as any,
      itemRepo as any,
      warehouseRepo as any,
      uomConversionRepo as any,
      inventoryService as any,
      transactionManager as any
    );

    await useCase.execute(COMPANY_ID, grn.id);
    expect(po.lines[0].receivedQty).toBe(4);
  });

  it('3) PostGRN updates PO status to PARTIALLY_RECEIVED', async () => {
    const settings = makeSettings('CONTROLLED');
    const item = makeItem('stock-3', { trackInventory: true });
    const po = makePO({ id: 'po-3', item, orderedQty: 10, receivedQty: 0, status: 'CONFIRMED' });
    const grn = makeGRN({ id: 'grn-3', purchaseOrderId: po.id, item, receivedQty: 2 });

    const transactionManager = makeTransactionManager();
    const inventoryService = makeInventoryService();
    const settingsRepo = { getSettings: jest.fn(async () => settings) };
    const goodsReceiptRepo = { getById: jest.fn(async () => grn), update: jest.fn(async () => undefined) };
    const purchaseOrderRepo = { getById: jest.fn(async () => po), update: jest.fn(async () => undefined) };
    const itemRepo = { getItem: jest.fn(async () => item) };
    const warehouseRepo = { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) };
    const uomConversionRepo = { getConversionsForItem: jest.fn(async () => []) };

    const useCase = new PostGoodsReceiptUseCase(
      settingsRepo as any,
      goodsReceiptRepo as any,
      purchaseOrderRepo as any,
      itemRepo as any,
      warehouseRepo as any,
      uomConversionRepo as any,
      inventoryService as any,
      transactionManager as any
    );

    await useCase.execute(COMPANY_ID, grn.id);
    expect(po.status).toBe('PARTIALLY_RECEIVED');
  });

  it('4) PostGRN creates NO GL entries (no voucher on GRN)', async () => {
    const settings = makeSettings('CONTROLLED');
    const item = makeItem('stock-4', { trackInventory: true });
    const po = makePO({ id: 'po-4', item, orderedQty: 10, receivedQty: 0 });
    const grn = makeGRN({ id: 'grn-4', purchaseOrderId: po.id, item, receivedQty: 2 });

    const transactionManager = makeTransactionManager();
    const inventoryService = makeInventoryService();
    const settingsRepo = { getSettings: jest.fn(async () => settings) };
    const goodsReceiptRepo = { getById: jest.fn(async () => grn), update: jest.fn(async () => undefined) };
    const purchaseOrderRepo = { getById: jest.fn(async () => po), update: jest.fn(async () => undefined) };
    const itemRepo = { getItem: jest.fn(async () => item) };
    const warehouseRepo = { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) };
    const uomConversionRepo = { getConversionsForItem: jest.fn(async () => []) };

    const useCase = new PostGoodsReceiptUseCase(
      settingsRepo as any,
      goodsReceiptRepo as any,
      purchaseOrderRepo as any,
      itemRepo as any,
      warehouseRepo as any,
      uomConversionRepo as any,
      inventoryService as any,
      transactionManager as any
    );

    const posted = await useCase.execute(COMPANY_ID, grn.id);
    expect((posted as any).voucherId).toBeUndefined();
  });

  it('5) PostPI (CONTROLLED stock): blocks if invoicedQty > receivedQty', async () => {
    const settings = makeSettings('CONTROLLED');
    const vendor = makeVendor();
    const item = makeItem('stock-5', { trackInventory: true });
    const po = makePO({ id: 'po-5', item, orderedQty: 10, receivedQty: 5, invoicedQty: 0 });
    const pi = makePI({
      id: 'pi-5',
      item,
      purchaseOrderId: po.id,
      poLineId: 'po-line-1',
      invoicedQty: 6,
      unitPriceDoc: 10,
      warehouseId: 'wh-1',
    });

    const inventoryService = makeInventoryService();
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };
    const useCase = new PostPurchaseInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      { getById: jest.fn(async () => pi), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => po), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => null) } as any,
      { getItem: jest.fn(async () => item) } as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      new SubledgerVoucherPostingService(
        voucherRepo as any,
        ledgerRepo as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    await expect(useCase.execute(COMPANY_ID, pi.id)).rejects.toThrow(/received qty/i);
    expect(voucherRepo.save).not.toHaveBeenCalled();
    expect(ledgerRepo.recordForVoucher).not.toHaveBeenCalled();
  });

  it('6) PostPI (CONTROLLED service): allows invoice without GRN', async () => {
    const settings = makeSettings('CONTROLLED');
    const vendor = makeVendor();
    const serviceItem = makeItem('svc-1', { trackInventory: false, type: 'SERVICE', cogsAccountId: 'EXP-500' });
    const po = makePO({ id: 'po-6', item: serviceItem, orderedQty: 10, receivedQty: 0, invoicedQty: 0 });
    const pi = makePI({
      id: 'pi-6',
      item: serviceItem,
      purchaseOrderId: po.id,
      poLineId: 'po-line-1',
      invoicedQty: 3,
      unitPriceDoc: 20,
    });

    const inventoryService = makeInventoryService();
    const savedVouchers: any[] = [];
    const voucherRepo = { save: jest.fn(async (voucher: any) => { savedVouchers.push(voucher); return voucher; }) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };
    const invoiceRepoStore = new Map([[pi.id, pi]]);
    const invoiceRepo = {
      getById: jest.fn(async (_companyId: string, id: string) => invoiceRepoStore.get(id) ?? null),
      update: jest.fn(async (entity: PurchaseInvoice) => { invoiceRepoStore.set(entity.id, entity); }),
    };

    const useCase = new PostPurchaseInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      invoiceRepo as any,
      { getById: jest.fn(async () => po), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => null) } as any,
      { getItem: jest.fn(async () => serviceItem) } as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      new SubledgerVoucherPostingService(
        voucherRepo as any,
        ledgerRepo as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, pi.id);
    expect(posted.status).toBe('POSTED');
    expect(inventoryService.processIN).not.toHaveBeenCalled();
    expect(voucherRepo.save).toHaveBeenCalledTimes(1);
    expect(savedVouchers[0].metadata.sourceModule).toBe('purchases');
    expect(savedVouchers[0].metadata.sourceType).toBe('PURCHASE_INVOICE');
  });

  it('7) PostPI (SIMPLE standalone): creates inventory movement + GL voucher', async () => {
    const settings = makeSettings('SIMPLE');
    const vendor = makeVendor();
    const stockItem = makeItem('stock-7', { trackInventory: true, inventoryAssetAccountId: 'INV-700' });
    const pi = makePI({
      id: 'pi-7',
      item: stockItem,
      invoicedQty: 2,
      unitPriceDoc: 15,
      warehouseId: 'wh-1',
    });

    const inventoryService = makeInventoryService();
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };
    const invoiceStore = new Map([[pi.id, pi]]);
    const invoiceRepo = {
      getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
      update: jest.fn(async (entity: PurchaseInvoice) => { invoiceStore.set(entity.id, entity); }),
    };

    const useCase = new PostPurchaseInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      invoiceRepo as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => null) } as any,
      { getItem: jest.fn(async () => stockItem) } as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      new SubledgerVoucherPostingService(
        voucherRepo as any,
        ledgerRepo as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, pi.id);
    expect(posted.status).toBe('POSTED');
    expect(inventoryService.processIN).toHaveBeenCalledTimes(1);
    expect(voucherRepo.save).toHaveBeenCalledTimes(1);
    expect(ledgerRepo.recordForVoucher).toHaveBeenCalledTimes(1);
  });

  it('8) PostPI (SIMPLE PO-linked): blocks if invoicedQty > orderedQty', async () => {
    const settings = makeSettings('SIMPLE', { overInvoiceTolerancePct: 0 });
    const vendor = makeVendor();
    const stockItem = makeItem('stock-8', { trackInventory: true });
    const po = makePO({ id: 'po-8', item: stockItem, orderedQty: 5, receivedQty: 0, invoicedQty: 0 });
    const pi = makePI({
      id: 'pi-8',
      item: stockItem,
      purchaseOrderId: po.id,
      poLineId: 'po-line-1',
      invoicedQty: 6,
      unitPriceDoc: 10,
      warehouseId: 'wh-1',
    });

    const useCase = new PostPurchaseInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      { getById: jest.fn(async () => pi), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => po), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => null) } as any,
      { getItem: jest.fn(async () => stockItem) } as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      makeInventoryService() as any,
      new SubledgerVoucherPostingService(
        { save: jest.fn(async (voucher: any) => voucher), delete: jest.fn(async () => true) } as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    await expect(useCase.execute(COMPANY_ID, pi.id)).rejects.toThrow(/ordered qty/i);
  });

  it('9) PostPI: tax snapshot frozen at posting time', async () => {
    const settings = makeSettings('SIMPLE');
    const vendor = makeVendor();
    const stockItem = makeItem('stock-9', {
      trackInventory: true,
      inventoryAssetAccountId: 'INV-900',
      defaultPurchaseTaxCodeId: 'tax-1',
    });
    const pi = makePI({
      id: 'pi-9',
      item: stockItem,
      invoicedQty: 1,
      unitPriceDoc: 100,
      warehouseId: 'wh-1',
      taxCodeId: 'tax-1',
    });

    const taxStore = new Map<string, TaxCode>([['tax-1', makeTaxCode(0.18)]]);
    const invoiceStore = new Map([[pi.id, pi]]);
    const useCase = new PostPurchaseInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (entity: PurchaseInvoice) => { invoiceStore.set(entity.id, entity); }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async (_companyId: string, id: string) => taxStore.get(id) ?? null) } as any,
      { getItem: jest.fn(async () => stockItem) } as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      makeInventoryService() as any,
      new SubledgerVoucherPostingService(
        { save: jest.fn(async (voucher: any) => voucher), delete: jest.fn(async () => true) } as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, pi.id);
    expect(posted.lines[0].taxRate).toBe(0.18);
    expect(posted.lines[0].taxCode).toBe('VAT18');

    taxStore.set('tax-1', makeTaxCode(0.25));
    const reloaded = invoiceStore.get(pi.id)!;
    expect(reloaded.lines[0].taxRate).toBe(0.18);
    expect(reloaded.lines[0].taxCode).toBe('VAT18');
  });

  it('10) PostPI with foreign currency computes base amounts correctly', async () => {
    const settings = makeSettings('SIMPLE');
    const vendor = makeVendor();
    const stockItem = makeItem('stock-10', {
      trackInventory: true,
      inventoryAssetAccountId: 'INV-1000',
      costCurrency: 'USD',
    });
    const pi = makePI({
      id: 'pi-10',
      item: stockItem,
      currency: 'EUR',
      exchangeRate: 1.5,
      invoicedQty: 2,
      unitPriceDoc: 10,
      warehouseId: 'wh-1',
      taxCodeId: 'tax-1',
    });

    const taxCode = makeTaxCode(0.1);
    const inventoryService = makeInventoryService();
    const savedVouchers: any[] = [];
    const voucherRepo = { save: jest.fn(async (voucher: any) => { savedVouchers.push(voucher); return voucher; }) };
    const invoiceStore = new Map([[pi.id, pi]]);

    const useCase = new PostPurchaseInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (entity: PurchaseInvoice) => { invoiceStore.set(entity.id, entity); }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => taxCode) } as any,
      { getItem: jest.fn(async () => stockItem) } as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      new SubledgerVoucherPostingService(
        voucherRepo as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, pi.id);
    expect(posted.subtotalDoc).toBe(20);
    expect(posted.taxTotalDoc).toBe(2);
    expect(posted.grandTotalDoc).toBe(22);
    expect(posted.subtotalBase).toBe(30);
    expect(posted.taxTotalBase).toBe(3);
    expect(posted.grandTotalBase).toBe(33);
    expect(posted.outstandingAmountBase).toBe(33);

    expect(voucherRepo.save).toHaveBeenCalledTimes(1);
    const voucher = savedVouchers[0];
    expect(voucher.totalDebit).toBe(33);
    expect(voucher.totalCredit).toBe(33);
    expect(voucher.metadata.sourceModule).toBe('purchases');
    expect(voucher.metadata.sourceType).toBe('PURCHASE_INVOICE');
    expect(voucher.metadata.sourceId).toBe(pi.id);
  });
});


