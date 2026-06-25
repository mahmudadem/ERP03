import { describe, expect, it, jest } from '@jest/globals';
import { PostGoodsReceiptUseCase } from '../../../application/purchases/use-cases/GoodsReceiptUseCases';
import {
  FinancialEvent,
  FinancialEventRecord,
  IAccountingBridge,
  PreBuiltVoucherEvent,
} from '../../../application/system-core/contracts/IAccountingBridge';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { Item } from '../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { GoodsReceipt } from '../../../domain/purchases/entities/GoodsReceipt';
import { PurchaseOrder } from '../../../domain/purchases/entities/PurchaseOrder';
import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';

const COMPANY_ID = 'cmp-grn-golden';
const USER_ID = 'u-grn-golden';
const nowDate = () => new Date('2026-01-01T00:00:00.000Z');

class CapturingBridge implements IAccountingBridge {
  public events: FinancialEvent[] = [];

  async recordFinancialEvent(event: FinancialEvent): Promise<FinancialEventRecord> {
    this.events.push(event);
    return { mode: 'full', voucher: { id: `vch-grn-${this.events.length}` } as VoucherEntity };
  }

  async recordPreBuiltVoucher(_event: PreBuiltVoucherEvent): Promise<FinancialEventRecord> {
    throw new Error('Goods Receipt should not send prebuilt voucher events');
  }
}

class MinimalBridge implements IAccountingBridge {
  public events: FinancialEvent[] = [];

  async recordFinancialEvent(event: FinancialEvent): Promise<FinancialEventRecord> {
    this.events.push(event);
    return { mode: 'minimal', voucher: null };
  }

  async recordPreBuiltVoucher(_event: PreBuiltVoucherEvent): Promise<FinancialEventRecord> {
    throw new Error('Goods Receipt should not send prebuilt voucher events');
  }
}

const makeSettings = (): PurchaseSettings =>
  new PurchaseSettings({
    companyId: COMPANY_ID,
    allowDirectInvoicing: false,
    requirePOForStockItems: true,
    defaultAPAccountId: 'AP-100',
    defaultPurchaseExpenseAccountId: 'EXP-100',
    defaultGRNIAccountId: 'GRNI-100',
    allowOverDelivery: false,
    overDeliveryTolerancePct: 0,
    overInvoiceTolerancePct: 0,
    defaultPaymentTermsDays: 30,
    poNumberPrefix: 'PO',
    poNumberNextSeq: 1,
    grnNumberPrefix: 'GRN',
    grnNumberNextSeq: 1,
    piNumberPrefix: 'PI',
    piNumberNextSeq: 1,
    prNumberPrefix: 'PR',
    prNumberNextSeq: 1,
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
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makePO = (item = makeItem()): PurchaseOrder =>
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
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        itemType: item.type,
        trackInventory: true,
        orderedQty: 10,
        receivedQty: 0,
        invoicedQty: 0,
        returnedQty: 0,
        uom: 'EA',
        unitPriceDoc: 10,
        lineTotalDoc: 100,
        unitPriceBase: 10,
        lineTotalBase: 100,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
        warehouseId: 'wh-1',
      },
    ],
    subtotalBase: 100,
    taxTotalBase: 0,
    grandTotalBase: 100,
    subtotalDoc: 100,
    taxTotalDoc: 0,
    grandTotalDoc: 100,
    status: 'CONFIRMED',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeGRN = (item = makeItem()): GoodsReceipt =>
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
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        receivedQty: 2,
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

const makeInventorySettingsRepository = (mode: 'PERIODIC' | 'PERPETUAL' = 'PERPETUAL') => ({
  getSettings: jest.fn(async () => ({
    accountingMode: mode,
    inventoryAccountingMethod: mode === 'PERPETUAL' ? 'PERPETUAL' : 'PERIODIC',
    defaultInventoryAssetAccountId: 'INV-100',
    defaultCOGSAccountId: 'COGS-100',
    costingBasis: 'WAREHOUSE',
  })),
});

const makeCompanyModuleRepo = (initialized = true) => ({
  get: jest.fn(async () => ({ companyId: COMPANY_ID, moduleKey: 'accounting', initialized })),
});

const makeStockLevel = (itemId = 'item-1') =>
  StockLevel.createNew(COMPANY_ID, itemId, 'wh-1');

function buildUseCase(
  bridge: IAccountingBridge,
  opts: { mode?: 'PERIODIC' | 'PERPETUAL'; initialized?: boolean } = {}
) {
  const item = makeItem();
  const po = makePO(item);
  const grn = makeGRN(item);
  const grnStore = new Map([[grn.id, grn]]);

  const useCase = new PostGoodsReceiptUseCase(
    { getSettings: jest.fn(async () => makeSettings()) } as any,
    makeInventorySettingsRepository(opts.mode ?? 'PERPETUAL') as any,
    {
      getById: jest.fn(async (_companyId: string, id: string) => grnStore.get(id) ?? null),
      update: jest.fn(async (updated: GoodsReceipt) => { grnStore.set(updated.id, updated); }),
    } as any,
    {
      getById: jest.fn(async () => po),
      update: jest.fn(async () => undefined),
    } as any,
    {
      getItem: jest.fn(async () => item),
      updateItemInTransaction: jest.fn(async () => undefined),
    } as any,
    { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
    { getConversionsForItem: jest.fn(async () => []) } as any,
    { getBaseCurrency: jest.fn(async () => 'USD') } as any,
    {
      preFetchLevelsByItem: jest.fn(async () => [makeStockLevel(item.id)]),
      writeStockMovement: jest.fn(async () => undefined),
      writeStockLevel: jest.fn(async () => undefined),
    } as any,
    makeCompanyModuleRepo(opts.initialized ?? true) as any,
    undefined,
    { runTransaction: jest.fn(async (fn: (transaction: any) => Promise<any>) => fn({ id: 'txn-grn' })) } as any,
    bridge
  );

  return { useCase, grn };
}

describe('Goods Receipt vouchers — golden bridge output (Task 267-F GRN slice)', () => {
  it('G1: PERPETUAL mode sends exact Inventory/GRNI voucher output to the bridge', async () => {
    const bridge = new CapturingBridge();
    const { useCase, grn } = buildUseCase(bridge);

    await useCase.execute(COMPANY_ID, grn.id);

    expect(bridge.events).toHaveLength(1);
    const event = bridge.events[0];
    const voucher = event.subledgerVoucher!;
    expect(event.kind).toBe('GOODS_RECEIPT');
    expect(voucher.companyId).toBe(COMPANY_ID);
    expect(voucher.voucherType).toBe('journal_entry');
    expect(voucher.voucherNo).toBe('GRN-GRN-00001');
    expect(voucher.date).toBe('2026-01-11');
    expect(voucher.currency).toBe('USD');
    expect(voucher.exchangeRate).toBe(1);
    expect(voucher.reference).toBe('GRN-00001');
    expect(voucher.baseCurrencyOverride).toBe('USD');
    expect(voucher.metadata).toEqual({
      sourceModule: 'purchases',
      sourceType: 'GOODS_RECEIPT',
      sourceId: 'grn-1',
    });
    expect(voucher.lines).toEqual([
      { accountId: 'INV-200', side: 'Debit', amount: 20, baseAmount: 20, docAmount: 20 },
      { accountId: 'GRNI-100', side: 'Credit', amount: 20, baseAmount: 20, docAmount: 20 },
    ]);
    expect(grn.voucherId).toBe('vch-grn-1');
  });

  it('G2: minimal mode sends the same event but links no GL voucher id', async () => {
    const bridge = new MinimalBridge();
    const { useCase, grn } = buildUseCase(bridge);

    await useCase.execute(COMPANY_ID, grn.id);

    expect(bridge.events).toHaveLength(1);
    expect(bridge.events[0].subledgerVoucher!.voucherNo).toBe('GRN-GRN-00001');
    expect(grn.voucherId).toBeNull();
  });

  it('G3: PERIODIC mode creates no GRNI bridge event', async () => {
    const bridge = new CapturingBridge();
    const { useCase, grn } = buildUseCase(bridge, { mode: 'PERIODIC' });

    await useCase.execute(COMPANY_ID, grn.id);

    expect(bridge.events).toHaveLength(0);
    expect(grn.voucherId).toBeNull();
  });
});
