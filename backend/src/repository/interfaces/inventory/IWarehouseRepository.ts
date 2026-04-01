
import { Warehouse } from '../../../domain/inventory/entities/Warehouse';

/**
 * Interface for Warehouse management.
 */
export interface WarehouseListOptions {
  limit?: number;
  offset?: number;
  active?: boolean;
}

export interface IWarehouseRepository {
  createWarehouse(warehouse: Warehouse): Promise<void>;
  updateWarehouse(id: string, data: Partial<Warehouse>): Promise<void>;
  getWarehouse(id: string): Promise<Warehouse | null>;
  getCompanyWarehouses(companyId: string, opts?: WarehouseListOptions): Promise<Warehouse[]>;
  getWarehouseByCode(companyId: string, code: string): Promise<Warehouse | null>;
}
