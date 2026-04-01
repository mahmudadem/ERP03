import { StockMovement } from '../../../domain/inventory/entities/StockMovement';
import { IStockMovementRepository } from '../../../repository/interfaces/inventory/IStockMovementRepository';

export interface MovementHistoryFilters {
  itemId?: string;
  warehouseId?: string;
  referenceType?: string;
  referenceId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export class GetMovementHistoryUseCase {
  constructor(private readonly movementRepo: IStockMovementRepository) {}

  async execute(companyId: string, filters: MovementHistoryFilters = {}): Promise<StockMovement[]> {
    const opts = {
      limit: filters.limit,
      offset: filters.offset,
    };

    if (filters.itemId) {
      return this.movementRepo.getItemMovements(companyId, filters.itemId, opts);
    }

    if (filters.warehouseId) {
      return this.movementRepo.getWarehouseMovements(companyId, filters.warehouseId, opts);
    }

    if (filters.referenceType && filters.referenceId) {
      return this.movementRepo.getMovementsByReference(
        companyId,
        filters.referenceType as any,
        filters.referenceId
      );
    }

    if (filters.from && filters.to) {
      return this.movementRepo.getMovementsByDateRange(companyId, filters.from, filters.to, opts);
    }

    return this.movementRepo.getMovementsByDateRange(companyId, '1900-01-01', '2999-12-31', opts);
  }

  async getByItem(companyId: string, itemId: string, limit?: number, offset?: number): Promise<StockMovement[]> {
    return this.movementRepo.getItemMovements(companyId, itemId, { limit, offset });
  }
}
