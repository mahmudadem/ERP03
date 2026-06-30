import { Item } from '../../../domain/inventory/entities/Item';
import { ItemListOptions } from '../../../repository/interfaces/inventory';
import { CreateItemInput } from '../catalog/use-cases/ItemUseCases';

export interface ICatalogCore {
  createItem(data: CreateItemInput): Promise<Item>;
  updateItem(companyId: string, id: string, data: Partial<Item>): Promise<Item>;
  getItem(companyId: string, id: string): Promise<Item | null>;
  listItems(companyId: string, filters?: ItemListOptions): Promise<Item[]>;
  searchItems(companyId: string, query: string, filters?: ItemListOptions): Promise<Item[]>;
  deleteItem(companyId: string, id: string): Promise<void>;
}
