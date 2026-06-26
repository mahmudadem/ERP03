import { Item } from '../../../domain/inventory/entities/Item';
import { ItemListOptions } from '../../../repository/interfaces/inventory';
import { CreateItemInput } from '../catalog/use-cases/ItemUseCases';

export interface ICatalogCore {
  createItem(data: CreateItemInput): Promise<Item>;
  updateItem(id: string, data: Partial<Item>): Promise<Item>;
  getItem(id: string): Promise<Item | null>;
  listItems(companyId: string, filters?: ItemListOptions): Promise<Item[]>;
  searchItems(companyId: string, query: string, filters?: ItemListOptions): Promise<Item[]>;
  deleteItem(id: string): Promise<void>;
}
