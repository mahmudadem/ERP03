import { IStockLevelRepository } from '../../../repository/interfaces/inventory/IStockLevelRepository';
import { IStockMovementRepository } from '../../../repository/interfaces/inventory/IStockMovementRepository';
import { IInventoryRevaluationRepository } from '../../../repository/interfaces/inventory/IInventoryRevaluationRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import {
  applyMovementToReplayState,
  applyRevaluationToReplayState,
  buildInventoryReplayEvents,
  buildLevelKey,
  ReplayLevelCostState,
  sortInventoryReplayEvents,
} from '../services/InventoryRevaluationReplayService';

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
    private readonly movementRepo: IStockMovementRepository,
    private readonly revaluationRepo?: IInventoryRevaluationRepository,
    private readonly inventorySettingsRepo?: IInventorySettingsRepository
  ) {}

  async execute(companyId: string): Promise<ReconcileResult> {
    const [levels, movements, revaluations, settings] = await Promise.all([
      this.stockLevelRepo.getAllLevels(companyId),
      this.movementRepo.getMovementsByDateRange(companyId, '1900-01-01', '2999-12-31'),
      this.revaluationRepo?.getByStatus(companyId, 'POSTED') ?? Promise.resolve([]),
      this.inventorySettingsRepo?.getSettings(companyId) ?? Promise.resolve(null),
    ]);
    const costingBasis = settings?.costingBasis === 'GLOBAL' ? 'GLOBAL' : 'WAREHOUSE';

    const levelByKey = new Map<string, (typeof levels)[number]>();
    levels.forEach((level) => levelByKey.set(buildLevelKey(level.itemId, level.warehouseId), level));

    const replayByKey = this.replayStockState(movements, revaluations, costingBasis);

    const allKeys = new Set<string>([
      ...Array.from(levelByKey.keys()),
      ...Array.from(replayByKey.keys()),
    ]);

    const mismatches: ReconcileMismatch[] = [];
    const tolerance = 0.0001;

    for (const key of allKeys) {
      const level = levelByKey.get(key) || null;
      const [keyItemId, keyWarehouseId] = key.split('__');
      const replayed = replayByKey.get(key) || {
        itemId: keyItemId,
        warehouseId: keyWarehouseId ?? '',
        qtyOnHand: 0,
        avgCostBase: 0,
        avgCostCCY: 0,
      };

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
        const sourceItemId = level?.itemId ?? replayed.itemId;
        const sourceWarehouseId = level?.warehouseId ?? replayed.warehouseId;

        let reason: ReconcileMismatch['reason'];
        if (!level) reason = 'LEVEL_MISSING';
        else if (hasQtyMismatch && hasAvgMismatch) reason = 'QTY_AND_AVG_MISMATCH';
        else if (hasQtyMismatch) reason = 'QTY_MISMATCH';
        else reason = 'AVG_MISMATCH';

        mismatches.push({
          key,
          itemId: sourceItemId,
          warehouseId: sourceWarehouseId,
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

  private replayStockState(
    movements: Parameters<typeof buildInventoryReplayEvents>[0],
    revaluations: Parameters<typeof buildInventoryReplayEvents>[1],
    costingBasis: 'WAREHOUSE' | 'GLOBAL'
  ): Map<string, ReplayLevelCostState> {
    const state = new Map<string, ReplayLevelCostState>();
    const events = sortInventoryReplayEvents(buildInventoryReplayEvents(movements, revaluations));

    for (const event of events) {
      if (event.kind === 'MOVEMENT') {
        applyMovementToReplayState(state, event.movement);
      } else {
        applyRevaluationToReplayState(state, event.revaluation, costingBasis);
      }
    }

    return state;
  }
}
