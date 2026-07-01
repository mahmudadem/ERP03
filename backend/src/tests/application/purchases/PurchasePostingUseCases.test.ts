import { describe, expect, it, jest } from '@jest/globals';
import { GoodsReceipt } from '../../../domain/purchases/entities/GoodsReceipt';
import { PurchaseInvoice } from '../../../domain/purchases/entities/PurchaseInvoice';
import { PurchaseOrder } from '../../../domain/purchases/entities/PurchaseOrder';
import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';
import { Item } from '../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import {
  PostGoodsReceiptUseCase,
} from '../../../application/purchases/use-cases/GoodsReceiptUseCases';
import { PostPurchaseInvoiceUseCase, ApprovePurchaseInvoiceUseCase } from '../../../application/purchases/use-cases/PurchaseInvoiceUseCases';
import { SubledgerVoucherPostingService } from '../../../application/accounting/services/SubledgerVoucherPostingService';
import { LegacyAccountingBridgeAdapter } from '../../../application/system-core/adapters/LegacyAccountingBridgeAdapter';

const COMPANY_ID = 'cmp-1';
const USER_ID = 'u-1';

const nowDate = () => new Date('2026-01-01T00:00:00.000Z');
const round2 = (value: number) => Math.round(value * 100) / 100;

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
    defaultGRNIAccountId: 'GRNI-100',
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
  unitCostDoc?: number;
  moveCurrency?: string;
  fxRateMovToBase?: number;
  fxRateCCYToBase?: number;
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
    currency: 'USD',
    exchangeRate: 1,
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
        unitCostDoc: input.unitCostDoc ?? 10,
        unitCostBase: (input.unitCostDoc ?? 10) * (input.fxRateMovToBase ?? 1),
        moveCurrency: input.moveCurrency ?? 'USD',
        fxRateMovToBase: input.fxRateMovToBase ?? 1,
        fxRateCCYToBase: input.fxRateCCYToBase ?? 1,
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
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  charges?: Array<{
    chargeId?: string;
    kind?: 'CHARGE' | 'DISCOUNT';
    name: string;
    amountDoc: number;
    accountId?: string;
  }>;
}): PurchaseInvoice =>
  new PurchaseInvoice({
    id: input.id,
    companyId: COMPANY_ID,
    invoiceNumber: `PI-${input.id}`,
    formType: 'purchase_invoice_direct',
    voucherType: 'purchase_invoice',
    persona: 'direct',
    purchaseOrderId: input.purchaseOrderId,
    vendorId: 'ven-1',
    vendorName: 'Vendor One',
    invoiceDate: '2026-01-12',
    dueDate: '2026-02-11',
    currency: (input.currency ?? 'USD').toUpperCase(),
    exchangeRate: input.exchangeRate ?? 1,
    charges: (input.charges || []).map((c, i) => ({
      chargeId: c.chargeId || `pi-chg-${i + 1}`,
      kind: c.kind,
      name: c.name,
      amountDoc: c.amountDoc,
      accountId: c.accountId,
    })),
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
        discountType: input.discountType,
        discountValue: input.discountValue,
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

const makeStockLevel = (unitCostBase = 10, qtyOnHand = 100) =>
  new StockLevel({
    id: 'sl-1',
    companyId: COMPANY_ID,
    itemId: 'stock-1',
    warehouseId: 'wh-1',
    qtyOnHand,
    reservedQty: 0,
    avgCostBase: unitCostBase,
    avgCostCCY: unitCostBase,
    lastCostBase: unitCostBase,
    lastCostCCY: unitCostBase,
    postingSeq: 1,
    maxBusinessDate: '2026-01-01',
    totalMovements: 1,
    lastMovementId: '',
    version: 1,
    updatedAt: new Date(),
  });

const makeInventoryService = () => {
  let seq = 1;
  return {
    processIN: jest.fn(async () => ({ id: `mov-${seq++}` })),
    processOUT: jest.fn(async () => ({ id: `mov-out-${seq++}` })),
    preFetchStockLevel: jest.fn(async () => makeStockLevel()),
    preFetchLevelsByItem: jest.fn(async () => [makeStockLevel()]),
    writeStockMovement: jest.fn(async () => {}),
    writeStockLevel: jest.fn(async () => {}),
    deleteMovement: jest.fn(async () => {}),
  };
};

const makeItemRepo = (item: Item) => ({
  getItem: jest.fn(async () => item),
  updateItemInTransaction: jest.fn(async () => undefined),
});

const makeInventorySettingsRepository = (
  mode: 'PERIODIC' | 'INVOICE_DRIVEN' | 'PERPETUAL' = 'PERPETUAL',
  overrides: Record<string, any> = {}
) => ({
  getSettings: jest.fn(async () => ({
    accountingMode: mode,
    inventoryAccountingMethod: mode === 'PERPETUAL' ? 'PERPETUAL' : 'PERIODIC',
    defaultInventoryAssetAccountId: 'INV-100',
    defaultCOGSAccountId: 'COGS-100',
    ...overrides,
  })),
});

const makeCompanyModuleRepo = (initialized = true) => ({
  get: jest.fn(async () => ({
    companyId: COMPANY_ID,
    moduleKey: 'accounting',
    initialized,
  })),
});

const makeAccountingPostingService = (voucherRepo?: any, ledgerRepo?: any) =>
  new SubledgerVoucherPostingService(
    (voucherRepo || {
      save: jest.fn(async (voucher: any) => voucher),
      delete: jest.fn(async () => true),
    }) as any,
    (ledgerRepo || {
      recordForVoucher: jest.fn(async () => undefined),
      deleteForVoucher: jest.fn(async () => undefined),
    }) as any,
    { getBaseCurrency: jest.fn(async () => 'USD') } as any
  );

const makeAccountingBridge = (voucherRepo?: any, ledgerRepo?: any, initialized = true) =>
  new LegacyAccountingBridgeAdapter(
    makeAccountingPostingService(voucherRepo, ledgerRepo),
    makeCompanyModuleRepo(initialized) as any
  );

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
    const itemRepo = makeItemRepo(item);
    const warehouseRepo = { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) };
    const uomConversionRepo = { getConversionsForItem: jest.fn(async () => []) };
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher), delete: jest.fn(async () => true) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) };

    const useCase = new PostGoodsReceiptUseCase(
      settingsRepo as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      goodsReceiptRepo as any,
      purchaseOrderRepo as any,
      itemRepo as any,
      warehouseRepo as any,
      uomConversionRepo as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      transactionManager as any,
      makeAccountingBridge(voucherRepo, ledgerRepo)
    );

    await useCase.execute(COMPANY_ID, grn.id);

    expect(inventoryService.writeStockMovement).toHaveBeenCalledTimes(1);
    const movement = (inventoryService.writeStockMovement as any).mock.calls[0][0];
    expect(movement.movementType).toBe('PURCHASE_RECEIPT');
    expect(movement.referenceType).toBe('GOODS_RECEIPT');
    expect(movement.referenceId).toBe(grn.id);
  });

  it('1a) PostGRN keeps item average cost in item cost currency when receipt is in base currency', async () => {
    const settings = makeSettings('CONTROLLED');
    const item = makeItem('stock-1a', {
      trackInventory: true,
      inventoryAssetAccountId: 'INV-1A',
      costCurrency: 'USD',
    });
    const po = makePO({ id: 'po-1a', item, orderedQty: 10, receivedQty: 0 });
    const grn = makeGRN({
      id: 'grn-1a',
      purchaseOrderId: po.id,
      item,
      receivedQty: 2,
      unitCostDoc: 100,
      moveCurrency: 'SYP',
      fxRateMovToBase: 1,
      fxRateCCYToBase: 10,
    });

    const transactionManager = makeTransactionManager();
    const inventoryService = makeInventoryService();
    inventoryService.preFetchStockLevel.mockResolvedValue(
      StockLevel.createNew(COMPANY_ID, item.id, 'wh-1')
    );
    inventoryService.preFetchLevelsByItem.mockResolvedValue([
      StockLevel.createNew(COMPANY_ID, item.id, 'wh-1'),
    ]);
    const goodsReceiptRepo = {
      getById: jest.fn(async () => grn),
      update: jest.fn(async () => undefined),
    };
    const purchaseOrderRepo = {
      getById: jest.fn(async () => po),
      update: jest.fn(async () => undefined),
    };
    const itemRepo = makeItemRepo(item);

    const useCase = new PostGoodsReceiptUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      goodsReceiptRepo as any,
      purchaseOrderRepo as any,
      itemRepo as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'SYP') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      transactionManager as any,
      makeAccountingBridge(
        { save: jest.fn(async (voucher: any) => voucher), delete: jest.fn(async () => true) },
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) }
      )
    );

    await useCase.execute(COMPANY_ID, grn.id);

    const movement = (inventoryService.writeStockMovement as any).mock.calls[0][0];
    expect(movement.unitCostBase).toBeCloseTo(100, 2);
    expect(movement.unitCostCCY).toBeCloseTo(10, 2);
    expect(movement.movementCurrency).toBe('SYP');
    expect(movement.fxRateMovToBase).toBe(1);
    expect(movement.fxRateCCYToBase).toBe(10);

    const writtenLevel = (inventoryService.writeStockLevel as any).mock.calls[0][0] as StockLevel;
    expect(writtenLevel.avgCostBase).toBeCloseTo(100, 2);
    expect(writtenLevel.avgCostCCY).toBeCloseTo(10, 2);

    const itemUpdate = (itemRepo.updateItemInTransaction as any).mock.calls[0][2];
    expect(itemUpdate.costingStats.avgCost.base).toBeCloseTo(100, 2);
    expect(itemUpdate.costingStats.avgCost.ccy).toBeCloseTo(10, 2);
    expect(itemUpdate.costingStats.avgCost.currency).toBe('USD');
    expect(itemUpdate.costingStats.avgCost.fxRateToBase).toBeCloseTo(10, 6);
    expect(itemUpdate.costingStats.lastPurchaseCost.base).toBeCloseTo(100, 2);
    expect(itemUpdate.costingStats.lastPurchaseCost.ccy).toBeCloseTo(100, 2);
    expect(itemUpdate.costingStats.lastPurchaseCost.currency).toBe('SYP');
    expect(itemUpdate.costingStats.lastPurchaseCost.fxRateToBase).toBeCloseTo(1, 6);
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
    const itemRepo = makeItemRepo(item);
    const warehouseRepo = { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) };
    const uomConversionRepo = { getConversionsForItem: jest.fn(async () => []) };
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher), delete: jest.fn(async () => true) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) };

    const useCase = new PostGoodsReceiptUseCase(
      settingsRepo as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      goodsReceiptRepo as any,
      purchaseOrderRepo as any,
      itemRepo as any,
      warehouseRepo as any,
      uomConversionRepo as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      transactionManager as any,
      makeAccountingBridge(voucherRepo, ledgerRepo)
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
    const itemRepo = makeItemRepo(item);
    const warehouseRepo = { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) };
    const uomConversionRepo = { getConversionsForItem: jest.fn(async () => []) };
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher), delete: jest.fn(async () => true) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) };

    const useCase = new PostGoodsReceiptUseCase(
      settingsRepo as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      goodsReceiptRepo as any,
      purchaseOrderRepo as any,
      itemRepo as any,
      warehouseRepo as any,
      uomConversionRepo as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      transactionManager as any,
      makeAccountingBridge(voucherRepo, ledgerRepo)
    );

    await useCase.execute(COMPANY_ID, grn.id);
    expect(po.status).toBe('PARTIALLY_RECEIVED');
  });

  it('4) PostGRN in PERPETUAL mode creates inventory/GRNI voucher', async () => {
    const settings = makeSettings('CONTROLLED');
    const item = makeItem('stock-4', { trackInventory: true });
    const po = makePO({ id: 'po-4', item, orderedQty: 10, receivedQty: 0 });
    const grn = makeGRN({ id: 'grn-4', purchaseOrderId: po.id, item, receivedQty: 2 });

    const transactionManager = makeTransactionManager();
    const inventoryService = makeInventoryService();
    const settingsRepo = { getSettings: jest.fn(async () => settings) };
    const goodsReceiptRepo = { getById: jest.fn(async () => grn), update: jest.fn(async () => undefined) };
    const purchaseOrderRepo = { getById: jest.fn(async () => po), update: jest.fn(async () => undefined) };
    const itemRepo = makeItemRepo(item);
    const warehouseRepo = { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) };
    const uomConversionRepo = { getConversionsForItem: jest.fn(async () => []) };
    const voucherRepo = { save: jest.fn(async (voucher: any) => ({ ...voucher, id: 'v-grn-1' })), delete: jest.fn(async () => true) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) };

    const useCase = new PostGoodsReceiptUseCase(
      settingsRepo as any,
      makeInventorySettingsRepository('PERPETUAL') as any,
      goodsReceiptRepo as any,
      purchaseOrderRepo as any,
      itemRepo as any,
      warehouseRepo as any,
      uomConversionRepo as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      transactionManager as any,
      makeAccountingBridge(voucherRepo, ledgerRepo)
    );

    const posted = await useCase.execute(COMPANY_ID, grn.id);
    expect(voucherRepo.save).toHaveBeenCalledTimes(1);
    expect(ledgerRepo.recordForVoucher).toHaveBeenCalledTimes(1);
    const savedVoucher = (voucherRepo.save as any).mock.calls[0][0];
    expect(posted.voucherId).toBe(savedVoucher.id);
    const hasInventoryDebit = savedVoucher.lines.some((line: any) => line.accountId === 'INV-100' && line.side === 'Debit');
    const hasGRNICredit = savedVoucher.lines.some((line: any) => line.accountId === 'GRNI-100' && line.side === 'Credit');
    expect(hasInventoryDebit).toBe(true);
    expect(hasGRNICredit).toBe(true);
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
      makeInventorySettingsRepository('INVOICE_DRIVEN') as any,
      { getById: jest.fn(async () => pi), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => po), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
        voucherRepo as any,
        ledgerRepo as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
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
      makeItemRepo(serviceItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
        voucherRepo as any,
        ledgerRepo as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
    );

    const posted = await useCase.execute(COMPANY_ID, pi.id);
    expect(posted.status).toBe('POSTED');
    expect(inventoryService.writeStockMovement).not.toHaveBeenCalled();
    expect(voucherRepo.save).toHaveBeenCalledTimes(1);
    expect(savedVouchers[0].metadata.sourceModule).toBe('purchases');
    expect(savedVouchers[0].metadata.sourceType).toBe('PURCHASE_INVOICE');

    // Characterization (Task 178 — PI posts through SubledgerDocumentPoster):
    // per-line expense/inventory debit(s) + a SINGLE AP credit, balanced. The
    // single-credit property is the key granularity guarantee for PI.
    const piVoucher = savedVouchers[0];
    const piCredits = piVoucher.lines.filter((l: any) => l.side === 'Credit');
    expect(piCredits).toHaveLength(1);
    expect(piVoucher.lines.some((l: any) => l.accountId === 'EXP-500' && l.side === 'Debit')).toBe(true);
    expect(piVoucher.totalDebit).toBeCloseTo(piVoucher.totalCredit, 2);
    expect(piCredits[0].creditAmount).toBeCloseTo(piVoucher.totalCredit, 2);
  });

  it('6b) PostPI applies whole-invoice CHARGE (debit) + DISCOUNT (credit): adjusts the bill and stays balanced', async () => {
    const settings = makeSettings('CONTROLLED');
    const vendor = makeVendor();
    const serviceItem = makeItem('svc-6b', { trackInventory: false, type: 'SERVICE', cogsAccountId: 'EXP-500' });
    const po = makePO({ id: 'po-6b', item: serviceItem, orderedQty: 10, receivedQty: 0, invoicedQty: 0 });
    const pi = makePI({
      id: 'pi-6b',
      item: serviceItem,
      purchaseOrderId: po.id,
      poLineId: 'po-line-1',
      invoicedQty: 3,
      unitPriceDoc: 20, // line = 60, no tax
      charges: [
        { chargeId: 'chg-frt', kind: 'CHARGE', name: 'Freight', amountDoc: 10, accountId: 'EXP-FREIGHT' },
        { chargeId: 'chg-disc', kind: 'DISCOUNT', name: 'Volume discount', amountDoc: 5, accountId: 'INC-DISC' },
      ],
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
      makeItemRepo(serviceItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
        voucherRepo as any,
        ledgerRepo as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
    );

    const posted = await useCase.execute(COMPANY_ID, pi.id);
    // 60 line + 10 charge − 5 discount = 65; no tax.
    expect(posted.subtotalDoc).toBe(65);
    expect(posted.taxTotalDoc).toBe(0);
    expect(posted.grandTotalDoc).toBe(65);

    const piVoucher = savedVouchers[0];
    const debits = piVoucher.lines.filter((l: any) => l.side === 'Debit');
    const credits = piVoucher.lines.filter((l: any) => l.side === 'Credit');
    // Line expense debit 60, freight charge debit 10; discount credit 5; AP credit 65.
    expect(debits.some((l: any) => l.accountId === 'EXP-500' && l.debitAmount === 60)).toBe(true);
    expect(debits.some((l: any) => l.accountId === 'EXP-FREIGHT' && l.debitAmount === 10)).toBe(true);
    expect(credits.some((l: any) => l.accountId === 'INC-DISC' && l.creditAmount === 5)).toBe(true);
    expect(credits.some((l: any) => l.creditAmount === 65)).toBe(true); // AP
    // Balanced: debits 60+10 = 70; credits 5 + 65 = 70.
    expect(piVoucher.totalDebit).toBeCloseTo(70, 2);
    expect(piVoucher.totalCredit).toBeCloseTo(70, 2);
  });

  it('6c) PostPI applies the LINE discount to the GL: inventory debit + AP credit are NET of the discount (regression for GP04 line-discount drop)', async () => {
    const settings = makeSettings('CONTROLLED');
    const vendor = makeVendor();
    // Stock item so the debit goes to the inventory asset account.
    const stockItem = makeItem('itm-6c', { trackInventory: true, inventoryAssetAccountId: 'INV-103' });
    const po = makePO({ id: 'po-6c', item: stockItem, orderedQty: 50, receivedQty: 50, invoicedQty: 0 });
    const pi = makePI({
      id: 'pi-6c',
      item: stockItem,
      purchaseOrderId: po.id,
      poLineId: 'po-line-1',
      grnLineId: 'grn-line-1',
      invoicedQty: 50,
      unitPriceDoc: 10,      // gross line = 500
      discountType: 'PERCENT',
      discountValue: 5,       // 5% → discount 25 → net 475
      warehouseId: 'wh-1',
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
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
        voucherRepo as any,
        ledgerRepo as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
    );

    const posted = await useCase.execute(COMPANY_ID, pi.id);
    // Net line = 500 − 5% = 475; no charges, no tax.
    expect(posted.subtotalDoc).toBe(475);
    expect(posted.grandTotalDoc).toBe(475);

    const piVoucher = savedVouchers[0];
    const debits = piVoucher.lines.filter((l: any) => l.side === 'Debit');
    const credits = piVoucher.lines.filter((l: any) => l.side === 'Credit');
    // Receipt-backed perpetual PI clears GRNI at NET 475 and must not post a second stock receipt.
    expect(inventoryService.writeStockMovement).not.toHaveBeenCalled();
    expect(debits.some((l: any) => l.accountId === 'GRNI-100' && l.debitAmount === 475)).toBe(true);
    expect(debits.some((l: any) => l.debitAmount === 475)).toBe(true);
    expect(debits.some((l: any) => l.debitAmount === 500)).toBe(false);
    expect(credits.some((l: any) => l.creditAmount === 475)).toBe(true);
    expect(piVoucher.totalDebit).toBeCloseTo(475, 2);
    expect(piVoucher.totalCredit).toBeCloseTo(475, 2);
  });

  it('6d) PostPI uses the discounted net cost for invoice-driven stock receipt and keeps stock value tied to the GL debit (backlog-223)', async () => {
    const settings = makeSettings('SIMPLE');
    const vendor = makeVendor();
    const stockItem = makeItem('itm-6d', { trackInventory: true, inventoryAssetAccountId: 'INV-106D' });
    const pi = makePI({
      id: 'pi-6d',
      item: stockItem,
      invoicedQty: 50,
      unitPriceDoc: 10,      // gross line = 500
      discountType: 'PERCENT',
      discountValue: 5,      // 5% -> discount 25 -> net 475 -> 9.5/unit
      warehouseId: 'wh-1',
    });

    const inventoryService = makeInventoryService();
    inventoryService.preFetchStockLevel.mockResolvedValue(
      StockLevel.createNew(COMPANY_ID, stockItem.id, 'wh-1')
    );
    inventoryService.preFetchLevelsByItem.mockResolvedValue([
      StockLevel.createNew(COMPANY_ID, stockItem.id, 'wh-1'),
    ]);

    const savedVouchers: any[] = [];
    const voucherRepo = { save: jest.fn(async (voucher: any) => { savedVouchers.push(voucher); return voucher; }) };
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
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
        voucherRepo as any,
        ledgerRepo as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
    );

    const posted = await useCase.execute(COMPANY_ID, pi.id);
    expect(posted.status).toBe('POSTED');
    expect(posted.subtotalBase).toBe(475);
    expect(posted.grandTotalBase).toBe(475);

    expect(inventoryService.writeStockMovement).toHaveBeenCalledTimes(1);
    expect(inventoryService.writeStockLevel).toHaveBeenCalledTimes(1);

    const movement = (inventoryService.writeStockMovement as any).mock.calls[0][0];
    expect(movement.unitCostBase).toBeCloseTo(9.5, 2);
    expect(movement.totalCostBase).toBeCloseTo(475, 2);
    expect(movement.unitCostCCY).toBeCloseTo(9.5, 2);
    expect(movement.totalCostCCY).toBeCloseTo(475, 2);
    expect(movement.avgCostBaseAfter).toBeCloseTo(9.5, 2);

    const level = (inventoryService.writeStockLevel as any).mock.calls[0][0];
    expect(level.qtyOnHand).toBeCloseTo(50, 2);
    expect(level.avgCostBase).toBeCloseTo(9.5, 2);
    expect(level.lastCostBase).toBeCloseTo(9.5, 2);
    expect(round2(level.avgCostBase * level.qtyOnHand)).toBeCloseTo(475, 2);

    const piVoucher = savedVouchers[0];
    const inventoryDebit = piVoucher.lines.find((l: any) => l.accountId === 'INV-106D' && l.side === 'Debit');
    expect(inventoryDebit).toBeTruthy();
    expect(inventoryDebit.debitAmount).toBeCloseTo(475, 2);
    expect(round2(level.avgCostBase * level.qtyOnHand)).toBeCloseTo(inventoryDebit.debitAmount, 2);
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
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
        voucherRepo as any,
        ledgerRepo as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
    );

    const posted = await useCase.execute(COMPANY_ID, pi.id);
    expect(posted.status).toBe('POSTED');
    expect(inventoryService.writeStockMovement).toHaveBeenCalledTimes(1);
    expect(voucherRepo.save).toHaveBeenCalledTimes(1);
    expect(ledgerRepo.recordForVoucher).toHaveBeenCalledTimes(1);
  });

  it('7b) PostPI does NOT re-receive stock when the PO line was already received by a GRN in periodic mode', async () => {
    // Periodic tenant, direct invoicing ON. The PI is built from the PO
    // (poLineId only — no grnLineId), but the PO line has already been received by a GRN
    // (receivedQty 50). The PI must post the purchase expense (Dr Purchases / Cr AP) WITHOUT posting a
    // second PURCHASE_RECEIPT — otherwise the quantity is double-counted (the live bug: 103 vs 53).
    const settings = makeSettings('SIMPLE'); // allowDirectInvoicing = true
    const vendor = makeVendor();
    const stockItem = makeItem('itm-7b', { trackInventory: true, inventoryAssetAccountId: 'INV-7B' });
    const po = makePO({ id: 'po-7b', item: stockItem, orderedQty: 50, receivedQty: 50, invoicedQty: 0 });
    const pi = makePI({
      id: 'pi-7b',
      item: stockItem,
      purchaseOrderId: po.id,
      poLineId: 'po-line-1',
      // grnLineId intentionally omitted — this is the create-PI-from-PO gap.
      invoicedQty: 50,
      unitPriceDoc: 10, // 500, no discount/tax
      warehouseId: 'wh-1',
    });

    const inventoryService = makeInventoryService();
    const savedVouchers: any[] = [];
    const voucherRepo = { save: jest.fn(async (voucher: any) => { savedVouchers.push(voucher); return voucher; }) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };
    const invoiceStore = new Map([[pi.id, pi]]);
    const invoiceRepo = {
      getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
      update: jest.fn(async (entity: PurchaseInvoice) => { invoiceStore.set(entity.id, entity); }),
    };

    const useCase = new PostPurchaseInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      invoiceRepo as any,
      { getById: jest.fn(async () => po), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
        voucherRepo as any,
        ledgerRepo as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
    );

    const posted = await useCase.execute(COMPANY_ID, pi.id);
    expect(posted.status).toBe('POSTED');

    // THE FIX: no second stock receipt for goods the GRN already received.
    expect(inventoryService.writeStockMovement).not.toHaveBeenCalled();

    // GL stays periodic: Dr Purchases 500 / Cr AP 500. No inventory/GRNI line is allowed.
    const piVoucher = savedVouchers[0];
    const debits = piVoucher.lines.filter((l: any) => l.side === 'Debit');
    const credits = piVoucher.lines.filter((l: any) => l.side === 'Credit');
    expect(debits.some((l: any) => l.accountId === 'EXP-100' && l.debitAmount === 500)).toBe(true);
    expect(debits.some((l: any) => l.accountId === 'INV-7B')).toBe(false);
    expect(debits.some((l: any) => l.accountId === 'GRNI-100')).toBe(false);
    expect(credits.some((l: any) => l.creditAmount === 500)).toBe(true); // AP
    expect(piVoucher.totalDebit).toBeCloseTo(500, 2);
    expect(piVoucher.totalCredit).toBeCloseTo(500, 2);
  });

  it('7c) PostPI in PERIODIC mode posts Dr Purchases / Cr AP, moves quantity when there is no GRN, and creates no inventory/GRNI lines', async () => {
    const settings = makeSettings('SIMPLE', {
      defaultPurchaseExpenseAccountId: 'PUR-500',
      defaultPurchaseDiscountAccountId: 'PUR-DISC-500',
    });
    const vendor = makeVendor();
    const stockItem = makeItem('stock-7c', { trackInventory: true, inventoryAssetAccountId: 'INV-7C' });
    const pi = makePI({
      id: 'pi-7c',
      item: stockItem,
      invoicedQty: 4,
      unitPriceDoc: 25,
      warehouseId: 'wh-1',
    });

    const inventoryService = makeInventoryService();
    inventoryService.preFetchStockLevel.mockResolvedValue(
      StockLevel.createNew(COMPANY_ID, stockItem.id, 'wh-1')
    );
    inventoryService.preFetchLevelsByItem.mockResolvedValue([
      StockLevel.createNew(COMPANY_ID, stockItem.id, 'wh-1'),
    ]);

    const savedVouchers: any[] = [];
    const invoiceStore = new Map([[pi.id, pi]]);
    const useCase = new PostPurchaseInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (entity: PurchaseInvoice) => { invoiceStore.set(entity.id, entity); }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
        { save: jest.fn(async (voucher: any) => { savedVouchers.push(voucher); return voucher; }) } as any,
        { recordForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
    );

    const posted = await useCase.execute(COMPANY_ID, pi.id);
    expect(posted.status).toBe('POSTED');
    expect(inventoryService.writeStockMovement).toHaveBeenCalledTimes(1);

    const movement = (inventoryService.writeStockMovement as any).mock.calls[0][0];
    expect(movement.movementType).toBe('PURCHASE_RECEIPT');
    expect(movement.totalCostBase).toBe(100);

    const voucher = savedVouchers[0];
    const debitLines = voucher.lines.filter((line: any) => line.side === 'Debit');
    const creditLines = voucher.lines.filter((line: any) => line.side === 'Credit');
    expect(debitLines.some((line: any) => line.accountId === 'PUR-500' && line.debitAmount === 100)).toBe(true);
    expect(debitLines.some((line: any) => line.accountId === 'INV-7C')).toBe(false);
    expect(debitLines.some((line: any) => line.accountId === 'GRNI-100')).toBe(false);
    expect(creditLines.some((line: any) => line.accountId === 'AP-200' && line.creditAmount === 100)).toBe(true);
    expect(voucher.totalDebit).toBeCloseTo(100, 2);
    expect(voucher.totalCredit).toBeCloseTo(100, 2);
  });

  it('A1) PostPI parks as PENDING_APPROVAL when central approval policy rejects unapproved post (no financial effect)', async () => {
    const settings = makeSettings('SIMPLE');
    const vendor = makeVendor();
    const stockItem = makeItem('stock-appr', { trackInventory: true, inventoryAssetAccountId: 'INV-700' });
    const pi = makePI({ id: 'pi-appr', item: stockItem, invoicedQty: 2, unitPriceDoc: 15, warehouseId: 'wh-1' });

    const inventoryService = makeInventoryService();
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };
    const invoiceStore = new Map([[pi.id, pi]]);
    const invoiceRepo = {
      getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
      update: jest.fn(async (entity: PurchaseInvoice) => { invoiceStore.set(entity.id, entity); }),
    };

    const approvalPolicy = {
      id: 'approval-required',
      name: 'Approval Required',
      validate: jest.fn(async (ctx: any) =>
        ctx.isApproved
          ? { ok: true }
          : { ok: false, error: { code: 'APPROVAL_REQUIRED', message: 'Voucher must be approved before posting', fieldHints: ['status'] } }
      ),
    };

    const mockPolicyRegistry = {
      getConfig: jest.fn(async () => ({ policyErrorMode: 'FAIL_FAST' })),
      getEnabledPolicies: jest.fn(async () => [approvalPolicy]),
    };

    const mockTxManager = {
      runTransaction: jest.fn(async (operation: (transaction: any) => Promise<any>) => {
        try {
          return await operation({ id: 'txn-1' });
        } catch (err) {
          inventoryService.writeStockMovement.mockClear();
          voucherRepo.save.mockClear();
          ledgerRepo.recordForVoucher.mockClear();
          throw err;
        }
      }),
    };

    const useCase = new PostPurchaseInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      invoiceRepo as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      mockTxManager as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
          voucherRepo as any,
          ledgerRepo as any,
          { getBaseCurrency: jest.fn(async () => 'USD') } as any,
          undefined,
          undefined,
          undefined,
          mockPolicyRegistry as any
        ),
        makeCompanyModuleRepo() as any
      )
    );

    const result = await useCase.execute(COMPANY_ID, pi.id);
    expect(result.status).toBe('PENDING_APPROVAL');
    expect(inventoryService.writeStockMovement).not.toHaveBeenCalled();
    expect(voucherRepo.save).not.toHaveBeenCalled();
    expect(ledgerRepo.recordForVoucher).not.toHaveBeenCalled();
  });

  it('A2) ApprovePurchaseInvoiceUseCase runs the real post on a PENDING_APPROVAL invoice', async () => {
    const settings = makeSettings('SIMPLE');
    const vendor = makeVendor();
    const stockItem = makeItem('stock-appr2', { trackInventory: true, inventoryAssetAccountId: 'INV-700' });
    const pi = makePI({ id: 'pi-appr2', item: stockItem, invoicedQty: 2, unitPriceDoc: 15, warehouseId: 'wh-1' });
    pi.status = 'PENDING_APPROVAL';

    const inventoryService = makeInventoryService();
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };
    const invoiceStore = new Map([[pi.id, pi]]);
    const invoiceRepo = {
      getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
      update: jest.fn(async (entity: PurchaseInvoice) => { invoiceStore.set(entity.id, entity); }),
    };

    const approvalPolicy = {
      id: 'approval-required',
      name: 'Approval Required',
      validate: jest.fn(async (ctx: any) =>
        ctx.isApproved
          ? { ok: true }
          : { ok: false, error: { code: 'APPROVAL_REQUIRED', message: 'Voucher must be approved before posting', fieldHints: ['status'] } }
      ),
    };

    const mockPolicyRegistry = {
      getConfig: jest.fn(async () => ({ policyErrorMode: 'FAIL_FAST' })),
      getEnabledPolicies: jest.fn(async () => [approvalPolicy]),
    };

    const postUseCase = new PostPurchaseInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      invoiceRepo as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
          voucherRepo as any,
          ledgerRepo as any,
          { getBaseCurrency: jest.fn(async () => 'USD') } as any,
          undefined,
          undefined,
          undefined,
          mockPolicyRegistry as any
        ),
        makeCompanyModuleRepo() as any
      )
    );

    const approveUseCase = new ApprovePurchaseInvoiceUseCase(invoiceRepo as any, postUseCase);
    const posted = await approveUseCase.execute(COMPANY_ID, pi.id, { userId: 'u-1' });

    expect(posted.status).toBe('POSTED');
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
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
        { save: jest.fn(async (voucher: any) => voucher), delete: jest.fn(async () => true) } as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
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
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
        { save: jest.fn(async (voucher: any) => voucher), delete: jest.fn(async () => true) } as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
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
      costCurrency: 'EUR',
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
    inventoryService.preFetchStockLevel.mockResolvedValue(
      StockLevel.createNew(COMPANY_ID, stockItem.id, 'wh-1')
    );
    inventoryService.preFetchLevelsByItem.mockResolvedValue([
      StockLevel.createNew(COMPANY_ID, stockItem.id, 'wh-1'),
    ]);
    const savedVouchers: any[] = [];
    const voucherRepo = { save: jest.fn(async (voucher: any) => { savedVouchers.push(voucher); return voucher; }) };
    const invoiceStore = new Map([[pi.id, pi]]);
    const itemRepo = makeItemRepo(stockItem);

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
      itemRepo as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
        voucherRepo as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
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

    expect(itemRepo.updateItemInTransaction).toHaveBeenCalledTimes(1);
    const itemUpdate = (itemRepo.updateItemInTransaction as any).mock.calls[0][2];
    expect(itemUpdate.costingStats.avgCost.base).toBeCloseTo(15, 2);
    expect(itemUpdate.costingStats.avgCost.ccy).toBeCloseTo(10, 2);
    expect(itemUpdate.costingStats.avgCost.currency).toBe('EUR');
    expect(itemUpdate.costingStats.avgCost.fxRateToBase).toBeCloseTo(1.5, 6);
    expect(itemUpdate.costingStats.avgCost.asOf).toBe('2026-01-12');
    expect(itemUpdate.costingStats.lastPurchaseCost.base).toBeCloseTo(15, 2);
    expect(itemUpdate.costingStats.lastPurchaseCost.ccy).toBeCloseTo(10, 2);
    expect(itemUpdate.costingStats.lastPurchaseCost.currency).toBe('EUR');
    expect(itemUpdate.costingStats.lastPurchaseCost.fxRateToBase).toBeCloseTo(1.5, 6);
    expect(itemUpdate.costingStats.lastPurchaseCost.asOf).toBe('2026-01-12');
    expect(itemUpdate.costingStats.lastPurchaseCost.uomId).toBe('EA');
    expect(itemUpdate.costingStats.lastPurchaseCostByCcyUom.EUR__EA.ccy).toBeCloseTo(10, 2);
    expect(itemUpdate.costingStats.lastPurchaseCostByCcyUom.EUR__EA.uomId).toBe('EA');
  });

  it('10b) PostPI keeps item average cost in item cost currency when invoice is in base currency', async () => {
    const settings = makeSettings('SIMPLE');
    const vendor = makeVendor();
    const stockItem = makeItem('stock-10b', {
      trackInventory: true,
      inventoryAssetAccountId: 'INV-10B',
      costCurrency: 'USD',
    });
    const pi = makePI({
      id: 'pi-10b',
      item: stockItem,
      currency: 'SYP',
      exchangeRate: 1,
      invoicedQty: 2,
      unitPriceDoc: 100,
      warehouseId: 'wh-1',
    });

    const inventoryService = makeInventoryService();
    inventoryService.preFetchStockLevel.mockResolvedValue(
      StockLevel.createNew(COMPANY_ID, stockItem.id, 'wh-1')
    );
    inventoryService.preFetchLevelsByItem.mockResolvedValue([
      StockLevel.createNew(COMPANY_ID, stockItem.id, 'wh-1'),
    ]);
    const invoiceStore = new Map([[pi.id, pi]]);
    const itemRepo = makeItemRepo(stockItem);
    const exchangeRateRepo = {
      getMostRecentRateBeforeDate: jest.fn(async () => ({ rate: 10 })),
    };
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher), delete: jest.fn(async () => true) };

    const useCase = new PostPurchaseInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (entity: PurchaseInvoice) => { invoiceStore.set(entity.id, entity); }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => null) } as any,
      itemRepo as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'SYP') } as any,
      exchangeRateRepo as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
        voucherRepo as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'SYP') } as any
        ),
        makeCompanyModuleRepo() as any
      )
    );

    const posted = await useCase.execute(COMPANY_ID, pi.id);
    expect(posted.subtotalDoc).toBe(200);
    expect(posted.subtotalBase).toBe(200);

    expect(exchangeRateRepo.getMostRecentRateBeforeDate as jest.Mock).toHaveBeenCalledWith(
      COMPANY_ID,
      'USD',
      'SYP',
      expect.any(Date)
    );
    const writtenLevel = (inventoryService.writeStockLevel as any).mock.calls[0][0] as StockLevel;
    expect(writtenLevel.avgCostBase).toBeCloseTo(100, 2);
    expect(writtenLevel.avgCostCCY).toBeCloseTo(10, 2);
    expect(writtenLevel.lastCostBase).toBeCloseTo(100, 2);
    expect(writtenLevel.lastCostCCY).toBeCloseTo(10, 2);

    expect(itemRepo.updateItemInTransaction).toHaveBeenCalledTimes(1);
    const itemUpdate = (itemRepo.updateItemInTransaction as any).mock.calls[0][2];
    expect(itemUpdate.costingStats.avgCost.base).toBeCloseTo(100, 2);
    expect(itemUpdate.costingStats.avgCost.ccy).toBeCloseTo(10, 2);
    expect(itemUpdate.costingStats.avgCost.currency).toBe('USD');
    expect(itemUpdate.costingStats.avgCost.fxRateToBase).toBeCloseTo(10, 6);
    expect(itemUpdate.costingStats.lastPurchaseCost.base).toBeCloseTo(100, 2);
    expect(itemUpdate.costingStats.lastPurchaseCost.ccy).toBeCloseTo(100, 2);
    expect(itemUpdate.costingStats.lastPurchaseCost.currency).toBe('SYP');
    expect(itemUpdate.costingStats.lastPurchaseCost.fxRateToBase).toBeCloseTo(1, 6);
    expect(itemUpdate.costingStats.lastPurchaseCost.uomId).toBe('EA');
    expect(itemUpdate.costingStats.lastPurchaseCostByCcyUom.SYP__EA.ccy).toBeCloseTo(100, 2);
    expect(itemUpdate.costingStats.lastPurchaseCostByCcyUom.SYP__EA.uomId).toBe('EA');
  });

  it('10a) PostPI re-post attempt does not double-apply inventory or item costing stats', async () => {
    const settings = makeSettings('SIMPLE');
    const vendor = makeVendor();
    const stockItem = makeItem('stock-10a', {
      trackInventory: true,
      inventoryAssetAccountId: 'INV-10A',
    });
    const pi = makePI({
      id: 'pi-10a',
      item: stockItem,
      invoicedQty: 2,
      unitPriceDoc: 10,
      warehouseId: 'wh-1',
    });

    const inventoryService = makeInventoryService();
    const itemRepo = makeItemRepo(stockItem);
    const invoiceStore = new Map([[pi.id, pi]]);
    const invoiceRepo = {
      getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
      update: jest.fn(async (entity: PurchaseInvoice) => { invoiceStore.set(entity.id, entity); }),
    };
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher), delete: jest.fn(async () => true) };

    const useCase = new PostPurchaseInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      invoiceRepo as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => null) } as any,
      itemRepo as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
        voucherRepo as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
    );

    const first = await useCase.execute(COMPANY_ID, pi.id);
    expect(first.status).toBe('POSTED');

    await expect(useCase.execute(COMPANY_ID, pi.id)).rejects.toThrow('Only DRAFT purchase invoices can be posted');
    expect(inventoryService.writeStockMovement).toHaveBeenCalledTimes(1);
    expect(inventoryService.writeStockLevel).toHaveBeenCalledTimes(1);
    expect(itemRepo.updateItemInTransaction).toHaveBeenCalledTimes(1);
    expect(voucherRepo.save).toHaveBeenCalledTimes(1);
  });

  it('11) PostGRN skips GL voucher when the Accounting Engine is not initialized', async () => {
    const settings = makeSettings('CONTROLLED');
    const item = makeItem('stock-11', { trackInventory: true });
    const po = makePO({ id: 'po-11', item, orderedQty: 10, receivedQty: 0 });
    const grn = makeGRN({ id: 'grn-11', purchaseOrderId: po.id, item, receivedQty: 2 });

    const transactionManager = makeTransactionManager();
    const inventoryService = makeInventoryService();
    const voucherRepo = { save: jest.fn(async (voucher: any) => ({ ...voucher, id: 'v-grn-11' })), delete: jest.fn(async () => true) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) };
    const grnStore = new Map([[grn.id, grn]]);

    const useCase = new PostGoodsReceiptUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERPETUAL') as any,
      {
        getById: jest.fn(async (_companyId: string, receiptId: string) => grnStore.get(receiptId) ?? null),
        update: jest.fn(async (entity: GoodsReceipt) => { grnStore.set(entity.id, entity); }),
      } as any,
      {
        getById: jest.fn(async () => po),
        update: jest.fn(async () => undefined),
      } as any,
      makeItemRepo(item) as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo(false) as any,
      undefined,
      transactionManager as any,
      makeAccountingBridge(voucherRepo, ledgerRepo, false)
    );

    const posted = await useCase.execute(COMPANY_ID, grn.id);

    expect(posted.status).toBe('POSTED');
    expect(voucherRepo.save).not.toHaveBeenCalled();
    expect(ledgerRepo.recordForVoucher).not.toHaveBeenCalled();
    expect(posted.voucherId).toBeNull();
  });

  it('12) PostPI skips GL voucher when createAccountingEffect is false', async () => {
    const settings = makeSettings('SIMPLE');
    const vendor = makeVendor();
    const stockItem = makeItem('stock-12', { trackInventory: true, inventoryAssetAccountId: 'INV-1200' });
    const pi = makePI({
      id: 'pi-12',
      item: stockItem,
      invoicedQty: 2,
      unitPriceDoc: 15,
      warehouseId: 'wh-1',
    });

    const inventoryService = makeInventoryService();
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher), delete: jest.fn(async () => true) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) };
    const invoiceStore = new Map([[pi.id, pi]]);

    const useCase = new PostPurchaseInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, invoiceId: string) => invoiceStore.get(invoiceId) ?? null),
        update: jest.fn(async (entity: PurchaseInvoice) => { invoiceStore.set(entity.id, entity); }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
        voucherRepo as any,
        ledgerRepo as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
    );

    const posted = await useCase.execute(COMPANY_ID, pi.id, false);

    expect(posted.status).toBe('POSTED');
    expect(inventoryService.writeStockMovement).toHaveBeenCalledTimes(1);
    expect(voucherRepo.save).not.toHaveBeenCalled();
    expect(ledgerRepo.recordForVoucher).not.toHaveBeenCalled();
    expect(posted.voucherId).toBeNull();
  });
});



