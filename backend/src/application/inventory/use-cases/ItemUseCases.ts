
import { Item } from '../../../domain/inventory/entities/Item';
import { IItemRepository, ItemListOptions, IUomRepository } from '../../../repository/interfaces/inventory';
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
  baseUomId?: string;
  baseUom: string;
  purchaseUomId?: string;
  purchaseUom?: string;
  salesUomId?: string;
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

const trimOrUndefined = (value: any): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const stripUndefined = <T extends Record<string, any>>(value: T): T => {
  Object.keys(value).forEach((key) => {
    if (value[key] === undefined) {
      delete value[key];
    }
  });
  return value;
};

const resolveManagedUom = async (
  companyId: string,
  repo: IUomRepository | undefined,
  fieldName: string,
  uomId?: string,
  uomCode?: string,
  required = false
): Promise<{ uomId?: string; uom?: string }> => {
  const normalizedId = trimOrUndefined(uomId);
  const normalizedCode = trimOrUndefined(uomCode)?.toUpperCase();

  if (repo) {
    if (normalizedId) {
      const selected = await repo.getUom(normalizedId);
      if (!selected || selected.companyId !== companyId) {
        throw new Error(`${fieldName} UOM not found: ${normalizedId}`);
      }
      return { uomId: selected.id, uom: selected.code };
    }

    if (normalizedCode) {
      const selected = await repo.getUomByCode(companyId, normalizedCode);
      if (!selected) {
        throw new Error(`${fieldName} UOM not found: ${normalizedCode}`);
      }
      return { uomId: selected.id, uom: selected.code };
    }
  }

  if (normalizedCode) {
    return { uomId: normalizedId, uom: normalizedCode };
  }

  if (required) {
    throw new Error(`${fieldName} UOM is required`);
  }

  return { uomId: normalizedId };
};

const resolveItemUomFields = async (
  companyId: string,
  data: Partial<CreateItemInput> & Partial<Item>,
  repo?: IUomRepository
): Promise<Partial<Item>> => {
  const base = await resolveManagedUom(companyId, repo, 'base', data.baseUomId, data.baseUom, true);
  const purchase = await resolveManagedUom(companyId, repo, 'purchase', data.purchaseUomId, data.purchaseUom, false);
  const sales = await resolveManagedUom(companyId, repo, 'sales', data.salesUomId, data.salesUom, false);

  return stripUndefined({
    baseUomId: base.uomId,
    baseUom: base.uom,
    purchaseUomId: purchase.uomId,
    purchaseUom: purchase.uom,
    salesUomId: sales.uomId,
    salesUom: sales.uom,
  });
};

export class CreateItemUseCase {
  constructor(
    private readonly itemRepo: IItemRepository,
    private readonly categoryRepo?: IItemCategoryRepository,
    private readonly uomRepo?: IUomRepository
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

    const uomFields = await resolveItemUomFields(data.companyId, data, this.uomRepo);
    if (!uomFields.baseUom) {
      throw new Error('base UOM is required');
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
        baseUomId: uomFields.baseUomId,
        baseUom: uomFields.baseUom,
        purchaseUomId: uomFields.purchaseUomId,
        purchaseUom: uomFields.purchaseUom,
        salesUomId: uomFields.salesUomId,
        salesUom: uomFields.salesUom,
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
  constructor(
    private readonly repo: IItemRepository,
    private readonly uomRepo?: IUomRepository
  ) {}

  async execute(id: string, data: Partial<Item>): Promise<Item> {
    const current = await this.repo.getItem(id);
    if (!current) {
      throw new Error(`Item not found: ${id}`);
    }

    if (data.costCurrency && data.costCurrency !== current.costCurrency) {
      const hasMovements = await this.repo.hasMovements(current.companyId, current.id);
      current.assertCostCurrencyChangeAllowed(data.costCurrency, hasMovements);
    }

    const hasAnyUomField =
      data.baseUom !== undefined
      || data.baseUomId !== undefined
      || data.purchaseUom !== undefined
      || data.purchaseUomId !== undefined
      || data.salesUom !== undefined
      || data.salesUomId !== undefined;

    const uomFields = hasAnyUomField
      ? await resolveItemUomFields(current.companyId, { ...current, ...data }, this.uomRepo)
      : {};

    await this.repo.updateItem(id, stripUndefined({
      ...data,
      ...uomFields,
      updatedAt: new Date(),
    }) as Partial<Item>);
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
