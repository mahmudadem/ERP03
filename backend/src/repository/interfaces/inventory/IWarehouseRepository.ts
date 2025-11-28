
import { Warehouse } from '../../../domain/inventory/entities/Warehouse';

/**
 * Interface for Warehouse management.
 */
export interface IWarehouseRepository {
  createWarehouse(warehouse: Warehouse): Promise<void>;
  updateWarehouse(id: string, data: Partial<Warehouse>): Promise<void>;
  getWarehouse(id: string): Promise<Warehouse | null>;
  getCompanyWarehouses(companyId: string): Promise<Warehouse[]>;
}
