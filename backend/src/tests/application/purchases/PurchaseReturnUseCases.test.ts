import { describe, expect, it, vi } from 'vitest';
import { Item } from '../../../domain/inventory/entities/Item';
import { GoodsReceipt } from '../../../domain/purchases/entities/GoodsReceipt';
import { PurchaseInvoice } from '../../../domain/purchases/entities/PurchaseInvoice';
import { PurchaseOrder } from '../../../domain/purchases/entities/PurchaseOrder';
import { PurchaseReturn } from '../../../domain/purchases/entities/PurchaseReturn';
import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import { PostPurchaseReturnUseCase } from '../../../application/purchases/use-cases/PurchaseReturnUseCases';

const COMPANY_ID = 'cmp-1';
const USER_ID = 'u-1';

const nowDate = () => new Date('2026-01-01T00:00:00.000Z');

const makeSettings = (
  mode: 'SIMPLE' | 'CONTROLLED',
  overrides: Partial<PurchaseSettings> = {}
): PurchaseSettings =>
  new PurchaseSettings({
    companyId: COMPANY_ID,
    procurementControlMode: mode,
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
  runTransaction: vi.fn(async (operation: (transaction: any) => Promise<any>) => operation({ id: 'txn-1' })),
});

const makeInventoryService = () => ({
  processOUT: vi.fn(async () => ({ id: 'mov-return-1' })),
});

describe('PurchaseReturn posting use-case (Phase 3)', () => {
  it('1) AFTER_INVOICE return: creates PURCHASE_RETURN OUT movement + GL voucher (Dr AP, Cr Inventory)', async () => {
    const settings = makeSettings('SIMPLE');
    const vendor = makeVendor();
    const item = makeItem();
    const taxCode = makeTaxCode();
    const po = makePO();
    const pi = makePostedPI();
    const purchaseReturn = makeAfterInvoiceReturn();

    const returnStore = new Map([[purchaseReturn.id, purchaseReturn]]);
    const voucherRepo = { save: vi.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: vi.fn(async () => undefined) };
    const inventoryService = makeInventoryService();

    const useCase = new PostPurchaseReturnUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      {
        getById: vi.fn(async (_companyId: string, id: string) => returnStore.get(id) ?? null),
        list: vi.fn(async () => []),
        update: vi.fn(async (entity: PurchaseReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      {
        getById: vi.fn(async () => pi),
        update: vi.fn(async () => undefined),
      } as any,
      {
        getById: vi.fn(async () => null),
        list: vi.fn(async () => []),
      } as any,
      {
        getById: vi.fn(async () => po),
        update: vi.fn(async () => undefined),
      } as any,
      { getById: vi.fn(async () => vendor) } as any,
      { getById: vi.fn(async () => taxCode) } as any,
      { getItem: vi.fn(async () => item) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      inventoryService as any,
      voucherRepo as any,
      ledgerRepo as any,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, purchaseReturn.id);
    expect(posted.status).toBe('POSTED');
    expect(inventoryService.processOUT).toHaveBeenCalledTimes(1);
    const movementInput = (inventoryService.processOUT as any).mock.calls[0][0];
    expect(movementInput.movementType).toBe('RETURN_OUT');
    expect(movementInput.refs.type).toBe('PURCHASE_RETURN');

    expect(voucherRepo.save).toHaveBeenCalledTimes(1);
    const savedVoucher = (voucherRepo.save as any).mock.calls[0][0];
    const hasAPDebit = savedVoucher.lines.some((line: any) => line.accountId === 'AP-200' && line.side === 'Debit');
    const hasInventoryCredit = savedVoucher.lines.some((line: any) => line.accountId === 'INV-100' && line.side === 'Credit');
    expect(hasAPDebit).toBe(true);
    expect(hasInventoryCredit).toBe(true);
  });

  it('2) BEFORE_INVOICE return: creates PURCHASE_RETURN OUT movement, NO GL voucher', async () => {
    const settings = makeSettings('CONTROLLED');
    const vendor = makeVendor();
    const item = makeItem();
    const po = makePO();
    const grn = makePostedGRN();
    const purchaseReturn = makeBeforeInvoiceReturn();

    const returnStore = new Map([[purchaseReturn.id, purchaseReturn]]);
    const voucherRepo = { save: vi.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: vi.fn(async () => undefined) };
    const inventoryService = makeInventoryService();

    const useCase = new PostPurchaseReturnUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      {
        getById: vi.fn(async (_companyId: string, id: string) => returnStore.get(id) ?? null),
        list: vi.fn(async () => []),
        update: vi.fn(async (entity: PurchaseReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      { getById: vi.fn(async () => null), update: vi.fn(async () => undefined) } as any,
      {
        getById: vi.fn(async () => grn),
        list: vi.fn(async () => []),
      } as any,
      {
        getById: vi.fn(async () => po),
        update: vi.fn(async () => undefined),
      } as any,
      { getById: vi.fn(async () => vendor) } as any,
      { getById: vi.fn(async () => null) } as any,
      { getItem: vi.fn(async () => item) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      inventoryService as any,
      voucherRepo as any,
      ledgerRepo as any,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, purchaseReturn.id);
    expect(posted.status).toBe('POSTED');
    expect(inventoryService.processOUT).toHaveBeenCalledTimes(1);
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
      { getSettings: vi.fn(async () => settings) } as any,
      {
        getById: vi.fn(async () => purchaseReturn),
        list: vi.fn(async () => []),
        update: vi.fn(async () => undefined),
      } as any,
      { getById: vi.fn(async () => null), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => grn), list: vi.fn(async () => []) } as any,
      { getById: vi.fn(async () => po), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => vendor) } as any,
      { getById: vi.fn(async () => null) } as any,
      { getItem: vi.fn(async () => item) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      { save: vi.fn(async (voucher: any) => voucher) } as any,
      { recordForVoucher: vi.fn(async () => undefined) } as any,
      makeTransactionManager() as any
    );

    await useCase.execute(COMPANY_ID, purchaseReturn.id);
    expect(po.lines[0].receivedQty).toBe(3);
    expect(po.lines[0].returnedQty).toBe(2);
  });

  it('4) Return qty > invoiced qty blocks posting', async () => {
    const settings = makeSettings('SIMPLE');
    const vendor = makeVendor();
    const item = makeItem();
    const po = makePO();
    const pi = makePostedPI();
    const purchaseReturn = makeAfterInvoiceReturn();
    purchaseReturn.lines[0].returnQty = 6;

    const inventoryService = makeInventoryService();
    const voucherRepo = { save: vi.fn(async (voucher: any) => voucher) };

    const useCase = new PostPurchaseReturnUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      {
        getById: vi.fn(async () => purchaseReturn),
        list: vi.fn(async () => []),
        update: vi.fn(async () => undefined),
      } as any,
      { getById: vi.fn(async () => pi), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => null), list: vi.fn(async () => []) } as any,
      { getById: vi.fn(async () => po), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => vendor) } as any,
      { getById: vi.fn(async () => makeTaxCode()) } as any,
      { getItem: vi.fn(async () => item) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      inventoryService as any,
      voucherRepo as any,
      { recordForVoucher: vi.fn(async () => undefined) } as any,
      makeTransactionManager() as any
    );

    await expect(useCase.execute(COMPANY_ID, purchaseReturn.id)).rejects.toThrow(/exceeds invoiced qty/i);
    expect(inventoryService.processOUT).not.toHaveBeenCalled();
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
    const voucherRepo = { save: vi.fn(async (voucher: any) => voucher) };

    const useCase = new PostPurchaseReturnUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      {
        getById: vi.fn(async () => purchaseReturn),
        list: vi.fn(async () => []),
        update: vi.fn(async () => undefined),
      } as any,
      { getById: vi.fn(async () => null), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => grn), list: vi.fn(async () => []) } as any,
      { getById: vi.fn(async () => po), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => vendor) } as any,
      { getById: vi.fn(async () => null) } as any,
      { getItem: vi.fn(async () => item) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      inventoryService as any,
      voucherRepo as any,
      { recordForVoucher: vi.fn(async () => undefined) } as any,
      makeTransactionManager() as any
    );

    await expect(useCase.execute(COMPANY_ID, purchaseReturn.id)).rejects.toThrow(/exceeds received qty/i);
    expect(inventoryService.processOUT).not.toHaveBeenCalled();
    expect(voucherRepo.save).not.toHaveBeenCalled();
  });
});
