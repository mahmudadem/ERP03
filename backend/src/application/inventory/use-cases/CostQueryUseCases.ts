import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IStockLevelRepository } from '../../../repository/interfaces/inventory/IStockLevelRepository';

export interface CurrentCostResult {
  qtyOnHand: number;
  avgCostBase: number;
  avgCostCCY: number;
  lastCostBase: number;
  lastCostCCY: number;
  costBasis: 'AVG' | 'LAST_KNOWN' | 'MISSING';
}

export class GetCurrentCostUseCase {
  constructor(
    private readonly itemRepo: IItemRepository,
    private readonly stockLevelRepo: IStockLevelRepository
  ) {}

  async execute(companyId: string, itemId: string, warehouseId: string): Promise<CurrentCostResult> {
    if (!itemId?.trim()) throw new Error('itemId is required');
    if (!warehouseId?.trim()) throw new Error('warehouseId is required');

    const item = await this.itemRepo.getItem(itemId);
    if (!item || item.companyId !== companyId) {
      throw new Error(`Item not found: ${itemId}`);
    }

    const level = await this.stockLevelRepo.getLevel(companyId, itemId, warehouseId);

    const qtyOnHand = level?.qtyOnHand ?? 0;
    const avgCostBase = level?.avgCostBase ?? 0;
    const avgCostCCY = level?.avgCostCCY ?? 0;
    const lastCostBase = level?.lastCostBase ?? 0;
    const lastCostCCY = level?.lastCostCCY ?? 0;

    let costBasis: 'AVG' | 'LAST_KNOWN' | 'MISSING' = 'MISSING';
    if (qtyOnHand > 0) {
      costBasis = 'AVG';
    } else if (lastCostBase > 0) {
      costBasis = 'LAST_KNOWN';
    }

    return {
      qtyOnHand,
      avgCostBase,
      avgCostCCY,
      lastCostBase,
      lastCostCCY,
      costBasis,
    };
  }
}

