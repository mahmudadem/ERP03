import { InventoryRevaluation } from '../../../domain/inventory/entities/InventoryRevaluation';
import { InventoryCostingBasis } from '../../../domain/inventory/entities/InventorySettings';
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';

export interface ReplayLevelCostState {
  itemId: string;
  warehouseId: string;
  qtyOnHand: number;
  avgCostBase: number;
  avgCostCCY: number;
  lastCostBase?: number;
  lastCostCCY?: number;
}

export type InventoryReplayEvent =
  | { kind: 'MOVEMENT'; date: string; postedAt: Date; id: string; movement: StockMovement }
  | { kind: 'REVALUATION'; date: string; postedAt: Date; id: string; revaluation: InventoryRevaluation };

export const buildLevelKey = (itemId: string, warehouseId: string) => `${itemId}__${warehouseId}`;

export const sortInventoryReplayEvents = (events: InventoryReplayEvent[]): InventoryReplayEvent[] =>
  events.slice().sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;

    const postedCmp = a.postedAt.getTime() - b.postedAt.getTime();
    if (postedCmp !== 0) return postedCmp;

    if (a.kind !== b.kind) return a.kind === 'MOVEMENT' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

export const buildInventoryReplayEvents = (
  movements: StockMovement[],
  revaluations: InventoryRevaluation[] = []
): InventoryReplayEvent[] => [
  ...movements.map((movement) => ({
    kind: 'MOVEMENT' as const,
    date: movement.date,
    postedAt: movement.postedAt,
    id: movement.id,
    movement,
  })),
  ...revaluations
    .filter((revaluation) => revaluation.status === 'POSTED' && !!revaluation.postedAt)
    .map((revaluation) => ({
      kind: 'REVALUATION' as const,
      date: revaluation.date,
      postedAt: revaluation.postedAt!,
      id: revaluation.id,
      revaluation,
    })),
];

export const applyMovementToReplayState = (
  state: Map<string, ReplayLevelCostState>,
  movement: StockMovement
): void => {
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

  current.qtyOnHand = movement.qtyAfter;
  current.avgCostBase = movement.avgCostBaseAfter;
  current.avgCostCCY = movement.avgCostCCYAfter;

  if (movement.direction === 'IN') {
    current.lastCostBase = movement.unitCostBase;
    current.lastCostCCY = movement.unitCostCCY;
  }

  state.set(key, current);
};

export const applyRevaluationToReplayState = (
  state: Map<string, ReplayLevelCostState>,
  revaluation: InventoryRevaluation,
  costingBasis: InventoryCostingBasis
): void => {
  for (const line of revaluation.lines) {
    if (costingBasis === 'GLOBAL' || !line.warehouseId) {
      for (const level of state.values()) {
        if (level.itemId !== line.itemId || Math.abs(level.qtyOnHand) <= 0.0000001) continue;
        level.avgCostBase = line.newAvgCostBase;
        level.avgCostCCY = line.newAvgCostCCY;
        level.lastCostBase = line.newAvgCostBase;
        level.lastCostCCY = line.newAvgCostCCY;
      }
      continue;
    }

    const key = buildLevelKey(line.itemId, line.warehouseId);
    const level = state.get(key);
    if (!level || Math.abs(level.qtyOnHand) <= 0.0000001) continue;
    level.avgCostBase = line.newAvgCostBase;
    level.avgCostCCY = line.newAvgCostCCY;
    level.lastCostBase = line.newAvgCostBase;
    level.lastCostCCY = line.newAvgCostCCY;
  }
};
