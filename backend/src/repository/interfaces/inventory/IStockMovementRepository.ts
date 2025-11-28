
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';

/**
 * Interface for Stock Movement history.
 */
export interface IStockMovementRepository {
  recordMovement(movement: StockMovement): Promise<void>;
  getItemMovements(itemId: string): Promise<StockMovement[]>;
  getWarehouseMovements(warehouseId: string): Promise<StockMovement[]>;
}
