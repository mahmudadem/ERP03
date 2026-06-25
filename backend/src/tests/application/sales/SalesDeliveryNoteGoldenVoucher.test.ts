import { describe, expect, it, jest } from '@jest/globals';
import { Item } from '../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { DeliveryNote } from '../../../domain/sales/entities/DeliveryNote';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import { PostingLockPolicy, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { PostDeliveryNoteUseCase } from '../../../application/sales/use-cases/DeliveryNoteUseCases';
import {
  IAccountingBridge,
  FinancialEvent,
  FinancialEventRecord,
  PreBuiltVoucherEvent,
} from '../../../application/system-core/contracts/IAccountingBridge';

const COMPANY_ID = 'cmp-golden';
const USER_ID = 'u-golden';
const nowDate = () => new Date('2026-01-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Capturing bridge — records the exact FinancialEvent the use case sends,
// so the golden test can pin every field of the voucher OUTPUT (the input
// to the bridge = the voucher that would be posted in full mode).
// ---------------------------------------------------------------------------

class CapturingBridge implements IAccountingBridge {
  public events: FinancialEvent[] = [];
  async recordFinancialEvent(event: FinancialEvent): Promise<FinancialEventRecord> {
    this.events.push(event);
    return { mode: 'full', voucher: { id: `vch-golden-${this.events.length}` } as VoucherEntity };
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
// Fixtures (mirrors SalesPostingUseCases.test.ts patterns, self-contained)
// ---------------------------------------------------------------------------

const makeSettings = (overrides: Partial<SalesSettings> = {}): SalesSettings =>
  new SalesSettings({
    companyId: COMPANY_ID,
    allowDirectInvoicing: true,
    requireSOForStockItems: true,
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

const makeItem = (
  id: string,
  opts: {
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
    type: 'PRODUCT',
    baseUom: 'EA',
    purchaseUom: 'EA',
    salesUom: 'EA',
    costCurrency: 'USD',
    costingMethod: 'MOVING_AVG',
    trackInventory: true,
    revenueAccountId: opts.revenueAccountId ?? 'REV-200',
    cogsAccountId: opts.cogsAccountId ?? 'COGS-200',
    inventoryAssetAccountId: opts.inventoryAssetAccountId ?? 'INV-200',
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeSO = (id: string, item: Item, orderedQty = 10): SalesOrder =>
  new SalesOrder({
    id,
    companyId: COMPANY_ID,
    orderNumber: `SO-${id}`,
    customerId: 'cus-1',
    customerName: 'Customer One',
    orderDate: '2026-01-10',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'so-line-1',
        lineNo: 1,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        itemType: item.type,
        trackInventory: true,
        orderedQty,
        uom: 'EA',
        deliveredQty: 0,
        invoicedQty: 0,
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
    status: 'CONFIRMED',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeDN = (id: string, soId: string, item: Item, deliveredQty: number): DeliveryNote =>
  new DeliveryNote({
    id,
    companyId: COMPANY_ID,
    dnNumber: `${id}`,
    salesOrderId: soId,
    customerId: 'cus-1',
    customerName: 'Customer One',
    deliveryDate: '2026-01-11',
    warehouseId: 'wh-1',
    lines: [
      {
        lineId: 'dn-line-1',
        lineNo: 1,
        soLineId: 'so-line-1',
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        deliveredQty,
        uom: 'EA',
        unitCostBase: 0,
        lineCostBase: 0,
        moveCurrency: 'USD',
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
        stockMovementId: null,
      },
    ],
    status: 'DRAFT',
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
      referenceType: 'DELIVERY_NOTE',
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
// Helper: build the use case with a capturing bridge (current signature —
// the 12th arg is the posting service, the 16th is the bridge).
// After migration the 12th arg is removed; the helper will be updated then.
// ---------------------------------------------------------------------------

function buildUseCaseWithBridge(
  bridge: IAccountingBridge,
  opts: {
    item: Item;
    dn: DeliveryNote;
    so: SalesOrder;
    settings?: SalesSettings;
    invMode?: 'PERIODIC' | 'INVOICE_DRIVEN' | 'PERPETUAL';
    invOverrides?: Record<string, any>;
  }
): PostDeliveryNoteUseCase {
  const settings = opts.settings ?? makeSettings();
  return new PostDeliveryNoteUseCase(
    { getSettings: jest.fn(async () => settings) } as any,
    makeInventorySettingsRepository(opts.invMode, opts.invOverrides) as any,
    { getById: jest.fn(async () => opts.dn), update: jest.fn(async () => undefined) } as any,
    { getById: jest.fn(async () => opts.so), update: jest.fn(async () => undefined) } as any,
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

describe('Sales DeliveryNote COGS — golden voucher-output (Task 267-F)', () => {
  it('G1: single-line DN posts COGS voucher with exact account ids, sides, amounts, and metadata', async () => {
    const item = makeItem('gi-1', { cogsAccountId: 'COGS-200', inventoryAssetAccountId: 'INV-200' });
    const so = makeSO('so-g1', item);
    const dn = makeDN('dn-g1', so.id, item, 2);
    const bridge = new CapturingBridge();

    const useCase = buildUseCaseWithBridge(bridge, { item, dn, so });
    await useCase.execute(COMPANY_ID, dn.id);

    expect(bridge.events).toHaveLength(1);
    const sv = bridge.events[0].subledgerVoucher!;

    // Voucher header
    expect(sv.companyId).toBe(COMPANY_ID);
    expect(sv.voucherType).toBe(VoucherType.JOURNAL_ENTRY);
    expect(sv.voucherNo).toBe('DN-dn-g1');
    expect(sv.date).toBe('2026-01-11');
    expect(sv.description).toBe('Delivery Note dn-g1 COGS');
    expect(sv.currency).toBe('USD');
    expect(sv.exchangeRate).toBe(1);
    expect(sv.createdBy).toBe(USER_ID);
    expect(sv.postingLockPolicy).toBe(PostingLockPolicy.FLEXIBLE_LOCKED);
    expect(sv.reference).toBe('dn-g1');
    expect(sv.baseCurrencyOverride).toBe('USD');

    // Source reference metadata
    expect(sv.metadata!.sourceModule).toBe('sales');
    expect(sv.metadata!.sourceType).toBe('DELIVERY_NOTE');
    expect(sv.metadata!.sourceId).toBe(dn.id);
    expect(sv.metadata!.referenceType).toBe('DELIVERY_NOTE');
    expect(sv.metadata!.referenceId).toBe(dn.id);
    expect(sv.metadata!.periodLockOverride).toBeUndefined();

    // Voucher lines: Dr COGS / Cr Inventory, amount = qty(2) * cost(10) = 20
    expect(sv.lines).toHaveLength(2);
    const dr = sv.lines[0];
    const cr = sv.lines[1];
    expect(dr.accountId).toBe('COGS-200');
    expect(dr.side).toBe('Debit');
    expect(dr.amount).toBe(20);
    expect(dr.baseAmount).toBe(20);
    expect(dr.docAmount).toBe(20);
    expect(cr.accountId).toBe('INV-200');
    expect(cr.side).toBe('Credit');
    expect(cr.amount).toBe(20);
    expect(cr.baseAmount).toBe(20);
    expect(cr.docAmount).toBe(20);

    // cogsVoucherId set from the bridge's full-mode return
    const posted = await ({ getById: jest.fn(async () => dn) } as any);
    expect(dn.cogsVoucherId).toBe('vch-golden-1');
  });

  it('G2: minimal mode (engine not initialized) posts NO GL voucher and sets cogsVoucherId = null', async () => {
    const item = makeItem('gi-2', { cogsAccountId: 'COGS-200', inventoryAssetAccountId: 'INV-200' });
    const so = makeSO('so-g2', item);
    const dn = makeDN('dn-g2', so.id, item, 3);
    const bridge = new MinimalBridge();

    const useCase = buildUseCaseWithBridge(bridge, { item, dn, so });
    await useCase.execute(COMPANY_ID, dn.id);

    // The bridge received the event (same voucher output) but returned no voucher.
    expect(bridge.events).toHaveLength(1);
    expect(bridge.events[0].subledgerVoucher!.lines).toHaveLength(2);
    expect(bridge.events[0].subledgerVoucher!.lines[0].amount).toBe(30);

    // No GL voucher id linked.
    expect(dn.cogsVoucherId).toBeNull();
  });

  it('G3: PERIODIC mode does NOT post a COGS voucher (no financial event sent to the bridge)', async () => {
    const item = makeItem('gi-3', { cogsAccountId: 'COGS-200', inventoryAssetAccountId: 'INV-200' });
    const so = makeSO('so-g3', item);
    const dn = makeDN('dn-g3', so.id, item, 2);
    const bridge = new CapturingBridge();

    const useCase = buildUseCaseWithBridge(bridge, { item, dn, so, invMode: 'PERIODIC' });
    await useCase.execute(COMPANY_ID, dn.id);

    expect(bridge.events).toHaveLength(0);
    expect(dn.cogsVoucherId).toBeNull();
  });

  it('G4: COGS fallback to inventory financial settings when item has no explicit accounts', async () => {
    const item = makeItem('gi-4', {});
    (item as any).cogsAccountId = undefined;
    (item as any).inventoryAssetAccountId = undefined;
    const so = makeSO('so-g4', item);
    const dn = makeDN('dn-g4', so.id, item, 5);
    const bridge = new CapturingBridge();

    const useCase = buildUseCaseWithBridge(bridge, {
      item,
      dn,
      so,
      settings: makeSettings({ defaultCOGSAccountId: undefined, defaultInventoryAccountId: undefined }),
      invOverrides: {
        defaultCOGSAccountId: 'INV-COGS-FALLBACK',
        defaultInventoryAssetAccountId: 'INV-ASSET-FALLBACK',
      },
    });
    await useCase.execute(COMPANY_ID, dn.id);

    expect(bridge.events).toHaveLength(1);
    const sv = bridge.events[0].subledgerVoucher!;
    expect(sv.lines).toHaveLength(2);
    expect(sv.lines[0].accountId).toBe('INV-COGS-FALLBACK');
    expect(sv.lines[0].side).toBe('Debit');
    expect(sv.lines[1].accountId).toBe('INV-ASSET-FALLBACK');
    expect(sv.lines[1].side).toBe('Credit');
    // amount = 5 * 10 = 50
    expect(sv.lines[0].amount).toBe(50);
    expect(sv.lines[1].amount).toBe(50);
  });

  it('G5: period-lock override metadata is forwarded into the voucher metadata', async () => {
    const item = makeItem('gi-5', { cogsAccountId: 'COGS-200', inventoryAssetAccountId: 'INV-200' });
    const so = makeSO('so-g5', item);
    const dn = makeDN('dn-g5', so.id, item, 1);
    const bridge = new CapturingBridge();

    const useCase = buildUseCaseWithBridge(bridge, { item, dn, so });
    await useCase.execute(
      COMPANY_ID,
      dn.id,
      true,
      { reason: 'late-shipment', overriddenBy: 'manager-1' },
      { userId: USER_ID, lockedThroughDate: '2026-01-01' }
    );

    expect(bridge.events).toHaveLength(1);
    const sv = bridge.events[0].subledgerVoucher!;
    expect(sv.metadata!.periodLockOverride).toEqual({
      reason: 'late-shipment',
      overriddenBy: 'manager-1',
    });
    // postingLockPolicy stays FLEXIBLE_LOCKED regardless of override
    expect(sv.postingLockPolicy).toBe(PostingLockPolicy.FLEXIBLE_LOCKED);
  });

  it('G6: foreign-currency DN resolves base currency for the voucher and keeps exchangeRate = 1', async () => {
    const item = makeItem('gi-6', { cogsAccountId: 'COGS-EUR', inventoryAssetAccountId: 'INV-EUR' });
    const so = makeSO('so-g6', item);
    const dn = makeDN('dn-g6', so.id, item, 4);
    // movement currency is EUR, base is EUR → resolvedBaseCurrency = 'EUR'
    dn.lines[0].moveCurrency = 'EUR';

    const bridge = new CapturingBridge();

    const useCase = new PostDeliveryNoteUseCase(
      { getSettings: jest.fn(async () => makeSettings()) } as any,
      makeInventorySettingsRepository() as any,
      { getById: jest.fn(async () => dn), update: jest.fn(async () => undefined) } as any,
      { getById: jest.fn(async () => so), update: jest.fn(async () => undefined) } as any,
      makeItemRepo(item) as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
      { getConversionsForItem: jest.fn(async () => []) } as any,
      { getBaseCurrency: jest.fn(async () => 'EUR') } as any,
      makeInventoryService(10) as any,
      makeCompanyModuleRepo() as any,
      undefined,
      makeTransactionManager() as any,
      bridge
    );

    await useCase.execute(COMPANY_ID, dn.id);

    expect(bridge.events).toHaveLength(1);
    const sv = bridge.events[0].subledgerVoucher!;
    expect(sv.currency).toBe('EUR');
    expect(sv.exchangeRate).toBe(1);
    expect(sv.baseCurrencyOverride).toBe('EUR');
    // amount = 4 * 10 = 40
    expect(sv.lines[0].amount).toBe(40);
  });

  it('G7: voucher output is stable — the same DN posted twice through the bridge produces identical subledgerVoucher fields', async () => {
    const item = makeItem('gi-7', { cogsAccountId: 'COGS-200', inventoryAssetAccountId: 'INV-200' });
    const so = makeSO('so-g7', item);
    const dn = makeDN('dn-g7', so.id, item, 3);
    const bridge1 = new CapturingBridge();

    const useCase1 = buildUseCaseWithBridge(bridge1, { item, dn, so });
    await useCase1.execute(COMPANY_ID, dn.id);

    // Reset DN state for a second run
    dn.status = 'DRAFT';
    dn.cogsVoucherId = null;
    const bridge2 = new CapturingBridge();
    const useCase2 = buildUseCaseWithBridge(bridge2, { item, dn, so });
    await useCase2.execute(COMPANY_ID, dn.id);

    expect(bridge1.events).toHaveLength(1);
    expect(bridge2.events).toHaveLength(1);
    const sv1 = bridge1.events[0].subledgerVoucher!;
    const sv2 = bridge2.events[0].subledgerVoucher!;

    // Golden assertion: every field is identical across runs.
    expect(sv2).toEqual(sv1);
  });
});
