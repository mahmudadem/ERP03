import { Item } from '../../../domain/inventory/entities/Item';
import { ItemListOptions } from '../../../repository/interfaces/inventory';
import { ICatalogCore } from '../contracts/ICatalogCore';
import {
  CreateItemInput,
  CreateItemUseCase,
  DeleteItemUseCase,
  GetItemUseCase,
  ListItemsUseCase,
  SearchItemsUseCase,
  UpdateItemUseCase,
} from './use-cases/ItemUseCases';

export class CatalogCore implements ICatalogCore {
  constructor(
    private readonly createItemUseCase: CreateItemUseCase,
    private readonly updateItemUseCase: UpdateItemUseCase,
    private readonly getItemUseCase: GetItemUseCase,
    private readonly listItemsUseCase: ListItemsUseCase,
    private readonly searchItemsUseCase: SearchItemsUseCase,
    private readonly deleteItemUseCase: DeleteItemUseCase
  ) {}

  async createItem(data: CreateItemInput): Promise<Item> {
    return this.createItemUseCase.execute(data);
  }

  async updateItem(companyId: string, id: string, data: Partial<Item>): Promise<Item> {
    return this.updateItemUseCase.execute(companyId, id, data);
  }

  async getItem(companyId: string, id: string): Promise<Item | null> {
    return this.getItemUseCase.execute(companyId, id);
  }

  async listItems(companyId: string, filters?: ItemListOptions): Promise<Item[]> {
    return this.listItemsUseCase.execute(companyId, filters);
  }

  async searchItems(companyId: string, query: string, filters?: ItemListOptions): Promise<Item[]> {
    return this.searchItemsUseCase.execute(companyId, query, filters);
  }

  async deleteItem(companyId: string, id: string): Promise<void> {
    return this.deleteItemUseCase.execute(companyId, id);
  }
}
