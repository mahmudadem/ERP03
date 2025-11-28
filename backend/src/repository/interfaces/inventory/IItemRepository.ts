
import { Item } from '../../../domain/inventory/entities/Item';

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
