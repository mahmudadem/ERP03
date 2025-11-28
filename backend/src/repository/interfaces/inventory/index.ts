
import { Item } from '../../../domain/inventory/entities/Item';
import { Warehouse } from '../../../domain/inventory/entities/Warehouse';
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';

/**
 * Interface for Item/Product access.
 */
export interface IItemRepository {
  createItem(item: Item): Promise<void>;
  updateItem(id: string, data: Partial<Item>): Promise<void>;
  setItemActive(id: string, active: boolean): Promise<void>;
  getItem(id: string): Promise<Item | null>;
  getCompanyItems(companyId: string): Promise<Item[]>;
}

/**
 * Interface for Warehouse management.
 */
export interface IWarehouseRepository {
  createWarehouse(warehouse: Warehouse): Promise<void>;
  updateWarehouse(id: string, data: Partial<Warehouse>): Promise<void>;
  getWarehouse(id: string): Promise<Warehouse | null>;
  getCompanyWarehouses(companyId: string): Promise<Warehouse[]>;
}

/**
 * Interface for Stock Movement history.
 */
export interface IStockMovementRepository {
  recordMovement(movement: StockMovement): Promise<void>;
  getItemMovements(itemId: string): Promise<StockMovement[]>;
  getWarehouseMovements(warehouseId: string): Promise<StockMovement[]>;
}
