import { PrismaClient } from '@prisma/client';
import { IStockLevelRepository, StockLevelListOptions } from '../../../../repository/interfaces/inventory/IStockLevelRepository';
import { StockLevel } from '../../../../domain/inventory/entities/StockLevel';

export class PrismaStockLevelRepository implements IStockLevelRepository {
  constructor(private prisma: PrismaClient) {}

  async getLevel(companyId: string, itemId: string, warehouseId: string): Promise<StockLevel | null> {
    const record = await this.prisma.stockLevel.findUnique({
      where: {
        companyId_itemId_warehouseId: { companyId, itemId, warehouseId },
      },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getLevelsByItem(companyId: string, itemId: string, opts?: StockLevelListOptions): Promise<StockLevel[]> {
    const records = await this.prisma.stockLevel.findMany({
      where: { companyId, itemId },
      orderBy: { updatedAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async getLevelsByWarehouse(companyId: string, warehouseId: string, opts?: StockLevelListOptions): Promise<StockLevel[]> {
    const records = await this.prisma.stockLevel.findMany({
      where: { companyId, warehouseId },
      orderBy: { updatedAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async getAllLevels(companyId: string, opts?: StockLevelListOptions): Promise<StockLevel[]> {
    const records = await this.prisma.stockLevel.findMany({
      where: { companyId },
      orderBy: { updatedAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async upsertLevel(level: StockLevel): Promise<void> {
    await this.prisma.stockLevel.update({
      where: {
        companyId_itemId_warehouseId: {
          companyId: level.companyId,
          itemId: level.itemId,
          warehouseId: level.warehouseId,
        },
        version: level.version - 1,
      },
      data: {
        qtyOnHand: level.qtyOnHand,
        reservedQty: level.reservedQty,
        avgCostBase: level.avgCostBase,
        avgCostCCY: level.avgCostCCY,
        lastCostBase: level.lastCostBase,
        lastCostCCY: level.lastCostCCY,
        postingSeq: level.postingSeq,
        maxBusinessDate: level.maxBusinessDate,
        totalMovements: level.totalMovements,
        lastMovementId: level.lastMovementId || null,
        version: level.version,
      } as any,
    });
  }

  async getLevelInTransaction(
    transaction: unknown,
    companyId: string,
    itemId: string,
    warehouseId: string
  ): Promise<StockLevel | null> {
    const tx = transaction as any;
    const record = await tx.stockLevel.findUnique({
      where: {
        companyId_itemId_warehouseId: { companyId, itemId, warehouseId },
      },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async upsertLevelInTransaction(transaction: unknown, level: StockLevel): Promise<void> {
    const tx = transaction as any;
    await tx.stockLevel.update({
      where: {
        companyId_itemId_warehouseId: {
          companyId: level.companyId,
          itemId: level.itemId,
          warehouseId: level.warehouseId,
        },
        version: level.version - 1,
      },
      data: {
        qtyOnHand: level.qtyOnHand,
        reservedQty: level.reservedQty,
        avgCostBase: level.avgCostBase,
        avgCostCCY: level.avgCostCCY,
        lastCostBase: level.lastCostBase,
        lastCostCCY: level.lastCostCCY,
        postingSeq: level.postingSeq,
        maxBusinessDate: level.maxBusinessDate,
        totalMovements: level.totalMovements,
        lastMovementId: level.lastMovementId || null,
        version: level.version,
      } as any,
    });
  }

  private toDomain(record: any): StockLevel {
    return StockLevel.fromJSON({
      id: record.id,
      companyId: record.companyId,
      itemId: record.itemId,
      warehouseId: record.warehouseId,
      qtyOnHand: record.qtyOnHand,
      reservedQty: record.reservedQty,
      avgCostBase: record.avgCostBase,
      avgCostCCY: record.avgCostCCY,
      lastCostBase: record.lastCostBase,
      lastCostCCY: record.lastCostCCY,
      postingSeq: record.postingSeq,
      maxBusinessDate: record.maxBusinessDate || '1970-01-01',
      totalMovements: record.totalMovements,
      lastMovementId: record.lastMovementId || '',
      version: record.version,
      updatedAt: record.updatedAt,
    });
  }
}
