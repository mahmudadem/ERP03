import { PostOpeningStockDocumentUseCase } from '../../../application/inventory/use-cases/OpeningStockDocumentUseCases';
import {
  FinancialEvent,
  FinancialEventRecord,
  IAccountingBridge,
  PreBuiltVoucherEvent,
} from '../../../application/system-core/contracts/IAccountingBridge';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { OpeningStockDocument } from '../../../domain/inventory/entities/OpeningStockDocument';

const COMPANY_ID = 'cmp-os-golden';
const USER_ID = 'u-os-golden';

class CapturingBridge implements IAccountingBridge {
  public events: FinancialEvent[] = [];

  constructor(private readonly mode: 'full' | 'minimal' = 'full') {}

  async recordFinancialEvent(event: FinancialEvent): Promise<FinancialEventRecord> {
    this.events.push(event);
    return {
      mode: this.mode,
      voucher: this.mode === 'full' ? ({ id: `vch-os-${this.events.length}` } as VoucherEntity) : null,
    };
  }

  async recordPreBuiltVoucher(_event: PreBuiltVoucherEvent): Promise<FinancialEventRecord> {
    throw new Error('Opening Stock should not send prebuilt voucher events');
  }
}

const makeDocument = (overrides: Partial<OpeningStockDocument> = {}) =>
  new OpeningStockDocument({
    id: 'osd-golden-1',
    companyId: COMPANY_ID,
    warehouseId: 'wh-golden-1',
    date: '2026-04-10',
    notes: 'migration batch',
    lines: [
      {
        lineId: 'os-line-1',
        itemId: 'item-golden-1',
        quantity: 5,
        unitCostInMoveCurrency: 10,
        moveCurrency: 'USD',
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
        unitCostBase: 10,
        totalValueBase: 50,
      },
    ],
    status: 'DRAFT',
    createAccountingEffect: true,
    openingBalanceAccountId: 'OPEN-100',
    totalValueBase: 50,
    createdBy: USER_ID,
    createdAt: new Date('2026-04-10T00:00:00.000Z'),
    ...((overrides as any) || {}),
  });

function buildUseCase(
  bridge: IAccountingBridge,
  opts: { mode?: 'PERIODIC' | 'PERPETUAL'; createAccountingEffect?: boolean } = {}
) {
  const document = makeDocument({
    createAccountingEffect: opts.createAccountingEffect ?? true,
    openingBalanceAccountId: opts.createAccountingEffect === false ? undefined : 'OPEN-100',
  });
  const updateDocument = jest.fn(async () => undefined);
  const documentRepo = {
    getDocument: jest.fn()
      .mockResolvedValueOnce(document)
      .mockResolvedValueOnce(makeDocument({
        status: 'POSTED',
        voucherId: bridge instanceof CapturingBridge && bridge.events.length > 0 ? 'vch-os-1' : undefined,
        postedAt: new Date('2026-04-10T01:00:00.000Z'),
        createAccountingEffect: document.createAccountingEffect,
        openingBalanceAccountId: document.openingBalanceAccountId,
      })),
    updateDocument,
  };

  const useCase = new PostOpeningStockDocumentUseCase(
    documentRepo as any,
    {
      getItem: jest.fn(async () => ({
        id: 'item-golden-1',
        companyId: COMPANY_ID,
        code: 'IT-OS',
        name: 'Opening Stock Item',
        type: 'PRODUCT',
        trackInventory: true,
        active: true,
        inventoryAssetAccountId: 'INV-ITEM-100',
      })),
    } as any,
    { getCompanyCategories: jest.fn(async () => []) } as any,
    { getWarehouse: jest.fn(async () => ({ id: 'wh-golden-1', companyId: COMPANY_ID, code: 'MAIN', active: true })) } as any,
    {
      getSettings: jest.fn(async () => ({
        accountingMode: opts.mode ?? 'PERPETUAL',
        inventoryAccountingMethod: opts.mode ?? 'PERPETUAL',
        defaultInventoryAssetAccountId: 'INV-SETTINGS-100',
      })),
    } as any,
    { findById: jest.fn(async () => ({ id: COMPANY_ID, baseCurrency: 'USD' })) } as any,
    { get: jest.fn(async () => ({ companyId: COMPANY_ID, moduleKey: 'accounting', initialized: true })) } as any,
    {
      getById: jest.fn(async (_companyId: string, accountId: string) => ({
        id: accountId,
        accountRole: 'POSTING',
        classification: accountId === 'OPEN-100' ? 'EQUITY' : 'ASSET',
        status: 'ACTIVE',
      })),
    } as any,
    { processIN: jest.fn(async () => undefined) } as any,
    { runTransaction: jest.fn(async (operation: (transaction: unknown) => Promise<unknown>) => operation({ id: 'txn-os' })) } as any,
    bridge
  );

  return { useCase, document, updateDocument };
}

describe('Opening Stock vouchers — golden bridge output (Task 267-F Inventory Opening Stock slice)', () => {
  it('G1: PERPETUAL mode sends exact Inventory/Opening Equity voucher output to the bridge', async () => {
    const bridge = new CapturingBridge();
    const { useCase, document, updateDocument } = buildUseCase(bridge);

    await useCase.execute(COMPANY_ID, document.id, USER_ID);

    expect(bridge.events).toHaveLength(1);
    const event = bridge.events[0];
    const voucher = event.subledgerVoucher!;
    expect(event.kind).toBe('OPENING_STOCK');
    expect(event.transaction).toEqual({ id: 'txn-os' });
    expect(voucher.companyId).toBe(COMPANY_ID);
    expect(voucher.voucherType).toBe('opening_balance');
    expect(voucher.voucherNo).toBe('OS-osd-golden-1');
    expect(voucher.date).toBe('2026-04-10');
    expect(voucher.description).toBe('Opening Stock Document osd-golden-1');
    expect(voucher.currency).toBe('USD');
    expect(voucher.exchangeRate).toBe(1);
    expect(voucher.reference).toBe('osd-golden-1');
    expect(voucher.createdBy).toBe(USER_ID);
    expect(voucher.postingLockPolicy).toBe('FLEXIBLE_LOCKED');
    expect(voucher.metadata).toEqual({
      sourceModule: 'inventory',
      sourceType: 'OPENING_STOCK_DOCUMENT',
      sourceId: 'osd-golden-1',
      warehouseId: 'wh-golden-1',
    });
    expect(voucher.lines).toEqual([]);
    expect(voucher.strategyPayload).toEqual({
      balances: [
        {
          accountId: 'INV-ITEM-100',
          debitBalance: 50,
          creditBalance: 0,
          currency: 'USD',
          exchangeRate: 1,
          metadata: {
            source: 'opening-stock-document',
            openingStockDocumentId: 'osd-golden-1',
          },
        },
        {
          accountId: 'OPEN-100',
          debitBalance: 0,
          creditBalance: 50,
          currency: 'USD',
          exchangeRate: 1,
          metadata: {
            source: 'opening-stock-document',
            openingStockDocumentId: 'osd-golden-1',
            role: 'opening-balance-offset',
          },
        },
      ],
    });
    expect(updateDocument).toHaveBeenCalledWith(
      COMPANY_ID,
      'osd-golden-1',
      expect.objectContaining({ status: 'POSTED', voucherId: 'vch-os-1' }),
      { id: 'txn-os' }
    );
  });

  it('G2: minimal mode sends the same event but links no GL voucher id', async () => {
    const bridge = new CapturingBridge('minimal');
    const { useCase, document, updateDocument } = buildUseCase(bridge);

    await useCase.execute(COMPANY_ID, document.id, USER_ID);

    expect(bridge.events).toHaveLength(1);
    expect(bridge.events[0].subledgerVoucher!.voucherNo).toBe('OS-osd-golden-1');
    expect(updateDocument).toHaveBeenCalledWith(
      COMPANY_ID,
      'osd-golden-1',
      expect.not.objectContaining({ voucherId: expect.anything() }),
      { id: 'txn-os' }
    );
  });

  it('G3: PERIODIC mode uses the inventory settings asset account in the same opening voucher', async () => {
    const bridge = new CapturingBridge();
    const { useCase, document } = buildUseCase(bridge, { mode: 'PERIODIC' });

    await useCase.execute(COMPANY_ID, document.id, USER_ID);

    expect(bridge.events).toHaveLength(1);
    expect(bridge.events[0].subledgerVoucher!.strategyPayload).toEqual({
      balances: expect.arrayContaining([
        expect.objectContaining({ accountId: 'INV-SETTINGS-100', debitBalance: 50 }),
        expect.objectContaining({ accountId: 'OPEN-100', creditBalance: 50 }),
      ]),
    });
    expect(bridge.events[0].subledgerVoucher!.strategyPayload).not.toEqual({
      balances: expect.arrayContaining([expect.objectContaining({ accountId: 'INV-ITEM-100' })]),
    });
  });

  it('G4: inventory-only opening stock creates no bridge event and no GL link', async () => {
    const bridge = new CapturingBridge();
    const { useCase, document, updateDocument } = buildUseCase(bridge, { createAccountingEffect: false });

    await useCase.execute(COMPANY_ID, document.id, USER_ID);

    expect(bridge.events).toHaveLength(0);
    expect(updateDocument).toHaveBeenCalledWith(
      COMPANY_ID,
      'osd-golden-1',
      expect.not.objectContaining({ voucherId: expect.anything() }),
      { id: 'txn-os' }
    );
  });

  it('G5: voucher output is stable across repeated postings', async () => {
    const bridge1 = new CapturingBridge();
    const { useCase: useCase1, document: document1 } = buildUseCase(bridge1);
    await useCase1.execute(COMPANY_ID, document1.id, USER_ID);

    const bridge2 = new CapturingBridge();
    const { useCase: useCase2, document: document2 } = buildUseCase(bridge2);
    await useCase2.execute(COMPANY_ID, document2.id, USER_ID);

    expect(bridge2.events[0].subledgerVoucher).toEqual(bridge1.events[0].subledgerVoucher);
  });
});
