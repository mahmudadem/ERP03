import { ItemCategory } from '../../../domain/inventory/entities/ItemCategory';

export interface CategoryListOptions {
  limit?: number;
  offset?: number;
  active?: boolean;
}

export interface IItemCategoryRepository {
  createCategory(category: ItemCategory): Promise<void>;
  updateCategory(id: string, data: Partial<ItemCategory>): Promise<void>;
  getCategory(id: string): Promise<ItemCategory | null>;
  getCompanyCategories(companyId: string, opts?: CategoryListOptions): Promise<ItemCategory[]>;
  getCategoriesByParent(companyId: string, parentId?: string, opts?: CategoryListOptions): Promise<ItemCategory[]>;
  deleteCategory(id: string): Promise<void>;
}
