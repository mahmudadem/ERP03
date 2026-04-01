
import { Item } from '../../../domain/inventory/entities/Item';
import { IItemRepository, ItemListOptions } from '../../../repository/interfaces/inventory';
import { IItemCategoryRepository } from '../../../repository/interfaces/inventory/IItemCategoryRepository';
import { randomUUID } from 'crypto';

export interface CreateItemInput {
  companyId: string;
  code: string;
  name: string;
  description?: string;
  barcode?: string;
  type: Item['type'];
  categoryId?: string;
  brand?: string;
  tags?: string[];
  baseUom: string;
  purchaseUom?: string;
  salesUom?: string;
  costCurrency: string;
  trackInventory: boolean;
  revenueAccountId?: string;
  cogsAccountId?: string;
  inventoryAssetAccountId?: string;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  createdBy: string;
}

export class CreateItemUseCase {
  constructor(
    private readonly itemRepo: IItemRepository,
    private readonly categoryRepo?: IItemCategoryRepository
  ) {}

  async execute(data: CreateItemInput): Promise<Item> {
    const existing = await this.itemRepo.getItemByCode(data.companyId, data.code);
    if (existing) {
      throw new Error(`Item code already exists: ${data.code}`);
    }

    let revenueAccountId = data.revenueAccountId;
    let cogsAccountId = data.cogsAccountId;
    let inventoryAssetAccountId = data.inventoryAssetAccountId;

    if (data.categoryId && this.categoryRepo) {
      const category = await this.categoryRepo.getCategory(data.categoryId);
      if (category) {
        revenueAccountId = revenueAccountId || category.defaultRevenueAccountId;
        cogsAccountId = cogsAccountId || category.defaultCogsAccountId;
        inventoryAssetAccountId = inventoryAssetAccountId || category.defaultInventoryAssetAccountId;
      }
    }

    const now = new Date();
    const item = new Item(
      {
        id: randomUUID(),
        companyId: data.companyId,
        code: data.code,
        name: data.name,
        description: data.description,
        barcode: data.barcode,
        type: data.type,
        categoryId: data.categoryId,
        brand: data.brand,
        tags: data.tags,
        baseUom: data.baseUom,
        purchaseUom: data.purchaseUom,
        salesUom: data.salesUom,
        costCurrency: data.costCurrency,
        costingMethod: 'MOVING_AVG',
        trackInventory: data.trackInventory,
        revenueAccountId,
        cogsAccountId,
        inventoryAssetAccountId,
        minStockLevel: data.minStockLevel,
        maxStockLevel: data.maxStockLevel,
        reorderPoint: data.reorderPoint,
        active: true,
        createdBy: data.createdBy,
        createdAt: now,
        updatedAt: now,
      }
    );
    await this.itemRepo.createItem(item);
    return item;
  }
}

export class UpdateItemUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(id: string, data: Partial<Item>): Promise<Item> {
    const current = await this.repo.getItem(id);
    if (!current) {
      throw new Error(`Item not found: ${id}`);
    }

    if (data.costCurrency && data.costCurrency !== current.costCurrency) {
      const hasMovements = await this.repo.hasMovements(current.companyId, current.id);
      current.assertCostCurrencyChangeAllowed(data.costCurrency, hasMovements);
    }

    await this.repo.updateItem(id, data);
    const updated = await this.repo.getItem(id);
    if (!updated) throw new Error(`Item not found after update: ${id}`);
    return updated;
  }
}

export class GetItemUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(id: string): Promise<Item | null> {
    return this.repo.getItem(id);
  }
}

export class ListItemsUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(companyId: string, filters: ItemListOptions = {}): Promise<Item[]> {
    return this.repo.getCompanyItems(companyId, filters);
  }
}

export class DeleteItemUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(id: string): Promise<void> {
    await this.repo.setItemActive(id, false);
  }
}
