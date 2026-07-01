import { describe, expect, it, jest } from '@jest/globals';
import { Item } from '../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { GoodsReceipt } from '../../../domain/purchases/entities/GoodsReceipt';
import { PurchaseInvoice } from '../../../domain/purchases/entities/PurchaseInvoice';
import { PurchaseOrder } from '../../../domain/purchases/entities/PurchaseOrder';
import { PurchaseReturn } from '../../../domain/purchases/entities/PurchaseReturn';
import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import {
  CreatePurchaseReturnUseCase,
  PostPurchaseReturnUseCase,
} from '../../../application/purchases/use-cases/PurchaseReturnUseCases';
import { VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { SubledgerVoucherPostingService } from '../../../application/accounting/services/SubledgerVoucherPostingService';
import { LegacyAccountingBridgeAdapter } from '../../../application/system-core/adapters/LegacyAccountingBridgeAdapter';

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

const makeItem = (overrides: Partial<Item> = {}): Item =>
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
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
    ...(overrides as any),
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
    scope: 'PURCHASE',
    purchaseTaxAccountId: 'TAX-100',
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makePO = (): PurchaseOrder =>
  new PurchaseOrder({
    id: 'po-1',
    companyId: COMPANY_ID,
    orderNumber: 'PO-00001',
    vendorId: 'ven-1',
    vendorName: 'Vendor One',
    orderDate: '2026-01-10',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'po-line-1',
        lineNo: 1,
        itemId: 'item-1',
        itemCode: 'IT-1',
        itemName: 'Stock Item',
        itemType: 'PRODUCT',
        trackInventory: true,
        orderedQty: 10,
        uom: 'EA',
        receivedQty: 5,
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
    status: 'PARTIALLY_RECEIVED',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makePostedPI = (): PurchaseInvoice =>
  new PurchaseInvoice({
    id: 'pi-1',
    companyId: COMPANY_ID,
    invoiceNumber: 'PI-00001',
    formType: 'purchase_invoice_linked',
    voucherType: 'purchase_invoice',
    persona: 'linked',
    purchaseOrderId: 'po-1',
    vendorId: 'ven-1',
    vendorName: 'Vendor One',
    invoiceDate: '2026-01-12',
    dueDate: '2026-02-11',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'pi-line-1',
        lineNo: 1,
        poLineId: 'po-line-1',
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
        accountId: 'INV-100',
        stockMovementId: 'mov-origin-1',
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
    voucherId: 'v-pi-1',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
    postedAt: nowDate(),
  });

const makePostedGRN = (): GoodsReceipt =>
  new GoodsReceipt({
    id: 'grn-1',
    companyId: COMPANY_ID,
    grnNumber: 'GRN-00001',
    purchaseOrderId: 'po-1',
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
        itemId: 'item-1',
        itemCode: 'IT-1',
        itemName: 'Stock Item',
        receivedQty: 5,
        uom: 'EA',
        unitCostDoc: 10,
        unitCostBase: 10,
        moveCurrency: 'USD',
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
        stockMovementId: 'mov-grn-1',
      },
    ],
    status: 'POSTED',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
    postedAt: nowDate(),
  });

const makeAfterInvoiceReturn = (): PurchaseReturn =>
  new PurchaseReturn({
    id: 'pr-1',
    companyId: COMPANY_ID,
    returnNumber: 'PR-00001',
    purchaseInvoiceId: 'pi-1',
    purchaseOrderId: 'po-1',
    vendorId: 'ven-1',
    vendorName: 'Vendor One',
    returnContext: 'AFTER_INVOICE',
    returnDate: '2026-01-15',
    warehouseId: 'wh-1',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'pr-line-1',
        lineNo: 1,
        piLineId: 'pi-line-1',
        poLineId: 'po-line-1',
        itemId: 'item-1',
        itemCode: 'IT-1',
        itemName: 'Stock Item',
        returnQty: 2,
        uom: 'EA',
        unitCostDoc: 10,
        unitCostBase: 10,
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
        taxCodeId: 'tax-1',
        taxCode: 'VAT10',
        taxRate: 0.1,
        taxAmountDoc: 2,
        taxAmountBase: 2,
        accountId: 'INV-100',
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
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeBeforeInvoiceReturn = (): PurchaseReturn =>
  new PurchaseReturn({
    id: 'pr-2',
    companyId: COMPANY_ID,
    returnNumber: 'PR-00002',
    goodsReceiptId: 'grn-1',
    purchaseOrderId: 'po-1',
    vendorId: 'ven-1',
    vendorName: 'Vendor One',
    returnContext: 'BEFORE_INVOICE',
    returnDate: '2026-01-15',
    warehouseId: 'wh-1',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'pr-line-2',
        lineNo: 1,
        grnLineId: 'grn-line-1',
        poLineId: 'po-line-1',
        itemId: 'item-1',
        itemCode: 'IT-1',
        itemName: 'Stock Item',
        returnQty: 2,
        uom: 'EA',
        unitCostDoc: 10,
        unitCostBase: 10,
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
        stockMovementId: null,
      },
    ],
    subtotalDoc: 20,
    taxTotalDoc: 0,
    grandTotalDoc: 20,
    subtotalBase: 20,
    taxTotalBase: 0,
    grandTotalBase: 20,
    reason: 'Rejected lot',
    status: 'DRAFT',
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

const makeInventoryService = () => ({
  processOUT: jest.fn(async () => ({ id: 'mov-return-1' })),
  preFetchStockLevel: jest.fn(async () => makeStockLevel()),
  writeStockMovement: jest.fn(async () => {}),
  writeStockLevel: jest.fn(async () => {}),
  deleteMovement: jest.fn(async () => {}),
});

const makeAccountRepo = () => ({
  getById: jest.fn(async (_companyId: string, id: string) => ({ id })),
  getByUserCode: jest.fn(async (_companyId: string, code: string) => ({ id: code })),
});

const makeInventorySettingsRepository = (
  mode: 'PERIODIC' | 'INVOICE_DRIVEN' | 'PERPETUAL' = 'PERIODIC'
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

describe('PurchaseReturn creation use-case', () => {
  it('creates DIRECT taxable return lines with real base cost and inclusive tax split', async () => {
    const settings = makeSettings('SIMPLE', {
      defaultPurchaseReturnAccountId: 'PUR-RET-100',
      prNumberPrefix: 'PR',
      prNumberNextSeq: 7,
    });
    const item = makeItem();
    const taxCode = new TaxCode({
      id: 'tax-inc',
      companyId: COMPANY_ID,
      code: 'VAT10INC',
      name: 'VAT 10 Inclusive',
      rate: 0.1,
      taxType: 'VAT',
      scope: 'PURCHASE',
      purchaseTaxAccountId: 'TAX-100',
      priceIsInclusive: true,
      active: true,
      createdBy: USER_ID,
      createdAt: nowDate(),
      updatedAt: nowDate(),
    });
    let createdReturn: PurchaseReturn | null = null;

    const useCase = new CreatePurchaseReturnUseCase(
      {
        getSettings: jest.fn(async () => settings),
        saveSettings: jest.fn(async () => undefined),
      } as any,
      {
        create: jest.fn(async (entity: PurchaseReturn) => { createdReturn = entity; }),
      } as any,
      { getById: jest.fn(async () => null) } as any,
      { getById: jest.fn(async () => null) } as any,
      { getById: jest.fn(async () => makeVendor()) } as any,
      makeItemRepo(item) as any,
      { getById: jest.fn(async () => taxCode) } as any
    );

    const result = await useCase.execute({
      companyId: COMPANY_ID,
      vendorId: 'ven-1',
      returnDate: '2026-01-15',
      warehouseId: 'wh-1',
      currency: 'USD',
      exchangeRate: 1,
      reason: 'Direct vendor credit',
      createdBy: USER_ID,
      lines: [{
        itemId: 'item-1',
        returnQty: 2,
        unitCostDoc: 110,
        taxCodeId: 'tax-inc',
      }],
    });

    expect(createdReturn).toBe(result);
    expect(result.returnContext).toBe('DIRECT');
    expect(result.lines[0].taxCodeId).toBe('tax-inc');
    expect(result.lines[0].taxRate).toBe(0.1);
    expect(result.lines[0].priceIsInclusive).toBe(true);
    expect(result.lines[0].unitCostBase).toBe(110);
    expect(result.subtotalDoc).toBeCloseTo(200, 2);
    expect(result.taxTotalDoc).toBeCloseTo(20, 2);
    expect(result.grandTotalDoc).toBeCloseTo(220, 2);
  });
});

describe('PurchaseReturn posting use-case (Phase 3)', () => {
  it('1) AFTER_INVOICE return in PERIODIC mode: creates PURCHASE_RETURN OUT movement + GL voucher (Dr AP, Cr Purchase Returns)', async () => {
    const settings = makeSettings('SIMPLE', {
      defaultPurchaseReturnAccountId: 'PUR-RET-100',
    });
    const vendor = makeVendor();
    const item = makeItem();
    const taxCode = makeTaxCode();
    const po = makePO();
    const pi = makePostedPI();
    const purchaseReturn = makeAfterInvoiceReturn();

    const returnStore = new Map([[purchaseReturn.id, purchaseReturn]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };
    const inventoryService = makeInventoryService();

    const useCase = new PostPurchaseReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => returnStore.get(id) ?? null),
        list: jest.fn(async () => []),
        update: jest.fn(async (entity: PurchaseReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      { getSettings: jest.fn(async () => null) } as any, // companySettingsRepo
      {
        getById: jest.fn(async () => pi),
        update: jest.fn(async () => undefined),
      } as any,
      {
        getById: jest.fn(async () => null),
        list: jest.fn(async () => []),
      } as any,
      {
        getById: jest.fn(async () => po),
        update: jest.fn(async () => undefined),
      } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => taxCode) } as any,
      makeItemRepo(item) as any,
      { getById: jest.fn(async () => ({ defaultInventoryAccountId: 'INV-100' })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      makeAccountRepo() as any,
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

    const posted = await useCase.execute(COMPANY_ID, purchaseReturn.id);
    expect(posted.status).toBe('POSTED');
    expect(inventoryService.writeStockMovement).toHaveBeenCalledTimes(1);
    const movementInput = (inventoryService.writeStockMovement as any).mock.calls[0][0];
    expect(movementInput.movementType).toBe('RETURN_OUT');
    expect(movementInput.referenceType).toBe('PURCHASE_RETURN');

    expect(voucherRepo.save).toHaveBeenCalledTimes(1);
    const savedVoucher = (voucherRepo.save as any).mock.calls[0][0];
    expect(savedVoucher.type).toBe(VoucherType.PURCHASE_RETURN);
    const hasAPDebit = savedVoucher.lines.some((line: any) => line.accountId === 'AP-200' && line.side === 'Debit');
    const hasPeriodicReturnCredit = savedVoucher.lines.some((line: any) => line.accountId === 'PUR-RET-100' && line.side === 'Credit');
    const hasInventoryCredit = savedVoucher.lines.some((line: any) => line.accountId === 'INV-100' && line.side === 'Credit');
    expect(hasAPDebit).toBe(true);
    expect(hasPeriodicReturnCredit).toBe(true);
    expect(hasInventoryCredit).toBe(false);
  });

  it('2) BEFORE_INVOICE return: creates PURCHASE_RETURN OUT movement, NO GL voucher', async () => {
    const settings = makeSettings('CONTROLLED');
    const vendor = makeVendor();
    const item = makeItem();
    const po = makePO();
    const grn = makePostedGRN();
    const purchaseReturn = makeBeforeInvoiceReturn();

    const returnStore = new Map([[purchaseReturn.id, purchaseReturn]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };
    const inventoryService = makeInventoryService();

    const useCase = new PostPurchaseReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => returnStore.get(id) ?? null),
        list: jest.fn(async () => []),
        update: jest.fn(async (entity: PurchaseReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      { getSettings: jest.fn(async () => null) } as any, // companySettingsRepo
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      {
        getById: jest.fn(async () => grn),
        list: jest.fn(async () => []),
      } as any,
      {
        getById: jest.fn(async () => po),
        update: jest.fn(async () => undefined),
      } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(item) as any,
      { getById: jest.fn(async () => ({ defaultInventoryAccountId: 'INV-100' })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      makeAccountRepo() as any,
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

    const posted = await useCase.execute(COMPANY_ID, purchaseReturn.id);
    expect(posted.status).toBe('POSTED');
    expect(inventoryService.writeStockMovement).toHaveBeenCalledTimes(1);
    expect(voucherRepo.save).not.toHaveBeenCalled();
    expect(ledgerRepo.recordForVoucher).not.toHaveBeenCalled();
  });

  it('3) BEFORE_INVOICE return: reduces PO line receivedQty', async () => {
    const settings = makeSettings('CONTROLLED');
    const vendor = makeVendor();
    const item = makeItem();
    const po = makePO();
    const grn = makePostedGRN();
    const purchaseReturn = makeBeforeInvoiceReturn();

    const useCase = new PostPurchaseReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      {
        getById: jest.fn(async () => purchaseReturn),
        list: jest.fn(async () => []),
        update: jest.fn(async () => undefined),
      } as any,
      { getSettings: jest.fn(async () => null) } as any, // companySettingsRepo
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => grn), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => po), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(item) as any,
      { getById: jest.fn(async () => ({ defaultInventoryAccountId: 'INV-100' })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo() as any,
      makeAccountRepo() as any,
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

    await useCase.execute(COMPANY_ID, purchaseReturn.id);
    expect(po.lines[0].receivedQty).toBe(3);
    expect(po.lines[0].returnedQty).toBe(2);
  });

  it('4) Return qty > invoiced qty blocks posting', async () => {
    const settings = makeSettings('SIMPLE', {
      defaultPurchaseReturnAccountId: 'PUR-RET-100',
    });
    const vendor = makeVendor();
    const item = makeItem();
    const po = makePO();
    const pi = makePostedPI();
    const purchaseReturn = makeAfterInvoiceReturn();
    purchaseReturn.lines[0].returnQty = 6;

    const inventoryService = makeInventoryService();
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };

    const useCase = new PostPurchaseReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      {
        getById: jest.fn(async () => purchaseReturn),
        list: jest.fn(async () => []),
        update: jest.fn(async () => undefined),
      } as any,
      { getSettings: jest.fn(async () => null) } as any, // companySettingsRepo
      { getById: jest.fn(async () => pi), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => po), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => makeTaxCode()) } as any,
      makeItemRepo(item) as any,
      { getById: jest.fn(async () => ({ defaultInventoryAccountId: 'INV-100' })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      makeAccountRepo() as any,
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

    await expect(useCase.execute(COMPANY_ID, purchaseReturn.id)).rejects.toThrow(/exceeds invoiced qty/i);
    expect(inventoryService.writeStockMovement).not.toHaveBeenCalled();
    expect(voucherRepo.save).not.toHaveBeenCalled();
  });

  it('5) Return qty > received qty (before invoice) blocks posting', async () => {
    const settings = makeSettings('CONTROLLED');
    const vendor = makeVendor();
    const item = makeItem();
    const po = makePO();
    const grn = makePostedGRN();
    const purchaseReturn = makeBeforeInvoiceReturn();
    purchaseReturn.lines[0].returnQty = 6;

    const inventoryService = makeInventoryService();
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };

    const useCase = new PostPurchaseReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      {
        getById: jest.fn(async () => purchaseReturn),
        list: jest.fn(async () => []),
        update: jest.fn(async () => undefined),
      } as any,
      { getSettings: jest.fn(async () => null) } as any, // companySettingsRepo
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => grn), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => po), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(item) as any,
      { getById: jest.fn(async () => ({ defaultInventoryAccountId: 'INV-100' })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      inventoryService as any,
      makeCompanyModuleRepo() as any,
      makeAccountRepo() as any,
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

    await expect(useCase.execute(COMPANY_ID, purchaseReturn.id)).rejects.toThrow(/exceeds received qty/i);
    expect(inventoryService.writeStockMovement).not.toHaveBeenCalled();
    expect(voucherRepo.save).not.toHaveBeenCalled();
  });

  it('6) Multi-currency return with rate difference: posts exchange difference to global account if module account is missing', async () => {
    // Original Invoice: Rate 1.2
    // Return: Rate 1.5
    const settings = makeSettings('SIMPLE', {
      defaultPurchaseReturnAccountId: 'PUR-RET-100',
    });
    const vendor = makeVendor({ defaultCurrency: 'EUR' });
    const item = makeItem();
    const pi = makePostedPI(); 
    pi.currency = 'EUR';
    pi.exchangeRate = 1.2;
    pi.lines[0].unitPriceBase = 12;
    pi.lines[0].unitPriceDoc = 10;
    
    const purchaseReturn = makeAfterInvoiceReturn();
    purchaseReturn.currency = 'EUR';
    purchaseReturn.exchangeRate = 1.5; 
    purchaseReturn.lines[0].unitCostBase = 12; // Original base cost
    purchaseReturn.lines[0].unitCostDoc = 10;
    
    // grandTotalDoc is 22 (20 cost + 2 tax).
    // apDebitBase = 22 * 1.5 = 33.
    // grandTotalBase stays 26.4 from the frozen line base values.
    // Diff = 33 - 26.4 = 6.6.

    const globalSettings = { companyId: COMPANY_ID, exchangeGainLossAccountId: 'GLOBAL-FX-AC' };
    const returnStore = new Map([[purchaseReturn.id, purchaseReturn]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };

    const useCase = new PostPurchaseReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      {
        getById: jest.fn(async (_companyId: string, id: string) => returnStore.get(id) ?? null),
        list: jest.fn(async () => []),
        update: jest.fn(async (entity: PurchaseReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      { getSettings: jest.fn(async () => globalSettings) } as any,
      {
        getById: jest.fn(async () => pi),
        update: jest.fn(async () => undefined),
      } as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => makePO()), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => makeTaxCode()) } as any,
      makeItemRepo(item) as any,
      { getById: jest.fn(async () => ({ defaultInventoryAccountId: 'INV-100' })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo() as any,
      makeAccountRepo() as any,
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

    await useCase.execute(COMPANY_ID, purchaseReturn.id);

    expect(voucherRepo.save).toHaveBeenCalledTimes(1);
    const savedVoucher = (voucherRepo.save as any).mock.calls[0][0];
    
    const fxLine = savedVoucher.lines.find((l: any) => l.accountId === 'GLOBAL-FX-AC');
    expect(fxLine).toBeDefined();
    expect(fxLine.side).toBe('Credit');
    expect(fxLine.baseAmount).toBe(6.6);
    expect(fxLine.amount).toBe(4.4);
    expect(savedVoucher.totalDebit).toBe(33);
    expect(savedVoucher.totalCredit).toBe(33);
  });

  it('7) AFTER_INVOICE return skips voucher creation when the Accounting Engine is not initialized', async () => {
    const settings = makeSettings('SIMPLE', {
      defaultPurchaseReturnAccountId: 'PUR-RET-100',
    });
    const vendor = makeVendor();
    const item = makeItem();
    const taxCode = makeTaxCode();
    const pi = makePostedPI();
    const purchaseReturn = makeAfterInvoiceReturn();

    const returnStore = new Map([[purchaseReturn.id, purchaseReturn]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined), deleteForVoucher: jest.fn(async () => undefined) };
    const purchaseInvoiceRepo = {
      getById: jest.fn(async () => pi),
      update: jest.fn(async () => undefined),
    };

    const useCase = new PostPurchaseReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      {
        getById: jest.fn(async (_companyId: string, returnId: string) => returnStore.get(returnId) ?? null),
        list: jest.fn(async () => []),
        update: jest.fn(async (entity: PurchaseReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      { getSettings: jest.fn(async () => null) } as any,
      purchaseInvoiceRepo as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => makePO()), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => taxCode) } as any,
      makeItemRepo(item) as any,
      { getById: jest.fn(async () => ({ defaultInventoryAccountId: 'INV-100' })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo(false) as any,
      makeAccountRepo() as any,
      makeTransactionManager() as any,
      new LegacyAccountingBridgeAdapter(
        new SubledgerVoucherPostingService(
          voucherRepo as any,
          ledgerRepo as any,
          { getBaseCurrency: jest.fn(async () => 'USD') } as any
        ),
        makeCompanyModuleRepo(false) as any
      )
    );

    const posted = await useCase.execute(COMPANY_ID, purchaseReturn.id);

    expect(posted.status).toBe('POSTED');
    expect(voucherRepo.save).not.toHaveBeenCalled();
    expect(ledgerRepo.recordForVoucher).not.toHaveBeenCalled();
    expect(posted.voucherId).toBeNull();
    expect(purchaseInvoiceRepo.update).toHaveBeenCalledTimes(1);
    expect(pi.outstandingAmountBase).toBe(33);
  });

  it('8) AFTER_INVOICE return honors the inherited line discount in the GL (AP reversal = NET, not gross) [GP04-step10 regression]', async () => {
    // PI line: 5 @ 10 = 50 gross, 5% line discount -> net 47.5 (no tax).
    // Before the fix the posting recompute + recalcReturnTotals used GROSS, so the
    // AP reversal posted 50 (vendor over-credited by the 2.5 discount) while the
    // document total was 47.5. Mirrors the PI line-discount fix (GP04-step5to8a).
    const settings = makeSettings('SIMPLE', {
      defaultPurchaseReturnAccountId: 'PUR-RET-100',
    });
    const vendor = makeVendor();
    const item = makeItem();

    const pi = new PurchaseInvoice({
      id: 'pi-d', companyId: COMPANY_ID, invoiceNumber: 'PI-D', formType: 'purchase_invoice_linked',
      voucherType: 'purchase_invoice', persona: 'linked', vendorId: 'ven-1', vendorName: 'Vendor One',
      invoiceDate: '2026-01-12', dueDate: '2026-02-11', currency: 'USD', exchangeRate: 1,
      lines: [{
        lineId: 'pi-line-d', lineNo: 1, itemId: 'item-1', itemCode: 'IT-1', itemName: 'Stock Item',
        trackInventory: true, invoicedQty: 50, uom: 'EA', unitPriceDoc: 10, lineTotalDoc: 475,
        unitPriceBase: 10, lineTotalBase: 475, discountType: 'PERCENT', discountValue: 5,
        taxRate: 0, taxAmountDoc: 0, taxAmountBase: 0, warehouseId: 'wh-1', accountId: 'INV-100',
        stockMovementId: 'mov-origin-d',
      }],
      subtotalDoc: 475, taxTotalDoc: 0, grandTotalDoc: 475, subtotalBase: 475, taxTotalBase: 0, grandTotalBase: 475,
      paymentTermsDays: 30, paymentStatus: 'UNPAID', paidAmountBase: 0, outstandingAmountBase: 475,
      status: 'POSTED', voucherId: 'v-pi-d', createdBy: USER_ID, createdAt: nowDate(), updatedAt: nowDate(), postedAt: nowDate(),
    });

    const purchaseReturn = new PurchaseReturn({
      id: 'pr-d', companyId: COMPANY_ID, returnNumber: 'PR-D', purchaseInvoiceId: 'pi-d',
      vendorId: 'ven-1', vendorName: 'Vendor One', returnContext: 'AFTER_INVOICE', returnDate: '2026-01-15',
      warehouseId: 'wh-1', currency: 'USD', exchangeRate: 1,
      lines: [{
        lineId: 'pr-line-d', lineNo: 1, piLineId: 'pi-line-d', itemId: 'item-1', itemCode: 'IT-1', itemName: 'Stock Item',
        returnQty: 5, uom: 'EA', unitCostDoc: 10, unitCostBase: 10, discountType: 'PERCENT', discountValue: 5,
        fxRateMovToBase: 1, fxRateCCYToBase: 1, taxRate: 0, taxAmountDoc: 0, taxAmountBase: 0,
        accountId: 'INV-100', stockMovementId: null,
      }],
      subtotalDoc: 47.5, taxTotalDoc: 0, grandTotalDoc: 47.5, subtotalBase: 47.5, taxTotalBase: 0, grandTotalBase: 47.5,
      reason: 'Damaged goods', status: 'DRAFT', createdBy: USER_ID, createdAt: nowDate(), updatedAt: nowDate(),
    });

    const returnStore = new Map([[purchaseReturn.id, purchaseReturn]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };

    const useCase = new PostPurchaseReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      {
        getById: jest.fn(async (_c: string, id: string) => returnStore.get(id) ?? null),
        list: jest.fn(async () => []),
        update: jest.fn(async (entity: PurchaseReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      { getSettings: jest.fn(async () => null) } as any,
      { getById: jest.fn(async () => pi), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => null) } as any,
      makeItemRepo(item) as any,
      { getById: jest.fn(async () => ({ defaultInventoryAccountId: 'INV-100' })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo() as any,
      makeAccountRepo() as any,
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

    const posted = await useCase.execute(COMPANY_ID, purchaseReturn.id);
    expect(posted.status).toBe('POSTED');
    expect(posted.grandTotalBase).toBeCloseTo(47.5, 2);

    const savedVoucher = (voucherRepo.save as any).mock.calls[0][0];
    const apLine = savedVoucher.lines.find((l: any) => l.accountId === 'AP-200' && l.side === 'Debit');
    const invLine = savedVoucher.lines.find((l: any) => l.accountId === 'PUR-RET-100' && l.side === 'Credit');
    expect(apLine).toBeTruthy();
    expect(invLine).toBeTruthy();
    // The whole point: NET 47.5, not GROSS 50.
    expect(apLine.baseAmount).toBeCloseTo(47.5, 2);
    expect(invLine.baseAmount).toBeCloseTo(47.5, 2);
    expect(apLine.baseAmount).not.toBeCloseTo(50, 2);
    // Voucher balances at the net.
    expect(savedVoucher.totalDebit).toBeCloseTo(savedVoucher.totalCredit, 2);
    expect(savedVoucher.totalDebit).toBeCloseTo(47.5, 2);
  });

  it('9) DIRECT taxable return posts a balanced AP debit, return credit, and purchase tax credit', async () => {
    const settings = makeSettings('SIMPLE', {
      defaultPurchaseReturnAccountId: 'PUR-RET-100',
    });
    const vendor = makeVendor();
    const item = makeItem();
    const taxCode = makeTaxCode();
    const purchaseReturn = new PurchaseReturn({
      id: 'pr-direct-tax',
      companyId: COMPANY_ID,
      returnNumber: 'PR-DIRECT',
      vendorId: 'ven-1',
      vendorName: 'Vendor One',
      returnContext: 'DIRECT',
      returnDate: '2026-01-15',
      warehouseId: 'wh-1',
      currency: 'USD',
      exchangeRate: 1,
      lines: [{
        lineId: 'pr-line-direct-tax',
        lineNo: 1,
        itemId: 'item-1',
        itemCode: 'IT-1',
        itemName: 'Stock Item',
        returnQty: 2,
        uom: 'EA',
        unitCostDoc: 10,
        unitCostBase: 10,
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
        taxCodeId: 'tax-1',
        taxCode: 'VAT10',
        taxRate: 0.1,
        taxAmountDoc: 2,
        taxAmountBase: 2,
        stockMovementId: null,
      }],
      subtotalDoc: 20,
      taxTotalDoc: 2,
      grandTotalDoc: 22,
      subtotalBase: 20,
      taxTotalBase: 2,
      grandTotalBase: 22,
      reason: 'Direct vendor credit',
      status: 'DRAFT',
      createdBy: USER_ID,
      createdAt: nowDate(),
      updatedAt: nowDate(),
    });

    const returnStore = new Map([[purchaseReturn.id, purchaseReturn]]);
    const voucherRepo = { save: jest.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) };

    const useCase = new PostPurchaseReturnUseCase(
      { getSettings: jest.fn(async () => settings) } as any,
      makeInventorySettingsRepository('PERIODIC') as any,
      {
        getById: jest.fn(async (_c: string, id: string) => returnStore.get(id) ?? null),
        list: jest.fn(async () => []),
        update: jest.fn(async (entity: PurchaseReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      { getSettings: jest.fn(async () => null) } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => null), list: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => vendor) } as any,
      { getById: jest.fn(async () => taxCode) } as any,
      makeItemRepo(item) as any,
      { getById: jest.fn(async () => ({ defaultInventoryAccountId: 'INV-100' })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      makeCompanyModuleRepo() as any,
      makeAccountRepo() as any,
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

    const posted = await useCase.execute(COMPANY_ID, purchaseReturn.id);
    expect(posted.status).toBe('POSTED');
    expect(posted.grandTotalBase).toBeCloseTo(22, 2);

    const savedVoucher = (voucherRepo.save as any).mock.calls[0][0];
    const apLine = savedVoucher.lines.find((l: any) => l.accountId === 'AP-200' && l.side === 'Debit');
    const returnLine = savedVoucher.lines.find((l: any) => l.accountId === 'PUR-RET-100' && l.side === 'Credit');
    const taxLine = savedVoucher.lines.find((l: any) => l.accountId === 'TAX-100' && l.side === 'Credit');

    expect(apLine?.baseAmount).toBeCloseTo(22, 2);
    expect(returnLine?.baseAmount).toBeCloseTo(20, 2);
    expect(taxLine?.baseAmount).toBeCloseTo(2, 2);
    expect(savedVoucher.totalDebit).toBeCloseTo(savedVoucher.totalCredit, 2);
    expect(savedVoucher.totalDebit).toBeCloseTo(22, 2);
  });
});


