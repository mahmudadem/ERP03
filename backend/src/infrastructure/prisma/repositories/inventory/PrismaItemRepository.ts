import { PrismaClient } from '@prisma/client';
import { IItemRepository, ItemListOptions } from '../../../../repository/interfaces/inventory/IItemRepository';
import { Item } from '../../../../domain/inventory/entities/Item';

export class PrismaItemRepository implements IItemRepository {
  constructor(private prisma: PrismaClient) {}

  async createItem(item: Item): Promise<void> {
    await this.prisma.item.create({
      data: {
        id: item.id,
        companyId: item.companyId,
        code: item.code,
        name: item.name,
        description: item.description || null,
        barcode: item.barcode || null,
        type: item.type,
        categoryId: item.categoryId || null,
        brand: item.brand || null,
        tags: item.tags || [],
        baseUomId: item.baseUomId || null,
        baseUom: item.baseUom,
        purchaseUomId: item.purchaseUomId || null,
        purchaseUom: item.purchaseUom || null,
        salesUomId: item.salesUomId || null,
        salesUom: item.salesUom || null,
        costCurrency: item.costCurrency,
        costingMethod: item.costingMethod,
        trackInventory: item.trackInventory,
        revenueAccountId: item.revenueAccountId || null,
        cogsAccountId: item.cogsAccountId || null,
        inventoryAssetAccountId: item.inventoryAssetAccountId || null,
        defaultPurchaseTaxCodeId: item.defaultPurchaseTaxCodeId || null,
        defaultSalesTaxCodeId: item.defaultSalesTaxCodeId || null,
        minStockLevel: item.minStockLevel ?? null,
        maxStockLevel: item.maxStockLevel ?? null,
        reorderPoint: item.reorderPoint ?? null,
        imageUrl: item.imageUrl || null,
        metadata: (item.metadata as any) || null,
        active: item.active,
        createdBy: item.createdBy,
      } as any,
    });
  }

  async updateItem(id: string, data: Partial<Item>): Promise<void> {
    await this.prisma.item.update({
      where: { id },
      data: data as any,
    });
  }

  async setItemActive(id: string, active: boolean): Promise<void> {
    await this.prisma.item.update({
      where: { id },
      data: { active },
    });
  }

  async getItem(id: string): Promise<Item | null> {
    const record = await this.prisma.item.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getCompanyItems(companyId: string, opts?: ItemListOptions): Promise<Item[]> {
    const where: any = { companyId };
    if (opts?.active !== undefined) {
      where.active = opts.active;
    }
    if (opts?.type !== undefined) {
      where.type = opts.type;
    }
    if (opts?.categoryId !== undefined) {
      where.categoryId = opts.categoryId;
    }
    if (opts?.trackInventory !== undefined) {
      where.trackInventory = opts.trackInventory;
    }
    const records = await this.prisma.item.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async getItemByCode(companyId: string, code: string): Promise<Item | null> {
    const record = await this.prisma.item.findFirst({
      where: { companyId, code },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getItemsByCategory(companyId: string, categoryId: string, opts?: ItemListOptions): Promise<Item[]> {
    const where: any = { companyId, categoryId };
    if (opts?.active !== undefined) {
      where.active = opts.active;
    }
    if (opts?.type !== undefined) {
      where.type = opts.type;
    }
    if (opts?.trackInventory !== undefined) {
      where.trackInventory = opts.trackInventory;
    }
    const records = await this.prisma.item.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async searchItems(companyId: string, query: string, opts?: ItemListOptions): Promise<Item[]> {
    const where: any = {
      companyId,
      OR: [
        { code: { contains: query, mode: 'insensitive' as any } },
        { name: { contains: query, mode: 'insensitive' as any } },
        { description: { contains: query, mode: 'insensitive' as any } },
        { barcode: { contains: query, mode: 'insensitive' as any } },
        { brand: { contains: query, mode: 'insensitive' as any } },
      ],
    };
    if (opts?.active !== undefined) {
      where.active = opts.active;
    }
    if (opts?.type !== undefined) {
      where.type = opts.type;
    }
    if (opts?.categoryId !== undefined) {
      where.categoryId = opts.categoryId;
    }
    if (opts?.trackInventory !== undefined) {
      where.trackInventory = opts.trackInventory;
    }
    const records = await this.prisma.item.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async deleteItem(id: string): Promise<void> {
    await this.prisma.item.delete({
      where: { id },
    });
  }

  async hasMovements(companyId: string, itemId: string): Promise<boolean> {
    const count = await this.prisma.stockMovement.count({
      where: { companyId, itemId },
    });
    return count > 0;
  }

  private toDomain(record: any): Item {
    return Item.fromJSON({
      id: record.id,
      companyId: record.companyId,
      code: record.code,
      name: record.name,
      description: record.description,
      barcode: record.barcode,
      type: record.type,
      categoryId: record.categoryId,
      brand: record.brand,
      tags: record.tags,
      baseUomId: record.baseUomId,
      baseUom: record.baseUom,
      purchaseUomId: record.purchaseUomId,
      purchaseUom: record.purchaseUom,
      salesUomId: record.salesUomId,
      salesUom: record.salesUom,
      costCurrency: record.costCurrency,
      costingMethod: record.costingMethod,
      trackInventory: record.trackInventory,
      revenueAccountId: record.revenueAccountId,
      cogsAccountId: record.cogsAccountId,
      inventoryAssetAccountId: record.inventoryAssetAccountId,
      defaultPurchaseTaxCodeId: record.defaultPurchaseTaxCodeId,
      defaultSalesTaxCodeId: record.defaultSalesTaxCodeId,
      minStockLevel: record.minStockLevel,
      maxStockLevel: record.maxStockLevel,
      reorderPoint: record.reorderPoint,
      imageUrl: record.imageUrl,
      metadata: record.metadata,
      active: record.active,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
