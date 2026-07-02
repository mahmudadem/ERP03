import { Prisma, PrismaClient } from '@prisma/client';
import { IItemCategoryRepository, CategoryListOptions } from '../../../../repository/interfaces/inventory/IItemCategoryRepository';
import { ItemCategory } from '../../../../domain/inventory/entities/ItemCategory';

export class PrismaItemCategoryRepository implements IItemCategoryRepository {
  constructor(private prisma: PrismaClient) {}

  async createCategory(category: ItemCategory): Promise<void> {
    await this.prisma.itemCategory.create({
      data: {
        id: category.id,
        companyId: category.companyId,
        code: category.id,
        name: category.name,
        parentId: category.parentId || null,
        description: null,
        ...(category).sortOrder !== undefined && { sortOrder: (category).sortOrder },
        ...(category).defaultRevenueAccountId !== undefined && { defaultRevenueAccountId: (category).defaultRevenueAccountId },
        ...(category).defaultCogsAccountId !== undefined && { defaultCogsAccountId: (category).defaultCogsAccountId },
        ...(category).defaultInventoryAssetAccountId !== undefined && { defaultInventoryAssetAccountId: (category).defaultInventoryAssetAccountId },
      },
    });
  }

  async updateCategory(id: string, data: Partial<ItemCategory>): Promise<void> {
    await this.prisma.itemCategory.update({
      where: { id },
      data: data,
    });
  }

  async getCategory(id: string): Promise<ItemCategory | null> {
    const record = await this.prisma.itemCategory.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getCompanyCategories(companyId: string, opts?: CategoryListOptions): Promise<ItemCategory[]> {
    const where: Prisma.ItemCategoryWhereInput = { companyId };
    if (opts?.active !== undefined) {
      where.active = opts.active;
    }
    const records = await this.prisma.itemCategory.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async getCategoriesByParent(companyId: string, parentId?: string, opts?: CategoryListOptions): Promise<ItemCategory[]> {
    const where: Prisma.ItemCategoryWhereInput = { companyId };
    if (parentId !== undefined) {
      where.parentId = parentId;
    } else {
      where.parentId = null;
    }
    if (opts?.active !== undefined) {
      where.active = opts.active;
    }
    const records = await this.prisma.itemCategory.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async deleteCategory(id: string): Promise<void> {
    await this.prisma.itemCategory.delete({
      where: { id },
    });
  }

  private toDomain(record: any): ItemCategory {
    return new ItemCategory({
      id: record.id,
      companyId: record.companyId,
      name: record.name,
      parentId: record.parentId ?? undefined,
      sortOrder: (record).sortOrder ?? 0,
      active: (record).active ?? true,
      defaultRevenueAccountId: (record).defaultRevenueAccountId ?? undefined,
      defaultCogsAccountId: (record).defaultCogsAccountId ?? undefined,
      defaultInventoryAssetAccountId: (record).defaultInventoryAssetAccountId ?? undefined,
    });
  }
}
