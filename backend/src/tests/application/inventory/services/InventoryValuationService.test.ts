import { InventoryValuationService } from '../../../../application/inventory/services/InventoryValuationService';
import { Item } from '../../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../../domain/inventory/entities/StockLevel';
import { StockMovement } from '../../../../domain/inventory/entities/StockMovement';

const createItem = (id: string, costingStats?: any) =>
  new Item({
    id,
    companyId: 'c1',
    code: `ITEM-${id}`,
    name: `Item ${id}`,
    type: 'PRODUCT',
    baseUom: 'PCS',
    costCurrency: 'USD',
    costingMethod: 'MOVING_AVG',
    trackInventory: true,
    costingStats,
    active: true,
    createdBy: 'u1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

const createLevel = (itemId: string, warehouseId: string, qtyOnHand: number, avgCostBase: number, lastCostBase: number) =>
  new StockLevel({
    id: `${itemId}_${warehouseId}`,
    companyId: 'c1',
    itemId,
    warehouseId,
    qtyOnHand,
    reservedQty: 0,
    avgCostBase,
    avgCostCCY: avgCostBase,
    lastCostBase,
    lastCostCCY: lastCostBase,
    postingSeq: 1,
    maxBusinessDate: '2026-01-31',
    totalMovements: 1,
    lastMovementId: 'm1',
    version: 1,
    updatedAt: new Date('2026-01-31T00:00:00.000Z'),
  });

const createMovement = (overrides: Partial<Record<string, any>> = {}) =>
  new StockMovement({
    id: overrides.id || `m_${Math.random().toString(36).slice(2, 8)}`,
    companyId: 'c1',
    date: overrides.date || '2026-01-10',
    postingSeq: overrides.postingSeq || 1,
    createdAt: overrides.createdAt || new Date('2026-01-10T00:00:00.000Z'),
    createdBy: 'u1',
    postedAt: overrides.postedAt || new Date('2026-01-10T00:00:00.000Z'),
    itemId: overrides.itemId || 'i1',
    warehouseId: overrides.warehouseId || 'w1',
    direction: overrides.direction || 'IN',
    movementType: overrides.movementType || 'PURCHASE_RECEIPT',
    qty: overrides.qty || 1,
    uom: 'PCS',
    referenceType: overrides.referenceType || 'PURCHASE_INVOICE',
    referenceId: overrides.referenceId || 'doc-1',
    transferPairId: overrides.transferPairId,
    unitCostBase: overrides.unitCostBase || 10,
    totalCostBase: overrides.totalCostBase || ((overrides.unitCostBase || 10) * (overrides.qty || 1)),
    unitCostCCY: overrides.unitCostCCY || overrides.unitCostBase || 10,
    totalCostCCY: overrides.totalCostCCY || ((overrides.unitCostCCY || overrides.unitCostBase || 10) * (overrides.qty || 1)),
    movementCurrency: 'USD',
    fxRateMovToBase: 1,
    fxRateCCYToBase: 1,
    fxRateKind: overrides.fxRateKind || 'DOCUMENT',
    avgCostBaseAfter: overrides.avgCostBaseAfter || overrides.unitCostBase || 10,
    avgCostCCYAfter: overrides.avgCostCCYAfter || overrides.unitCostCCY || overrides.unitCostBase || 10,
    qtyBefore: overrides.qtyBefore || 0,
    qtyAfter: overrides.qtyAfter || (overrides.qty || 1),
    settledQty: overrides.direction === 'OUT' ? (overrides.settledQty ?? (overrides.qty || 1)) : undefined,
    unsettledQty: overrides.direction === 'OUT' ? (overrides.unsettledQty ?? 0) : undefined,
    unsettledCostBasis: overrides.direction === 'OUT' ? overrides.unsettledCostBasis : undefined,
    settlesNegativeQty: overrides.direction === 'IN' ? (overrides.settlesNegativeQty ?? 0) : undefined,
    newPositiveQty: overrides.direction === 'IN' ? (overrides.newPositiveQty ?? (overrides.qty || 1)) : undefined,
    negativeQtyAtPosting: overrides.negativeQtyAtPosting || false,
    costSettled: overrides.costSettled ?? true,
    isBackdated: overrides.isBackdated || false,
    costSource: overrides.costSource || 'PURCHASE',
    notes: overrides.notes,
    metadata: overrides.metadata,
  } as any);

describe('InventoryValuationService', () => {
  it('uses current item last purchase cost for live LAST_PURCHASE valuation', async () => {
    const itemRepo = {
      getCompanyItems: jest.fn().mockResolvedValue([
        createItem('i1', {
          avgCost: { base: 10, ccy: 10, currency: 'USD', fxRateToBase: 1, asOf: '2026-01-31' },
          lastPurchaseCost: { base: 14, ccy: 14, currency: 'USD', fxRateToBase: 1, asOf: '2026-01-30' },
        }),
      ]),
    } as any;
    const stockLevelRepo = {
      getAllLevels: jest.fn().mockResolvedValue([createLevel('i1', 'w1', 2, 10, 11)]),
    } as any;
    const stockMovementRepo = {} as any;
    const inventorySettingsRepo = {
      getSettings: jest.fn().mockResolvedValue({ accountingMode: 'PERPETUAL', costingBasis: 'WAREHOUSE' }),
    } as any;

    const service = new InventoryValuationService(itemRepo, stockLevelRepo, stockMovementRepo, inventorySettingsRepo);
    const result = await service.value('c1', '2099-01-31', 'LAST_PURCHASE');

    expect(result.totalValueBase).toBe(28);
    expect(result.items[0].pricingUnitCostBase).toBe(14);
    expect(result.items[0].valueBase).toBe(28);
  });

  it('replays historical movement state and propagates GLOBAL average restatements', async () => {
    const itemRepo = {
      getCompanyItems: jest.fn().mockResolvedValue([createItem('i1')]),
    } as any;
    const stockLevelRepo = {} as any;
    const stockMovementRepo = {
      getMovementsByDateRange: jest.fn().mockResolvedValue([
        createMovement({
          id: 'm1',
          date: '2026-01-01',
          postedAt: new Date('2026-01-01T00:00:00.000Z'),
          itemId: 'i1',
          warehouseId: 'w1',
          direction: 'IN',
          movementType: 'PURCHASE_RECEIPT',
          qty: 5,
          qtyBefore: 0,
          qtyAfter: 5,
          unitCostBase: 10,
          avgCostBaseAfter: 10,
        }),
        createMovement({
          id: 'm2',
          date: '2026-01-02',
          postedAt: new Date('2026-01-02T00:00:00.000Z'),
          itemId: 'i1',
          warehouseId: 'w2',
          direction: 'IN',
          movementType: 'PURCHASE_RECEIPT',
          qty: 5,
          qtyBefore: 0,
          qtyAfter: 5,
          unitCostBase: 10,
          avgCostBaseAfter: 10,
        }),
        createMovement({
          id: 'm3',
          date: '2026-01-03',
          postedAt: new Date('2026-01-03T00:00:00.000Z'),
          itemId: 'i1',
          warehouseId: 'w1',
          direction: 'OUT',
          movementType: 'TRANSFER_OUT',
          referenceType: 'STOCK_TRANSFER',
          qty: 1,
          qtyBefore: 5,
          qtyAfter: 4,
          unitCostBase: 10,
          avgCostBaseAfter: 12,
          settledQty: 1,
          unsettledQty: 0,
          costSource: 'TRANSFER',
          transferPairId: 'tp1',
        }),
        createMovement({
          id: 'm4',
          date: '2026-01-03',
          postedAt: new Date('2026-01-03T00:00:01.000Z'),
          itemId: 'i1',
          warehouseId: 'w2',
          direction: 'IN',
          movementType: 'TRANSFER_IN',
          referenceType: 'STOCK_TRANSFER',
          qty: 1,
          qtyBefore: 5,
          qtyAfter: 6,
          unitCostBase: 14,
          avgCostBaseAfter: 12,
          settlesNegativeQty: 0,
          newPositiveQty: 1,
          costSource: 'TRANSFER',
          transferPairId: 'tp1',
        }),
      ]),
    } as any;
    const inventorySettingsRepo = {
      getSettings: jest.fn().mockResolvedValue({ accountingMode: 'PERIODIC', costingBasis: 'GLOBAL' }),
    } as any;

    const service = new InventoryValuationService(itemRepo, stockLevelRepo, stockMovementRepo, inventorySettingsRepo);
    const result = await service.value('c1', '2026-01-31', 'AVERAGE');

    expect(result.totalValueBase).toBe(120);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ warehouseId: 'w1', qtyOnHand: 4, avgCostBase: 12, valueBase: 48 }),
        expect.objectContaining({ warehouseId: 'w2', qtyOnHand: 6, avgCostBase: 12, valueBase: 72 }),
      ])
    );
  });
});
