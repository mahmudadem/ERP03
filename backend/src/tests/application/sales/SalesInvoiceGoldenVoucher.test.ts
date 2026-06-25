import { describe, expect, it, jest } from '@jest/globals';
import { Item } from '../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import { Party } from '../../../domain/shared/entities/Party';
import { PostingLockPolicy, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { PostSalesInvoiceUseCase } from '../../../application/sales/use-cases/SalesInvoiceUseCases';
import { LegacyAccountingBridgeAdapter } from '../../../application/system-core/adapters/LegacyAccountingBridgeAdapter';
import {
  IAccountingBridge,
  FinancialEvent,
  FinancialEventRecord,
  PreBuiltVoucherEvent,
} from '../../../application/system-core/contracts/IAccountingBridge';

const COMPANY_ID = 'cmp-si-golden';
const USER_ID = 'u-si-golden';
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
    return { mode: 'full', voucher: { id: `vch-si-${this.events.length}` } as VoucherEntity };
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
// Fixtures (self-contained, mirrors SalesPostingUseCases.test.ts patterns)
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

const makeItem = (
  id: string,
  opts: {
    trackInventory?: boolean;
    cogsAccountId?: string;
    inventoryAssetAccountId?: string;
    revenueAccountId?: string;
  } = {}
): Item =>
  new Item({
    id,
    companyId: COMPANY_ID,
    code: `IT-${id}`,
    name: `Item ${id}`,
    type: opts.trackInventory ? 'PRODUCT' : 'SERVICE',
    baseUom: 'EA',
    purchaseUom: 'EA',
    salesUom: 'EA',
    costCurrency: 'USD',
    costingMethod: 'MOVING_AVG',
    trackInventory: opts.trackInventory ?? false,
    revenueAccountId: opts.revenueAccountId ?? 'REV-200',
    cogsAccountId: opts.cogsAccountId,
    inventoryAssetAccountId: opts.inventoryAssetAccountId,
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeSI = (input: {
  id: string;
  item: Item;
  invoicedQty: number;
  unitPriceDoc: number;
  currency?: string;
  exchangeRate?: number;
  warehouseId?: string;
}): SalesInvoice =>
  new SalesInvoice({
    id: input.id,
    companyId: COMPANY_ID,
    invoiceNumber: `${input.id}`,
    formType: 'sales_invoice_direct',
    voucherType: 'sales_invoice',
    persona: 'direct',
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
    charges: [],
    subtotalDoc: input.invoicedQty * input.unitPriceDoc,
    taxTotalDoc: 0,
    grandTotalDoc: input.invoicedQty * input.unitPriceDoc,
    subtotalBase: input.invoicedQty * input.unitPriceDoc * (input.exchangeRate ?? 1),
    taxTotalBase: 0,
    grandTotalBase: input.invoicedQty * input.unitPriceDoc * (input.exchangeRate ?? 1),
    paymentTermsDays: 30,
    paymentStatus: 'UNPAID',
    paidAmountBase: 0,
    outstandingAmountBase: input.invoicedQty * input.unitPriceDoc * (input.exchangeRate ?? 1),
    status: 'DRAFT',
    voucherId: null,
    cogsVoucherId: null,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeStockLevel = (unitCostBase = 10) =>
  new StockLevel({
    id: 'sl-1',
    companyId: COMPANY_ID,
    itemId: 'item-1',
    warehouseId: 'wh-1',
    qtyOnHand: 100,
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

const makeInventoryService = (costBase = 10) => ({
  processOUT: jest.fn(async () => ({
    id: 'mov-out-1',
    unitCostBase: costBase,
    movementCurrency: 'USD',
    fxRateMovToBase: 1,
    fxRateCCYToBase: 1,
  })),
  processIN: jest.fn(async () => ({ id: 'mov-in-1' })),
  preFetchStockLevel: jest.fn(async () => makeStockLevel(costBase)),
  preFetchLevelsByItem: jest.fn(async () => [makeStockLevel(costBase)]),
  writeStockMovement: jest.fn(async () => {}),
  writeStockLevel: jest.fn(async () => {}),
  deleteMovement: jest.fn(async () => {}),
  resolveCOGSAccounts: jest.fn(({ item, defaultCOGSAccountId, defaultInventoryAssetAccountId }: any) => ({
    cogsAccountId: item.cogsAccountId || defaultCOGSAccountId,
    inventoryAccountId: item.inventoryAssetAccountId || defaultInventoryAssetAccountId,
  })),
  addToCOGSBucket: jest.fn((bucket: Map<string, any>, cogsId: string, invId: string, amount: number) => {
    const key = `${cogsId}|${invId}`;
    const existing = bucket.get(key);
    if (existing) {
      existing.amountBase = Math.round((existing.amountBase + amount) * 100) / 100;
    } else {
      bucket.set(key, { cogsAccountId: cogsId, inventoryAccountId: invId, amountBase: amount });
    }
  }),
  computeStockOutMovement: jest.fn(({ qtyInBaseUom, level }: any) => ({
    movement: {
      id: 'mov-out-1',
      movementType: 'SALES_DELIVERY',
      referenceType: 'SALES_INVOICE',
      movementCurrency: 'USD',
      fxRateMovToBase: 1,
      fxRateCCYToBase: 1,
    },
    unitCostBase: level.avgCostBase,
    lineCostBase: qtyInBaseUom * level.avgCostBase,
  })),
  computeStockReturnInMovement: jest.fn(),
});

const makeItemRepo = (item: Item) => ({
  getItem: jest.fn(async () => item),
  updateItemInTransaction: jest.fn(async () => undefined),
});

const makeCompanyModuleRepo = (initialized = true) => ({
  get: jest.fn(async () => ({ companyId: COMPANY_ID, moduleKey: 'accounting', initialized })),
});

const makeTransactionManager = () => ({
  runTransaction: jest.fn(async (operation: (transaction: any) => Promise<any>) => operation({ id: 'txn-1' })),
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
    costingBasis: 'WAREHOUSE',
    ...overrides,
  })),
});

// ---------------------------------------------------------------------------
// Helper: build PostSalesInvoiceUseCase with a capturing bridge.
// Post-migration constructor: postingService is removed and bridge is required
// right after transactionManager, so this fixture exercises the same
// bridge-only path as production.
// ---------------------------------------------------------------------------

function buildUseCaseWithCapturingBridge(
  bridge: IAccountingBridge,
  opts: {
    item: Item;
    si: SalesInvoice;
    customer?: Party;
    settings?: SalesSettings;
    invMode?: 'PERIODIC' | 'INVOICE_DRIVEN' | 'PERPETUAL';
  }
): PostSalesInvoiceUseCase {
  const settings = opts.settings ?? makeSettings();
  const customer = opts.customer ?? makeCustomer();
  const invoiceStore = new Map([[opts.si.id, opts.si]]);
  return new PostSalesInvoiceUseCase(
    { getSettings: jest.fn(async () => settings) } as any,
    makeInventorySettingsRepository(opts.invMode) as any,
    {
      getById: jest.fn(async (_c: string, id: string) => invoiceStore.get(id) ?? null),
      update: jest.fn(async (e: SalesInvoice) => { invoiceStore.set(e.id, e); }),
    } as any,
    { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
    { list: jest.fn(async () => []) } as any,
    { getById: jest.fn(async () => customer) } as any,
    { getById: jest.fn(async () => null) } as any,
    makeItemRepo(opts.item) as any,
    { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
    { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
    { getConversionsForItem: jest.fn(async () => []) } as any,
    { getBaseCurrency: jest.fn(async () => 'USD') } as any,
    makeInventoryService(10) as any,
    makeCompanyModuleRepo() as any,
    undefined,
    makeTransactionManager() as any,
    bridge
  );
}

// ---------------------------------------------------------------------------
// Golden voucher-output tests
// ---------------------------------------------------------------------------

describe('Sales Invoice document vouchers — golden voucher-output (Task 267-F SI slice)', () => {
  it('G1: service-item SI posts REVENUE voucher with exact AR debit, revenue credit, and metadata', async () => {
    const item = makeItem('svc-g1', { trackInventory: false, revenueAccountId: 'REV-200' });
    const si = makeSI({ id: 'si-g1', item, invoicedQty: 1, unitPriceDoc: 100 });
    const bridge = new CapturingBridge();

    const useCase = buildUseCaseWithCapturingBridge(bridge, { item, si });
    await useCase.execute(COMPANY_ID, si.id);

    // Service item → only one event (revenue voucher, no COGS)
    expect(bridge.events).toHaveLength(1);
    const sv = bridge.events[0].subledgerVoucher!;

    // Voucher header
    expect(sv.companyId).toBe(COMPANY_ID);
    expect(sv.voucherType).toBe(VoucherType.SALES_INVOICE);
    expect(sv.voucherNo).toBe('SI-si-g1');
    expect(sv.date).toBe('2026-01-12');
    expect(sv.currency).toBe('USD');
    expect(sv.exchangeRate).toBe(1);
    expect(sv.createdBy).toBe(USER_ID);
    expect(sv.postingLockPolicy).toBe(PostingLockPolicy.FLEXIBLE_LOCKED);
    expect(sv.reference).toBe('si-g1');
    expect(sv.approved).toBe(false);

    // Source metadata
    expect(sv.metadata!.sourceModule).toBe('sales');
    expect(sv.metadata!.sourceType).toBe('SALES_INVOICE');
    expect(sv.metadata!.sourceId).toBe(si.id);
    expect(sv.metadata!.voucherPart).toBe('REVENUE');

    // Lines: Dr AR / Cr Revenue, amount = 1 * 100 = 100
    expect(sv.lines.length).toBeGreaterThanOrEqual(2);
    const arLine = sv.lines.find((l: any) => l.side === 'Debit');
    const revLine = sv.lines.find((l: any) => l.side === 'Credit');
    expect(arLine).toBeDefined();
    expect(revLine).toBeDefined();
    expect(arLine!.accountId).toBe('AR-200');
    expect(arLine!.baseAmount).toBe(100);
    expect(arLine!.docAmount).toBe(100);
    expect(revLine!.accountId).toBe('REV-200');
    expect(revLine!.baseAmount).toBe(100);
    expect(revLine!.docAmount).toBe(100);

    // voucherId set from the bridge's full-mode return; no COGS for service
    expect(si.voucherId).toBe('vch-si-1');
    expect(si.cogsVoucherId).toBeNull();
  });

  it('G2: stock-item SI posts REVENUE + COGS vouchers with exact account ids and amounts', async () => {
    const item = makeItem('stk-g2', {
      trackInventory: true,
      cogsAccountId: 'COGS-200',
      inventoryAssetAccountId: 'INV-200',
      revenueAccountId: 'REV-200',
    });
    const si = makeSI({ id: 'si-g2', item, invoicedQty: 3, unitPriceDoc: 15, warehouseId: 'wh-1' });
    const bridge = new CapturingBridge();

    const useCase = buildUseCaseWithCapturingBridge(bridge, { item, si });
    await useCase.execute(COMPANY_ID, si.id);

    // Stock item PERPETUAL → two events: revenue + COGS
    expect(bridge.events).toHaveLength(2);

    // --- Revenue voucher ---
    const revSv = bridge.events[0].subledgerVoucher!;
    expect(revSv.voucherType).toBe(VoucherType.SALES_INVOICE);
    expect(revSv.voucherNo).toBe('SI-si-g2');
    expect(revSv.metadata!.voucherPart).toBe('REVENUE');
    const revAr = revSv.lines.find((l: any) => l.side === 'Debit')!;
    const revRev = revSv.lines.find((l: any) => l.side === 'Credit')!;
    // AR = 3 * 15 = 45
    expect(revAr.accountId).toBe('AR-200');
    expect(revAr.baseAmount).toBe(45);
    expect(revAr.docAmount).toBe(45);
    expect(revRev.accountId).toBe('REV-200');
    expect(revRev.baseAmount).toBe(45);
    expect(revRev.docAmount).toBe(45);

    // --- COGS voucher ---
    const cogsSv = bridge.events[1].subledgerVoucher!;
    expect(cogsSv.voucherType).toBe(VoucherType.SALES_INVOICE);
    expect(cogsSv.voucherNo).toBe('SI-COGS-si-g2');
    expect(cogsSv.metadata!.voucherPart).toBe('COGS');
    expect(cogsSv.currency).toBe('USD');
    expect(cogsSv.exchangeRate).toBe(1);
    // COGS = 3 * 10 (cost) = 30
    const cogsDr = cogsSv.lines.find((l: any) => l.side === 'Debit')!;
    const cogsCr = cogsSv.lines.find((l: any) => l.side === 'Credit')!;
    expect(cogsDr.accountId).toBe('COGS-200');
    expect(cogsDr.baseAmount).toBe(30);
    expect(cogsDr.docAmount).toBe(30);
    expect(cogsCr.accountId).toBe('INV-200');
    expect(cogsCr.baseAmount).toBe(30);
    expect(cogsCr.docAmount).toBe(30);

    expect(si.voucherId).toBe('vch-si-1');
    expect(si.cogsVoucherId).toBe('vch-si-2');
  });

  it('G3: minimal mode (engine not initialized) posts NO GL voucher — null voucher ids', async () => {
    const item = makeItem('stk-g3', {
      trackInventory: true,
      cogsAccountId: 'COGS-200',
      inventoryAssetAccountId: 'INV-200',
      revenueAccountId: 'REV-200',
    });
    const si = makeSI({ id: 'si-g3', item, invoicedQty: 2, unitPriceDoc: 20, warehouseId: 'wh-1' });
    const bridge = new MinimalBridge();

    const useCase = buildUseCaseWithCapturingBridge(bridge, { item, si });
    await useCase.execute(COMPANY_ID, si.id);

    // The bridge received both events (same voucher output) but returned no voucher.
    expect(bridge.events).toHaveLength(2);
    expect(bridge.events[0].subledgerVoucher!.metadata!.voucherPart).toBe('REVENUE');
    expect(bridge.events[1].subledgerVoucher!.metadata!.voucherPart).toBe('COGS');

    // No GL voucher ids linked.
    expect(si.voucherId).toBeNull();
    expect(si.cogsVoucherId).toBeNull();
  });

  it('G4: period-lock override metadata is forwarded into both REVENUE and COGS vouchers', async () => {
    const item = makeItem('stk-g4', {
      trackInventory: true,
      cogsAccountId: 'COGS-200',
      inventoryAssetAccountId: 'INV-200',
      revenueAccountId: 'REV-200',
    });
    const si = makeSI({ id: 'si-g4', item, invoicedQty: 1, unitPriceDoc: 50, warehouseId: 'wh-1' });
    const bridge = new CapturingBridge();

    const useCase = buildUseCaseWithCapturingBridge(bridge, { item, si });
    await useCase.execute(
      COMPANY_ID,
      si.id,
      true,
      undefined,
      undefined,
      { reason: 'late-invoice', overriddenBy: 'manager-1' }
    );

    expect(bridge.events).toHaveLength(2);
    for (const event of bridge.events) {
      const sv = event.subledgerVoucher!;
      expect(sv.metadata!.periodLockOverride).toEqual({
        reason: 'late-invoice',
        overriddenBy: 'manager-1',
      });
      expect(sv.postingLockPolicy).toBe(PostingLockPolicy.FLEXIBLE_LOCKED);
    }
  });

  it('G5: foreign-currency SI passes currency and exchangeRate into the revenue voucher', async () => {
    const item = makeItem('svc-g5', { trackInventory: false, revenueAccountId: 'REV-EUR' });
    const si = makeSI({ id: 'si-g5', item, invoicedQty: 2, unitPriceDoc: 50, currency: 'EUR', exchangeRate: 1.5 });
    const bridge = new CapturingBridge();

    const useCase = buildUseCaseWithCapturingBridge(bridge, { item, si });
    await useCase.execute(COMPANY_ID, si.id);

    expect(bridge.events).toHaveLength(1);
    const sv = bridge.events[0].subledgerVoucher!;
    expect(sv.currency).toBe('EUR');
    expect(sv.exchangeRate).toBe(1.5);
    // AR doc = 2 * 50 = 100 EUR; base = 100 * 1.5 = 150 USD
    const arLine = sv.lines.find((l: any) => l.side === 'Debit')!;
    expect(arLine.baseAmount).toBe(150);
    expect(arLine.docAmount).toBe(100);
    const revLine = sv.lines.find((l: any) => l.side === 'Credit')!;
    expect(revLine.baseAmount).toBe(150);
    expect(revLine.docAmount).toBe(100);
  });

  it('G6: PERIODIC mode posts REVENUE voucher but NO COGS voucher', async () => {
    const item = makeItem('stk-g6', {
      trackInventory: true,
      cogsAccountId: 'COGS-200',
      inventoryAssetAccountId: 'INV-200',
      revenueAccountId: 'REV-200',
    });
    const si = makeSI({ id: 'si-g6', item, invoicedQty: 2, unitPriceDoc: 25, warehouseId: 'wh-1' });
    const bridge = new CapturingBridge();

    const useCase = buildUseCaseWithCapturingBridge(bridge, { item, si, invMode: 'PERIODIC' });
    await useCase.execute(COMPANY_ID, si.id);

    // PERIODIC → only revenue, no COGS
    expect(bridge.events).toHaveLength(1);
    expect(bridge.events[0].subledgerVoucher!.metadata!.voucherPart).toBe('REVENUE');
    expect(si.voucherId).toBe('vch-si-1');
    expect(si.cogsVoucherId).toBeNull();
  });

  it('G7: output stability — the same SI posted twice through the bridge produces identical subledgerVoucher fields', async () => {
    const item = makeItem('stk-g7', {
      trackInventory: true,
      cogsAccountId: 'COGS-200',
      inventoryAssetAccountId: 'INV-200',
      revenueAccountId: 'REV-200',
    });
    const si = makeSI({ id: 'si-g7', item, invoicedQty: 3, unitPriceDoc: 15, warehouseId: 'wh-1' });
    const bridge1 = new CapturingBridge();

    const useCase1 = buildUseCaseWithCapturingBridge(bridge1, { item, si });
    await useCase1.execute(COMPANY_ID, si.id);

    // Reset SI state for a second run
    si.status = 'DRAFT';
    si.voucherId = null;
    si.cogsVoucherId = null;
    const bridge2 = new CapturingBridge();
    const useCase2 = buildUseCaseWithCapturingBridge(bridge2, { item, si });
    await useCase2.execute(COMPANY_ID, si.id);

    expect(bridge1.events).toHaveLength(2);
    expect(bridge2.events).toHaveLength(2);
    // Golden assertion: every field is identical across runs.
    expect(bridge2.events[0].subledgerVoucher).toEqual(bridge1.events[0].subledgerVoucher);
    expect(bridge2.events[1].subledgerVoucher).toEqual(bridge1.events[1].subledgerVoucher);
  });
});
