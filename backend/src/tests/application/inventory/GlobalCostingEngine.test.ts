import { RecordStockMovementUseCase } from '../../../application/inventory/use-cases/RecordStockMovementUseCase';
import { Item } from '../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';

/**
 * Locks the GLOBAL costing basis: ONE company-wide moving average per item,
 * shared by every warehouse. The defining property is that a warehouse issues
 * (COGS) at the company average — not at the price it personally received — and
 * a receipt into one location re-prices stock held in every other location.
 *
 * WAREHOUSE costing (the default) is covered by RecordStockMovementUseCase.test;
 * this file exercises only the GLOBAL branch.
 */

const COMPANY_ID = 'cmp-1';
const ITEM_ID = 'item-1';
const WH_A = 'wh-a';
const WH_B = 'wh-b';
const WH_C = 'wh-c';
const BASE = 'USD';

class InMemoryLevelRepo {
  readonly levels = new Map<string, StockLevel>();

  seed(level: StockLevel): void {
    this.levels.set(level.id, level);
  }

  async getLevel(companyId: string, itemId: string, warehouseId: string): Promise<StockLevel | null> {
    const lvl = this.levels.get(StockLevel.compositeId(itemId, warehouseId));
    return lvl && lvl.companyId === companyId ? lvl : null;
  }

  async getLevelsByItem(companyId: string, itemId: string): Promise<StockLevel[]> {
    return Array.from(this.levels.values()).filter((l) => l.companyId === companyId && l.itemId === itemId);
  }

  async getLevelsByWarehouse(): Promise<StockLevel[]> {
    return [];
  }

  async getAllLevels(companyId: string): Promise<StockLevel[]> {
    return Array.from(this.levels.values()).filter((l) => l.companyId === companyId);
  }

  async upsertLevel(level: StockLevel): Promise<void> {
    this.levels.set(level.id, level);
  }

  async getLevelInTransaction(_t: unknown, companyId: string, itemId: string, warehouseId: string): Promise<StockLevel | null> {
    return this.getLevel(companyId, itemId, warehouseId);
  }

  async getLevelsByItemInTransaction(_t: unknown, companyId: string, itemId: string): Promise<StockLevel[]> {
    return this.getLevelsByItem(companyId, itemId);
  }

  async upsertLevelInTransaction(_t: unknown, level: StockLevel): Promise<void> {
    this.levels.set(level.id, level);
  }
}

class InMemoryMovementRepo {
  readonly movements: StockMovement[] = [];
  async recordMovement(m: StockMovement): Promise<void> {
    this.movements.push(m);
  }
  async getItemMovements(): Promise<StockMovement[]> {
    return this.movements;
  }
  async getMovement(): Promise<StockMovement | null> {
    return null;
  }
  async deleteMovement(): Promise<void> {
    /* not used */
  }
}

const makeItem = (): Item =>
  new Item({
    id: ITEM_ID,
    companyId: COMPANY_ID,
    code: 'ITM-1',
    name: 'Item 1',
    type: 'PRODUCT',
    baseUom: 'pcs',
    costCurrency: BASE,
    costingMethod: 'MOVING_AVG',
    trackInventory: true,
    active: true,
    createdBy: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const build = (costingBasis: 'GLOBAL' | 'WAREHOUSE' = 'GLOBAL') => {
  const levelRepo = new InMemoryLevelRepo();
  const movementRepo = new InMemoryMovementRepo();
  const item = makeItem();

  const useCase = new RecordStockMovementUseCase({
    itemRepository: { getItem: async () => item } as any,
    warehouseRepository: { getWarehouse: async (id: string) => ({ id }) } as any,
    stockMovementRepository: movementRepo as any,
    stockLevelRepository: levelRepo as any,
    companyRepository: { findById: async () => ({ id: COMPANY_ID, baseCurrency: BASE }) } as any,
    inventorySettingsRepository: {
      getSettings: async () => ({ costingBasis, allowNegativeStock: true }),
    } as any,
    transactionManager: { runTransaction: async (fn: any) => fn({}) } as any,
  });

  const IN = (warehouseId: string, qty: number, unitCost: number, date = '2026-01-10') =>
    useCase.processIN({
      companyId: COMPANY_ID,
      itemId: ITEM_ID,
      warehouseId,
      qty,
      date,
      movementType: 'PURCHASE_RECEIPT',
      refs: { type: 'PURCHASE_INVOICE', docId: 'p1' },
      currentUser: 'u1',
      unitCostInMoveCurrency: unitCost,
      moveCurrency: BASE,
      fxRateMovToBase: 1,
      fxRateCCYToBase: 1,
      preFetchedItem: item,
      baseCurrency: BASE,
    });

  const OUT = (warehouseId: string, qty: number, date = '2026-01-11') =>
    useCase.processOUT({
      companyId: COMPANY_ID,
      itemId: ITEM_ID,
      warehouseId,
      qty,
      date,
      movementType: 'SALES_DELIVERY',
      refs: { type: 'SALES_INVOICE', docId: 's1' },
      currentUser: 'u1',
      preFetchedItem: item,
    });

  const TRANSFER = (
    qty: number,
    opts: { landedCostBase?: number } = {},
    date = '2026-01-12'
  ) =>
    useCase.processTRANSFER({
      companyId: COMPANY_ID,
      itemId: ITEM_ID,
      sourceWarehouseId: WH_A,
      destinationWarehouseId: WH_B,
      qty,
      date,
      transferDocId: 'trf-1',
      currentUser: 'u1',
      destUnitCostOverrideBase: opts.landedCostBase,
      destUnitCostOverrideCCY: opts.landedCostBase,
    });

  const avgAt = async (warehouseId: string) =>
    (await levelRepo.getLevel(COMPANY_ID, ITEM_ID, warehouseId))?.avgCostBase;
  const qtyAt = async (warehouseId: string) =>
    (await levelRepo.getLevel(COMPANY_ID, ITEM_ID, warehouseId))?.qtyOnHand;

  return { useCase, levelRepo, movementRepo, IN, OUT, TRANSFER, avgAt, qtyAt };
};

describe('RecordStockMovementUseCase — GLOBAL costing basis', () => {
  it('re-blends the company-wide average across warehouses on receipt', async () => {
    const { IN, avgAt, qtyAt } = build('GLOBAL');

    await IN(WH_A, 10, 5); // A: 10 @ 5  → global avg 5
    expect(await avgAt(WH_A)).toBe(5);

    await IN(WH_B, 10, 7); // B: 10 @ 7  → global (50+70)/20 = 6
    // Both locations now carry the SAME company-wide average.
    expect(await avgAt(WH_A)).toBe(6);
    expect(await avgAt(WH_B)).toBe(6);
    expect(await qtyAt(WH_A)).toBe(10);
    expect(await qtyAt(WH_B)).toBe(10);
  });

  it('issues COGS at the company average, even from a warehouse that received cheaper/dearer stock', async () => {
    const { IN, OUT } = build('GLOBAL');

    await IN(WH_A, 10, 5);
    await IN(WH_B, 10, 7); // global avg 6

    // WH-B received at 7 but must issue at the company-wide 6.
    const out = await OUT(WH_B, 3);
    expect(out.unitCostBase).toBe(6);
    expect(out.totalCostBase).toBe(18);
    expect(out.avgCostBaseAfter).toBe(6);
  });

  it('leaves the average unchanged on issue and keeps untouched warehouses in sync', async () => {
    const { IN, OUT, avgAt, qtyAt } = build('GLOBAL');

    await IN(WH_A, 10, 5);
    await IN(WH_B, 10, 7); // global avg 6

    await OUT(WH_A, 5); // average is unchanged by an issue
    expect(await avgAt(WH_A)).toBe(6);
    expect(await avgAt(WH_B)).toBe(6);
    expect(await qtyAt(WH_A)).toBe(5);
    expect(await qtyAt(WH_B)).toBe(10);
  });

  it('FLAT transfer moves quantity without moving the company average', async () => {
    const { IN, TRANSFER, avgAt, qtyAt } = build('GLOBAL');

    await IN(WH_A, 10, 5);
    await IN(WH_B, 10, 7); // global avg 6, total qty 20, value 120

    const { outMov, inMov } = await TRANSFER(4); // FLAT (no landed override)
    expect(outMov.unitCostBase).toBe(6);
    expect(inMov.unitCostBase).toBe(6);
    expect(await avgAt(WH_A)).toBe(6);
    expect(await avgAt(WH_B)).toBe(6);
    expect(await qtyAt(WH_A)).toBe(6);
    expect(await qtyAt(WH_B)).toBe(14);
  });

  it('VALUED transfer capitalizes the uplift into the company average', async () => {
    const { IN, TRANSFER, avgAt } = build('GLOBAL');

    await IN(WH_A, 10, 5);
    await IN(WH_B, 10, 5); // global avg 5, qty 20, value 100

    // Move 5 from A→B landing at 9 (e.g. +freight). Uplift = (9-5)*5 = 20.
    const { outMov, inMov } = await TRANSFER(5, { landedCostBase: 9 });
    expect(outMov.unitCostBase).toBe(5); // source issues at the company average
    expect(inMov.unitCostBase).toBe(9); // destination lands at the valued cost
    // inMov.total − outMov.total = uplift the clearing voucher will capitalize.
    expect(inMov.totalCostBase - outMov.totalCostBase).toBe(20);

    // New company average = (100 + 20) / 20 = 6, restated everywhere.
    expect(await avgAt(WH_A)).toBe(6);
    expect(await avgAt(WH_B)).toBe(6);
  });

  it('restates a third warehouse that was not part of the receipt', async () => {
    const { IN, avgAt } = build('GLOBAL');

    await IN(WH_A, 10, 5);
    await IN(WH_B, 10, 5);
    await IN(WH_C, 10, 5); // three locations, company avg 5, qty 30, value 150
    // A dear receipt into A must lift the carried average in B and C too.
    await IN(WH_A, 10, 9); // (150 + 90) / 40 = 6
    expect(await avgAt(WH_A)).toBe(6);
    expect(await avgAt(WH_B)).toBe(6);
    expect(await avgAt(WH_C)).toBe(6);
  });

  it('does not touch the WAREHOUSE path (sanity): per-warehouse averages stay independent', async () => {
    const { IN, avgAt } = build('WAREHOUSE');

    await IN(WH_A, 10, 5);
    await IN(WH_B, 10, 7);
    // Under WAREHOUSE costing each location keeps its own average.
    expect(await avgAt(WH_A)).toBe(5);
    expect(await avgAt(WH_B)).toBe(7);
  });
});
