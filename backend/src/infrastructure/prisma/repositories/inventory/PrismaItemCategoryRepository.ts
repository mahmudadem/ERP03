import { PrismaClient } from '@prisma/client';
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
        ...(category as any).sortOrder !== undefined && { sortOrder: (category as any).sortOrder },
        ...(category as any).defaultRevenueAccountId !== undefined && { defaultRevenueAccountId: (category as any).defaultRevenueAccountId },
        ...(category as any).defaultCogsAccountId !== undefined && { defaultCogsAccountId: (category as any).defaultCogsAccountId },
        ...(category as any).defaultInventoryAssetAccountId !== undefined && { defaultInventoryAssetAccountId: (category as any).defaultInventoryAssetAccountId },
      } as any,
    });
  }

  async updateCategory(id: string, data: Partial<ItemCategory>): Promise<void> {
    await this.prisma.itemCategory.update({
      where: { id },
      data: data as any,
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
    const where: any = { companyId };
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
    const where: any = { companyId };
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
      sortOrder: (record as any).sortOrder ?? 0,
      active: (record as any).active ?? true,
      defaultRevenueAccountId: (record as any).defaultRevenueAccountId ?? undefined,
      defaultCogsAccountId: (record as any).defaultCogsAccountId ?? undefined,
      defaultInventoryAssetAccountId: (record as any).defaultInventoryAssetAccountId ?? undefined,
    });
  }
}
