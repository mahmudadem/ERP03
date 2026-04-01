import { StockLevel } from '../../../domain/inventory/entities/StockLevel';

export interface StockLevelListOptions {
  limit?: number;
  offset?: number;
}

export interface IStockLevelRepository {
  getLevel(companyId: string, itemId: string, warehouseId: string): Promise<StockLevel | null>;
  getLevelsByItem(companyId: string, itemId: string, opts?: StockLevelListOptions): Promise<StockLevel[]>;
  getLevelsByWarehouse(companyId: string, warehouseId: string, opts?: StockLevelListOptions): Promise<StockLevel[]>;
  getAllLevels(companyId: string, opts?: StockLevelListOptions): Promise<StockLevel[]>;
  upsertLevel(level: StockLevel): Promise<void>;
  getLevelInTransaction(transaction: unknown, companyId: string, itemId: string, warehouseId: string): Promise<StockLevel | null>;
  upsertLevelInTransaction(transaction: unknown, level: StockLevel): Promise<void>;
}
