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
    await this.persistLevel(this.prisma, level);
  }

  private mutableLevelData(level: StockLevel): any {
    return {
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
    };
  }

  /**
   * Create-or-update with optimistic concurrency. The Firestore impl uses a blind
   * `.set()` (create-or-replace); a plain Prisma `update` cannot create the first
   * row, so the initial persistence of a brand-new level (version 1, with no prior
   * version-0 row) threw RecordNotFound — breaking stock receipt in SQL mode.
   *
   * This mirrors the upsert while KEEPING the version guard the SQL path intends:
   *   - row matches version-1  -> update (normal optimistic-concurrency path)
   *   - no row at all          -> insert (first persistence of a new level)
   *   - row exists, version off -> real concurrency conflict (throw)
   */
  private async persistLevel(client: any, level: StockLevel): Promise<void> {
    const updated = await client.stockLevel.updateMany({
      where: {
        companyId: level.companyId,
        itemId: level.itemId,
        warehouseId: level.warehouseId,
        version: level.version - 1,
      },
      data: this.mutableLevelData(level),
    });
    if (updated.count > 0) return;

    const existing = await client.stockLevel.findUnique({
      where: {
        companyId_itemId_warehouseId: {
          companyId: level.companyId,
          itemId: level.itemId,
          warehouseId: level.warehouseId,
        },
      },
      select: { version: true },
    });
    if (existing) {
      throw new Error(
        `StockLevel optimistic concurrency conflict for ${level.companyId}/${level.itemId}/${level.warehouseId}: ` +
          `expected version ${level.version - 1}, found ${existing.version}`
      );
    }

    await client.stockLevel.create({
      data: {
        id: level.id,
        companyId: level.companyId,
        itemId: level.itemId,
        warehouseId: level.warehouseId,
        ...this.mutableLevelData(level),
      },
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

  async getLevelsByItemInTransaction(
    transaction: unknown,
    companyId: string,
    itemId: string
  ): Promise<StockLevel[]> {
    const tx = transaction as any;
    const records = await tx.stockLevel.findMany({ where: { companyId, itemId } });
    return records.map((r: any) => this.toDomain(r));
  }

  async upsertLevelInTransaction(transaction: unknown, level: StockLevel): Promise<void> {
    await this.persistLevel(transaction as any, level);
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
