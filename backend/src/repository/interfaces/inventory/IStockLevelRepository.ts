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
  /**
   * Transaction-scoped read of EVERY warehouse level for one item. Used by GLOBAL
   * costing to compute the company-wide moving average atomically (the result set
   * participates in the transaction's optimistic lock, so the levels can be safely
   * re-written in the same transaction). Not needed by WAREHOUSE costing.
   */
  getLevelsByItemInTransaction(transaction: unknown, companyId: string, itemId: string): Promise<StockLevel[]>;
  upsertLevelInTransaction(transaction: unknown, level: StockLevel): Promise<void>;
}
