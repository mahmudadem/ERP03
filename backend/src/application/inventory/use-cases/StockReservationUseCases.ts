import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { IStockLevelRepository } from '../../../repository/interfaces/inventory/IStockLevelRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';

export interface StockReservationInput {
  companyId: string;
  itemId: string;
  warehouseId: string;
  qty: number;
}

const validateReservationInput = (input: StockReservationInput) => {
  if (!input.itemId?.trim()) throw new Error('itemId is required');
  if (!input.warehouseId?.trim()) throw new Error('warehouseId is required');
  if (input.qty <= 0 || Number.isNaN(input.qty)) {
    throw new Error('qty must be greater than 0');
  }
};

export class ReserveStockUseCase {
  constructor(
    private readonly stockLevelRepo: IStockLevelRepository,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(input: StockReservationInput): Promise<StockLevel> {
    validateReservationInput(input);

    return this.transactionManager.runTransaction(async (txn) => {
      let level = await this.stockLevelRepo.getLevelInTransaction(
        txn,
        input.companyId,
        input.itemId,
        input.warehouseId
      );

      if (!level) {
        level = StockLevel.createNew(input.companyId, input.itemId, input.warehouseId);
      }

      level.reservedQty += input.qty;
      level.version += 1;
      level.updatedAt = new Date();

      await this.stockLevelRepo.upsertLevelInTransaction(txn, level);
      return level;
    });
  }
}

export class ReleaseReservedStockUseCase {
  constructor(
    private readonly stockLevelRepo: IStockLevelRepository,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(input: StockReservationInput): Promise<StockLevel> {
    validateReservationInput(input);

    return this.transactionManager.runTransaction(async (txn) => {
      const level = await this.stockLevelRepo.getLevelInTransaction(
        txn,
        input.companyId,
        input.itemId,
        input.warehouseId
      );

      if (!level) {
        throw new Error(
          `Stock level not found for reservation release: ${input.itemId}_${input.warehouseId}`
        );
      }

      const nextReservedQty = level.reservedQty - input.qty;
      if (nextReservedQty < 0) {
        throw new Error('reservedQty cannot drop below 0');
      }

      level.reservedQty = nextReservedQty;
      level.version += 1;
      level.updatedAt = new Date();

      await this.stockLevelRepo.upsertLevelInTransaction(txn, level);
      return level;
    });
  }
}

