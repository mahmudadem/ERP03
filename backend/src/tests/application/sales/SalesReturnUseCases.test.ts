import { describe, expect, it, vi } from 'vitest';
import { Item } from '../../../domain/inventory/entities/Item';
import { DeliveryNote } from '../../../domain/sales/entities/DeliveryNote';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import { SalesReturn } from '../../../domain/sales/entities/SalesReturn';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import { PostSalesReturnUseCase } from '../../../application/sales/use-cases/SalesReturnUseCases';

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
  runTransaction: vi.fn(async (operation: (transaction: any) => Promise<any>) => operation({ id: 'txn-1' })),
});

const makeInventoryService = () => ({
  processIN: vi.fn(async () => ({ id: 'mov-return-1' })),
  processOUT: vi.fn(async () => ({ id: 'mov-out-unused' })),
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
    const voucherRepo = { save: vi.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: vi.fn(async () => undefined) };
    const inventoryService = makeInventoryService();

    const useCase = new PostSalesReturnUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      {
        getById: vi.fn(async (_companyId: string, id: string) => returnStore.get(id) ?? null),
        list: vi.fn(async () => []),
        update: vi.fn(async (entity: SalesReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      { getById: vi.fn(async () => si), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => null), list: vi.fn(async () => []) } as any,
      { getById: vi.fn(async () => so), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => customer) } as any,
      { getById: vi.fn(async () => taxCode) } as any,
      { getItem: vi.fn(async () => item) } as any,
      { getCategory: vi.fn(async () => null) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      inventoryService as any,
      voucherRepo as any,
      ledgerRepo as any,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, salesReturn.id);
    expect(posted.status).toBe('POSTED');
    expect(inventoryService.processIN).toHaveBeenCalledTimes(1);
    const movementInput = (inventoryService.processIN as any).mock.calls[0][0];
    expect(movementInput.movementType).toBe('RETURN_IN');
    expect(movementInput.refs.type).toBe('SALES_RETURN');

    expect(voucherRepo.save).toHaveBeenCalledTimes(2);
    const savedVouchers = (voucherRepo.save as any).mock.calls.map((args: any[]) => args[0]);
    const revenueVoucher = savedVouchers.find((v: any) => String(v.voucherNo).startsWith('SR-REV-'));
    const cogsVoucher = savedVouchers.find((v: any) => String(v.voucherNo).startsWith('SR-COGS-'));
    expect(revenueVoucher).toBeTruthy();
    expect(cogsVoucher).toBeTruthy();
  });

  it('12) BEFORE_INVOICE: creates RETURN_IN + COGS reversal only (no revenue reversal)', async () => {
    const settings = makeSettings('CONTROLLED');
    const customer = makeCustomer();
    const item = makeItem();
    const so = makeSO();
    const dn = makePostedDN();
    const salesReturn = makeBeforeInvoiceReturn();

    const returnStore = new Map([[salesReturn.id, salesReturn]]);
    const voucherRepo = { save: vi.fn(async (voucher: any) => voucher) };
    const ledgerRepo = { recordForVoucher: vi.fn(async () => undefined) };
    const inventoryService = makeInventoryService();

    const useCase = new PostSalesReturnUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      {
        getById: vi.fn(async (_companyId: string, id: string) => returnStore.get(id) ?? null),
        list: vi.fn(async () => []),
        update: vi.fn(async (entity: SalesReturn) => { returnStore.set(entity.id, entity); }),
      } as any,
      { getById: vi.fn(async () => null), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => dn), list: vi.fn(async () => []) } as any,
      { getById: vi.fn(async () => so), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => customer) } as any,
      { getById: vi.fn(async () => makeTaxCode()) } as any,
      { getItem: vi.fn(async () => item) } as any,
      { getCategory: vi.fn(async () => null) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      inventoryService as any,
      voucherRepo as any,
      ledgerRepo as any,
      makeTransactionManager() as any
    );

    const posted = await useCase.execute(COMPANY_ID, salesReturn.id);
    expect(posted.status).toBe('POSTED');
    expect(posted.revenueVoucherId).toBeNull();
    expect(inventoryService.processIN).toHaveBeenCalledTimes(1);
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
    const voucherRepo = { save: vi.fn(async (voucher: any) => voucher) };

    const useCase = new PostSalesReturnUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      { getById: vi.fn(async () => salesReturn), list: vi.fn(async () => []), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => si), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => null), list: vi.fn(async () => []) } as any,
      { getById: vi.fn(async () => so), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => customer) } as any,
      { getById: vi.fn(async () => makeTaxCode()) } as any,
      { getItem: vi.fn(async () => item) } as any,
      { getCategory: vi.fn(async () => null) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      inventoryService as any,
      voucherRepo as any,
      { recordForVoucher: vi.fn(async () => undefined) } as any,
      makeTransactionManager() as any
    );

    await expect(useCase.execute(COMPANY_ID, salesReturn.id)).rejects.toThrow(/exceeds invoiced qty/i);
    expect(inventoryService.processIN).not.toHaveBeenCalled();
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
      { getSettings: vi.fn(async () => settings) } as any,
      { getById: vi.fn(async () => salesReturn), list: vi.fn(async () => []), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => null), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => dn), list: vi.fn(async () => []) } as any,
      { getById: vi.fn(async () => so), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => customer) } as any,
      { getById: vi.fn(async () => makeTaxCode()) } as any,
      { getItem: vi.fn(async () => item) } as any,
      { getCategory: vi.fn(async () => null) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      { save: vi.fn(async (voucher: any) => voucher) } as any,
      { recordForVoucher: vi.fn(async () => undefined) } as any,
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
      getById: vi.fn(async () => si),
      update: vi.fn(async () => undefined),
    };

    const useCase = new PostSalesReturnUseCase(
      { getSettings: vi.fn(async () => settings) } as any,
      { getById: vi.fn(async () => salesReturn), list: vi.fn(async () => []), update: vi.fn(async () => undefined) } as any,
      salesInvoiceRepo as any,
      { getById: vi.fn(async () => null), list: vi.fn(async () => []) } as any,
      { getById: vi.fn(async () => so), update: vi.fn(async () => undefined) } as any,
      { getById: vi.fn(async () => customer) } as any,
      { getById: vi.fn(async () => makeTaxCode()) } as any,
      { getItem: vi.fn(async () => item) } as any,
      { getCategory: vi.fn(async () => null) } as any,
      { getConversionsForItem: vi.fn(async () => []) } as any,
      { getBaseCurrency: vi.fn(async () => 'USD') } as any,
      makeInventoryService() as any,
      { save: vi.fn(async (voucher: any) => voucher) } as any,
      { recordForVoucher: vi.fn(async () => undefined) } as any,
      makeTransactionManager() as any
    );

    await useCase.execute(COMPANY_ID, salesReturn.id);
    expect(si.outstandingAmountBase).toBe(33);
    expect(salesInvoiceRepo.update).toHaveBeenCalled();
  });
});

