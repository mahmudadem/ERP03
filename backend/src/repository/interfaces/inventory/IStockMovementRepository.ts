
import { StockMovement, ReferenceType, MovementType, StockDirection } from '../../../domain/inventory/entities/StockMovement';

/**
 * Interface for Stock Movement history.
 */
export interface MovementQueryOptions {
  limit?: number;
  offset?: number;
  movementType?: MovementType;
  direction?: StockDirection;
}

export interface IStockMovementRepository {
  recordMovement(movement: StockMovement, transaction?: unknown): Promise<void>;
  getItemMovements(companyId: string, itemId: string, opts?: MovementQueryOptions): Promise<StockMovement[]>;
  getWarehouseMovements(companyId: string, warehouseId: string, opts?: MovementQueryOptions): Promise<StockMovement[]>;
  getMovementsByReference(companyId: string, referenceType: ReferenceType, referenceId: string): Promise<StockMovement[]>;
  getMovementByReference(
    companyId: string,
    referenceType: ReferenceType,
    referenceId: string,
    referenceLineId?: string
  ): Promise<StockMovement | null>;
  getMovementsByDateRange(companyId: string, from: string, to: string, opts?: MovementQueryOptions): Promise<StockMovement[]>;
  getUnsettledMovements(companyId: string): Promise<StockMovement[]>;
  getMovement(id: string): Promise<StockMovement | null>;
}
