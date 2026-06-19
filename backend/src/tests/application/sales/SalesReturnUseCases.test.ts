import { describe, expect, it, jest } from '@jest/globals';
import { Item } from '../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { DeliveryNote } from '../../../domain/sales/entities/DeliveryNote';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import { SalesReturn } from '../../../domain/sales/entities/SalesReturn';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import { PostSalesReturnUseCase } from '../../../application/sales/use-cases/SalesReturnUseCases';
import { SubledgerVoucherPostingService } from '../../../application/accounting/services/SubledgerVoucherPostingService';

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

const makeItemRepo = (item: Item) => ({
  getItem: jest.fn(async () => item),
  updateItemInTransaction: jest.fn(async (_companyId: string, _id: string, data: Partial<Item>) => {
    Object.assign(item as any, data);
  }),
});

const makeTaxCode = (): TaxCode =>
  new TaxCode({
    id: 'tax-1',
    companyId: COMPANY_ID,
    code: 'VAT10',
    name: 'VAT 10%',
    rate: 0.1,
    taxType: 'VAT',
    scope: 'SALES',
    salesTaxAccountId: 'TAX-100',
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeSO = (): SalesOrder =>
  new SalesOrder({
    id: 'so-1',
    companyId: COMPANY_ID,
    orderNumber: 'SO-00001',
    customerId: 'cus-1',
    customerName: 'Customer One',
    orderDate: '2026-01-10',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'so-line-1',
        lineNo: 1,
        itemId: 'item-1',
        itemCode: 'IT-1',
        itemName: 'Stock Item',
        itemType: 'PRODUCT',
        trackInventory: true,
        orderedQty: 10,
        uom: 'EA',
        deliveredQty: 5,
        invoicedQty: 5,
        returnedQty: 0,
        unitPriceDoc: 10,
        lineTotalDoc: 100,
        unitPriceBase: 10,
        lineTotalBase: 100,
        taxRate: 0.1,
        taxAmountDoc: 10,
        taxAmountBase: 10,
        warehouseId: 'wh-1',
      },
    ],
    subtotalBase: 100,
    taxTotalBase: 10,
    grandTotalBase: 110,
    subtotalDoc: 100,
    taxTotalDoc: 10,
    grandTotalDoc: 110,
    status: 'PARTIALLY_DELIVERED',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makePostedSI = (): SalesInvoice =>
  new SalesInvoice({
    id: 'si-1',
    companyId: COMPANY_ID,
    invoiceNumber: 'SI-00001',
    formType: 'sales_invoice_direct',
    voucherType: 'sales_invoice',
    persona: 'direct',
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
        itemId: 'item-1',
        itemCode: 'IT-1',
        itemName: 'Stock Item',
        trackInventory: true,
        invoicedQty: 5,
        uom: 'EA',
        unitPriceDoc: 10,
        lineTotalDoc: 50,
        unitPriceBase: 10,
        lineTotalBase: 50,
        taxCodeId: 'tax-1',
        taxCode: 'VAT10',
        taxRate: 0.1,
        taxAmountDoc: 5,
        taxAmountBase: 5,
        warehouseId: 'wh-1',
        revenueAccountId: 'REV-100',
        cogsAccountId: 'COGS-100',
        inventoryAccountId: 'INV-100',
        unitCostBase: 4,
        lineCostBase: 20,
      },
    ],
    subtotalDoc: 50,
    taxTotalDoc: 5,
    grandTotalDoc: 55,
    subtotalBase: 50,
    taxTotalBase: 5,
    grandTotalBase: 55,
    paymentTermsDays: 30,
    paymentStatus: 'UNPAID',
    paidAmountBase: 0,
    outstandingAmountBase: 55,
    status: 'POSTED',
    voucherId: 'v-si-1',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
    postedAt: nowDate(),
  });

const makePostedDN = (): DeliveryNote =>
  new DeliveryNote({
    id: 'dn-1',
    companyId: COMPANY_ID,
    dnNumber: 'DN-00001',
    salesOrderId: 'so-1',
    customerId: 'cus-1',
    customerName: 'Customer One',
    deliveryDate: '2026-01-11',
    warehouseId: 'wh-1',
    lines: [
      {
        lineId: 'dn-line-1',
        lineNo: 1,
        soLineId: 'so-line-1',
        itemId: 'item-1',
        itemCode: 'IT-1',
        itemName: 'Stock Item',
        deliveredQty: 5,
        uom: 'EA',
        unitCostBase: 4,
        lineCostBase: 20,
        moveCurrency: 'USD',
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
        stockMovementId: 'mov-dn-1',
      },
    ],
    status: 'POSTED',
    cogsVoucherId: 'v-dn-cogs',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
    postedAt: nowDate(),
  });

const makeAfterInvoiceReturn = (): SalesReturn =>
  new SalesReturn({
    id: 'sr-1',
    companyId: COMPANY_ID,
    returnNumber: 'SR-00001',
    salesInvoiceId: 'si-1',
    salesOrderId: 'so-1',
    customerId: 'cus-1',
    customerName: 'Customer One',
    returnContext: 'AFTER_INVOICE',
    returnDate: '2026-01-15',
    warehouseId: 'wh-1',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'sr-line-1',
        lineNo: 1,
        siLineId: 'si-line-1',
        soLineId: 'so-line-1',
        itemId: 'item-1',
        itemCode: 'IT-1',
        itemName: 'Stock Item',
        returnQty: 2,
        uom: 'EA',
        unitPriceDoc: 10,
        unitPriceBase: 10,
        unitCostBase: 4,
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
        taxCodeId: 'tax-1',
        taxRate: 0.1,
        taxAmountDoc: 2,
        taxAmountBase: 2,
        revenueAccountId: 'REV-100',
        cogsAccountId: 'COGS-100',
        inventoryAccountId: 'INV-100',
        stockMovementId: null,
      },
    ],
    subtotalDoc: 20,
    taxTotalDoc: 2,
    grandTotalDoc: 22,
    subtotalBase: 20,
    taxTotalBase: 2,
    grandTotalBase: 22,
    reason: 'Damaged goods',
    status: 'DRAFT',
    revenueVoucherId: null,
    cogsVoucherId: null,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeBeforeInvoiceReturn = (): SalesReturn =>
  new SalesReturn({
    id: 'sr-2',
    companyId: COMPANY_ID,
    returnNumber: 'SR-00002',
    deliveryNoteId: 'dn-1',
    salesOrderId: 'so-1',
    customerId: 'cus-1',
    customerName: 'Customer One',
    returnContext: 'BEFORE_INVOICE',
    returnDate: '2026-01-15',
    warehouseId: 'wh-1',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'sr-line-2',
        lineNo: 1,
        dnLineId: 'dn-line-1',
        soLineId: 'so-line-1',
        itemId: 'item-1',
        itemCode: 'IT-1',
        itemName: 'Stock Item',
        returnQty: 2,
        uom: 'EA',
        unitCostBase: 4,
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
        cogsAccountId: 'COGS-100',
        inventoryAccountId: 'INV-100',
        stockMovementId: null,
      },
    ],
    subtotalDoc: 0,
    taxTotalDoc: 0,
    grandTotalDoc: 0,
    subtotalBase: 0,
    taxTotalBase: 0,
    grandTotalBase: 0,
    reason: 'Rejected lot',
    status: 'DRAFT',
    revenueVoucherId: null,
    cogsVoucherId: null,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeTransactionManager = () => ({
  runTransaction: jest.fn(async (operation: (transaction: any) => Promise<any>) => operation({ id: 'txn-1' })),
});

const makeStockLevel = (overrides: Partial<StockLevel> = {}): StockLevel =>
  new StockLevel({
    id: 'item-1_wh-1',
    companyId: COMPANY_ID,
    itemId: 'item-1',
    warehouseId: 'wh-1',
    qtyOnHand: 10,
    reservedQty: 0,
    avgCostBase: 4,
    avgCostCCY: 4,
    lastCostBase: 4,
    lastCostCCY: 4,
    postingSeq: 1,
    maxBusinessDate: '2026-01-12',
    totalMovements: 1,
    lastMovementId: 'mov-si-1',
    version: 1,
    updatedAt: nowDate(),
    ...overrides,
  });

const makeInventoryService = () => ({
  processIN: jest.fn(async () => ({ id: 'mov-return-1' })),
  processOUT: jest.fn(async () => ({ id: 'mov-out-unused' })),
  preFetchStockLevel: jest.fn(async () => makeStockLevel()),
  writeStockMovement: jest.fn(async () => undefined),
  writeStockLevel: jest.fn(async () => undefined),
});

const makeInventorySettingsRepository = (
  mode: 'PERIODIC' | 'INVOICE_DRIVEN' | 'PERPETUAL' = 'PERPETUAL'
) => ({
  getSettings: jest.fn(async () => ({
    accountingMode: mode,
    inventoryAccountingMethod: mode === 'PERPETUAL' ? 'PERPETUAL' : 'PERIODIC',
    defaultInventoryAssetAccountId: 'INV-100',
  })),
});

const makeCompanyModuleRepo = (initialized = true) => ({
  get: jest.fn(async () => ({
    companyId: COMPANY_ID,
    moduleKey: 'accounting',
    initialized,
  })),
});

describe('SalesReturn posting use-case (Phase 3)', () => {
  it('11) AFTER_INVOICE: creates RETURN_IN + Revenue reversal + COGS reversal', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const item = makeItem();
    const taxCode = makeTaxCode();
    const so = makeSO();
    const si = makePostedSI();
    const salesReturn = makeAfterInvoiceReturn();

    const returnStore = new Map([[salesReturn.id, salesReturn]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };
    const inventoryService = makeInventoryService();

    const useCase = new PostSalesReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => returnStore.get(id) ?? null),
        list: jest.fn(async () => []),
        update: jest.fn(async (entity: SalesReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      { getById: jest.fn(async () => si), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => taxCode) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      new SubledgerVoucherPostingService(
        voucherRepo as any,
        ledgerRepo as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, salesReturn.id);
    expect(posted.status).toBe('POSTED');
    expect(inventoryService.writeStockMovement).toHaveBeenCalledTimes(1);
    const movement = (inventoryService.writeStockMovement as any).mock.calls[0][0];
    expect(movement.movementType).toBe('RETURN_IN');
    expect(movement.referenceType).toBe('SALES_RETURN');

    expect(voucherRepo.save).toHaveBeenCalledTimes(2);
    const savedVouchers = (voucherRepo.save as any).mock.calls.map((args: any[]) => args[0]);
    const revenueVoucher = savedVouchers.find((v: any) => String(v.voucherNo).startsWith('SR-REV-'));
    const cogsVoucher = savedVouchers.find((v: any) => String(v.voucherNo).startsWith('SR-COGS-'));
    expect(revenueVoucher).toBeTruthy();
    expect(cogsVoucher).toBeTruthy();

    // Characterization (Task 178 — SR posts through SubledgerDocumentPoster):
    // both reversal vouchers are balanced, and the COGS-reversal voucher is a
    // single inventory-debit / COGS-credit pair (inventory comes back).
    expect(revenueVoucher.totalDebit).toBeCloseTo(revenueVoucher.totalCredit, 2);
    expect(cogsVoucher.totalDebit).toBeCloseTo(cogsVoucher.totalCredit, 2);
    expect(cogsVoucher.lines).toHaveLength(2);
    expect(cogsVoucher.lines.filter((l: any) => l.side === 'Debit')).toHaveLength(1);
    expect(cogsVoucher.lines.filter((l: any) => l.side === 'Credit')).toHaveLength(1);
  });

  it('12) BEFORE_INVOICE: creates RETURN_IN + COGS reversal only (no revenue reversal)', async () => {
    const settings = makeSettings('CONTROLLED');
    const customer = makeCustomer();
    const item = makeItem();
    const so = makeSO();
    const dn = makePostedDN();
    const salesReturn = makeBeforeInvoiceReturn();

    const returnStore = new Map([[salesReturn.id, salesReturn]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };
    const inventoryService = makeInventoryService();

    const useCase = new PostSalesReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => returnStore.get(id) ?? null),
        list: jest.fn(async () => []),
        update: jest.fn(async (entity: SalesReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => dn), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => makeTaxCode()) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      new SubledgerVoucherPostingService(
        voucherRepo as any,
        ledgerRepo as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, salesReturn.id);
    expect(posted.status).toBe('POSTED');
    expect(posted.revenueVoucherId).toBeNull();
    expect(inventoryService.writeStockMovement).toHaveBeenCalledTimes(1);
    expect(voucherRepo.save).toHaveBeenCalledTimes(1);
  });

  it('13) returnQty validation enforced', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const item = makeItem();
    const so = makeSO();
    const si = makePostedSI();
    const salesReturn = makeAfterInvoiceReturn();
    salesReturn.lines[0].returnQty = 6;

    const inventoryService = makeInventoryService();
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };

    const useCase = new PostSalesReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      { getById: jest.fn(async () => salesReturn), list: jest.fn(async () => []), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => si), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => makeTaxCode()) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      new SubledgerVoucherPostingService(
        voucherRepo as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    await expect(useCase.execute(COMPANY_ID, salesReturn.id)).rejects.toThrow(/exceeds invoiced qty/i);
    expect(inventoryService.writeStockMovement).not.toHaveBeenCalled();
    expect(voucherRepo.save).not.toHaveBeenCalled();
  });

  it('14) SO line returnedQty updated', async () => {
    const settings = makeSettings('CONTROLLED');
    const customer = makeCustomer();
    const item = makeItem();
    const so = makeSO();
    const dn = makePostedDN();
    const salesReturn = makeBeforeInvoiceReturn();

    const useCase = new PostSalesReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      { getById: jest.fn(async () => salesReturn), list: jest.fn(async () => []), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => dn), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => makeTaxCode()) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo() as any,
      new SubledgerVoucherPostingService(
        { save: jest.fn(async (voucher: any) => voucher), delete: jest.fn(async () => true) } as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    await useCase.execute(COMPANY_ID, salesReturn.id);
    expect(so.lines[0].returnedQty).toBe(2);
  });

  it('15) AFTER_INVOICE updates SI outstandingAmount', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const item = makeItem();
    const so = makeSO();
    const si = makePostedSI();
    const salesReturn = makeAfterInvoiceReturn();
    const salesInvoiceRepo = {
      getById: jest.fn(async () => si),
      update: jest.fn(async () => undefined),
    };

    const useCase = new PostSalesReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      { getById: jest.fn(async () => salesReturn), list: jest.fn(async () => []), update: jest.fn(async () => undefined) } as any,
      salesInvoiceRepo as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => makeTaxCode()) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo() as any,
      new SubledgerVoucherPostingService(
        { save: jest.fn(async (voucher: any) => voucher), delete: jest.fn(async () => true) } as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    await useCase.execute(COMPANY_ID, salesReturn.id);
    expect(si.outstandingAmountBase).toBe(33);
    expect(salesInvoiceRepo.update).toHaveBeenCalled();
  });

  it('16) inventory failure does not create return vouchers or persist posted return', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const item = makeItem();
    const so = makeSO();
    const si = makePostedSI();
    const salesReturn = makeAfterInvoiceReturn();
    const salesReturnRepo = {
      getById: jest.fn(async () => salesReturn),
      list: jest.fn(async () => []),
      update: jest.fn(async () => undefined),
    };
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const inventoryService = {
      ...makeInventoryService(),
      writeStockMovement: jest.fn(async () => {
        throw new Error('Inventory failed');
      }),
    };

    const useCase = new PostSalesReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      salesReturnRepo as any,
      { getById: jest.fn(async () => si), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => makeTaxCode()) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      new SubledgerVoucherPostingService(
        voucherRepo as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    await expect(useCase.execute(COMPANY_ID, salesReturn.id)).rejects.toThrow('Inventory failed');
    expect(voucherRepo.save).not.toHaveBeenCalled();
    expect(salesReturnRepo.update).not.toHaveBeenCalled();
  });

  it('17) accounting failure does not persist posted return, SI, or SO updates', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const item = makeItem();
    const so = makeSO();
    const si = makePostedSI();
    const salesReturn = makeAfterInvoiceReturn();
    const salesReturnRepo = {
      getById: jest.fn(async () => salesReturn),
      list: jest.fn(async () => []),
      update: jest.fn(async () => undefined),
    };
    const salesInvoiceRepo = {
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

    const useCase = new PostSalesReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      salesReturnRepo as any,
      salesInvoiceRepo as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      salesOrderRepo as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => makeTaxCode()) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo() as any,
      new SubledgerVoucherPostingService(
        voucherRepo as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    await expect(useCase.execute(COMPANY_ID, salesReturn.id)).rejects.toThrow('Accounting failed');
    expect(salesReturnRepo.update).not.toHaveBeenCalled();
    expect(salesInvoiceRepo.update).not.toHaveBeenCalled();
    expect(salesOrderRepo.update).not.toHaveBeenCalled();
  });

  it('18) PERPETUAL: zero cost blocks posting', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const item = makeItem();
    const so = makeSO();
    const si = makePostedSI();
    si.lines[0].unitCostBase = 0;
    si.lines[0].lineCostBase = 0;
    const salesReturn = makeAfterInvoiceReturn();
    salesReturn.lines[0].unitCostBase = 0;

    const salesReturnRepo = {
      getById: jest.fn(async () => salesReturn),
      list: jest.fn(async () => []),
      update: jest.fn(async () => undefined),
    };
    const salesInvoiceRepo = {
      getById: jest.fn(async () => si),
      update: jest.fn(async () => undefined),
    };
    const inventoryService = {
      ...makeInventoryService(),
      preFetchStockLevel: jest.fn(async () => makeStockLevel({
        qtyOnHand: 0,
        avgCostBase: 0,
        avgCostCCY: 0,
        lastCostBase: 0,
        lastCostCCY: 0,
      })),
    };
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };

    const useCase = new PostSalesReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERPETUAL') as any,
      salesReturnRepo as any,
      salesInvoiceRepo as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => makeTaxCode()) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      new SubledgerVoucherPostingService(
        voucherRepo as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    await expect(useCase.execute(COMPANY_ID, salesReturn.id)).rejects.toThrow('Missing positive inventory cost');
    expect(inventoryService.writeStockMovement).not.toHaveBeenCalled();
    expect(voucherRepo.save).not.toHaveBeenCalled();
    expect(salesReturnRepo.update).not.toHaveBeenCalled();
    expect(salesInvoiceRepo.update).not.toHaveBeenCalled();
  });

  it('19) AFTER_INVOICE: recovers missing return cost from stock level cost snapshot', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const item = makeItem();
    const so = makeSO();
    const si = makePostedSI();
    si.lines[0].unitCostBase = 0;
    si.lines[0].lineCostBase = 0;
    const salesReturn = makeAfterInvoiceReturn();
    salesReturn.lines[0].unitCostBase = 0;

    const returnStore = new Map([[salesReturn.id, salesReturn]]);
    const inventoryService = {
      ...makeInventoryService(),
      preFetchStockLevel: jest.fn(async () => makeStockLevel({
        qtyOnHand: 8,
        avgCostBase: 3.5,
        avgCostCCY: 3.5,
        lastCostBase: 4.25,
        lastCostCCY: 4.25,
      })),
    };

    const useCase = new PostSalesReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => returnStore.get(id) ?? null),
        list: jest.fn(async () => []),
        update: jest.fn(async (entity: SalesReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      { getById: jest.fn(async () => si), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => makeTaxCode()) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo(false) as any,
      new SubledgerVoucherPostingService(
        { save: jest.fn(async (voucher: any) => voucher), delete: jest.fn(async () => true) } as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, salesReturn.id);
    expect(posted.status).toBe('POSTED');
    expect(posted.lines[0].unitCostBase).toBe(3.5);
    const movement = (inventoryService.writeStockMovement as any).mock.calls[0][0];
    expect(movement.unitCostBase).toBe(3.5);
  });

  it('20) INVOICE_DRIVEN: zero cost allowed, movement marked unsettled', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const item = makeItem();
    const so = makeSO();
    const si = makePostedSI();
    si.lines[0].unitCostBase = 0;
    si.lines[0].lineCostBase = 0;
    const salesReturn = makeAfterInvoiceReturn();
    salesReturn.lines[0].unitCostBase = 0;

    const returnStore = new Map([[salesReturn.id, salesReturn]]);
    const inventoryService = {
      ...makeInventoryService(),
      preFetchStockLevel: jest.fn(async () => makeStockLevel({
        qtyOnHand: 0,
        avgCostBase: 0,
        avgCostCCY: 0,
        lastCostBase: 0,
        lastCostCCY: 0,
      })),
    };

    const useCase = new PostSalesReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('INVOICE_DRIVEN') as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => returnStore.get(id) ?? null),
        list: jest.fn(async () => []),
        update: jest.fn(async (entity: SalesReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      { getById: jest.fn(async () => si), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => makeTaxCode()) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      new SubledgerVoucherPostingService(
        { save: jest.fn(async (voucher: any) => voucher), delete: jest.fn(async () => true) } as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, salesReturn.id);
    expect(posted.status).toBe('POSTED');
    const movement = (inventoryService.writeStockMovement as any).mock.calls[0][0];
    expect(movement.costSettled).toBe(false);
  });

  const makeDirectReturn = (): SalesReturn =>
    new SalesReturn({
      id: 'sr-3',
      companyId: COMPANY_ID,
      returnNumber: 'SR-00003',
      customerId: 'cus-1',
      customerName: 'Customer One',
      returnContext: 'DIRECT',
      returnDate: '2026-02-15',
      warehouseId: 'wh-1',
      currency: 'USD',
      exchangeRate: 1,
      lines: [{
        lineId: 'sr-line-3', lineNo: 1,
        itemId: 'item-1', itemCode: 'IT-1', itemName: 'Stock Item',
        returnQty: 10, uom: 'EA',
        unitPriceDoc: 10, unitPriceBase: 10,
        unitCostBase: 0,
        fxRateMovToBase: 1, fxRateCCYToBase: 1,
        taxRate: 0, taxAmountDoc: 0, taxAmountBase: 0,
        stockMovementId: null,
      }],
      subtotalDoc: 100, taxTotalDoc: 0, grandTotalDoc: 100,
      subtotalBase: 100, taxTotalBase: 0, grandTotalBase: 100,
      reason: 'Customer return',
      status: 'DRAFT',
      revenueVoucherId: null, cogsVoucherId: null,
      createdBy: USER_ID,
      createdAt: nowDate(), updatedAt: nowDate(),
    });

  it('21) DIRECT standalone return posts in INVOICE_DRIVEN mode', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const item = makeItem();
    const salesReturn = makeDirectReturn();

    const returnStore = new Map([[salesReturn.id, salesReturn]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const inventoryService = makeInventoryService();

    const useCase = new PostSalesReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('INVOICE_DRIVEN') as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => returnStore.get(id) ?? null),
        list: jest.fn(async () => []),
        update: jest.fn(async (entity: SalesReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => makeTaxCode()) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      new SubledgerVoucherPostingService(
        voucherRepo as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, salesReturn.id);
    expect(posted.status).toBe('POSTED');
    expect(posted.revenueVoucherId).toBeTruthy();
    const savedVouchers = (voucherRepo.save as any).mock.calls.map((args: any[]) => args[0]);
    expect(savedVouchers.some((v: any) => v.voucherNo.startsWith('SR-REV-'))).toBe(true);
  });

  it('21b) AFTER_INVOICE return in PERIODIC mode posts revenue reversal only and never creates a COGS reversal voucher', async () => {
    const settings = makeSettings('SIMPLE', {
      defaultSalesReturnAccountId: 'SALES-RET-100',
    });
    const customer = makeCustomer();
    const item = makeItem();
    const so = makeSO();
    const si = makePostedSI();
    const salesReturn = makeAfterInvoiceReturn();

    const returnStore = new Map([[salesReturn.id, salesReturn]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const inventoryService = makeInventoryService();

    const useCase = new PostSalesReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => returnStore.get(id) ?? null),
        list: jest.fn(async () => []),
        update: jest.fn(async (entity: SalesReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      { getById: jest.fn(async () => si), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => makeTaxCode()) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      new SubledgerVoucherPostingService(
        voucherRepo as any,
        { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) } as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, salesReturn.id);
    expect(posted.status).toBe('POSTED');
    expect(inventoryService.writeStockMovement).toHaveBeenCalledTimes(1);
    expect(voucherRepo.save).toHaveBeenCalledTimes(1);
    expect(posted.cogsVoucherId).toBeNull();

    const revenueVoucher = (voucherRepo.save as any).mock.calls[0][0];
    expect(revenueVoucher.lines.some((line: any) => line.accountId === 'SALES-RET-100' && line.side === 'Debit')).toBe(true);
    expect(revenueVoucher.lines.some((line: any) => line.accountId === 'COGS-100')).toBe(false);
    expect(revenueVoucher.lines.some((line: any) => line.accountId === 'INV-100')).toBe(false);
  });

  it('22) DIRECT standalone return blocked in PERPETUAL mode', async () => {
    const settings = makeSettings('CONTROLLED');
    const salesReturn = makeDirectReturn();

    const useCase = new PostSalesReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERPETUAL') as any,
      { getById: jest.fn(async () => salesReturn), list: jest.fn(async () => []), update: jest.fn(async () => undefined) } as any,
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo() as any,
      {} as any, undefined, {} as any
    );

    await expect(useCase.execute(COMPANY_ID, salesReturn.id)).rejects.toThrow('Standalone returns require a source document');
  });

  it('23) CREDIT_NOTE with restocking fee reduces SI outstanding by net settlement only', async () => {
    const settings = makeSettings('SIMPLE');
    const customer = makeCustomer();
    const item = makeItem();
    const so = makeSO();
    const si = makePostedSI();
    const salesReturn = makeAfterInvoiceReturn();
    salesReturn.restockingFeeType = 'AMOUNT';
    salesReturn.restockingFeeValue = 2;
    salesReturn.recalculateMonetaryTotals();

    const returnStore = new Map([[salesReturn.id, salesReturn]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) };
    const salesInvoiceRepo = { getById: jest.fn(async () => si), update: jest.fn(async () => undefined) };

    const useCase = new PostSalesReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => returnStore.get(id) ?? null),
        list: jest.fn(async () => []),
        update: jest.fn(async (entity: SalesReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      salesInvoiceRepo as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => makeTaxCode()) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo() as any,
      new SubledgerVoucherPostingService(
        voucherRepo as any,
        ledgerRepo as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    await useCase.execute(COMPANY_ID, salesReturn.id);
    expect(si.outstandingAmountBase).toBe(35);
    expect(salesInvoiceRepo.update).toHaveBeenCalledTimes(1);

    const savedVouchers = (voucherRepo.save as any).mock.calls.map((args: any[]) => args[0]);
    const revenueVoucher = savedVouchers.find((v: any) => String(v.voucherNo).startsWith('SR-REV-'));
    const arCreditLine = revenueVoucher.lines.find((line: any) => line.accountId === 'AR-200' && line.side === 'Credit');
    expect(arCreditLine.baseAmount).toBe(20);
  });

  it('24) REFUND mode posts refund voucher and does not reduce SI outstanding', async () => {
    const settings = makeSettings('SIMPLE', {
      paymentMethodConfigs: [{ method: 'CASH', settlementAccountId: 'CASH-1', isEnabled: true }],
    } as any);
    const customer = makeCustomer();
    const item = makeItem();
    const so = makeSO();
    const si = makePostedSI();
    const salesReturn = makeAfterInvoiceReturn();
    salesReturn.settlementMode = 'REFUND';
    salesReturn.recalculateMonetaryTotals();

    const returnStore = new Map([[salesReturn.id, salesReturn]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) };
    const salesInvoiceRepo = { getById: jest.fn(async () => si), update: jest.fn(async () => undefined) };

    const useCase = new PostSalesReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository() as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => returnStore.get(id) ?? null),
        list: jest.fn(async () => []),
        update: jest.fn(async (entity: SalesReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      salesInvoiceRepo as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => customer) } as any,
      { getById: jest.fn(async () => makeTaxCode()) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo() as any,
      new SubledgerVoucherPostingService(
        voucherRepo as any,
        ledgerRepo as any,
        { getBaseCurrency: jest.fn(async () => 'USD') } as any
      ),
      undefined,
      makeTransactionManager() as any
    );

    await useCase.execute(COMPANY_ID, salesReturn.id);
    expect(si.outstandingAmountBase).toBe(55);
    expect(salesInvoiceRepo.update).not.toHaveBeenCalled();

    const savedVouchers = (voucherRepo.save as any).mock.calls.map((args: any[]) => args[0]);
    expect(savedVouchers.some((v: any) => String(v.voucherNo).startsWith('SR-REF-'))).toBe(true);
  });
});
