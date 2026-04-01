import { roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { InventoryPeriodSnapshot } from '../../../domain/inventory/entities/InventoryPeriodSnapshot';
import { IInventoryPeriodSnapshotRepository } from '../../../repository/interfaces/inventory/IInventoryPeriodSnapshotRepository';
import { IStockLevelRepository } from '../../../repository/interfaces/inventory/IStockLevelRepository';
import { IStockMovementRepository } from '../../../repository/interfaces/inventory/IStockMovementRepository';

export interface CreatePeriodSnapshotInput {
  companyId: string;
  periodKey: string;
}

export interface GetAsOfValuationInput {
  companyId: string;
  asOfDate: string;
}

interface ReplayState {
  itemId: string;
  warehouseId: string;
  qtyOnHand: number;
  avgCostBase: number;
  avgCostCCY: number;
  lastCostBase: number;
  lastCostCCY: number;
}

const buildLevelKey = (itemId: string, warehouseId: string) => `${itemId}__${warehouseId}`;

const isValidPeriodKey = (value: string) => /^\d{4}-\d{2}$/.test(value);
const isValidIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const getPeriodEndDate = (periodKey: string): string => {
  const [yearRaw, monthRaw] = periodKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yearRaw}-${monthRaw}-${String(lastDay).padStart(2, '0')}`;
};

export class CreatePeriodSnapshotUseCase {
  constructor(
    private readonly stockLevelRepo: IStockLevelRepository,
    private readonly snapshotRepo: IInventoryPeriodSnapshotRepository
  ) {}

  async execute(input: CreatePeriodSnapshotInput): Promise<InventoryPeriodSnapshot> {
    if (!isValidPeriodKey(input.periodKey)) {
      throw new Error('periodKey must be in YYYY-MM format');
    }

    const periodEndDate = getPeriodEndDate(input.periodKey);
    const levels = await this.stockLevelRepo.getAllLevels(input.companyId);

    const snapshotData = levels.map((level) => ({
      itemId: level.itemId,
      warehouseId: level.warehouseId,
      qtyOnHand: level.qtyOnHand,
      avgCostBase: level.avgCostBase,
      avgCostCCY: level.avgCostCCY,
      lastCostBase: level.lastCostBase,
      lastCostCCY: level.lastCostCCY,
      valueBase: roundMoney(level.qtyOnHand * level.avgCostBase),
    }));

    const totalValueBase = roundMoney(snapshotData.reduce((sum, line) => sum + line.valueBase, 0));

    const snapshot = new InventoryPeriodSnapshot({
      id: `${input.companyId}_${input.periodKey}`,
      companyId: input.companyId,
      periodKey: input.periodKey,
      periodEndDate,
      snapshotData,
      totalValueBase,
      totalItems: snapshotData.length,
      createdAt: new Date(),
    });

    await this.snapshotRepo.saveSnapshot(snapshot);
    return snapshot;
  }
}

export class GetAsOfValuationUseCase {
  constructor(
    private readonly snapshotRepo: IInventoryPeriodSnapshotRepository,
    private readonly movementRepo: IStockMovementRepository
  ) {}

  async execute(input: GetAsOfValuationInput): Promise<{
    asOfDate: string;
    snapshotPeriodKey?: string;
    totalValueBase: number;
    totalItems: number;
    items: Array<{
      itemId: string;
      warehouseId: string;
      qtyOnHand: number;
      avgCostBase: number;
      avgCostCCY: number;
      lastCostBase: number;
      lastCostCCY: number;
      valueBase: number;
    }>;
  }> {
    if (!isValidIsoDate(input.asOfDate)) {
      throw new Error('asOfDate must be in YYYY-MM-DD format');
    }

    const snapshot = await this.snapshotRepo.findNearestSnapshotForDate(input.companyId, input.asOfDate);
    const state = new Map<string, ReplayState>();

    if (snapshot) {
      snapshot.snapshotData.forEach((line) => {
        const key = buildLevelKey(line.itemId, line.warehouseId);
        state.set(key, {
          itemId: line.itemId,
          warehouseId: line.warehouseId,
          qtyOnHand: line.qtyOnHand,
          avgCostBase: line.avgCostBase,
          avgCostCCY: line.avgCostCCY,
          lastCostBase: line.lastCostBase,
          lastCostCCY: line.lastCostCCY,
        });
      });
    }

    let movements = await this.movementRepo.getMovementsByDateRange(
      input.companyId,
      '1900-01-01',
      input.asOfDate
    );

    if (snapshot) {
      movements = movements.filter((movement) => movement.postedAt > snapshot.createdAt);
    }

    movements.sort((a, b) => {
      const keyA = buildLevelKey(a.itemId, a.warehouseId);
      const keyB = buildLevelKey(b.itemId, b.warehouseId);
      if (keyA !== keyB) return keyA.localeCompare(keyB);
      return a.postingSeq - b.postingSeq;
    });

    for (const movement of movements) {
      if (movement.date > input.asOfDate) continue;

      const key = buildLevelKey(movement.itemId, movement.warehouseId);
      const current = state.get(key) || {
        itemId: movement.itemId,
        warehouseId: movement.warehouseId,
        qtyOnHand: 0,
        avgCostBase: 0,
        avgCostCCY: 0,
        lastCostBase: 0,
        lastCostCCY: 0,
      };

      if (movement.direction === 'IN') {
        const qtyBefore = current.qtyOnHand;

        if (qtyBefore <= 0) {
          current.avgCostBase = movement.unitCostBase;
          current.avgCostCCY = movement.unitCostCCY;
        } else {
          const newQty = qtyBefore + movement.qty;
          if (newQty !== 0) {
            current.avgCostBase = roundMoney(
              ((current.avgCostBase * qtyBefore) + (movement.unitCostBase * movement.qty)) / newQty
            );
            current.avgCostCCY = roundMoney(
              ((current.avgCostCCY * qtyBefore) + (movement.unitCostCCY * movement.qty)) / newQty
            );
          }
        }

        current.qtyOnHand += movement.qty;
        current.lastCostBase = movement.unitCostBase;
        current.lastCostCCY = movement.unitCostCCY;
      } else {
        current.qtyOnHand -= movement.qty;
      }

      state.set(key, current);
    }

    const items = Array.from(state.values())
      .map((line) => ({
        ...line,
        valueBase: roundMoney(line.qtyOnHand * line.avgCostBase),
      }))
      .sort((a, b) => {
        if (a.itemId !== b.itemId) return a.itemId.localeCompare(b.itemId);
        return a.warehouseId.localeCompare(b.warehouseId);
      });

    const totalValueBase = roundMoney(items.reduce((sum, line) => sum + line.valueBase, 0));

    return {
      asOfDate: input.asOfDate,
      snapshotPeriodKey: snapshot?.periodKey,
      totalValueBase,
      totalItems: items.length,
      items,
    };
  }
}
