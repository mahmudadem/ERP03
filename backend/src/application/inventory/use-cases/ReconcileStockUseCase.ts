import { IStockLevelRepository } from '../../../repository/interfaces/inventory/IStockLevelRepository';
import { IStockMovementRepository } from '../../../repository/interfaces/inventory/IStockMovementRepository';
import { roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';

export interface ReconcileMismatch {
  key: string;
  itemId: string;
  warehouseId: string;
  levelQty: number;
  movementQty: number;
  difference: number;
  levelAvgCostBase: number;
  replayAvgCostBase: number;
  avgCostBaseDifference: number;
  levelAvgCostCCY: number;
  replayAvgCostCCY: number;
  avgCostCCYDifference: number;
  reason?: 'LEVEL_MISSING' | 'QTY_MISMATCH' | 'AVG_MISMATCH' | 'QTY_AND_AVG_MISMATCH';
}

export interface ReconcileResult {
  matches: boolean;
  checkedLevels: number;
  mismatchCount: number;
  mismatches: ReconcileMismatch[];
}

export class ReconcileStockUseCase {
  constructor(
    private readonly stockLevelRepo: IStockLevelRepository,
    private readonly movementRepo: IStockMovementRepository
  ) {}

  async execute(companyId: string): Promise<ReconcileResult> {
    const [levels, movements] = await Promise.all([
      this.stockLevelRepo.getAllLevels(companyId),
      this.movementRepo.getMovementsByDateRange(companyId, '1900-01-01', '2999-12-31'),
    ]);

    const levelByKey = new Map<string, (typeof levels)[number]>();
    levels.forEach((level) => levelByKey.set(`${level.itemId}_${level.warehouseId}`, level));

    const movementByKey = new Map<string, StockMovement[]>();
    for (const movement of movements) {
      const key = `${movement.itemId}_${movement.warehouseId}`;
      const list = movementByKey.get(key) || [];
      list.push(movement);
      movementByKey.set(key, list);
    }

    const allKeys = new Set<string>([
      ...Array.from(levelByKey.keys()),
      ...Array.from(movementByKey.keys()),
    ]);

    const mismatches: ReconcileMismatch[] = [];
    const tolerance = 0.0001;

    for (const key of allKeys) {
      const level = levelByKey.get(key) || null;
      const keyMovements = (movementByKey.get(key) || []).slice().sort((a, b) => {
        if (a.postingSeq !== b.postingSeq) return a.postingSeq - b.postingSeq;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      const replayed = this.replayStockState(keyMovements);

      const levelQty = level?.qtyOnHand ?? 0;
      const movementQty = replayed.qtyOnHand;
      const difference = levelQty - movementQty;

      const levelAvgCostBase = level?.avgCostBase ?? 0;
      const replayAvgCostBase = replayed.avgCostBase;
      const avgCostBaseDifference = levelAvgCostBase - replayAvgCostBase;

      const levelAvgCostCCY = level?.avgCostCCY ?? 0;
      const replayAvgCostCCY = replayed.avgCostCCY;
      const avgCostCCYDifference = levelAvgCostCCY - replayAvgCostCCY;

      const hasQtyMismatch = Math.abs(difference) > tolerance;
      const hasAvgMismatch =
        Math.abs(avgCostBaseDifference) > tolerance ||
        Math.abs(avgCostCCYDifference) > tolerance;

      if (!level || hasQtyMismatch || hasAvgMismatch) {
        const source = level || keyMovements[0];
        if (!source) continue;

        let reason: ReconcileMismatch['reason'];
        if (!level) reason = 'LEVEL_MISSING';
        else if (hasQtyMismatch && hasAvgMismatch) reason = 'QTY_AND_AVG_MISMATCH';
        else if (hasQtyMismatch) reason = 'QTY_MISMATCH';
        else reason = 'AVG_MISMATCH';

        mismatches.push({
          key,
          itemId: source.itemId,
          warehouseId: source.warehouseId,
          levelQty,
          movementQty,
          difference,
          levelAvgCostBase,
          replayAvgCostBase,
          avgCostBaseDifference,
          levelAvgCostCCY,
          replayAvgCostCCY,
          avgCostCCYDifference,
          reason,
        });
      }
    }

    return {
      matches: mismatches.length === 0,
      checkedLevels: allKeys.size,
      mismatchCount: mismatches.length,
      mismatches,
    };
  }

  private replayStockState(movements: StockMovement[]): {
    qtyOnHand: number;
    avgCostBase: number;
    avgCostCCY: number;
    lastCostBase: number;
    lastCostCCY: number;
  } {
    let qtyOnHand = 0;
    let avgCostBase = 0;
    let avgCostCCY = 0;
    let lastCostBase = 0;
    let lastCostCCY = 0;

    for (const movement of movements) {
      if (movement.direction === 'IN') {
        const qtyBefore = qtyOnHand;

        if (qtyBefore <= 0) {
          avgCostBase = movement.unitCostBase;
          avgCostCCY = movement.unitCostCCY;
        } else {
          const newQty = qtyBefore + movement.qty;
          avgCostBase = roundMoney(
            ((avgCostBase * qtyBefore) + (movement.unitCostBase * movement.qty)) / newQty
          );
          avgCostCCY = roundMoney(
            ((avgCostCCY * qtyBefore) + (movement.unitCostCCY * movement.qty)) / newQty
          );
        }

        qtyOnHand += movement.qty;
        lastCostBase = movement.unitCostBase;
        lastCostCCY = movement.unitCostCCY;
      } else {
        qtyOnHand -= movement.qty;
      }
    }

    return {
      qtyOnHand,
      avgCostBase,
      avgCostCCY,
      lastCostBase,
      lastCostCCY,
    };
  }
}
