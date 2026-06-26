import { describe, expect, it, jest } from '@jest/globals';
import { Item } from '../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { DeliveryNote } from '../../../domain/sales/entities/DeliveryNote';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import { PostDeliveryNoteUseCase } from '../../../application/sales/use-cases/DeliveryNoteUseCases';
import { PostSalesInvoiceUseCase, ApproveSalesInvoiceUseCase } from '../../../application/sales/use-cases/SalesInvoiceUseCases';
import { SubledgerVoucherPostingService } from '../../../application/accounting/services/SubledgerVoucherPostingService';
import { LegacyAccountingBridgeAdapter } from '../../../application/system-core/adapters/LegacyAccountingBridgeAdapter';

const COMPANY_ID = 'cmp-1';
const USER_ID = 'u-1';

const nowDate = () => new Date('2026-01-01T00:00:00.000Z');

const makeSettings = (
  mode: 'SIMPLE' | 'CONTROLLED',
  overrides: Partial<SalesSettings> = {}
): SalesSettings =>
  new SalesSettings({
    companyId: COMPANY_ID,
    allowDirectInvoicing: mode === 'SIMPLE',
    requireSOForStockItems: mode === 'CONTROLLED',
    defaultARAccountId: 'AR-100',
    defaultRevenueAccountId: 'REV-100',
    defaultCOGSAccountId: 'COGS-100',
    allowOverDelivery: false,
    overDeliveryTolerancePct: 0,
    overInvoiceTolerancePct: 0,
    defaultPaymentTermsDays: 30,
    governanceRules: [],
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
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  taxCodeId?: string;
  priceIsInclusive?: boolean;
  warehouseId?: string;
  documentPersona?: string;
  charges?: Array<{
    chargeId?: string;
    kind?: 'CHARGE' | 'DISCOUNT';
    name: string;
    amountDoc: number;
    taxCodeId?: string;
    revenueAccountId?: string;
  }>;
}): SalesInvoice =>
  new SalesInvoice({
    id: input.id,
    companyId: COMPANY_ID,
    invoiceNumber: `SI-${input.id}`,
    formType: 'sales_invoice_direct',
    voucherType: 'sales_invoice',
    persona: 'direct',
    documentPersona: input.documentPersona,
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
        discountType: input.discountType,
        discountValue: input.discountValue,
        lineTotalDoc: input.invoicedQty * input.unitPriceDoc,
        unitPriceBase: (input.exchangeRate ?? 1) * input.unitPriceDoc,
        lineTotalBase: input.invoicedQty * input.unitPriceDoc * (input.exchangeRate ?? 1),
        taxCodeId: input.taxCodeId,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
        priceIsInclusive: input.priceIsInclusive,
        warehouseId: input.warehouseId,
        revenueAccountId: input.item.revenueAccountId || '',
        cogsAccountId: input.item.cogsAccountId,
        inventoryAccountId: input.item.inventoryAssetAccountId,
        stockMovementId: null,
      },
    ],
    charges: (input.charges || []).map((charge, index) => ({
      chargeId: charge.chargeId || `chg-${index + 1}`,
      kind: charge.kind,
      name: charge.name,
      amountDoc: charge.amountDoc,
      taxCodeId: charge.taxCodeId,
      // A DISCOUNT with no explicit account falls back to the settings discount
      // account at posting time; a CHARGE defaults to the item's revenue account.
      revenueAccountId: charge.revenueAccountId || (charge.kind === 'DISCOUNT' ? undefined : (input.item.revenueAccountId || '')),
    })),
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

const makeInventoryService = (costBase = 10) => {
  let seq = 1;
  return {
    processOUT: jest.fn(async () => ({
      id: `mov-out-${seq++}`,
      unitCostBase: costBase,
      movementCurrency: 'USD',
      fxRateMovToBase: 1,
      fxRateCCYToBase: 1,
    })),
    processIN: jest.fn(async () => ({ id: `mov-in-${seq++}` })),
    preFetchStockLevel: jest.fn(async () => makeStockLevel(costBase)),
    preFetchLevelsByItem: jest.fn(async () => [makeStockLevel(costBase)]),
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

describe('Sales posting use-cases (Phase 2)', () => {
  it('1) PostDN creates SALES_DELIVERY inventory movement per line', async () => {
    const settings = makeSettings('CONTROLLED');
    const item = makeItem('stock-1', { trackInventory: true });
    const so = makeSO({ id: 'so-1', item, orderedQty: 10, deliveredQty: 0 });
    const dn = makeDN({ id: 'dn-1', salesOrderId: so.id, item, deliveredQty: 4 });

    const inventoryService = makeInventoryService(5);
    const useCase = new PostDeliveryNoteUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      { getById: jest.fn(async () => dn), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
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

    await useCase.execute(COMPANY_ID, dn.id);

    expect(inventoryService.writeStockMovement).toHaveBeenCalledTimes(1);
    const movement = (inventoryService.writeStockMovement as any).mock.calls[0][0];
    expect(movement.movementType).toBe('SALES_DELIVERY');
    expect(movement.referenceType).toBe('DELIVERY_NOTE');
    expect(movement.referenceId).toBe(dn.id);
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

    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };

    const useCase = new PostDeliveryNoteUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      { getById: jest.fn(async () => dn), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
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

  it('2b) PostDN uses Inventory financial settings as the COGS fallback', async () => {
    const settings = makeSettings('CONTROLLED', {
      defaultCOGSAccountId: undefined,
      defaultInventoryAccountId: undefined,
    });
    const item = makeItem('stock-2b', { trackInventory: true });
    (item as any).cogsAccountId = undefined;
    (item as any).inventoryAssetAccountId = undefined;
    const so = makeSO({ id: 'so-2b', item, orderedQty: 10, deliveredQty: 0 });
    const dn = makeDN({ id: 'dn-2b', salesOrderId: so.id, item, deliveredQty: 2 });

    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };

    const useCase = new PostDeliveryNoteUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERPETUAL', {
        defaultCOGSAccountId: 'INV-COGS-FALLBACK',
        defaultInventoryAssetAccountId: 'INV-ASSET-FALLBACK',
      }) as any,
      { getById: jest.fn(async () => dn), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
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

    await useCase.execute(COMPANY_ID, dn.id);

    const voucher = (voucherRepo.save as any).mock.calls[0][0];
    const hasCogsDebit = voucher.lines.some((line: any) => line.accountId === 'INV-COGS-FALLBACK' && line.side === 'Debit');
    const hasInventoryCredit = voucher.lines.some((line: any) => line.accountId === 'INV-ASSET-FALLBACK' && line.side === 'Credit');
    expect(hasCogsDebit).toBe(true);
    expect(hasInventoryCredit).toBe(true);
  });

  it('3) PostDN updates SO line deliveredQty', async () => {
    const settings = makeSettings('CONTROLLED');
    const item = makeItem('stock-3', { trackInventory: true });
    const so = makeSO({ id: 'so-3', item, orderedQty: 10, deliveredQty: 1 });
    const dn = makeDN({ id: 'dn-3', salesOrderId: so.id, item, deliveredQty: 3 });

    const useCase = new PostDeliveryNoteUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      { getById: jest.fn(async () => dn), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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

    await useCase.execute(COMPANY_ID, dn.id);
    expect(so.lines[0].deliveredQty).toBe(4);
  });

  it('4) PostDN updates SO status to PARTIALLY_DELIVERED', async () => {
    const settings = makeSettings('CONTROLLED');
    const item = makeItem('stock-4', { trackInventory: true });
    const so = makeSO({ id: 'so-4', item, orderedQty: 10, deliveredQty: 0, status: 'CONFIRMED' });
    const dn = makeDN({ id: 'dn-4', salesOrderId: so.id, item, deliveredQty: 2 });

    const useCase = new PostDeliveryNoteUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      { getById: jest.fn(async () => dn), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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

    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      { getById: jest.fn(async () => si), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
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
      documentPersona: 'POS_DIRECT_SALE',
    });

    const inventoryService = makeInventoryService();
    const invoiceStore = new Map([[si.id, si]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (entity: SalesInvoice) => {
          invoiceStore.set(entity.id, entity);
        }),
      } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(serviceItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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

    await useCase.execute(COMPANY_ID, si.id);

    expect(voucherRepo.save).toHaveBeenCalledTimes(1);
    const voucher = (voucherRepo.save as any).mock.calls[0][0];
    expect(voucher.metadata.sourceModule).toBe('sales');
    expect(voucher.metadata.sourceType).toBe('SALES_INVOICE');
    expect(voucher.metadata.documentPersona).toBe('POS_DIRECT_SALE');
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
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (entity: SalesInvoice) => {
          invoiceStore.set(entity.id, entity);
        }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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

    const posted = await useCase.execute(COMPANY_ID, si.id);
    expect(posted.status).toBe('POSTED');
    expect(inventoryService.writeStockMovement).toHaveBeenCalledTimes(1);
    expect(voucherRepo.save).toHaveBeenCalledTimes(2);
    expect(ledgerRepo.recordForVoucher).toHaveBeenCalledTimes(2);
  });

  // Task 264 — shared below-cost selling policy attached to Sales posting.
  const makePostSIForBelowCost = (commercialCore: any) => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const stockItem = makeItem('stock-7c', {
      trackInventory: true,
      cogsAccountId: 'COGS-700',
      inventoryAssetAccountId: 'INV-700',
      revenueAccountId: 'REV-700',
    });
    const si = makeSI({ id: 'si-7c', item: stockItem, invoicedQty: 2, unitPriceDoc: 15, warehouseId: 'wh-1' });
    const inventoryService = makeInventoryService();
    const invoiceStore = new Map([[si.id, si]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };
    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (entity: SalesInvoice) => { invoiceStore.set(entity.id, entity); }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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
      ),
      undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined,
      commercialCore
    );
    return { useCase, si, voucherRepo, inventoryService };
  };

  it('7c) PostSI blocks a below-cost line when the selling policy denies it (no vouchers)', async () => {
    const commercialCore = {
      validateCostMargin: jest.fn(async (_ctx: any) => ({ allowed: false, requiresApproval: true, reason: 'BELOW_COST' })),
    };
    const { useCase, si, voucherRepo } = makePostSIForBelowCost(commercialCore);

    await expect(useCase.execute(COMPANY_ID, si.id)).rejects.toThrow(/below allowed cost\/margin/i);
    expect(commercialCore.validateCostMargin).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'sales', itemId: 'stock-7c' })
    );
    expect(voucherRepo.save).not.toHaveBeenCalled();
  });

  it('7d) PostSI posts normally when the selling policy allows the line', async () => {
    const commercialCore = {
      validateCostMargin: jest.fn(async (_ctx: any) => ({ allowed: true, requiresApproval: false, reason: 'OK' })),
    };
    const { useCase, si, voucherRepo } = makePostSIForBelowCost(commercialCore);

    const posted = await useCase.execute(COMPANY_ID, si.id);
    expect(posted.status).toBe('POSTED');
    expect(commercialCore.validateCostMargin).toHaveBeenCalled();
    expect(voucherRepo.save).toHaveBeenCalledTimes(2);
  });

  it('7b) PostSI in PERIODIC mode posts only revenue voucher, still moves quantity, and creates no COGS/inventory GL lines', async () => {
    const settings = makeSettings('SIMPLE', {
      defaultRevenueAccountId: 'SALES-700',
      defaultSalesReturnAccountId: 'SALES-RET-700',
    });
    const customer = makeCustomer();
    const stockItem = makeItem('stock-7b', {
      trackInventory: true,
      cogsAccountId: 'COGS-700',
      inventoryAssetAccountId: 'INV-700',
      revenueAccountId: 'REV-700',
    });
    const si = makeSI({
      id: 'si-7b',
      item: stockItem,
      invoicedQty: 2,
      unitPriceDoc: 15,
      warehouseId: 'wh-1',
    });

    const inventoryService = makeInventoryService();
    const invoiceStore = new Map([[si.id, si]]);
    const savedVouchers: any[] = [];

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (entity: SalesInvoice) => {
          invoiceStore.set(entity.id, entity);
        }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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

    const posted = await useCase.execute(COMPANY_ID, si.id);
    expect(posted.status).toBe('POSTED');
    expect(inventoryService.writeStockMovement).toHaveBeenCalledTimes(1);
    expect(savedVouchers).toHaveLength(1);
    expect(posted.cogsVoucherId).toBeNull();

    const voucher = savedVouchers[0];
    const debitLines = voucher.lines.filter((line: any) => line.side === 'Debit');
    const creditLines = voucher.lines.filter((line: any) => line.side === 'Credit');
    expect(debitLines.some((line: any) => line.accountId === 'AR-200' && line.debitAmount === 30)).toBe(true);
    expect(creditLines.some((line: any) => line.accountId === 'REV-700' && line.creditAmount === 30)).toBe(true);
    expect(voucher.lines.some((line: any) => line.accountId === 'INV-700')).toBe(false);
    expect(voucher.lines.some((line: any) => line.accountId === 'COGS-700')).toBe(false);
  });

  it('A1) PostSI parks as PENDING_APPROVAL when central approval policy rejects unapproved post (no financial effect)', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const stockItem = makeItem('stock-appr', {
      trackInventory: true,
      cogsAccountId: 'COGS-700',
      inventoryAssetAccountId: 'INV-700',
      revenueAccountId: 'REV-700',
    });
    const si = makeSI({ id: 'si-appr', item: stockItem, invoicedQty: 2, unitPriceDoc: 15, warehouseId: 'wh-1' });

    const inventoryService = makeInventoryService();
    const invoiceStore = new Map([[si.id, si]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };

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

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (entity: SalesInvoice) => { invoiceStore.set(entity.id, entity); }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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

    const result = await useCase.execute(COMPANY_ID, si.id);
    expect(result.status).toBe('PENDING_APPROVAL');
    expect(inventoryService.writeStockMovement).not.toHaveBeenCalled();
    expect(voucherRepo.save).not.toHaveBeenCalled();
    expect(ledgerRepo.recordForVoucher).not.toHaveBeenCalled();
  });

  it('A1b) PostSI preserves the entered settlement on the parked invoice (not lost across the approval boundary)', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const stockItem = makeItem('stock-appr-pend', {
      trackInventory: true,
      cogsAccountId: 'COGS-700',
      inventoryAssetAccountId: 'INV-700',
      revenueAccountId: 'REV-700',
    });
    const si = makeSI({ id: 'si-appr-pend', item: stockItem, invoicedQty: 2, unitPriceDoc: 15, warehouseId: 'wh-1' });

    const inventoryService = makeInventoryService();
    const invoiceStore = new Map([[si.id, si]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };

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

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (entity: SalesInvoice) => { invoiceStore.set(entity.id, entity); }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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

    const settlementInput = {
      settlementMode: 'CASH_FULL' as const,
      receivablePayableAccountId: 'AR-1',
      settlements: [{ amountBase: 30, paymentMethod: 'CASH' as const, paymentDate: '2026-05-02' }],
    };
    const result = await useCase.execute(COMPANY_ID, si.id, true, undefined, settlementInput);

    expect(result.status).toBe('PENDING_APPROVAL');
    // The settlement intent is preserved verbatim so the approver can replay it.
    expect(result.pendingSettlement).toEqual(settlementInput);
    // And it is persisted on the parked invoice, not just the returned entity.
    expect(invoiceStore.get(si.id)?.pendingSettlement).toEqual(settlementInput);
    // Still no financial effect while parked.
    expect(voucherRepo.save).not.toHaveBeenCalled();
    expect(ledgerRepo.recordForVoucher).not.toHaveBeenCalled();
  });

  it('A2) ApproveSalesInvoiceUseCase runs the real post on a PENDING_APPROVAL invoice', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const stockItem = makeItem('stock-appr2', {
      trackInventory: true,
      cogsAccountId: 'COGS-700',
      inventoryAssetAccountId: 'INV-700',
      revenueAccountId: 'REV-700',
    });
    const si = makeSI({ id: 'si-appr2', item: stockItem, invoicedQty: 2, unitPriceDoc: 15, warehouseId: 'wh-1' });
    si.status = 'PENDING_APPROVAL';

    const inventoryService = makeInventoryService();
    const invoiceStore = new Map([[si.id, si]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };
    const siRepo = {
      getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
      update: jest.fn(async (entity: SalesInvoice) => { invoiceStore.set(entity.id, entity); }),
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

    const postUseCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      siRepo as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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

    const approveUseCase = new ApproveSalesInvoiceUseCase(siRepo as any, postUseCase);
    const posted = await approveUseCase.execute(COMPANY_ID, si.id, { userId: USER_ID });

    expect(posted.status).toBe('POSTED');
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
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      { getById: jest.fn(async () => si), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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

    await expect(useCase.execute(COMPANY_ID, si.id)).rejects.toThrow(/ordered qty/i);
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
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (entity: SalesInvoice) => {
          invoiceStore.set(entity.id, entity);
        }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async (_companyId: string, id: string) => taxStore.get(id) ?? null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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
    const itemRepo = makeItemRepo(stockItem);
    const inventoryService = makeInventoryService();

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (entity: SalesInvoice) => {
          invoiceStore.set(entity.id, entity);
        }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => taxCode) } as any,
      itemRepo as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
          { save: jest.fn(async (voucher: any) => { savedVouchers.push(voucher); return voucher; }), delete: jest.fn(async () => true) } as any,
          { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
          { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
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
    expect(itemRepo.updateItemInTransaction).toHaveBeenCalledTimes(1);

    const itemUpdate = (itemRepo.updateItemInTransaction as any).mock.calls[0][2];
    expect(itemUpdate.costingStats.avgCost.base).toBeCloseTo(10, 2);
    expect(itemUpdate.costingStats.lastSalePrice.base).toBeCloseTo(15, 2);
    expect(itemUpdate.costingStats.lastSalePrice.ccy).toBeCloseTo(10, 2);
    expect(itemUpdate.costingStats.lastSalePrice.currency).toBe('EUR');
    expect(itemUpdate.costingStats.lastSalePrice.fxRateToBase).toBeCloseTo(1.5, 6);
    expect(itemUpdate.costingStats.lastSalePrice.asOf).toBe('2026-01-12');
    expect(itemUpdate.costingStats.lastSalePrice.uomId).toBe('EA');
    expect(itemUpdate.costingStats.lastSalePriceByCcyUom.EUR__EA.ccy).toBeCloseTo(10, 2);
    expect(itemUpdate.costingStats.lastSalePriceByCcyUom.EUR__EA.uomId).toBe('EA');
  });

  it('10a) PostSI re-post attempt does not double-apply inventory or item sale stats', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const stockItem = makeItem('stock-10a', {
      trackInventory: true,
      cogsAccountId: 'COGS-10A',
      inventoryAssetAccountId: 'INV-10A',
      revenueAccountId: 'REV-10A',
    });
    const si = makeSI({
      id: 'si-10a',
      item: stockItem,
      invoicedQty: 2,
      unitPriceDoc: 10,
      warehouseId: 'wh-1',
    });

    const invoiceStore = new Map([[si.id, si]]);
    const itemRepo = makeItemRepo(stockItem);
    const inventoryService = makeInventoryService();
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher), delete: jest.fn(async () => true) };

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (entity: SalesInvoice) => {
          invoiceStore.set(entity.id, entity);
        }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => null) } as any,
      itemRepo as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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

    const first = await useCase.execute(COMPANY_ID, si.id);
    expect(first.status).toBe('POSTED');

    await expect(useCase.execute(COMPANY_ID, si.id)).rejects.toThrow(/already POSTED/i);
    expect(inventoryService.writeStockMovement).toHaveBeenCalledTimes(1);
    expect(inventoryService.writeStockLevel).toHaveBeenCalledTimes(1);
    expect(itemRepo.updateItemInTransaction).toHaveBeenCalledTimes(1);
    expect(voucherRepo.save).toHaveBeenCalledTimes(2);
  });

  it('10b) PostSI applies discount and charges to totals and revenue voucher', async () => {
    const settings = makeSettings('SIMPLE', { defaultSalesExpenseAccountId: 'EXP-DISC-10B' });
    const customer = makeCustomer();
    const serviceItem = makeItem('svc-10b', {
      trackInventory: false,
      type: 'SERVICE',
      revenueAccountId: 'REV-100',
    });
    const si = makeSI({
      id: 'si-10b',
      item: serviceItem,
      invoicedQty: 2,
      unitPriceDoc: 10,
      discountType: 'PERCENT',
      discountValue: 10,
      taxCodeId: 'tax-1',
      charges: [
        {
          chargeId: 'chg-10b',
          name: 'Delivery Fee',
          amountDoc: 5,
        },
      ],
    });

    const taxCode = makeTaxCode(0.1);
    const invoiceStore = new Map([[si.id, si]]);
    const savedVouchers: any[] = [];

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (entity: SalesInvoice) => {
          invoiceStore.set(entity.id, entity);
        }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => taxCode) } as any,
      makeItemRepo(serviceItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
          { save: jest.fn(async (voucher: any) => { savedVouchers.push(voucher); return voucher; }), delete: jest.fn(async () => true) } as any,
          { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
          { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
    );

    const posted = await useCase.execute(COMPANY_ID, si.id);
    expect(posted.lines[0].discountAmountDoc).toBe(2);
    expect(posted.subtotalDoc).toBe(23);
    expect(posted.taxTotalDoc).toBe(1.8);
    expect(posted.grandTotalDoc).toBe(24.8);

    const revenueVoucher = savedVouchers.find((voucher) => voucher.voucherNo === `SI-${si.invoiceNumber}`);
    expect(revenueVoucher).toBeTruthy();
    const creditLines = revenueVoucher.lines.filter((line: any) => line.side === 'Credit');
    const debitLines = revenueVoucher.lines.filter((line: any) => line.side === 'Debit');
    expect(debitLines.some((line: any) => line.accountId === 'AR-200' && line.debitAmount === 24.8)).toBe(true);
    expect(debitLines.some((line: any) => line.accountId === 'EXP-DISC-10B' && line.debitAmount === 2)).toBe(true);
    expect(creditLines.filter((line: any) => line.accountId === 'REV-100' && line.creditAmount === 20)).toHaveLength(1);
    expect(creditLines.filter((line: any) => line.accountId === 'REV-100' && line.creditAmount === 5)).toHaveLength(1);
    expect(creditLines.some((line: any) => line.accountId === 'TAX-OUT-100' && line.creditAmount === 1.8)).toBe(true);
    expect(revenueVoucher.totalDebit).toBe(26.8);
    expect(revenueVoucher.totalCredit).toBe(26.8);

    // Characterization (Task 178 — guards SI revenue-voucher shape against
    // line-granularity drift now that posting flows through SubledgerDocumentPoster).
    // Exactly: AR debit, discount debit, two REV credits (20 + 5), tax credit.
    expect(revenueVoucher.lines).toHaveLength(5);
    expect(debitLines).toHaveLength(2);
    expect(creditLines).toHaveLength(3);
    const sumDebit = revenueVoucher.lines.reduce((s: number, l: any) => s + (l.debitAmount || 0), 0);
    const sumCredit = revenueVoucher.lines.reduce((s: number, l: any) => s + (l.creditAmount || 0), 0);
    expect(sumDebit).toBeCloseTo(26.8, 2);
    expect(sumCredit).toBeCloseTo(26.8, 2);
  });

  it('10d) PostSI applies a whole-invoice DISCOUNT adjustment: debits the discount account, reduces the total, stays balanced', async () => {
    const settings = makeSettings('SIMPLE', { defaultSalesExpenseAccountId: 'EXP-DISC-10D' });
    const customer = makeCustomer();
    const serviceItem = makeItem('svc-10d', {
      trackInventory: false,
      type: 'SERVICE',
      revenueAccountId: 'REV-100',
    });
    const si = makeSI({
      id: 'si-10d',
      item: serviceItem,
      invoicedQty: 2,
      unitPriceDoc: 10, // 20 gross, no line discount, no tax
      charges: [
        // Whole-invoice discount with no explicit account → falls back to the settings discount account.
        { chargeId: 'disc-10d', kind: 'DISCOUNT', name: 'Year-end discount', amountDoc: 5 },
      ],
    });

    const invoiceStore = new Map([[si.id, si]]);
    const savedVouchers: any[] = [];

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (entity: SalesInvoice) => {
          invoiceStore.set(entity.id, entity);
        }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(serviceItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
          { save: jest.fn(async (voucher: any) => { savedVouchers.push(voucher); return voucher; }), delete: jest.fn(async () => true) } as any,
          { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
          { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
    );

    const posted = await useCase.execute(COMPANY_ID, si.id);
    // 20 gross − 5 discount = 15 net; no tax.
    expect(posted.subtotalDoc).toBe(15);
    expect(posted.taxTotalDoc).toBe(0);
    expect(posted.grandTotalDoc).toBe(15);

    const revenueVoucher = savedVouchers.find((voucher) => voucher.voucherNo === `SI-${si.invoiceNumber}`);
    expect(revenueVoucher).toBeTruthy();
    const creditLines = revenueVoucher.lines.filter((line: any) => line.side === 'Credit');
    const debitLines = revenueVoucher.lines.filter((line: any) => line.side === 'Debit');
    // AR reduced to 15; discount debited 5 to the settings discount account; revenue credited at gross 20.
    expect(debitLines.some((line: any) => line.accountId === 'AR-200' && line.debitAmount === 15)).toBe(true);
    expect(debitLines.some((line: any) => line.accountId === 'EXP-DISC-10D' && line.debitAmount === 5)).toBe(true);
    expect(creditLines.some((line: any) => line.accountId === 'REV-100' && line.creditAmount === 20)).toBe(true);
    expect(revenueVoucher.totalDebit).toBe(20);
    expect(revenueVoucher.totalCredit).toBe(20);
    // No tax line on a tax-free discount/charge invoice: AR + discount debits, single revenue credit.
    expect(debitLines).toHaveLength(2);
    expect(creditLines).toHaveLength(1);
  });

  it('10c) PostSI balances the revenue voucher when discount + inclusive tax force ±0.01 rounding', async () => {
    // Regression for "Subledger voucher SI-... is not balanced: debit=99.52, credit=99.53".
    // qty 1, price 100, 5% inclusive, discount $10 → 100/1.05 and 10/1.05 both non-
    // terminating; rounding revenue, discount, and tax independently leaks 1 paisa.
    // Discount must absorb the residue (revenueCreditBase − lineTotalBase).
    const settings = makeSettings('SIMPLE', { defaultSalesExpenseAccountId: 'EXP-DISC-10C' });
    const customer = makeCustomer();
    const serviceItem = makeItem('svc-10c', {
      trackInventory: false,
      type: 'SERVICE',
      revenueAccountId: 'REV-100',
    });
    const si = makeSI({
      id: 'si-10c',
      item: serviceItem,
      invoicedQty: 1,
      unitPriceDoc: 100,
      discountType: 'AMOUNT',
      discountValue: 10,
      taxCodeId: 'tax-1',
      priceIsInclusive: true,
    });

    const taxCode = makeTaxCode(0.05);
    const invoiceStore = new Map([[si.id, si]]);
    const savedVouchers: any[] = [];

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (entity: SalesInvoice) => {
          invoiceStore.set(entity.id, entity);
        }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => taxCode) } as any,
      makeItemRepo(serviceItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
          { save: jest.fn(async (voucher: any) => { savedVouchers.push(voucher); return voucher; }), delete: jest.fn(async () => true) } as any,
          { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
          { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      )
    );

    // The bug was a throw from SubledgerDocumentPoster.assertBalanced.
    // If posting completes at all, the voucher is balanced.
    const posted = await useCase.execute(COMPANY_ID, si.id);
    expect(posted.grandTotalBase).toBe(90);

    const revenueVoucher = savedVouchers.find((voucher) => voucher.voucherNo === `SI-${si.invoiceNumber}`);
    expect(revenueVoucher).toBeTruthy();
    expect(revenueVoucher.totalDebit).toBeCloseTo(revenueVoucher.totalCredit, 2);

    const debitLines = revenueVoucher.lines.filter((line: any) => line.side === 'Debit');
    const creditLines = revenueVoucher.lines.filter((line: any) => line.side === 'Credit');
    expect(debitLines.some((l: any) => l.accountId === 'AR-200' && l.debitAmount === 90)).toBe(true);
    // Discount absorbs the +0.01 residue → 9.53, not 9.52.
    expect(debitLines.some((l: any) => l.accountId === 'EXP-DISC-10C' && l.debitAmount === 9.53)).toBe(true);
    expect(creditLines.some((l: any) => l.accountId === 'REV-100' && l.creditAmount === 95.24)).toBe(true);
    expect(creditLines.some((l: any) => l.accountId === 'TAX-OUT-100' && l.creditAmount === 4.29)).toBe(true);
  });

  it('11) PostDN: accounting failure does not persist posted DN or SO status', async () => {
    const settings = makeSettings('CONTROLLED');
    const item = makeItem('stock-11', {
      trackInventory: true,
      cogsAccountId: 'COGS-1100',
      inventoryAssetAccountId: 'INV-1100',
    });
    const so = makeSO({ id: 'so-11', item, orderedQty: 10, deliveredQty: 0 });
    const dn = makeDN({ id: 'dn-11', salesOrderId: so.id, item, deliveredQty: 2 });

    const dnRepo = {
      getById: jest.fn(async () => dn),
      update: jest.fn(async () => undefined),
    };
    const soRepo = {
      getById: jest.fn(async () => so),
      update: jest.fn(async () => undefined),
    };
    const inventoryService = makeInventoryService();
    const voucherRepo = {
      save: jest.fn(async () => {
        throw new Error('Accounting failed');
      }),
    };

    const useCase = new PostDeliveryNoteUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      dnRepo as any,
      soRepo as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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

    await expect(useCase.execute(COMPANY_ID, dn.id)).rejects.toThrow('Accounting failed');
    expect(inventoryService.writeStockMovement).toHaveBeenCalledTimes(1);
    expect(dnRepo.update).not.toHaveBeenCalled();
    expect(soRepo.update).not.toHaveBeenCalled();
  });

  it('12) PostSI: inventory failure does not create vouchers or persist posted invoice', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const stockItem = makeItem('stock-12', {
      trackInventory: true,
      cogsAccountId: 'COGS-1200',
      inventoryAssetAccountId: 'INV-1200',
      revenueAccountId: 'REV-1200',
    });
    const si = makeSI({
      id: 'si-12',
      item: stockItem,
      invoicedQty: 2,
      unitPriceDoc: 15,
      warehouseId: 'wh-1',
    });

    const invoiceRepo = {
      getById: jest.fn(async () => si),
      update: jest.fn(async () => undefined),
    };
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const inventoryService = {
      ...makeInventoryService(),
      writeStockMovement: jest.fn(async () => {
        throw new Error('Inventory failed');
      }),
    };

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      invoiceRepo as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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

    await expect(useCase.execute(COMPANY_ID, si.id)).rejects.toThrow('Inventory failed');
    expect(voucherRepo.save).not.toHaveBeenCalled();
    expect(invoiceRepo.update).not.toHaveBeenCalled();
  });

  it('13) PostSI: accounting failure does not persist invoice or SO posting state', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const stockItem = makeItem('stock-13', {
      trackInventory: true,
      cogsAccountId: 'COGS-1300',
      inventoryAssetAccountId: 'INV-1300',
      revenueAccountId: 'REV-1300',
    });
    const so = makeSO({ id: 'so-13', item: stockItem, orderedQty: 10, deliveredQty: 0, invoicedQty: 0 });
    const si = makeSI({
      id: 'si-13',
      item: stockItem,
      salesOrderId: so.id,
      soLineId: 'so-line-1',
      invoicedQty: 2,
      unitPriceDoc: 15,
      warehouseId: 'wh-1',
    });

    const invoiceRepo = {
      getById: jest.fn(async () => si),
      update: jest.fn(async () => undefined),
    };
    const salesOrderRepo = {
      getById: jest.fn(async () => so),
      update: jest.fn(async () => undefined),
    };
    const voucherRepo = {
      save: jest.fn(async () => {
        throw new Error('Accounting failed');
      }),
    };

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      invoiceRepo as any,
      salesOrderRepo as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
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

    await expect(useCase.execute(COMPANY_ID, si.id)).rejects.toThrow('Accounting failed');
    expect(invoiceRepo.update).not.toHaveBeenCalled();
    expect(salesOrderRepo.update).not.toHaveBeenCalled();
  });

  it('14) PostDN: missing cost basis aborts posting before any voucher or status update', async () => {
    const settings = makeSettings('CONTROLLED');
    const item = makeItem('stock-14', { trackInventory: true });
    const so = makeSO({ id: 'so-14', item, orderedQty: 10, deliveredQty: 0 });
    const dn = makeDN({ id: 'dn-14', salesOrderId: so.id, item, deliveredQty: 3 });

    const deliveryNoteRepo = {
      getById: jest.fn(async () => dn),
      update: jest.fn(async () => undefined),
    };
    const salesOrderRepo = {
      getById: jest.fn(async () => so),
      update: jest.fn(async () => undefined),
    };
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const inventoryService = {
      ...makeInventoryService(0),
    };

    const useCase = new PostDeliveryNoteUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      deliveryNoteRepo as any,
      salesOrderRepo as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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

    await expect(useCase.execute(COMPANY_ID, dn.id)).rejects.toThrow('Missing positive inventory cost');
    expect(voucherRepo.save).not.toHaveBeenCalled();
    expect(deliveryNoteRepo.update).not.toHaveBeenCalled();
    expect(salesOrderRepo.update).not.toHaveBeenCalled();
  });

  it('14b) PostDN: invoice-driven allows zero cost and posts with unsettled movement', async () => {
    const settings = makeSettings('CONTROLLED', {
      defaultCOGSAccountId: undefined,
      defaultInventoryAccountId: undefined,
    });
    const item = makeItem('stock-14b', { trackInventory: true });
    (item as any).cogsAccountId = undefined;
    (item as any).inventoryAssetAccountId = undefined;
    const so = makeSO({ id: 'so-14b', item, orderedQty: 10, deliveredQty: 0 });
    const dn = makeDN({ id: 'dn-14b', salesOrderId: so.id, item, deliveredQty: 3 });

    const deliveryNoteRepo = {
      getById: jest.fn(async () => dn),
      update: jest.fn(async () => undefined),
    };
    const salesOrderRepo = {
      getById: jest.fn(async () => so),
      update: jest.fn(async () => undefined),
    };
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const inventoryService = {
      ...makeInventoryService(0),
    };

    const useCase = new PostDeliveryNoteUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('INVOICE_DRIVEN', {
        defaultCOGSAccountId: undefined,
        defaultInventoryAssetAccountId: undefined,
      }) as any,
      deliveryNoteRepo as any,
      salesOrderRepo as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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

    const posted = await useCase.execute(COMPANY_ID, dn.id);
    expect(posted.status).toBe('POSTED');
    expect(posted.lines[0].unitCostBase).toBe(0);
    expect(voucherRepo.save).not.toHaveBeenCalled();
    expect(deliveryNoteRepo.update).toHaveBeenCalled();
    expect(salesOrderRepo.update).toHaveBeenCalled();
  });

  it('15) PostSI: missing tracked-item cost basis aborts posting before vouchers are created', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const stockItem = makeItem('stock-15', {
      trackInventory: true,
      cogsAccountId: 'COGS-1500',
      inventoryAssetAccountId: 'INV-1500',
      revenueAccountId: 'REV-1500',
    });
    const si = makeSI({
      id: 'si-15',
      item: stockItem,
      invoicedQty: 2,
      unitPriceDoc: 15,
      warehouseId: 'wh-1',
    });

    const invoiceRepo = {
      getById: jest.fn(async () => si),
      update: jest.fn(async () => undefined),
    };
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const inventoryService = {
      ...makeInventoryService(0),
    };

    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      invoiceRepo as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
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

    await expect(useCase.execute(COMPANY_ID, si.id)).rejects.toThrow('Missing positive inventory cost');
    expect(voucherRepo.save).not.toHaveBeenCalled();
    expect(invoiceRepo.update).not.toHaveBeenCalled();
  });
});

/**
 * FUP-3 production-wiring parity (the merge gate).
 *
 * The controllers now pass a real `LegacyAccountingBridgeAdapter` into PostSI/PI/SR.
 * Unit tests prove the assembler; these prove the *whole use-case* behaves identically
 * when posting through the real bridge in full mode (Accounting App enabled), and
 * degrades to minimal mode (no GL voucher) when the App is disabled — the only intended
 * behavior change. Scenario mirrors test #7 (SIMPLE standalone stock SI → Revenue + COGS).
 */
describe('PostSI — FUP-3 production bridge parity (full == legacy) + minimal mode', () => {
  const buildScenario = () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const stockItem = makeItem('stock-bridge', {
      trackInventory: true,
      cogsAccountId: 'COGS-700',
      inventoryAssetAccountId: 'INV-700',
      revenueAccountId: 'REV-700',
    });
    const si = makeSI({ id: 'si-bridge', item: stockItem, invoicedQty: 2, unitPriceDoc: 15, warehouseId: 'wh-1' });
    return { settings, customer, stockItem, si };
  };

  /** Build the use-case for a scenario. `bridge` is the new LAST constructor param. */
  const buildUseCase = (
    scenario: ReturnType<typeof buildScenario>,
    captureRepo: { save: any },
    bridge?: any
  ) => {
    const { settings, customer, stockItem, si } = scenario;
    const invoiceStore = new Map([[si.id, si]]);
    const useCase = new PostSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_c: string, id: string) => invoiceStore.get(id) ?? null),
        update: jest.fn(async (e: SalesInvoice) => { invoiceStore.set(e.id, e); }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(stockItem) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      bridge ?? new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
          captureRepo as any,
          { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
          { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo() as any
      ),
      undefined, // paymentHistoryRepo
      undefined, // voucherRepo
      undefined, // voucherSequenceRepo
      undefined, // ledgerRepo
      undefined, // postingLogRepo
      undefined, // auditEngine
      undefined, // partyItemPriceRepo
      undefined, // profitFactRecorder
      undefined, // numberingEngine
    );
    return { useCase, si };
  };

  /** The accounting truth that must not drift: voucher type + per-line Dr/Cr accounts/amounts. */
  const normalize = (vouchers: any[]) =>
    vouchers.map((v) => ({
      voucherType: v.voucherType,
      sourceType: v.metadata?.sourceType,
      voucherPart: v.metadata?.voucherPart,
      lines: v.lines
        .map((l: any) => ({ accountId: l.accountId, side: l.side, baseAmount: l.baseAmount, docAmount: l.docAmount }))
        .sort((a: any, b: any) => `${a.side}${a.accountId}`.localeCompare(`${b.side}${b.accountId}`)),
    }));

  it('full mode (App enabled) through the real adapter posts vouchers IDENTICAL to the legacy path', async () => {
    // Legacy path — no bridge, use-case posts directly.
    const legacyRepo = { save: jest.fn(async (v: any) => v) };
    const legacy = buildUseCase(buildScenario(), legacyRepo);
    const legacyPosted = await legacy.useCase.execute(COMPANY_ID, legacy.si.id);

    // Production path — real LegacyAccountingBridgeAdapter, Accounting App ENABLED → full mode.
    // The bridge owns its OWN posting service, so capture vouchers from the bridge's repo.
    const bridgeRepo = { save: jest.fn(async (v: any) => v) };
    const bridgePostingService = new SubledgerVoucherPostingService(
      bridgeRepo as any,
      { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any
    );
    const moduleEnabled = { get: jest.fn(async () => ({ companyId: COMPANY_ID, moduleCode: 'accounting', isEnabled: true, initialized: true })) };
    const postingLogRepo = { create: jest.fn(async () => undefined) };
    const bridge = new LegacyAccountingBridgeAdapter(bridgePostingService, moduleEnabled as any, postingLogRepo as any);

    const prodRepo = { save: jest.fn(async (v: any) => v) }; // use-case's own repo — should stay UNUSED in full mode
    const prod = buildUseCase(buildScenario(), prodRepo, bridge);
    const prodPosted = await prod.useCase.execute(COMPANY_ID, prod.si.id);

    // Same number of vouchers, same Dr/Cr truth.
    expect(bridgeRepo.save).toHaveBeenCalledTimes(legacyRepo.save.mock.calls.length);
    expect(bridgeRepo.save).toHaveBeenCalledTimes(2); // Revenue + COGS
    expect(normalize(bridgeRepo.save.mock.calls.map((c: any) => c[0])))
      .toEqual(normalize(legacyRepo.save.mock.calls.map((c: any) => c[0])));

    // The bridge intercepted: the use-case's own posting service was never touched.
    expect(prodRepo.save).not.toHaveBeenCalled();
    // No minimal-journal log in full mode.
    expect(postingLogRepo.create).not.toHaveBeenCalled();
    // Same end state.
    expect(prodPosted.status).toBe('POSTED');
    expect(legacyPosted.status).toBe('POSTED');
    expect(prodPosted.voucherId).toBeTruthy();
    expect(prodPosted.cogsVoucherId).toBeTruthy();
  });

  it('minimal mode (not linked to accounting — engine not initialized) posts NO GL voucher, records a minimal journal, still marks POSTED', async () => {
    const bridgeRepo = { save: jest.fn(async (v: any) => v) };
    const bridgePostingService = new SubledgerVoucherPostingService(
      bridgeRepo as any,
      { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any
    );
    const moduleDisabled = { get: jest.fn(async () => ({ companyId: COMPANY_ID, moduleCode: 'accounting', isEnabled: false, initialized: false })) };
    const postingLogRepo = { create: jest.fn(async () => undefined) };
    const bridge = new LegacyAccountingBridgeAdapter(bridgePostingService, moduleDisabled as any, postingLogRepo as any);

    const prod = buildUseCase(buildScenario(), { save: jest.fn(async (v: any) => v) }, bridge);
    const posted = await prod.useCase.execute(COMPANY_ID, prod.si.id);

    expect(bridgeRepo.save).not.toHaveBeenCalled();          // no GL voucher
    expect(postingLogRepo.create).toHaveBeenCalled();        // minimal journal recorded instead
    expect(posted.status).toBe('POSTED');                    // document still posts
    expect(posted.voucherId).toBeNull();                     // no revenue voucher id
    expect(posted.cogsVoucherId).toBeNull();                 // no COGS voucher id
  });
});


