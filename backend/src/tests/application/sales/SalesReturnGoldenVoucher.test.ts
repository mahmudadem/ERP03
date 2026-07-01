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
import { PostingLockPolicy, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { PostSalesReturnUseCase } from '../../../application/sales/use-cases/SalesReturnUseCases';
import {
  IAccountingBridge,
  FinancialEvent,
  FinancialEventRecord,
  PreBuiltVoucherEvent,
} from '../../../application/system-core/contracts/IAccountingBridge';

const COMPANY_ID = 'cmp-sr-golden';
const USER_ID = 'u-sr-golden';
const nowDate = () => new Date('2026-01-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Capturing bridge — records every FinancialEvent the use case sends, so the
// golden test can pin every field of the voucher OUTPUT (the subledgerVoucher
// input to the bridge = the voucher that would be posted in full mode).
// ---------------------------------------------------------------------------

class CapturingBridge implements IAccountingBridge {
  public events: FinancialEvent[] = [];
  async recordFinancialEvent(event: FinancialEvent): Promise<FinancialEventRecord> {
    this.events.push(event);
    return { mode: 'full', voucher: { id: `vch-sr-${this.events.length}` } as VoucherEntity };
  }
  async recordPreBuiltVoucher(event: PreBuiltVoucherEvent): Promise<FinancialEventRecord> {
    return { mode: 'full', voucher: event.voucher };
  }
}

class MinimalBridge implements IAccountingBridge {
  public events: FinancialEvent[] = [];
  async recordFinancialEvent(event: FinancialEvent): Promise<FinancialEventRecord> {
    this.events.push(event);
    return { mode: 'minimal', voucher: null };
  }
  async recordPreBuiltVoucher(event: PreBuiltVoucherEvent): Promise<FinancialEventRecord> {
    return { mode: 'minimal', voucher: null };
  }
}

// ---------------------------------------------------------------------------
// Fixtures (self-contained; distinct account ids from the other suites)
// ---------------------------------------------------------------------------

const makeSettings = (overrides: Partial<SalesSettings> = {}): SalesSettings =>
  new SalesSettings({
    companyId: COMPANY_ID,
    allowDirectInvoicing: true,
    requireSOForStockItems: false,
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
    inventoryAssetAccountId: 'INV-200',
    revenueAccountId: 'REV-200',
    cogsAccountId: 'COGS-200',
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
    salesTaxAccountId: 'TAX-200',
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

const makePostedSI = (
  opts: { currency?: string; exchangeRate?: number; invoicedQty?: number } = {}
): SalesInvoice =>
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
    currency: (opts.currency ?? 'USD').toUpperCase(),
    exchangeRate: opts.exchangeRate ?? 1,
    lines: [
      {
        lineId: 'si-line-1',
        lineNo: 1,
        soLineId: 'so-line-1',
        itemId: 'item-1',
        itemCode: 'IT-1',
        itemName: 'Stock Item',
        trackInventory: true,
        invoicedQty: opts.invoicedQty ?? 5,
        uom: 'EA',
        unitPriceDoc: 10,
        lineTotalDoc: 50,
        unitPriceBase: (opts.exchangeRate ?? 1) * 10,
        lineTotalBase: 50 * (opts.exchangeRate ?? 1),
        taxCodeId: 'tax-1',
        taxCode: 'VAT10',
        taxRate: 0.1,
        taxAmountDoc: 5,
        taxAmountBase: 5 * (opts.exchangeRate ?? 1),
        warehouseId: 'wh-1',
        revenueAccountId: 'REV-200',
        cogsAccountId: 'COGS-200',
        inventoryAccountId: 'INV-200',
        unitCostBase: 4,
        lineCostBase: 20,
      },
    ],
    subtotalDoc: 50,
    taxTotalDoc: 5,
    grandTotalDoc: 55,
    subtotalBase: 50 * (opts.exchangeRate ?? 1),
    taxTotalBase: 5 * (opts.exchangeRate ?? 1),
    grandTotalBase: 55 * (opts.exchangeRate ?? 1),
    paymentTermsDays: 30,
    paymentStatus: 'UNPAID',
    paidAmountBase: 0,
    outstandingAmountBase: 55 * (opts.exchangeRate ?? 1),
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
    currency: 'USD',
    exchangeRate: 1,
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

const makeAfterInvoiceReturn = (
  opts: { currency?: string; exchangeRate?: number } = {}
): SalesReturn =>
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
    currency: (opts.currency ?? 'USD').toUpperCase(),
    exchangeRate: opts.exchangeRate ?? 1,
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
        unitPriceBase: (opts.exchangeRate ?? 1) * 10,
        unitCostBase: 4,
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
        taxCodeId: 'tax-1',
        taxRate: 0.1,
        taxAmountDoc: 2,
        taxAmountBase: 2,
        revenueAccountId: 'REV-200',
        cogsAccountId: 'COGS-200',
        inventoryAccountId: 'INV-200',
        priceIsInclusive: false,
        stockMovementId: null,
      },
    ],
    subtotalDoc: 20,
    taxTotalDoc: 2,
    grandTotalDoc: 22,
    subtotalBase: 20 * (opts.exchangeRate ?? 1),
    taxTotalBase: 2 * (opts.exchangeRate ?? 1),
    grandTotalBase: 22 * (opts.exchangeRate ?? 1),
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
    returnDate: '2026-01-16',
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
        cogsAccountId: 'COGS-200',
        inventoryAccountId: 'INV-200',
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

// ---------------------------------------------------------------------------
// Inventory service / repositories (mocks; ensureInventoryCore fills
// resolveCOGSAccounts + addToCOGSBucket defaults when not on the mock).
// ---------------------------------------------------------------------------

const makeStockLevel = (unitCostBase = 4): StockLevel =>
  new StockLevel({
    id: 'item-1_wh-1',
    companyId: COMPANY_ID,
    itemId: 'item-1',
    warehouseId: 'wh-1',
    qtyOnHand: 10,
    reservedQty: 0,
    avgCostBase: unitCostBase,
    avgCostCCY: unitCostBase,
    lastCostBase: unitCostBase,
    lastCostCCY: unitCostBase,
    postingSeq: 1,
    maxBusinessDate: '2026-01-12',
    totalMovements: 1,
    lastMovementId: 'mov-si-1',
    version: 1,
    updatedAt: nowDate(),
  });

const makeInventoryService = () => ({
  processIn: jest.fn(async () => ({ id: 'mov-return-1' })),
  processIN: jest.fn(async () => ({ id: 'mov-return-1' })),
  processOUT: jest.fn(async () => ({ id: 'mov-out-unused' })),
  preFetchStockLevel: jest.fn(async () => makeStockLevel(4)),
  writeStockMovement: jest.fn(async () => undefined),
  writeStockLevel: jest.fn(async () => undefined),
});

const makeItemRepo = (item: Item) => ({
  getItem: jest.fn(async () => item),
  updateItemInTransaction: jest.fn(async () => undefined),
});

const makeCompanyModuleRepo = (initialized = true) => ({
  get: jest.fn(async () => ({
    companyId: COMPANY_ID,
    moduleKey: 'accounting',
    initialized,
  })),
});

const makeTransactionManager = () => ({
  runTransaction: jest.fn(async (operation: (transaction: any) => Promise<any>) => operation({ id: 'txn-1' })),
});

const makeInventorySettingsRepository = (
  mode: 'PERIODIC' | 'INVOICE_DRIVEN' | 'PERPETUAL' = 'PERPETUAL'
) => ({
  getSettings: jest.fn(async () => ({
    accountingMode: mode,
    inventoryAccountingMethod: mode === 'PERPETUAL' ? 'PERPETUAL' : 'PERIODIC',
    defaultInventoryAssetAccountId: 'INV-200',
    defaultCOGSAccountId: 'COGS-200',
    costingBasis: 'WAREHOUSE',
  })),
});

// ---------------------------------------------------------------------------
// Helper: build PostSalesReturnUseCase with a capturing bridge.
// Post-migration constructor: accountingPostingService is removed and
// accountingBridge is required right after transactionManager, so this fixture
// exercises the same bridge-only path as production.
// ---------------------------------------------------------------------------

interface BuildOpts {
  settings?: SalesSettings;
  customer?: Party;
  item?: Item;
  so?: SalesOrder | null;
  si?: SalesInvoice | null;
  dn?: DeliveryNote | null;
  salesReturn: SalesReturn;
  invSettingsMode?: 'INVOICE_DRIVEN' | 'PERIODIC' | 'PERPETUAL';
  companyModuleInitialized?: boolean;
}

function buildUseCaseWithCapturingBridge(
  bridge: IAccountingBridge,
  opts: BuildOpts
): PostSalesReturnUseCase {
  const settings = opts.settings ?? makeSettings();
  const customer = opts.customer ?? makeCustomer();
  const item = opts.item ?? makeItem();
  const so = opts.so === undefined ? makeSO() : opts.so;
  const si = opts.si === undefined ? makePostedSI() : opts.si;
  const dn = opts.dn === undefined ? null : opts.dn;
  const returnStore = new Map([[opts.salesReturn.id, opts.salesReturn]]);

  return new PostSalesReturnUseCase(
    { getSettings: jest.fn(async () => settings) } as any,
    makeInventorySettingsRepository(
      (opts.invSettingsMode as any) ?? 'PERPETUAL'
    ) as any,
    {
      getById: jest.fn(async (_c: string, id: string) => returnStore.get(id) ?? null),
      list: jest.fn(async () => []),
      update: jest.fn(async (e: SalesReturn) => { returnStore.set(e.id, e); }),
    } as any,
    {
      getById: jest.fn(async () => si),
      update: jest.fn(async () => undefined),
    } as any,
    {
      getById: jest.fn(async () => dn),
      list: jest.fn(async () => []),
    } as any,
    {
      getById: jest.fn(async () => so),
      update: jest.fn(async () => undefined),
    } as any,
    { getById: jest.fn(async () => customer) } as any,
    { getById: jest.fn(async () => makeTaxCode()) } as any,
    makeItemRepo(item) as any,
    { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
    { getConversionsForItem: jest.fn(async () => []) } as any,
    { getBaseCurrency: jest.fn(async () => 'USD') } as any,
    makeInventoryService() as any,
    makeCompanyModuleRepo(opts.companyModuleInitialized ?? true) as any,
    undefined, // accountRepo — resolveAccountId returns ids unchanged
    makeTransactionManager() as any,
    bridge // required (post-migration): the poster routes here only
  );
}

// ---------------------------------------------------------------------------
// Golden voucher-output tests
// ---------------------------------------------------------------------------

describe('Sales Return document vouchers — golden voucher-output (Task 267-F SR slice)', () => {
  it('G1: AFTER_INVOICE posts COGS then REVENUE vouchers with exact account ids, sides, amounts, currency, and metadata', async () => {
    const salesReturn = makeAfterInvoiceReturn();
    const bridge = new CapturingBridge();

    const useCase = buildUseCaseWithCapturingBridge(bridge, { salesReturn });
    await useCase.execute(COMPANY_ID, salesReturn.id);

    // Event order: COGS comes first, then REVENUE.
    expect(bridge.events).toHaveLength(2);
    const cogsSv = bridge.events[0].subledgerVoucher!;
    const revSv = bridge.events[1].subledgerVoucher!;

    // --- COGS voucher header + lines ---
    expect(cogsSv.companyId).toBe(COMPANY_ID);
    expect(cogsSv.voucherType).toBe(VoucherType.SALES_RETURN);
    expect(cogsSv.voucherNo).toBe('SR-COGS-SR-00001');
    expect(cogsSv.date).toBe('2026-01-15');
    expect(cogsSv.currency).toBe('USD');
    expect(cogsSv.exchangeRate).toBe(1);
    expect(cogsSv.createdBy).toBe(USER_ID);
    expect(cogsSv.approved).toBe(true);
    expect(cogsSv.postingLockPolicy).toBe(PostingLockPolicy.FLEXIBLE_LOCKED);
    expect(cogsSv.reference).toBe('SR-00001');
    expect(cogsSv.baseCurrencyOverride).toBe('USD');
    expect(cogsSv.metadata!.sourceModule).toBe('sales');
    expect(cogsSv.metadata!.sourceType).toBe('SALES_RETURN');
    expect(cogsSv.metadata!.sourceId).toBe('sr-1');
    expect(cogsSv.metadata!.referenceType).toBe('SALES_RETURN');
    expect(cogsSv.metadata!.referenceId).toBe('sr-1');
    expect(cogsSv.metadata!.voucherPart).toBe('COGS');
    expect(cogsSv.metadata!.periodLockOverride).toBeUndefined();

    expect(cogsSv.lines).toHaveLength(2);
    const cogsInv = cogsSv.lines.find((l: any) => l.side === 'Debit')!;
    const cogsCogs = cogsSv.lines.find((l: any) => l.side === 'Credit')!;
    expect(cogsInv.accountId).toBe('INV-200');
    expect(cogsInv.baseAmount).toBe(8);
    expect(cogsInv.docAmount).toBe(8);
    expect(cogsCogs.accountId).toBe('COGS-200');
    expect(cogsCogs.baseAmount).toBe(8);
    expect(cogsCogs.docAmount).toBe(8);

    // --- REVENUE voucher header + lines ---
    expect(revSv.voucherType).toBe(VoucherType.SALES_RETURN);
    expect(revSv.voucherNo).toBe('SR-REV-SR-00001');
    expect(revSv.date).toBe('2026-01-15');
    expect(revSv.currency).toBe('USD');
    expect(revSv.exchangeRate).toBe(1);
    expect(revSv.approved).toBe(true);
    expect(revSv.postingLockPolicy).toBe(PostingLockPolicy.FLEXIBLE_LOCKED);
    expect(revSv.reference).toBe('SR-00001');
    expect(revSv.baseCurrencyOverride).toBe('USD');
    expect(revSv.metadata!.voucherPart).toBe('REVENUE');
    expect(revSv.metadata!.settlementMode).toBe('CREDIT_NOTE');
    expect(revSv.metadata!.reasonCode).toBe('OTHER');
    expect(revSv.metadata!.restockingFeeAmountBase).toBe(0);
    expect(revSv.metadata!.restockingFeeAmountDoc).toBe(0);

    // 3 lines: Dr revenue (20) + Dr tax (2) + Cr AR settlement (22).
    expect(revSv.lines).toHaveLength(3);
    const revDr = revSv.lines.find((l: any) => l.accountId === 'REV-200')!;
    const taxDr = revSv.lines.find((l: any) => l.accountId === 'TAX-200')!;
    const arCr = revSv.lines.find((l: any) => l.accountId === 'AR-200')!;
    expect(revDr.side).toBe('Debit');
    expect(revDr.baseAmount).toBe(20);
    expect(revDr.docAmount).toBe(20);
    expect(taxDr.side).toBe('Debit');
    expect(taxDr.baseAmount).toBe(2);
    expect(taxDr.docAmount).toBe(2);
    expect(arCr.side).toBe('Credit');
    expect(arCr.baseAmount).toBe(22);
    expect(arCr.docAmount).toBe(22);

    // Voucher ids linked from the bridge's full-mode return.
    expect(salesReturn.cogsVoucherId).toBe('vch-sr-1');
    expect(salesReturn.revenueVoucherId).toBe('vch-sr-2');
  });

  it('G2: BEFORE_INVOICE posts COGS voucher only (no revenue voucher)', async () => {
    const salesReturn = makeBeforeInvoiceReturn();
    const bridge = new CapturingBridge();

    const useCase = buildUseCaseWithCapturingBridge(bridge, {
      salesReturn,
      si: null,
      dn: makePostedDN(),
    });
    await useCase.execute(COMPANY_ID, salesReturn.id);

    // No revenue voucher: BEFORE_INVOICE has no invoice to reverse.
    expect(bridge.events).toHaveLength(1);
    const cogsSv = bridge.events[0].subledgerVoucher!;
    expect(cogsSv.metadata!.voucherPart).toBe('COGS');
    expect(cogsSv.voucherNo).toBe('SR-COGS-SR-00002');
    expect(cogsSv.currency).toBe('USD');
    expect(cogsSv.lines).toHaveLength(2);
    const cogsInv = cogsSv.lines.find((l: any) => l.side === 'Debit')!;
    const cogsCogs = cogsSv.lines.find((l: any) => l.side === 'Credit')!;
    expect(cogsInv.accountId).toBe('INV-200');
    expect(cogsInv.baseAmount).toBe(8);
    expect(cogsCogs.accountId).toBe('COGS-200');
    expect(cogsCogs.baseAmount).toBe(8);

    expect(salesReturn.cogsVoucherId).toBe('vch-sr-1');
    expect(salesReturn.revenueVoucherId).toBeNull();
  });

  it('G3: minimal mode (bridge not initialized) receives events but links NO GL voucher ids', async () => {
    const salesReturn = makeAfterInvoiceReturn();
    const bridge = new MinimalBridge();

    const useCase = buildUseCaseWithCapturingBridge(bridge, { salesReturn });
    await useCase.execute(COMPANY_ID, salesReturn.id);

    // The bridge received both events (same voucher output) but returned no voucher.
    expect(bridge.events).toHaveLength(2);
    expect(bridge.events[0].subledgerVoucher!.metadata!.voucherPart).toBe('COGS');
    expect(bridge.events[1].subledgerVoucher!.metadata!.voucherPart).toBe('REVENUE');

    // No GL voucher ids linked.
    expect(salesReturn.cogsVoucherId).toBeNull();
    expect(salesReturn.revenueVoucherId).toBeNull();
  });

  it('G4: period-lock override metadata is forwarded into both COGS and REVENUE vouchers', async () => {
    const salesReturn = makeAfterInvoiceReturn();
    const bridge = new CapturingBridge();

    const useCase = buildUseCaseWithCapturingBridge(bridge, { salesReturn });
    await useCase.execute(
      COMPANY_ID,
      salesReturn.id,
      true,
      { reason: 'late-return', overriddenBy: 'manager-1' },
      { userId: 'actor-1' }
    );

    expect(bridge.events).toHaveLength(2);
    for (const event of bridge.events) {
      const sv = event.subledgerVoucher!;
      expect(sv.metadata!.periodLockOverride).toEqual({
        reason: 'late-return',
        overriddenBy: 'manager-1',
      });
      expect(sv.postingLockPolicy).toBe(PostingLockPolicy.FLEXIBLE_LOCKED);
    }
  });

  it('G5: foreign-currency return keeps EUR currency + rate on the REVENUE voucher, base currency on the COGS voucher', async () => {
    const si = makePostedSI({ currency: 'EUR', exchangeRate: 1.5 });
    const salesReturn = makeAfterInvoiceReturn({ currency: 'EUR', exchangeRate: 1.5 });
    const bridge = new CapturingBridge();

    const useCase = buildUseCaseWithCapturingBridge(bridge, { salesReturn, si });
    await useCase.execute(COMPANY_ID, salesReturn.id);

    expect(bridge.events).toHaveLength(2);

    // --- COGS voucher: base currency (USD), exchangeRate 1 ---
    const cogsSv = bridge.events[0].subledgerVoucher!;
    expect(cogsSv.currency).toBe('USD');
    expect(cogsSv.exchangeRate).toBe(1);
    const cogsInv = cogsSv.lines.find((l: any) => l.side === 'Debit')!;
    const cogsCogs = cogsSv.lines.find((l: any) => l.side === 'Credit')!;
    expect(cogsInv.accountId).toBe('INV-200');
    expect(cogsInv.baseAmount).toBe(8);
    expect(cogsCogs.accountId).toBe('COGS-200');
    expect(cogsCogs.baseAmount).toBe(8);

    // --- REVENUE voucher: document currency (EUR), exchangeRate 1.5 ---
    const revSv = bridge.events[1].subledgerVoucher!;
    expect(revSv.currency).toBe('EUR');
    expect(revSv.exchangeRate).toBe(1.5);
    // 2 qty x 10 EUR = 20 EUR doc; base = 20 x 1.5 = 30 USD.
    const revDr = revSv.lines.find((l: any) => l.accountId === 'REV-200')!;
    expect(revDr.side).toBe('Debit');
    expect(revDr.baseAmount).toBe(30);
    expect(revDr.docAmount).toBe(20);
    // Tax: 20 x 0.1 = 2 EUR doc; base = 3 USD.
    const taxDr = revSv.lines.find((l: any) => l.accountId === 'TAX-200')!;
    expect(taxDr.baseAmount).toBe(3);
    expect(taxDr.docAmount).toBe(2);
    // AR settlement: 22 EUR doc; base = 33 USD.
    const arCr = revSv.lines.find((l: any) => l.accountId === 'AR-200')!;
    expect(arCr.baseAmount).toBe(33);
    expect(arCr.docAmount).toBe(22);
  });

  it('G6: PERIODIC mode posts the REVENUE voucher but NO COGS voucher', async () => {
    const salesReturn = makeAfterInvoiceReturn();
    const bridge = new CapturingBridge();

    const useCase = buildUseCaseWithCapturingBridge(bridge, {
      salesReturn,
      invSettingsMode: 'PERIODIC' as any,
    });
    await useCase.execute(COMPANY_ID, salesReturn.id);

    // PERIODIC: no COGS reversal voucher.
    expect(bridge.events).toHaveLength(1);
    expect(bridge.events[0].subledgerVoucher!.metadata!.voucherPart).toBe('REVENUE');
    expect(salesReturn.revenueVoucherId).toBe('vch-sr-1');
    expect(salesReturn.cogsVoucherId).toBeNull();
  });

  it('G7: output stability — the same return posted twice through the bridge produces identical subledgerVoucher fields', async () => {
    const salesReturn = makeAfterInvoiceReturn();
    const bridge1 = new CapturingBridge();

    const useCase1 = buildUseCaseWithCapturingBridge(bridge1, { salesReturn });
    await useCase1.execute(COMPANY_ID, salesReturn.id);

    // Reset SR state for a second run.
    salesReturn.status = 'DRAFT';
    salesReturn.revenueVoucherId = null;
    salesReturn.cogsVoucherId = null;
    const bridge2 = new CapturingBridge();
    const useCase2 = buildUseCaseWithCapturingBridge(bridge2, { salesReturn });
    await useCase2.execute(COMPANY_ID, salesReturn.id);

    expect(bridge1.events).toHaveLength(2);
    expect(bridge2.events).toHaveLength(2);
    // Golden assertion: every field is identical across runs.
    expect(bridge2.events[0].subledgerVoucher).toEqual(bridge1.events[0].subledgerVoucher);
    expect(bridge2.events[1].subledgerVoucher).toEqual(bridge1.events[1].subledgerVoucher);
  });
});
