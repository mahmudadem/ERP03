
import { Item } from '../../../domain/inventory/entities/Item';

/**
 * Interface for Item/Product access.
 */
export interface ItemListOptions {
  limit?: number;
  offset?: number;
  active?: boolean;
  type?: Item['type'];
  categoryId?: string;
}

export interface IItemRepository {
  createItem(item: Item): Promise<void>;
  updateItem(id: string, data: Partial<Item>): Promise<void>;
  setItemActive(id: string, active: boolean): Promise<void>;
  getItem(id: string): Promise<Item | null>;
  getCompanyItems(companyId: string, opts?: ItemListOptions): Promise<Item[]>;
  getItemByCode(companyId: string, code: string): Promise<Item | null>;
  getItemsByCategory(companyId: string, categoryId: string, opts?: ItemListOptions): Promise<Item[]>;
  searchItems(companyId: string, query: string, opts?: ItemListOptions): Promise<Item[]>;
  deleteItem(id: string): Promise<void>;
  hasMovements(companyId: string, itemId: string): Promise<boolean>;
}
