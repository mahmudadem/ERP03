import { randomUUID } from 'crypto';
import { ItemCategory } from '../../../domain/inventory/entities/ItemCategory';
import { IItemCategoryRepository } from '../../../repository/interfaces/inventory/IItemCategoryRepository';

export interface CreateCategoryInput {
  companyId: string;
  name: string;
  parentId?: string;
  sortOrder?: number;
  defaultRevenueAccountId?: string;
  defaultCogsAccountId?: string;
  defaultInventoryAssetAccountId?: string;
}

export class ManageCategoriesUseCase {
  constructor(private readonly repo: IItemCategoryRepository) {}

  async create(input: CreateCategoryInput): Promise<ItemCategory> {
    const category = new ItemCategory({
      id: randomUUID(),
      companyId: input.companyId,
      name: input.name,
      parentId: input.parentId,
      sortOrder: input.sortOrder ?? 0,
      active: true,
      defaultRevenueAccountId: input.defaultRevenueAccountId,
      defaultCogsAccountId: input.defaultCogsAccountId,
      defaultInventoryAssetAccountId: input.defaultInventoryAssetAccountId,
    });

    await this.repo.createCategory(category);
    return category;
  }

  async update(id: string, data: Partial<ItemCategory>): Promise<ItemCategory> {
    await this.repo.updateCategory(id, data);
    const updated = await this.repo.getCategory(id);
    if (!updated) throw new Error(`Category not found: ${id}`);
    return updated;
  }

  async list(companyId: string, parentId?: string): Promise<ItemCategory[]> {
    if (parentId !== undefined) {
      return this.repo.getCategoriesByParent(companyId, parentId);
    }

    return this.repo.getCompanyCategories(companyId);
  }

  async get(id: string): Promise<ItemCategory | null> {
    return this.repo.getCategory(id);
  }

  async delete(id: string): Promise<void> {
    await this.repo.updateCategory(id, { active: false } as Partial<ItemCategory>);
  }
}
