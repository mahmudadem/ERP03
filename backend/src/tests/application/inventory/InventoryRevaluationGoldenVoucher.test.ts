import { PostInventoryRevaluationUseCase } from '../../../application/inventory/use-cases/InventoryRevaluationUseCases';
import {
  FinancialEvent,
  FinancialEventRecord,
  IAccountingBridge,
  PreBuiltVoucherEvent,
} from '../../../application/system-core/contracts/IAccountingBridge';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { InventoryRevaluation } from '../../../domain/inventory/entities/InventoryRevaluation';

const COMPANY_ID = 'cmp-rev-golden';
const USER_ID = 'u-rev-golden';

class CapturingBridge implements IAccountingBridge {
  public events: FinancialEvent[] = [];

  constructor(private readonly mode: 'full' | 'minimal' = 'full') {}

  async recordFinancialEvent(event: FinancialEvent): Promise<FinancialEventRecord> {
    this.events.push(event);
    return {
      mode: this.mode,
      voucher: this.mode === 'full' ? ({ id: `vch-rev-${this.events.length}` } as VoucherEntity) : null,
    };
  }

  async recordPreBuiltVoucher(_event: PreBuiltVoucherEvent): Promise<FinancialEventRecord> {
    throw new Error('Inventory Revaluation should not send prebuilt voucher events');
  }
}

const makeRevaluation = (newAvgCostBase = 7) =>
  new InventoryRevaluation({
    id: 'rev-golden-1',
    companyId: COMPANY_ID,
    date: '2026-06-20',
    reason: 'COST_CORRECTION',
    lines: [{
      itemId: 'item-1',
      warehouseId: 'wh-1',
      qtyOnHand: 10,
      currentAvgCostBase: 5,
      currentAvgCostCCY: 5,
      newAvgCostBase,
      newAvgCostCCY: newAvgCostBase,
      valueDeltaBase: 10 * (newAvgCostBase - 5),
      valueDeltaCCY: 10 * (newAvgCostBase - 5),
    }],
    status: 'DRAFT',
    totalValueDeltaBase: 10 * (newAvgCostBase - 5),
    totalValueDeltaCCY: 10 * (newAvgCostBase - 5),
    createdBy: USER_ID,
    createdAt: new Date('2026-06-20T00:00:00.000Z'),
  });

function buildUseCase(
  bridge: IAccountingBridge,
  opts: { mode?: 'PERIODIC' | 'INVOICE_DRIVEN'; newAvgCostBase?: number } = {}
) {
  const revaluation = makeRevaluation(opts.newAvgCostBase ?? 7);
  const updateRevaluation = jest.fn(async () => undefined);
  const levels = [{
    itemId: 'item-1',
    warehouseId: 'wh-1',
    qtyOnHand: 10,
    avgCostBase: 5,
    avgCostCCY: 5,
    version: 0,
    companyId: COMPANY_ID,
    updatedAt: new Date('2026-06-20T00:00:00.000Z'),
  }];
  const useCase = new PostInventoryRevaluationUseCase(
    {
      getRevaluation: jest.fn()
        .mockResolvedValueOnce(revaluation)
        .mockResolvedValueOnce(new InventoryRevaluation({ ...revaluation.toJSON(), status: 'POSTED', voucherId: 'vch-rev-1' } as any)),
      updateRevaluation,
    } as any,
    {
      getItem: jest.fn(async () => ({
        id: 'item-1',
        companyId: COMPANY_ID,
        code: 'ITM-REV',
        costCurrency: 'USD',
        inventoryAssetAccountId: 'INV-100',
        costingStats: { avgCost: { base: 5, ccy: 5, currency: 'USD', fxRateToBase: 1, asOf: '2026-06-01' } },
      })),
      updateItemInTransaction: jest.fn(async () => undefined),
    } as any,
    {
      getLevelInTransaction: jest.fn(async () => levels[0]),
      getLevelsByItemInTransaction: jest.fn(async () => levels),
      upsertLevelInTransaction: jest.fn(async () => undefined),
    } as any,
    {
      getSettings: jest.fn(async () => ({
        costingBasis: 'WAREHOUSE',
        accountingMode: opts.mode ?? 'INVOICE_DRIVEN',
        defaultInventoryAssetAccountId: 'INV-DEFAULT',
        defaultInventoryRevaluationAccountId: 'REV-100',
        defaultCostCurrency: 'USD',
      })),
    } as any,
    { runTransaction: jest.fn(async (operation: (transaction: unknown) => Promise<unknown>) => operation({ id: 'txn-rev' })) } as any,
    { get: jest.fn(async () => ({ companyId: COMPANY_ID, moduleKey: 'accounting', initialized: true })) } as any,
    bridge
  );

  return { useCase, revaluation, updateRevaluation };
}

describe('Inventory Revaluation vouchers — golden bridge output (Task 267-F Inventory Revaluation slice)', () => {
  it('G1: write-up sends exact Inventory/Revaluation voucher output to the bridge', async () => {
    const bridge = new CapturingBridge();
    const { useCase, revaluation, updateRevaluation } = buildUseCase(bridge);

    await useCase.execute(COMPANY_ID, revaluation.id, USER_ID);

    expect(bridge.events).toHaveLength(1);
    const event = bridge.events[0];
    const voucher = event.subledgerVoucher!;
    expect(event.kind).toBe('INVENTORY_REVALUATION');
    expect(event.transaction).toEqual({ id: 'txn-rev' });
    expect(voucher.companyId).toBe(COMPANY_ID);
    expect(voucher.voucherType).toBe('journal_entry');
    expect(voucher.voucherNo).toBe('REV-rev-golden-1');
    expect(voucher.date).toBe('2026-06-20');
    expect(voucher.description).toBe('Inventory revaluation rev-golden-1 (COST_CORRECTION)');
    expect(voucher.reference).toBe('rev-golden-1');
    expect(voucher.createdBy).toBe(USER_ID);
    expect(voucher.postingLockPolicy).toBe('FLEXIBLE_LOCKED');
    expect(voucher.metadata).toEqual({
      sourceModule: 'inventory',
      referenceType: 'INVENTORY_REVALUATION',
      referenceId: 'rev-golden-1',
      revaluationId: 'rev-golden-1',
      revaluationReason: 'COST_CORRECTION',
      totalValueDeltaBase: 20,
    });
    expect(voucher.lines).toEqual([
      expect.objectContaining({
        accountId: 'INV-100',
        side: 'Debit',
        amount: 20,
        baseAmount: 20,
        docAmount: 20,
        metadata: expect.objectContaining({ direction: 'WRITE_UP', itemId: 'item-1', warehouseId: 'wh-1' }),
      }),
      expect.objectContaining({
        accountId: 'REV-100',
        side: 'Credit',
        amount: 20,
        baseAmount: 20,
        docAmount: 20,
        metadata: expect.objectContaining({ direction: 'WRITE_UP', itemId: 'item-1', warehouseId: 'wh-1' }),
      }),
    ]);
    expect(updateRevaluation).toHaveBeenCalledWith(
      COMPANY_ID,
      'rev-golden-1',
      expect.objectContaining({ status: 'POSTED', voucherId: 'vch-rev-1', totalValueDeltaBase: 20 }),
      { id: 'txn-rev' }
    );
  });

  it('G2: write-down reverses sides and uses absolute delta amount', async () => {
    const bridge = new CapturingBridge();
    const { useCase, revaluation } = buildUseCase(bridge, { newAvgCostBase: 4 });

    await useCase.execute(COMPANY_ID, revaluation.id, USER_ID);

    expect(bridge.events[0].subledgerVoucher!.lines).toEqual([
      expect.objectContaining({ accountId: 'REV-100', side: 'Debit', amount: 10, baseAmount: 10 }),
      expect.objectContaining({ accountId: 'INV-100', side: 'Credit', amount: 10, baseAmount: 10 }),
    ]);
  });

  it('G3: minimal mode sends the same event but links no GL voucher id', async () => {
    const bridge = new CapturingBridge('minimal');
    const { useCase, revaluation, updateRevaluation } = buildUseCase(bridge);

    await useCase.execute(COMPANY_ID, revaluation.id, USER_ID);

    expect(bridge.events).toHaveLength(1);
    expect(updateRevaluation).toHaveBeenCalledWith(
      COMPANY_ID,
      'rev-golden-1',
      expect.objectContaining({ status: 'POSTED', voucherId: null }),
      { id: 'txn-rev' }
    );
  });

  it('G4: PERIODIC mode creates no bridge event and links no GL voucher', async () => {
    const bridge = new CapturingBridge();
    const { useCase, revaluation, updateRevaluation } = buildUseCase(bridge, { mode: 'PERIODIC' });

    await useCase.execute(COMPANY_ID, revaluation.id, USER_ID);

    expect(bridge.events).toHaveLength(0);
    expect(updateRevaluation).toHaveBeenCalledWith(
      COMPANY_ID,
      'rev-golden-1',
      expect.objectContaining({ status: 'POSTED', voucherId: null }),
      { id: 'txn-rev' }
    );
  });

  it('G5: voucher output is stable across repeated postings', async () => {
    const bridge1 = new CapturingBridge();
    const { useCase: useCase1, revaluation: revaluation1 } = buildUseCase(bridge1);
    await useCase1.execute(COMPANY_ID, revaluation1.id, USER_ID);

    const bridge2 = new CapturingBridge();
    const { useCase: useCase2, revaluation: revaluation2 } = buildUseCase(bridge2);
    await useCase2.execute(COMPANY_ID, revaluation2.id, USER_ID);

    expect(bridge2.events[0].subledgerVoucher).toEqual(bridge1.events[0].subledgerVoucher);
  });
});
